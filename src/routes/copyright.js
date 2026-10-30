// Copyright (see services/copyright.js for the whole process)
//  POST /copyright/reports              anyone (no login): a rights owner's notice
//  GET  /copyright/mine                 my content that was reported / removed, and my strikes
//  POST /copyright/:id/appeal  { text } contest a removal of my content
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { many, one } from '../db.js';
import { config } from '../config.js';
import { ah, badRequest, forbidden, notFound } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { appeal, fileReport, parseContentUrl, reportView, STRIKE_DAYS } from '../services/copyright.js';

const r = Router();
const yes = z.literal(true, { message: 'Please confirm every statement' });

r.post('/reports', rateLimit({ windowMs: 3600_000, limit: config.env === 'test' ? 1000 : 10 }), ah(async (req, res) => {
  const d = z.object({
    name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254), phone: z.string().trim().max(30).optional(),
    address: z.string().trim().min(10).max(400),
    relationship: z.enum(['owner', 'agent']), rightsOwner: z.string().trim().min(2).max(200),
    work: z.string().trim().min(10).max(1000), originalUrl: z.string().trim().url().max(500).optional().or(z.literal('')),
    proof: z.string().trim().max(1000).optional(), contentUrl: z.string().trim().min(10).max(500),
    explanation: z.string().trim().max(1000).optional(),
    goodFaith: yes, accurate: yes, suitUndertaking: yes, signature: z.string().trim().min(2).max(120),
  }).parse(req.body || {});
  const target = parseContentUrl(d.contentUrl);
  if (!target) throw badRequest('Paste the link to the Spark or post on Soulink (it contains /spark/ or /post/).', 'bad_link');
  const rep = await fileReport({ ...d, ...target }, req);
  if (!rep) throw notFound('We could not find that Spark or post. It may already have been deleted.');
  res.status(201).json({ ok: true, reference: String(rep.id).slice(0, 8) });
}));

r.get('/mine', requireAuth, ah(async (req, res) => {
  const rows = await many(`SELECT TOP 50 * FROM copyright_reports WHERE uploader_id=$1 AND status IN (N'removed', N'restored', N'court_order') ORDER BY created_at DESC`, [req.user.id]);
  const s = await one(`SELECT COUNT(*) AS n FROM copyright_strikes WHERE user_id=$1 AND removed_at IS NULL AND created_at > DATEADD(DAY, -${STRIKE_DAYS}, SYSDATETIMEOFFSET())`, [req.user.id]);
  res.json({ notices: rows.map((x) => reportView(x, true)), strikes: Number(s?.n || 0), postingBlockedUntil: req.user.posting_blocked_until || null });
}));

r.post('/:id/appeal', requireAuth, ah(async (req, res) => {
  const { text } = z.object({ text: z.string().trim().min(20, 'Tell us why in a sentence or two').max(1000), confirm: yes }).parse(req.body || {});
  const rep = await one('SELECT * FROM copyright_reports WHERE id=$1', [req.params.id]);
  if (!rep || String(rep.uploader_id).toLowerCase() !== String(req.user.id).toLowerCase()) throw notFound('Notice not found');
  if (rep.status !== 'removed') throw forbidden('This notice can no longer be contested', 'not_contestable');
  if (rep.appealed_at) throw badRequest('You already contested this removal', 'already_appealed');
  await appeal(rep, text, req);
  res.json({ ok: true });
}));

export default r;
