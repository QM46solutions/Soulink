// Home feed: posts from people you're connected with (and your own), newest first.
import { Router } from 'express';
import { many, one } from '../db.js';
import { ah } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { userCard } from '../services/social.js';

const r = Router();
r.use(requireAuth);

r.get('/', ah(async (req, res) => {
  const me = req.user.id;
  const conn = await one(
    `SELECT COUNT(*) AS n FROM follows WHERE status=N'accepted' AND (follower_id=$1 OR followee_id=$1)`, [me],
  );
  const rows = await many(
    `SELECT TOP 50 p.id AS post_id, p.caption, p.media_urls, p.created_at AS post_at,
            u.id, u.username, u.display_name, u.avatar_url, u.is_private, u.face_verified, u.soul_type
       FROM posts p JOIN users u ON u.id = p.author_id
      WHERE p.deleted_at IS NULL AND p.is_anonymous = 0
        AND (p.author_id = $1 OR p.author_id IN (SELECT followee_id FROM follows WHERE follower_id=$1 AND status=N'accepted'))
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=p.author_id) OR (b.blocker_id=p.author_id AND b.blocked_id=$1))
      ORDER BY p.created_at DESC`,
    [me],
  );
  res.json({
    connections: Number(conn?.n || 0),
    posts: rows.map((x) => ({ id: x.post_id, caption: x.caption, media: JSON.parse(x.media_urls || '[]'), createdAt: x.post_at, author: userCard(x) })),
  });
}));

export default r;
