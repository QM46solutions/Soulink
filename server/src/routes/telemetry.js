// What the app sends for the team console: how long screens take, "Report a problem", and crashes.
//  POST /telemetry/screens   { items: [{ screen, ms, platform, appVersion }] }  (batched, at most 30)
//  POST /telemetry/problem   { details, screen?, platform, appVersion }
//  POST /telemetry/crash     { message, platform, appVersion }  (same crash again adds to its count)
import { Router } from 'express';
import { z } from 'zod';
import { one, query } from '../db.js';
import { ah } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';

const r = Router();
r.use(requireAuth);
const plat = z.enum(['android', 'ios', 'web']).optional();
const ver = z.string().max(20).optional();

r.post('/screens', ah(async (req, res) => {
  const d = z.object({ items: z.array(z.object({ screen: z.string().trim().min(1).max(60), ms: z.number().int().min(1).max(120000), platform: plat, appVersion: ver })).max(30) }).parse(req.body);
  for (const x of d.items) {
    await query('INSERT INTO screen_timings (screen, platform, ms, app_version) VALUES ($1, $2, $3, $4)', [x.screen, x.platform || null, x.ms, x.appVersion || null]).catch(() => {});
  }
  res.json({ ok: true });
}));
r.post('/problem', ah(async (req, res) => {
  const d = z.object({ details: z.string().trim().min(3).max(2000), screen: z.string().max(60).optional(), platform: plat, appVersion: ver }).parse(req.body);
  const title = `${d.screen ? `${d.screen}: ` : ''}${d.details.split('\n')[0].slice(0, 150)}`;
  const x = await one(`INSERT INTO app_issues (title, details, source, user_id, platform, app_version) OUTPUT INSERTED.id VALUES ($1, $2, N'user', $3, $4, $5)`,
    [title, d.details, req.user.id, d.platform || null, d.appVersion || null]);
  res.json({ ok: true, ref: `SL-${x.id}` });
}));
r.post('/crash', ah(async (req, res) => {
  const d = z.object({ message: z.string().trim().min(1).max(1500), platform: plat, appVersion: ver }).parse(req.body);
  const title = `Crash: ${d.message.split('\n')[0].slice(0, 180)}`;
  const same = await one(`SELECT TOP 1 id FROM app_issues WHERE source = N'crash' AND title = $1 AND status IN (N'new', N'progress')`, [title]);
  if (same) await query('UPDATE app_issues SET reports = reports + 1, updated_at = SYSDATETIMEOFFSET() WHERE id=$1', [same.id]);
  else await query(`INSERT INTO app_issues (title, details, source, severity, user_id, platform, app_version) VALUES ($1, $2, N'crash', N'high', $3, $4, $5)`, [title, d.message, req.user.id, d.platform || null, d.appVersion || null]);
  res.json({ ok: true });
}));

export default r;
