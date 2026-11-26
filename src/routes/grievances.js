// Complaints to the Grievance Officer (see services/legal.js for the deadlines).
//  GET  /grievances/categories   the choices shown in the form
//  POST /grievances              anyone, logged in or not: file a complaint; the reply email is the acknowledgement
//  GET  /grievances/mine         my complaints and their status (logged in)
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { many } from '../db.js';
import { config } from '../config.js';
import { ah } from '../lib/errors.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { CATEGORIES, fileGrievance, grievanceView, RESOLVE_DAYS, URGENT_HOURS } from '../services/legal.js';

const r = Router();

r.get('/categories', (req, res) => res.json({ categories: Object.entries(CATEGORIES).map(([key, text]) => ({ key, text })), resolveDays: RESOLVE_DAYS, urgentHours: URGENT_HOURS }));

r.post('/', rateLimit({ windowMs: 3600_000, limit: config.env === 'test' ? 1000 : 10 }), optionalAuth, ah(async (req, res) => {
  const d = z.object({
    name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254), phone: z.string().trim().max(30).optional(),
    category: z.enum(Object.keys(CATEGORIES)),
    aboutUrl: z.string().trim().max(500).optional(), aboutUsername: z.string().trim().max(41).transform((v) => v.replace(/^@/, '')).optional(),
    details: z.string().trim().min(20, 'Please tell us a little more (at least 20 characters)').max(2000),
  }).parse(req.body || {});
  const g = await fileGrievance(d, req);
  res.status(201).json({ ok: true, ticket: g.ticket_no, urgent: !!g.urgent, dueAt: g.due_at });
}));

r.get('/mine', requireAuth, ah(async (req, res) => {
  const rows = await many('SELECT TOP 30 * FROM grievances WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]);
  res.json({ complaints: rows.map((g) => { const v = grievanceView(g); delete v.handledBy; return v; }) });
}));

export default r;
