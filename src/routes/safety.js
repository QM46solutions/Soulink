import { Router } from 'express';
import { z } from 'zod';
import { one, many, tx } from '../db.js';
import { ah, badRequest, notFound } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { userCard } from '../services/social.js';

const r = Router();
r.use(requireAuth);

const uuid = z.string().uuid().transform((v) => v.toLowerCase());

r.post('/blocks/:id', ah(async (req, res) => {
  const id = uuid.parse(req.params.id);
  if (id === req.user.id) throw badRequest("You can't block yourself");
  if (!(await one('SELECT TOP 1 1 AS x FROM users WHERE id=$1', [id]))) throw notFound('User not found');
  await tx(async (c) => {
    await c.query('IF NOT EXISTS (SELECT 1 FROM blocks WHERE blocker_id=$1 AND blocked_id=$2) INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)', [req.user.id, id]);
    // Blocking removes follows (and requests) in both directions
    await c.query('DELETE FROM follows WHERE (follower_id=$1 AND followee_id=$2) OR (follower_id=$2 AND followee_id=$1)', [req.user.id, id]);
  });
  res.json({ blocked: true });
}));

r.delete('/blocks/:id', ah(async (req, res) => {
  await one('DELETE FROM blocks WHERE blocker_id=$1 AND blocked_id=$2', [req.user.id, uuid.parse(req.params.id)]);
  res.json({ blocked: false });
}));

r.get('/blocks', ah(async (req, res) => {
  const rows = await many(
    'SELECT u.* FROM blocks b JOIN users u ON u.id=b.blocked_id WHERE b.blocker_id=$1 ORDER BY b.created_at DESC',
    [req.user.id],
  );
  res.json({ users: rows.map(userCard) });
}));

export const REPORT_REASONS = ['spam', 'fake_account', 'harassment', 'hate_speech', 'nudity', 'violence', 'scam', 'underage', 'other'];

r.post('/reports', ah(async (req, res) => {
  const data = z.object({
    targetType: z.enum(['user', 'post', 'comment', 'message', 'case', 'story']),
    targetId: uuid,
    reason: z.enum(REPORT_REASONS),
    details: z.string().max(1000).optional(),
  }).parse(req.body);
  const row = await one(
    `INSERT INTO reports (reporter_id, target_type, target_id, reason, details) OUTPUT INSERTED.id VALUES ($1, $2, $3, $4, $5)`,
    [req.user.id, data.targetType, data.targetId, data.reason, data.details ?? null],
  );
  res.status(201).json({ id: row.id, message: 'Thanks. Our team will review this.' });
}));

r.get('/reports/reasons', (req, res) => res.json({ reasons: REPORT_REASONS }));

export default r;
