// Home feed: my posts + posts from my Soul Connections (and people I follow), newest first.
import { Router } from 'express';
import { many, one } from '../db.js';
import { ah } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { POST_SELECT, postView } from './posts.js';

const r = Router();
r.use(requireAuth);

r.get('/', ah(async (req, res) => {
  const me = req.user.id;
  const conn = await one('SELECT COUNT(*) AS n FROM connections WHERE user_a=$1 OR user_b=$1', [me]);
  const rows = await many(
    `${POST_SELECT}
      WHERE p.deleted_at IS NULL AND p.is_anonymous = 0 AND (p.suspended_at IS NULL OR p.author_id = $1)
        AND NOT EXISTS (SELECT 1 FROM users du WHERE du.id = p.author_id AND du.deactivated_at IS NOT NULL)
        AND (p.author_id = $1
          OR p.author_id IN (SELECT CASE WHEN c.user_a=$1 THEN c.user_b ELSE c.user_a END FROM connections c WHERE c.user_a=$1 OR c.user_b=$1)
          OR p.author_id IN (SELECT followee_id FROM follows WHERE follower_id=$1 AND status=N'accepted'))
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=p.author_id) OR (b.blocker_id=p.author_id AND b.blocked_id=$1))
      ORDER BY p.created_at DESC
      OFFSET 0 ROWS FETCH NEXT 60 ROWS ONLY`,
    [me],
  );
  res.json({ connections: Number(conn?.n || 0), posts: rows.map((x) => postView(x, me)) });
}));

export default r;
