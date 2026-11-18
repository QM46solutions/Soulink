// Settings pages that read your own account data.
//  GET    /account/activity?kind=likes|comments|requests   your activity
//  GET    /account/viewers                                 who viewed your profile (last 30 days): top 3 free, all with Premium
//  GET    /account/status                                  account status (verification, warnings, suspensions)
//  DELETE /account/location                                stop using your location
//  GET    /account/sessions                                every device your account is logged in on (and recently ended)
//  DELETE /account/sessions/:id                            log that device out
//  POST   /account/sessions/end-others                     log out of every other device
import { Router } from 'express';
import { z } from 'zod';
import { many, one, query } from '../db.js';
import { ah } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { meView, userCard } from '../services/social.js';
import { POST_SELECT, postView } from './posts.js';
import { INTENTS } from '../services/connections.js';
import { endMySession, endOtherSessions, listSessions } from '../services/sessions.js';
import { disconnectSession } from '../realtime.js';
import { audit } from '../services/audit.js';
import { badRequest, notFound, HttpError } from '../lib/errors.js';
import { tx } from '../db.js';
import { normalizeEmail } from '../lib/auth.js';
import { checkCode, issueCode, realDelivery } from '../services/otp.js';
import { expireSignup, isRealMember } from '../services/signupCleanup.js';

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
      `SELECT TOP 100 c.id, c.body, c.created_at, c.post_id, p.caption, p.media_urls, p.reveal_at, p.teaser_url, p.author_id, u.id AS uid, u.username, u.display_name, u.avatar_url, u.is_private, u.face_verified, u.soul_type
         FROM comments c JOIN posts p ON p.id = c.post_id JOIN users u ON u.id = p.author_id
        WHERE c.author_id = $1 AND c.deleted_at IS NULL AND p.deleted_at IS NULL
        ORDER BY c.created_at DESC`, [me]);
    return res.json({
      comments: rows.map((x) => {
        let mediaList = []; try { mediaList = JSON.parse(x.media_urls || '[]'); } catch { /* none */ }
        return { id: x.id, body: x.body, createdAt: x.created_at, post: { id: x.post_id, caption: x.caption, thumb: (x.reveal_at && new Date(x.reveal_at) > new Date() && String(x.author_id).toLowerCase() !== String(me).toLowerCase()) ? (x.teaser_url || null) : (mediaList[0] || null) }, author: userCard({ ...x, id: x.uid }) };
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
       (SELECT COUNT(*) FROM reports WHERE target_type=N'user' AND target_id=$1) AS reports,
       (SELECT COUNT(*) FROM copyright_strikes WHERE user_id=$1 AND removed_at IS NULL AND created_at > DATEADD(DAY, -365, SYSDATETIMEOFFSET())) AS strikes`, [me]);
  const suspended = Number(n.suspended_posts || 0); const reports = Number(n.reports || 0); const marks = Number(n.offense_marks || 0);
  const strikes = Number(n.strikes || 0);
  const level = suspended > 0 || reports >= 5 || strikes > 0 ? 'warning' : marks > 0 || reports > 0 ? 'watch' : 'good';
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
      copyrightStrikes: strikes,
      postingBlockedUntil: req.user.posting_blocked_until || null,
      memberSince: req.user.created_at,
    },
  });
}));

r.delete('/location', ah(async (req, res) => {
  const u = await one('UPDATE users SET lat=NULL, lon=NULL OUTPUT INSERTED.* WHERE id=$1', [req.user.id]);
  res.json({ user: meView(u) });
}));

export default r;

// ---------- Settings › Email: add or change the account's email (it becomes a way to sign in) ----------
// A code goes to the new address first; the email is saved (and counted as verified) only after that code.
// The request step answers the same whether or not the address is used elsewhere.
const emailBody = (b) => {
  const e = normalizeEmail(z.object({ email: z.string().max(254) }).parse(b || {}).email);
  if (!e) throw badRequest('Enter a valid email address', 'invalid_email');
  return e;
};
r.post('/email/request', ah(async (req, res) => {
  const email = emailBody(req.body);
  if (email === req.user.email && req.user.email_verified_at) throw badRequest('This email is already on your account', 'email_same');
  const sent = await issueCode({ target: email, channel: 'email', purpose: 'add_email', userId: req.user.id, req });
  res.json({ sent: true, email, ...sent });
}));
r.post('/email/verify', ah(async (req, res) => {
  const email = emailBody(req.body);
  const code = z.string().regex(/^\d{6}$/, 'Code must be 6 digits').parse(req.body?.code);
  const out = await tx(async (c) => {
    const chk = await checkCode(c, { target: email, code, purpose: 'add_email', userId: req.user.id });
    if (chk.error) return chk;
    const other = (await c.query('SELECT TOP 1 * FROM users WHERE email=$1 AND id<>$2', [email, req.user.id])).rows[0];
    if (other) {
      // A half-made sign-up with this email (code checked, profile never finished) doesn't own it: the person who
      // just proved the email is theirs gets it, and the half-made sign-up is erased (same as when it expires).
      if (other.onboarding_done || other.deactivated_at || (await isRealMember(other.id))) {
        return { error: new HttpError(409, 'Another Soulink account already uses this email. Use a different email.', 'email_taken') };
      }
      return { clear: other };
    }
    const u = (await c.query(`UPDATE users SET email=$2, email_verified_at=${realDelivery('email') ? 'SYSDATETIMEOFFSET()' : 'NULL'}
      OUTPUT INSERTED.* WHERE id=$1`, [req.user.id, email])).rows[0];
    return { user: u };
  });
  if (out.error) throw out.error;
  if (out.clear) {
    await expireSignup(out.clear, 'unfinished_signup_email_claimed');
    const again = await tx(async (c) => {
      // the code was already used above; the email is free now
      const u = (await c.query(`UPDATE users SET email=$2, email_verified_at=${realDelivery('email') ? 'SYSDATETIMEOFFSET()' : 'NULL'}
        OUTPUT INSERTED.* WHERE id=$1`, [req.user.id, email])).rows[0];
      return { user: u };
    });
    out.user = again.user;
  }
  await audit(req, 'email_changed', { detail: email.replace(/^(.{2}).*@/, '$1•••@') });
  res.json({ user: meView(out.user) });
}));

// ---------- Settings › Where you're logged in ----------
r.get('/sessions', ah(async (req, res) => {
  res.json({ sessions: await listSessions(req.user.id, req.sessionId) });
}));
r.post('/sessions/end-others', ah(async (req, res) => {
  const ended = await endOtherSessions(req.user.id, req.sessionId);
  for (const sid of ended) disconnectSession(sid); // their live connection drops now; the app shows "You were logged out"
  await audit(req, 'sessions_ended_others', { detail: String(ended.length) });
  res.json({ ended: ended.length, sessions: await listSessions(req.user.id, req.sessionId) });
}));
r.delete('/sessions/:id', ah(async (req, res) => {
  const sid = z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid id').parse(req.params.id);
  if (req.sessionId && sid.toLowerCase() === String(req.sessionId).toLowerCase()) throw badRequest('This is the device you are using. Use Log out instead.', 'current_session');
  if (!(await endMySession(req.user.id, sid))) throw notFound('That device is already logged out');
  disconnectSession(sid);
  await audit(req, 'session_ended_remote', { detail: sid });
  res.json({ ok: true, sessions: await listSessions(req.user.id, req.sessionId) });
}));
