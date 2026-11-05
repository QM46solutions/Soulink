import { Router } from 'express';
import { many, one, query } from '../db.js';
import { ah } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { userCard } from '../services/social.js';

const r = Router();
r.use(requireAuth);

r.get('/', ah(async (req, res) => {
  const rows = await many(
    `SELECT TOP 100 n.*, u.id AS a_id, u.username AS a_username, u.display_name AS a_display, u.avatar_url AS a_avatar,
            u.is_private AS a_private, u.face_verified AS a_verified
       FROM notifications n LEFT JOIN users u ON u.id = n.actor_id
      WHERE n.user_id=$1
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=n.actor_id) OR (b.blocker_id=n.actor_id AND b.blocked_id=$1))
      ORDER BY n.created_at DESC`,
    [req.user.id],
  );
  const unread = await one('SELECT COUNT(*) AS n FROM notifications WHERE user_id=$1 AND read_at IS NULL', [req.user.id]);
  res.json({
    unread: unread.n,
    notifications: rows.map((n) => ({
      id: n.id,
      type: n.type,
      entityId: n.entity_id,
      meta: n.meta ? (typeof n.meta === 'string' ? JSON.parse(n.meta) : n.meta) : null,
      read: !!n.read_at,
      createdAt: n.created_at,
      actor: n.a_id ? userCard({ id: n.a_id, username: n.a_username, display_name: n.a_display, avatar_url: n.a_avatar, is_private: n.a_private, face_verified: n.a_verified }) : null,
    })),
  });
}));

// Unread count for the bell badge
r.get('/unread', ah(async (req, res) => {
  const row = await one(
    `SELECT COUNT(*) AS n FROM notifications n WHERE n.user_id=$1 AND n.read_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=n.actor_id) OR (b.blocker_id=n.actor_id AND b.blocked_id=$1))`, [req.user.id],
  );
  res.json({ count: Number(row?.n || 0) });
}));

r.post('/read', ah(async (req, res) => {
  await query('UPDATE notifications SET read_at=SYSDATETIMEOFFSET() WHERE user_id=$1 AND read_at IS NULL', [req.user.id]);
  res.json({ ok: true });
}));

export default r;
