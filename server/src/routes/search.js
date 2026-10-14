import { Router } from 'express';
import { z } from 'zod';
import { many, query } from '../db.js';
import { ah } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { userCard } from '../services/social.js';

const r = Router();
r.use(requireAuth);

// GET /search/users?q=ravi  — username/name prefix first, then fuzzy matches
r.get('/users', ah(async (req, res) => {
  const q = z.string().trim().max(50).parse(req.query.q ?? '').toLowerCase().replace(/^@/, '');
  if (q.length < 1) return res.json({ users: [] });
  // Escape LIKE wildcards for SQL Server: [ % _
  const esc = q.replace(/[[%_]/g, (c) => `[${c}]`);
  const rows = await many(
    `SELECT TOP 30 u.*,
            CASE WHEN u.username LIKE $2 THEN 3
                 WHEN u.display_name LIKE $2 OR u.display_name LIKE $3 THEN 2
                 WHEN u.username LIKE $4 OR u.display_name LIKE $4 THEN 1
                 ELSE 0 END AS score,
            CASE WHEN EXISTS (SELECT 1 FROM follows f WHERE f.follower_id=$5 AND f.followee_id=u.id AND f.status=N'accepted') THEN 1 ELSE 0 END AS i_follow
       FROM users u
      WHERE u.onboarding_done = 1 AND u.deactivated_at IS NULL AND u.id <> $5
        AND (u.username LIKE $4 OR u.display_name LIKE $4
             OR ($6 = 1 AND DIFFERENCE(u.display_name, $1) = 4))
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$5 AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=$5))
      ORDER BY i_follow DESC, score DESC, u.username`,
    [q, `${esc}%`, `% ${esc}%`, `%${esc}%`, req.user.id, q.length >= 4 ? 1 : 0],
  );
  // Behaviour signal for Soul DNA (only with consent)
  if (req.user.consent_tracking && q.length >= 3) {
    query(`INSERT INTO behavior_events (user_id, type, meta) VALUES ($1,'search',$2)`, [req.user.id, { q }]).catch(() => {});
  }
  res.json({ users: rows.map((u) => ({ ...userCard(u), youFollow: u.i_follow === 1 })) });
}));

export default r;
