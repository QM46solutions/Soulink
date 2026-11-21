// Home feed: my posts + posts from my Soul Connections (and public people I follow), newest first.
import { Router } from 'express';
import { many, one, query } from '../db.js';
import { ah } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { POST_SELECT, postView } from './posts.js';
import { NOT_MUTED_OR_HIDDEN } from '../services/privacy.js';
import { ageOf } from '../services/spread.js';

const r = Router();
r.use(requireAuth);

r.get('/', ah(async (req, res) => {
  const me = req.user.id;
  const conn = await one('SELECT COUNT(*) AS n FROM connections WHERE user_a=$1 OR user_b=$1', [me]);
  const rows = await many(
    `${POST_SELECT}
      WHERE p.deleted_at IS NULL AND p.is_anonymous = 0 AND p.archived_at IS NULL AND (p.suspended_at IS NULL OR p.author_id = $1)
        AND ${NOT_MUTED_OR_HIDDEN}
        AND NOT EXISTS (SELECT 1 FROM users du WHERE du.id = p.author_id AND du.deactivated_at IS NOT NULL)
        AND (p.author_id = $1
          OR p.author_id IN (SELECT CASE WHEN c.user_a=$1 THEN c.user_b ELSE c.user_a END FROM connections c WHERE c.user_a=$1 OR c.user_b=$1)
          OR (u.is_private = 0 AND p.author_id IN (SELECT followee_id FROM follows WHERE follower_id=$1 AND status=N'accepted'))) -- private accounts: Connections only
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=p.author_id) OR (b.blocker_id=p.author_id AND b.blocked_id=$1))
      ORDER BY p.created_at DESC
      OFFSET 0 ROWS FETCH NEXT 60 ROWS ONLY`,
    [me],
  );
  const posts = rows.map((x) => postView(x, me));
  // Boost: up to 2 boosted posts from public accounts this person doesn't follow yet (their city / age), at about the 3rd and 9th spot
  try {
    const boosted = await many(`SELECT TOP 2 sp.id AS spread_id, x.* FROM post_spreads sp
        CROSS APPLY (${POST_SELECT}
          WHERE p.id = sp.post_id AND p.deleted_at IS NULL AND p.is_anonymous = 0 AND p.archived_at IS NULL AND p.suspended_at IS NULL
            AND u.is_private = 0 AND u.deactivated_at IS NULL AND ${NOT_MUTED_OR_HIDDEN}
            AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=p.author_id) OR (b.blocker_id=p.author_id AND b.blocked_id=$1))) x
        WHERE sp.status IN (N'active', N'test') AND sp.ends_at > SYSDATETIMEOFFSET() AND sp.user_id <> $1
          AND (sp.city IS NULL OR sp.city = $2)
          AND ($3 IS NULL OR ($3 BETWEEN sp.age_min AND sp.age_max))
        ORDER BY NEWID()`, [me, req.user.city || '', ageOf(req.user)]);
    let at = 2;
    for (const b of boosted) {
      const v = postView(b, me);
      const i = posts.findIndex((x) => x.id === v.id);
      if (i >= 0) posts.splice(i, 1);
      posts.splice(Math.min(at, posts.length), 0, v); at += 6;
      await query('UPDATE post_spreads SET impressions = impressions + 1 WHERE id = $1', [b.spread_id]).catch(() => {});
    }
  } catch { /* the feed still works without boosts */ }
  res.json({ connections: Number(conn?.n || 0), posts });
}));

export default r;
