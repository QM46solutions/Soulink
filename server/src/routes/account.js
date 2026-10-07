// Settings pages that read your own account data.
//  GET    /account/activity?kind=likes|comments|requests   your activity
//  GET    /account/viewers                                 who viewed your profile (last 30 days): top 3 free, all with Premium
//  GET    /account/status                                  account status (verification, warnings, suspensions)
//  DELETE /account/location                                stop using your location
import { Router } from 'express';
import { z } from 'zod';
import { many, one, query } from '../db.js';
import { ah } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { meView, userCard } from '../services/social.js';
import { POST_SELECT, postView } from './posts.js';
import { INTENTS } from '../services/connections.js';

export const FREE_VIEWERS = 3; // free accounts see this many profile viewers; the rest is Premium
const r = Router();
r.use(requireAuth);
const NOT_BLOCKED = (col) => `NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=${col}) OR (b.blocker_id=${col} AND b.blocked_id=$1))`;

r.get('/activity', ah(async (req, res) => {
  const kind = z.enum(['likes', 'comments', 'requests']).parse(req.query.kind || 'likes');
  const me = req.user.id;
  if (kind === 'likes') {
    const rows = await many(
      `${POST_SELECT} JOIN post_likes ml ON ml.post_id = p.id AND ml.user_id = $1
        WHERE p.deleted_at IS NULL AND (p.suspended_at IS NULL OR p.author_id = $1) AND ${NOT_BLOCKED('p.author_id')}
        ORDER BY ml.created_at DESC OFFSET 0 ROWS FETCH NEXT 60 ROWS ONLY`, [me]);
    return res.json({ posts: rows.map((x) => postView(x, me)) });
  }
  if (kind === 'comments') {
    const rows = await many(
      `SELECT TOP 100 c.id, c.body, c.created_at, c.post_id, p.caption, p.media_urls, u.id AS uid, u.username, u.display_name, u.avatar_url, u.is_private, u.face_verified, u.soul_type
         FROM comments c JOIN posts p ON p.id = c.post_id JOIN users u ON u.id = p.author_id
        WHERE c.author_id = $1 AND c.deleted_at IS NULL AND p.deleted_at IS NULL
        ORDER BY c.created_at DESC`, [me]);
    return res.json({
      comments: rows.map((x) => {
        let mediaList = []; try { mediaList = JSON.parse(x.media_urls || '[]'); } catch { /* none */ }
        return { id: x.id, body: x.body, createdAt: x.created_at, post: { id: x.post_id, caption: x.caption, thumb: mediaList[0] || null }, author: userCard({ ...x, id: x.uid }) };
      }),
    });
  }
  const rows = await many(
    `SELECT TOP 100 q.id, q.intent, q.status, q.created_at, u.* FROM connection_requests q JOIN users u ON u.id = q.to_id
      WHERE q.from_id = $1 ORDER BY q.created_at DESC`, [me]);
  return res.json({ requests: rows.map((x) => ({ id: x.id, intent: x.intent, intentLabel: INTENTS[x.intent]?.label, status: x.status, createdAt: x.created_at, user: userCard(x) })) });
}));

r.get('/viewers', ah(async (req, res) => {
  const rows = await many(
    `SELECT x.viewer_id, x.last_at, x.days, u.* FROM (
        SELECT viewer_id, MAX(created_at) AS last_at, COUNT(*) AS days FROM profile_views
         WHERE target_id = $1 AND day >= CAST(DATEADD(day, -30, SYSDATETIMEOFFSET()) AS DATE) GROUP BY viewer_id) x
      JOIN users u ON u.id = x.viewer_id WHERE ${NOT_BLOCKED('x.viewer_id')} ORDER BY x.last_at DESC`, [req.user.id]);
  // Free: the 3 most recent viewers. Premium: everyone. Locked ones are sent only as a number (no names, ids or photos).
  const premium = !!req.user.is_premium;
  const shown = premium ? rows : rows.slice(0, FREE_VIEWERS);
  res.json({
    total: rows.length,
    premium,
    locked: rows.length - shown.length,
    viewers: shown.map((x) => ({ ...userCard(x), lastViewedAt: x.last_at, days: Number(x.days || 1) })),
  });
}));

r.get('/status', ah(async (req, res) => {
  const me = req.user.id;
  const n = await one(
    `SELECT
       (SELECT COUNT(*) FROM posts WHERE author_id=$1 AND deleted_at IS NULL) AS posts,
       (SELECT COUNT(*) FROM posts WHERE author_id=$1 AND deleted_at IS NULL AND suspended_at IS NOT NULL) AS suspended_posts,
       (SELECT COUNT(*) FROM post_offenses o JOIN posts p ON p.id = o.post_id WHERE p.author_id=$1 AND p.deleted_at IS NULL) AS offense_marks,
       (SELECT COUNT(*) FROM reports WHERE target_type=N'user' AND target_id=$1) AS reports`, [me]);
  const suspended = Number(n.suspended_posts || 0); const reports = Number(n.reports || 0); const marks = Number(n.offense_marks || 0);
  const level = suspended > 0 || reports >= 5 ? 'warning' : marks > 0 || reports > 0 ? 'watch' : 'good';
  res.json({
    user: meView(req.user),
    level, // good | watch | warning
    checks: {
      faceVerified: !!req.user.face_verified,
      soulDna: !!req.user.soul_ready,
      posts: Number(n.posts || 0),
      suspendedPosts: suspended,
      offenseMarks: marks,
      reports, // how many times people reported your account (never who)
      memberSince: req.user.created_at,
    },
  });
}));

r.delete('/location', ah(async (req, res) => {
  const u = await one('UPDATE users SET lat=NULL, lon=NULL OUTPUT INSERTED.* WHERE id=$1', [req.user.id]);
  res.json({ user: meView(u) });
}));

export default r;
