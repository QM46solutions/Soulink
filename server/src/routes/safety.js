import { Router } from 'express';
import { z } from 'zod';
import { one, many, tx } from '../db.js';
import { ah, badRequest, notFound } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { userCard } from '../services/social.js';
import { closeHeldChat, pairOf } from '../services/connections.js';

const r = Router();
r.use(requireAuth);

const uuid = z.string().uuid().transform((v) => v.toLowerCase());

r.post('/blocks/:id', ah(async (req, res) => {
  const id = uuid.parse(req.params.id);
  if (id === req.user.id) throw badRequest("You can't block yourself");
  if (!(await one('SELECT TOP 1 1 AS x FROM users WHERE id=$1', [id]))) throw notFound('User not found');
  const [pa, pb] = pairOf(req.user.id, id);
  const held = await tx(async (c) => {
    await c.query('IF NOT EXISTS (SELECT 1 FROM blocks WHERE blocker_id=$1 AND blocked_id=$2) INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)', [req.user.id, id]);
    // Blocking ends the relationship in both directions: follows, the Connection and open Connect requests.
    // After an unblock they start from nothing and must Connect again (SLD-001, product rule confirmed 21 Nov 2026).
    await c.query('DELETE FROM follows WHERE (follower_id=$1 AND followee_id=$2) OR (follower_id=$2 AND followee_id=$1)', [req.user.id, id]);
    await c.query('DELETE FROM connections WHERE user_a=$1 AND user_b=$2', [pa, pb]);
    const closed = await c.query(`UPDATE connection_requests SET status=N'withdrawn', responded_at=SYSDATETIMEOFFSET() OUTPUT DELETED.status
      WHERE status IN (N'pending', N'held') AND ((from_id=$1 AND to_id=$2) OR (from_id=$2 AND to_id=$1))`, [req.user.id, id]);
    return closed.rows.some((x) => x.status === 'held');
  });
  if (held) await closeHeldChat(req.user.id, id); // the chat they had during a hold is hidden, as when a hold is rejected
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

export const REPORT_REASONS = ['child_safety', 'spam', 'fake_account', 'harassment', 'hate_speech', 'nudity', 'violence', 'scam', 'underage', 'other'];

r.post('/reports', ah(async (req, res) => {
  const data = z.object({
    targetType: z.enum(['user', 'post', 'comment', 'message', 'case', 'story', 'spark']),
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
