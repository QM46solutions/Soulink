// What the app sends for the team console: how long screens take, slow / failed requests, "Report a problem",
// and crashes (fatal and non-fatal). Older apps send fewer fields; everything new is optional.
//  POST /telemetry/screens   { items: [{ screen, ms, platform, appVersion, build? }] }            (batched, at most 30)
//  POST /telemetry/api       { items: [{ path, method, status, ms, platform, appVersion, build? }] } (slow or failed only)
//  POST /telemetry/problem   JSON or multipart (optional "screenshot" image):
//                            { details, category?, comments?, screen?, platform, appVersion, build?, osVersion?, device? }
//  POST /telemetry/crash     { message, fatal?, screen?, platform, appVersion, build?, osVersion?, device? }
// Never stored: passwords, codes, tokens, chat text. Paths are patterns (ids replaced), screens are route patterns.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { one, query } from '../db.js';
import { config } from '../config.js';
import { ah } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { saveFile, uploadMemory } from '../providers/storage.js';
import { clientKey } from '../lib/clientKey.js';

const r = Router();
r.use(requireAuth);
const plat = z.enum(['android', 'ios', 'web']).optional();
const ver = z.string().max(20).optional();
const short = (n) => z.string().trim().max(n).optional();
const device = { build: short(30), osVersion: short(30), device: short(80) };
const perUser = (limit) => rateLimit({ windowMs: 60 * 60_000, limit: config.env === 'test' ? 1000 : limit, keyGenerator: (req) => req.user?.id || clientKey(req), standardHeaders: true, legacyHeaders: false });

export const PROBLEM_CATEGORIES = ['App crashing', 'Screen not loading', 'Login or registration issue', 'Email verification issue', 'Slow performance or lag', 'Profile-related issue', 'Other'];

r.post('/screens', ah(async (req, res) => {
  const d = z.object({ items: z.array(z.object({ screen: z.string().trim().min(1).max(60), ms: z.number().int().min(1).max(120000), platform: plat, appVersion: ver, build: short(30) })).max(30) }).parse(req.body);
  for (const x of d.items) {
    await query('INSERT INTO screen_timings (screen, platform, ms, app_version, build) VALUES ($1, $2, $3, $4, $5)', [x.screen, x.platform || null, x.ms, x.appVersion || null, x.build || null]).catch(() => {});
  }
  res.json({ ok: true });
}));

// ids and long numbers in a path become :id, so nothing personal (usernames, ids) is kept
const pattern = (p) => String(p).split('?')[0].replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id').replace(/\/\d{3,}/g, '/:id').replace(/\/users\/[^/]+/, '/users/:name').slice(0, 80);
r.post('/api', perUser(120), ah(async (req, res) => {
  const d = z.object({ items: z.array(z.object({ path: z.string().trim().min(1).max(200), method: z.string().trim().max(8), status: z.number().int().min(0).max(999), ms: z.number().int().min(0).max(300000), platform: plat, appVersion: ver, build: short(30) })).max(30) }).parse(req.body);
  for (const x of d.items) {
    await query('INSERT INTO api_timings (path, method, status, ms, platform, app_version, build) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [pattern(x.path), x.method.toUpperCase(), x.status, x.ms, x.platform || null, x.appVersion || null, x.build || null]).catch(() => {});
  }
  res.json({ ok: true });
}));

// multipart (with a screenshot) or JSON; multer only runs for multipart requests
const maybeScreenshot = (req, res, next) => (req.is('multipart/form-data') ? uploadMemory('image', 8).single('screenshot')(req, res, next) : next());
r.post('/problem', perUser(10), maybeScreenshot, ah(async (req, res) => {
  const d = z.object({
    details: z.string().trim().min(3).max(2000), category: z.enum(PROBLEM_CATEGORIES).optional(), comments: short(1000),
    screen: short(60), platform: plat, appVersion: ver, ...device,
  }).parse(req.body || {});
  // the same text from the same person within 10 minutes is one report, not two
  const dup = await one(`SELECT TOP 1 id FROM app_issues WHERE source = N'user' AND user_id = $1 AND details = $2 AND created_at > DATEADD(MINUTE, -10, SYSDATETIMEOFFSET())`, [req.user.id, d.details]);
  if (dup) return res.json({ ok: true, ref: `SL-${dup.id}`, duplicate: true });
  const screenshot = req.file ? await saveFile(req.file, 'reports') : null;
  const title = `${d.category ? `${d.category}: ` : d.screen ? `${d.screen}: ` : ''}${d.details.split('\n')[0].slice(0, 150)}`.slice(0, 200);
  const x = await one(`INSERT INTO app_issues (title, details, source, user_id, platform, app_version, category, comments, build, os_version, device, screen, screenshot_url)
      OUTPUT INSERTED.id VALUES ($1, $2, N'user', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
  [title, d.details, req.user.id, d.platform || null, d.appVersion || null, d.category || null, d.comments || null, d.build || null, d.osVersion || null, d.device || null, d.screen || null, screenshot]);
  res.json({ ok: true, ref: `SL-${x.id}` });
}));

r.post('/crash', perUser(60), ah(async (req, res) => {
  const d = z.object({ message: z.string().trim().min(1).max(1500), fatal: z.boolean().optional(), screen: short(60), platform: plat, appVersion: ver, ...device }).parse(req.body);
  const fatal = d.fatal !== false; // older apps only report crashes that stop the app
  const title = `${fatal ? 'Crash' : 'Non-fatal'}: ${d.message.split('\n')[0].slice(0, 180)}`;
  // the same crash on the same version adds to its count, so the team sees how many people it hits
  const same = await one(`SELECT TOP 1 id FROM app_issues WHERE source = N'crash' AND title = $1 AND ISNULL(app_version, N'') = $2 AND status IN (N'new', N'progress')`, [title, d.appVersion || '']);
  if (same) await query('UPDATE app_issues SET reports = reports + 1, updated_at = SYSDATETIMEOFFSET() WHERE id=$1', [same.id]);
  else {
    await query(`INSERT INTO app_issues (title, details, source, severity, user_id, platform, app_version, build, os_version, device, screen, fatal)
      VALUES ($1, $2, N'crash', $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [title, d.message, fatal ? 'high' : 'medium', req.user.id, d.platform || null, d.appVersion || null, d.build || null, d.osVersion || null, d.device || null, d.screen || null, fatal ? 1 : 0]);
  }
  res.json({ ok: true });
}));

/** Daily: timings older than 90 days are deleted (they're only for trends). */
export async function purgeTelemetry() {
  await query('DELETE FROM screen_timings WHERE created_at < DATEADD(DAY, -90, SYSDATETIMEOFFSET())').catch(() => {});
  await query('DELETE FROM api_timings WHERE created_at < DATEADD(DAY, -90, SYSDATETIMEOFFSET())').catch(() => {});
}

export default r;
