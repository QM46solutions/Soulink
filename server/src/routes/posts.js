// Posts: photo/video posts (1-10) or text-only posts, with likes and comments.
//  POST   /posts                     multipart: photos[] (photos or videos, optional), cover? (a frame of the video),
//                                    caption, place?, revealAt? (ISO time: goes up now, blurred for others until then)  → new post
//  GET    /posts/:id                 one post (same visibility as the profile)
//  DELETE /posts/:id                 delete my post
//  PATCH  /posts/:id                 { caption?, hideLikes?, commentsOff? } edit my post
//  POST   /posts/:id/music           multipart: audio (a song from your phone) + title  → music on my post
//  DELETE /posts/:id/music           remove the music
//  POST   /posts/:id/like            like / unlike (toggle)
//  GET    /posts/:id/comments        comments, oldest first
//  POST   /posts/:id/comments        { body }
//  POST   /posts/:id/comments        { body, parentId? } (a reply to a comment)
//  POST   /posts/:id/comments/:cid/like     👌🏻 a comment (toggle)
//  POST   /posts/:id/comments/:cid/offense  { reason? } mark a comment as offensive (toggle)
//  DELETE /posts/:id/comments/:cid   delete my comment (or any comment on my post)
//  GET    /posts/user/:userId        someone's posts (profile grid)
//  POST   /posts/:id/offense         mark / unmark as offensive (toggle). More than 75 marks suspends the post:
//                                    hidden from everyone except its owner.
//  POST   /posts/:id/share           { conversationIds?: [...] } send it in chats, or {} = shared outside Soulink
import { track } from '../services/signals.js';
import { postingBlocked, UNAVAILABLE } from '../services/copyright.js';
import { phoneMusicOn } from './music.js';
import { Router } from 'express';
import { z } from 'zod';
import { many, one, query } from '../db.js';
import { ah, badRequest, forbidden, notFound } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadMemory, saveFile } from '../providers/storage.js';
import { REF_RE, playPath } from '../services/music.js';
import { canViewContent, isBlockedEither, notify, relationship, userCard } from '../services/social.js';
import { sharePostToChat } from './conversations.js';
import { makeTeaser } from '../services/teaser.js';
import { commentGate } from '../services/privacy.js';
import { paymentMode, takePayment } from '../lib/payments.js';
import { SPREAD_PLANS, spreadView } from '../services/spread.js';

export const OFFENSE_LIMIT = 75; // more than this many offense marks suspends a post
export const OFFENSE_REASONS = ['dislike', 'bullying', 'hate', 'child_safety', 'nudity', 'violence', 'self_harm', 'scam', 'false_info', 'spam', 'other'];

const r = Router();
r.use(requireAuth);
const uuid = z.string().uuid();
const media = (v) => (Array.isArray(v) ? v : (() => { try { return JSON.parse(v || '[]'); } catch { return []; } })());

const SELECT = `SELECT p.id AS post_id, p.author_id, p.caption, p.media_urls, p.created_at AS post_at,
    (SELECT COUNT(*) FROM post_likes l WHERE l.post_id = p.id) AS like_count,
    (SELECT TOP 1 lu.username FROM post_likes l2 JOIN users lu ON lu.id = l2.user_id WHERE l2.post_id = p.id AND l2.user_id <> $1 ORDER BY l2.created_at DESC) AS liked_by,
    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL AND (c.hidden_at IS NULL OR c.author_id = $1)) AS comment_count,
    CASE WHEN EXISTS (SELECT 1 FROM post_likes l WHERE l.post_id = p.id AND l.user_id = $1) THEN 1 ELSE 0 END AS liked,
    (SELECT COUNT(*) FROM post_offenses o WHERE o.post_id = p.id) AS offense_count,
    CASE WHEN EXISTS (SELECT 1 FROM post_offenses o WHERE o.post_id = p.id AND o.user_id = $1) THEN 1 ELSE 0 END AS offended,
    (SELECT TOP 1 o.reason FROM post_offenses o WHERE o.post_id = p.id AND o.user_id = $1) AS offense_reason,
    (SELECT COUNT(*) FROM post_shares sh WHERE sh.post_id = p.id) AS share_count, p.suspended_at,
    CASE WHEN EXISTS (SELECT 1 FROM comments c2 WHERE c2.post_id = p.id AND c2.author_id = $1 AND c2.deleted_at IS NULL) THEN 1 ELSE 0 END AS commented,
    CASE WHEN EXISTS (SELECT 1 FROM post_shares s2 WHERE s2.post_id = p.id AND s2.user_id = $1) THEN 1 ELSE 0 END AS shared,
    CASE WHEN EXISTS (SELECT 1 FROM saved_posts sv WHERE sv.post_id = p.id AND sv.user_id = $1) THEN 1 ELSE 0 END AS saved, p.pinned_at, p.archived_at,
    p.suspended_reason, p.hide_likes, p.comments_off, p.music_url, p.music_title, p.music_start, p.place, p.reveal_at, p.teaser_url,
    u.id, u.username, u.display_name, u.avatar_url, u.is_private, u.face_verified, u.soul_type
  FROM posts p JOIN users u ON u.id = p.author_id`;

const on = (v) => v === true || v === 1;
export const postView = (x, meId) => {
  const mine = String(x.author_id).toLowerCase() === String(meId).toLowerCase();
  const v = basicView(x, meId);
  // owner's choices: like count hidden from others; commenting off hides comments for everyone
  if (on(x.hide_likes) && !mine) v.likeCount = null;
  if (on(x.comments_off)) v.commentCount = null;
  // scheduled reveal: until then others get only the blurred teaser (never the real photos or videos)
  const revealAt = x.reveal_at ? new Date(x.reveal_at) : null;
  const locked = !!revealAt && revealAt.getTime() > Date.now();
  if (locked && !mine) v.media = [];
  return {
    ...v,
    reveal: locked ? { at: revealAt.toISOString(), teaser: x.teaser_url || null, locked: !mine } : null,
    hideLikes: on(x.hide_likes),
    commentsOff: on(x.comments_off),
    saved: !!x.saved, pinned: !!x.pinned_at, archived: mine && !!x.archived_at,
    music: x.music_url ? { url: x.music_url, title: x.music_title || 'Music', start: x.music_start || 0 } : null,
    place: x.place || null,
    ...(x.spread_id ? { spread: true } : {}), // shown to this person because the owner boosted it
  };
};
const basicView = (x, meId) => ({
  id: x.post_id,
  caption: x.caption,
  media: media(x.media_urls),
  createdAt: x.post_at,
  likeCount: Number(x.like_count || 0),
  likedBy: x.liked_by || null, // latest person (other than me) who gave it a 👌🏻, for "Liked by …"
  commentCount: Number(x.comment_count || 0),
  liked: !!x.liked,
  shareCount: Number(x.share_count || 0),
  commented: !!x.commented, // I commented: the comment icon turns its colour
  shared: !!x.shared,       // I shared it: the share icon turns its colour
  offended: !!x.offended,
  offenseReason: x.offense_reason || null, // my own reason, if I marked it
  mine: String(x.author_id).toLowerCase() === String(meId).toLowerCase(),
  offenseCount: Number(x.offense_count || 0), // shown under the ❗ icon (never who marked it)
  suspended: !!x.suspended_at,
  author: userCard(x),
});
/** SQL filter: suspended posts are visible only to their owner ($1 = viewer). */
export const NOT_SUSPENDED_FOR_VIEWER = '(p.suspended_at IS NULL OR p.author_id = $1)';
export const POST_SELECT = SELECT;

async function loadVisible(req) {
  const id = uuid.parse(req.params.id);
  const x = await one(`${SELECT} WHERE p.id = $2 AND p.deleted_at IS NULL`, [req.user.id, id]);
  if (!x) throw notFound('Post not found');
  if (String(x.author_id).toLowerCase() !== String(req.user.id).toLowerCase()) {
    if (x.suspended_at) throw x.suspended_reason === 'copyright' ? notFound(UNAVAILABLE, 'copyright_removed') : x.suspended_reason === 'legal' ? notFound('This post is unavailable because of a legal order.', 'legal_removed') : x.suspended_reason === 'complaint' ? notFound('This post was removed after a complaint to our Grievance Officer.', 'complaint_removed') : notFound('This post was suspended after many people found it offensive', 'post_suspended');
    if (x.archived_at) throw notFound('Post not found'); // archived: only its owner sees it
    if (await isBlockedEither(req.user.id, x.author_id)) throw notFound('Post not found');
    const author = await one('SELECT * FROM users WHERE id=$1', [x.author_id]);
    if (!canViewContent(author, await relationship(req.user.id, author.id))) throw forbidden('This account is private', 'private_account');
  }
  return x;
}

r.post('/', uploadMemory('post', 40, 11).fields([{ name: 'photos', maxCount: 10 }, { name: 'cover', maxCount: 1 }]), ah(async (req, res) => {
  const blocked = postingBlocked(req.user); if (blocked) throw forbidden(blocked, 'posting_limited');
  const { caption, place, revealAt } = z.object({
    caption: z.string().max(2200).optional(), place: z.string().trim().max(150).optional(), revealAt: z.string().datetime({ offset: true }).optional(),
  }).parse(req.body || {});
  const files = req.files?.photos || [];
  const cover = req.files?.cover?.[0];
  if (!files.length && !caption?.trim()) throw badRequest('Add a photo or write something', 'empty_post');
  let reveal = null;
  if (revealAt) {
    if (!files.length) throw badRequest('Add a photo or video to schedule a reveal', 'reveal_needs_media');
    reveal = new Date(revealAt);
    const ms = reveal.getTime() - Date.now();
    if (ms < 60_000) throw badRequest('Pick a reveal time at least a minute from now', 'reveal_too_soon');
    if (ms > 30 * 86400_000) throw badRequest('A reveal can be at most 30 days away', 'reveal_too_far');
  }
  const urls = [];
  for (const f of files) urls.push(await saveFile(f, 'posts', 'post'));
  let teaserUrl = null;
  if (reveal) {
    const first = files.find((f) => f.mimetype.startsWith('image/')) || (cover?.mimetype.startsWith('image/') ? cover : null);
    const t = first ? makeTeaser(first.buffer) : null;
    if (t) teaserUrl = await saveFile({ buffer: t, mimetype: 'image/jpeg' }, 'posts');
  }
  const p = await one('INSERT INTO posts (author_id, caption, media_urls, place, reveal_at, teaser_url) OUTPUT INSERTED.id VALUES ($1, $2, $3, $4, $5, $6)',
    [req.user.id, (caption || '').trim(), urls, place || null, reveal, teaserUrl]);
  const x = await one(`${SELECT} WHERE p.id = $2`, [req.user.id, p.id]);
  res.status(201).json({ post: postView(x, req.user.id) });
}));

r.get('/user/:userId', ah(async (req, res) => {
  const author = await one('SELECT * FROM users WHERE id=$1', [uuid.parse(req.params.userId)]);
  if (!author) throw notFound('User not found');
  if (await isBlockedEither(req.user.id, author.id)) throw notFound('User not found');
  if (!canViewContent(author, await relationship(req.user.id, author.id))) return res.json({ posts: [], private: true });
  // pinned posts first (newest pin first), then the rest; archived posts are only in the owner's Archive
  const rows = await many(`${SELECT} WHERE p.author_id = $2 AND p.deleted_at IS NULL AND p.is_anonymous = 0 AND p.archived_at IS NULL AND (p.suspended_at IS NULL OR p.author_id = $1)
    ORDER BY CASE WHEN p.pinned_at IS NULL THEN 1 ELSE 0 END, p.pinned_at DESC, p.created_at DESC`, [req.user.id, author.id]);
  res.json({ posts: rows.map((x) => postView(x, req.user.id)) });
}));

// ---------- the ⋯ menu: save, archive, pin to profile, not interested ----------
r.get('/saved', ah(async (req, res) => {
  const rows = await many(`${SELECT} JOIN saved_posts sv2 ON sv2.post_id = p.id AND sv2.user_id = $1
    WHERE p.deleted_at IS NULL AND p.is_anonymous = 0 AND (p.archived_at IS NULL OR p.author_id = $1) AND (p.suspended_at IS NULL OR p.author_id = $1)
      AND (u.is_private = 0 OR p.author_id = $1 OR EXISTS (SELECT 1 FROM connections pc WHERE (pc.user_a = $1 AND pc.user_b = p.author_id) OR (pc.user_b = $1 AND pc.user_a = p.author_id)))
      AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=p.author_id) OR (b.blocker_id=p.author_id AND b.blocked_id=$1))
    ORDER BY sv2.created_at DESC`, [req.user.id]);
  res.json({ posts: rows.map((x) => postView(x, req.user.id)) });
}));
r.get('/archived', ah(async (req, res) => {
  const rows = await many(`${SELECT} WHERE p.author_id = $1 AND p.deleted_at IS NULL AND p.archived_at IS NOT NULL ORDER BY p.archived_at DESC`, [req.user.id]);
  res.json({ posts: rows.map((x) => postView(x, req.user.id)) });
}));

// ---------- Boost (Spread around) a post: the same plans as Sparks ----------
//  GET  /posts/spread/plans      prices + whether payments are on
//  GET  /posts/:id/spread        my post's boost status
//  POST /posts/:id/spread        { days, city: 'mine'|'all', ageMin, ageMax }
//  POST /posts/:id/spread/stop
r.get('/spread/plans', ah(async (req, res) => {
  const mode = paymentMode();
  res.json({ plans: SPREAD_PLANS, available: mode !== 'off', test: mode === 'test', myCity: req.user.city || null });
}));
const currentPostSpread = (postId) => one(`SELECT TOP 1 * FROM post_spreads WHERE post_id=$1 AND status <> N'stopped' AND ends_at > SYSDATETIMEOFFSET() ORDER BY ends_at DESC`, [postId]);
r.get('/:id/spread', ah(async (req, res) => {
  const p = await myPost(req);
  const sp = await currentPostSpread(p.id);
  const likes = await one('SELECT COUNT(*) AS n FROM post_likes WHERE post_id=$1', [p.id]).catch(() => ({ n: 0 }));
  res.json({ spread: spreadView(sp), views: null, likes: Number(likes?.n || 0) });
}));
r.post('/:id/spread', ah(async (req, res) => {
  const p = await myPost(req);
  const d = z.object({
    days: z.union([z.literal(1), z.literal(3), z.literal(7)]),
    city: z.enum(['mine', 'all']).default('all'),
    ageMin: z.number().int().min(18).max(80).default(18),
    ageMax: z.number().int().min(18).max(80).default(60),
    paymentRef: z.string().max(120).optional(),
  }).refine((v) => v.ageMax >= v.ageMin, 'Check the ages').parse(req.body || {});
  const full = await one('SELECT is_anonymous, archived_at, suspended_at FROM posts WHERE id=$1', [p.id]);
  if (full?.is_anonymous || full?.archived_at || full?.suspended_at) throw badRequest("This post can't be boosted", 'not_boostable');
  if (await currentPostSpread(p.id)) throw badRequest('This post is already boosted', 'already_spreading');
  if (d.city === 'mine' && !req.user.city) throw badRequest('Add your city in your profile first, or pick All of India', 'no_city');
  const plan = SPREAD_PLANS.find((x) => x.days === d.days);
  const mode = takePayment(d.paymentRef); // 'test' on the laptop: nothing is charged
  const sp = await one(`INSERT INTO post_spreads (post_id, user_id, city, age_min, age_max, days, amount_paise, payment_ref, status, ends_at)
      OUTPUT INSERTED.* VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, DATEADD(DAY, $6, SYSDATETIMEOFFSET()))`,
    [p.id, req.user.id, d.city === 'mine' ? req.user.city : null, d.ageMin, d.ageMax, d.days, plan.priceInr * 100, d.paymentRef || null, mode === 'test' ? 'test' : 'active']);
  res.status(201).json({ spread: spreadView(sp) });
}));
r.post('/:id/spread/stop', ah(async (req, res) => {
  const p = await myPost(req);
  await query(`UPDATE post_spreads SET status = N'stopped' WHERE post_id=$1 AND status <> N'stopped'`, [p.id]);
  res.json({ spread: null });
}));

r.get('/:id', ah(async (req, res) => {
  res.json({ post: postView(await loadVisible(req), req.user.id) });
}));

// save / unsave (only you see what you saved)
r.post('/:id/save', ah(async (req, res) => {
  const x = await loadVisible(req);
  const had = await one('DELETE FROM saved_posts OUTPUT DELETED.post_id WHERE user_id=$1 AND post_id=$2', [req.user.id, x.post_id]);
  if (!had) await query('INSERT INTO saved_posts (user_id, post_id) VALUES ($1, $2)', [req.user.id, x.post_id]);
  res.json({ saved: !had });
}));
// "Not interested": hide this post from my feed
r.post('/:id/hide', ah(async (req, res) => {
  const x = await loadVisible(req);
  await query('IF NOT EXISTS (SELECT 1 FROM hidden_posts WHERE user_id=$1 AND post_id=$2) INSERT INTO hidden_posts (user_id, post_id) VALUES ($1, $2)', [req.user.id, x.post_id]);
  res.json({ hidden: true });
}));
const PIN_MAX = 3;
// archive / unarchive (my post): hidden from my profile and every feed, kept in Settings › Archive
r.post('/:id/archive', ah(async (req, res) => {
  const p = await myPost(req);
  const row = await one('SELECT archived_at FROM posts WHERE id=$1', [p.id]);
  const archived = !row.archived_at;
  await query(`UPDATE posts SET archived_at=${archived ? 'SYSDATETIMEOFFSET()' : 'NULL'}, pinned_at=${archived ? 'NULL' : 'pinned_at'} WHERE id=$1`, [p.id]);
  res.json({ archived });
}));
// pin / unpin to the top of my profile (up to 3)
r.post('/:id/pin', ah(async (req, res) => {
  const p = await myPost(req);
  const row = await one('SELECT pinned_at, archived_at FROM posts WHERE id=$1', [p.id]);
  if (row.pinned_at) { await query('UPDATE posts SET pinned_at=NULL WHERE id=$1', [p.id]); return res.json({ pinned: false }); }
  if (row.archived_at) throw badRequest('Unarchive this post first, then pin it.', 'archived');
  const n = await one('SELECT COUNT(*) AS n FROM posts WHERE author_id=$1 AND pinned_at IS NOT NULL AND deleted_at IS NULL', [req.user.id]);
  if (Number(n?.n || 0) >= PIN_MAX) throw badRequest(`You can pin up to ${PIN_MAX} posts. Unpin one first.`, 'pin_limit');
  await query('UPDATE posts SET pinned_at=SYSDATETIMEOFFSET() WHERE id=$1', [p.id]);
  res.json({ pinned: true });
}));

r.delete('/:id', ah(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const upd = await one('UPDATE posts SET deleted_at = SYSDATETIMEOFFSET() OUTPUT INSERTED.id WHERE id=$1 AND author_id=$2 AND deleted_at IS NULL', [id, req.user.id]);
  if (!upd) throw notFound('Post not found');
  res.json({ ok: true });
}));

async function myPost(req) {
  const id = uuid.parse(req.params.id);
  const p = await one('SELECT id, media_urls FROM posts WHERE id=$1 AND author_id=$2 AND deleted_at IS NULL', [id, req.user.id]);
  if (!p) throw notFound('Post not found');
  return p;
}
const freshView = async (req, id) => postView(await one(`${SELECT} WHERE p.id = $2`, [req.user.id, id]), req.user.id);

r.patch('/:id', ah(async (req, res) => {
  const p = await myPost(req);
  const d = z.object({ caption: z.string().max(2200).optional(), place: z.string().trim().max(150).nullable().optional(), hideLikes: z.boolean().optional(), commentsOff: z.boolean().optional() }).parse(req.body || {});
  if (d.place !== undefined) await query('UPDATE posts SET place=$2 WHERE id=$1', [p.id, d.place || null]);
  if (d.caption !== undefined) {
    if (!d.caption.trim() && !media(p.media_urls).length) throw badRequest("A text post can't be empty", 'empty_post');
    await query('UPDATE posts SET caption=$2 WHERE id=$1', [p.id, d.caption.trim()]);
  }
  if (d.hideLikes !== undefined) await query('UPDATE posts SET hide_likes=$2 WHERE id=$1', [p.id, d.hideLikes]);
  if (d.commentsOff !== undefined) await query('UPDATE posts SET comments_off=$2 WHERE id=$1', [p.id, d.commentsOff]);
  res.json({ post: await freshView(req, p.id) });
}));

// Music: a song/audio from your phone (up to 15 MB); the post plays its first 30 seconds
r.post('/:id/music', uploadMemory('audio', 15).single('audio'), ah(async (req, res) => {
  if (!phoneMusicOn()) throw forbidden("Songs from your phone can't be added. Use the music library instead.", 'music_upload_off');
  if (String(req.body?.rightsConfirmed) !== 'true') throw badRequest('Confirm you own this song or have permission to use it', 'rights_not_confirmed');
  const p = await myPost(req);
  if (!req.file) throw badRequest('Choose a song first', 'no_audio');
  const title = z.string().trim().min(1).max(150).parse(String(req.body?.title || req.file.originalname || 'Music').replace(/\.[a-z0-9]{2,4}$/i, '') || 'Music');
  const url = await saveFile(req.file, 'music', 'audio');
  await query('UPDATE posts SET music_url=$2, music_title=$3, music_start=NULL WHERE id=$1', [p.id, url, title]);
  res.json({ post: await freshView(req, p.id) });
}));

// Music from JioSaavn / Deezer / free music: { ref: 'saavn:<id>', title, start }
r.post('/:id/music/stream', ah(async (req, res) => {
  const p = await myPost(req);
  const d = z.object({ ref: z.string().regex(REF_RE, 'Pick the song again'), title: z.string().trim().min(1).max(150), start: z.number().int().min(0).max(1200).default(0) }).parse(req.body || {});
  await query('UPDATE posts SET music_url=$2, music_title=$3, music_start=$4 WHERE id=$1', [p.id, playPath(d.ref), d.title, d.start || null]);
  res.json({ post: await freshView(req, p.id) });
}));

r.delete('/:id/music', ah(async (req, res) => {
  const p = await myPost(req);
  await query('UPDATE posts SET music_url=NULL, music_title=NULL, music_start=NULL WHERE id=$1', [p.id]);
  res.json({ post: await freshView(req, p.id) });
}));

r.post('/:id/like', ah(async (req, res) => {
  const x = await loadVisible(req);
  const had = await one('SELECT 1 AS y FROM post_likes WHERE post_id=$1 AND user_id=$2', [x.post_id, req.user.id]);
  if (had) await query('DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2', [x.post_id, req.user.id]);
  else {
    await query('INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)', [x.post_id, req.user.id]);
    await notify(x.author_id, req.user.id, 'post_like', x.post_id).catch(() => {});
    track(req.user, 'like', x.caption); // what you're into (only with your consent)
  }
  const n = await one('SELECT COUNT(*) AS n FROM post_likes WHERE post_id=$1', [x.post_id]);
  const hidden = on(x.hide_likes) && String(x.author_id).toLowerCase() !== String(req.user.id).toLowerCase();
  res.json({ liked: !had, likeCount: hidden ? null : Number(n.n) });
}));

r.post('/:id/offense', ah(async (req, res) => {
  const x = await loadVisible(req);
  if (String(x.author_id).toLowerCase() === String(req.user.id).toLowerCase()) throw badRequest("You can't mark your own post", 'own_post');
  const { reason } = z.object({ reason: z.enum(OFFENSE_REASONS).optional() }).parse(req.body || {});
  const had = await one('SELECT 1 AS y FROM post_offenses WHERE post_id=$1 AND user_id=$2', [x.post_id, req.user.id]);
  if (had) await query('DELETE FROM post_offenses WHERE post_id=$1 AND user_id=$2', [x.post_id, req.user.id]);
  else await query('IF NOT EXISTS (SELECT 1 FROM post_offenses WHERE post_id=$1 AND user_id=$2) INSERT INTO post_offenses (post_id, user_id, reason) VALUES ($1, $2, $3)', [x.post_id, req.user.id, reason || 'other']);
  const n = Number((await one('SELECT COUNT(*) AS n FROM post_offenses WHERE post_id=$1', [x.post_id])).n);
  let suspended = !!x.suspended_at;
  if (!suspended && n > OFFENSE_LIMIT) {
    const upd = await one('UPDATE posts SET suspended_at = SYSDATETIMEOFFSET() OUTPUT INSERTED.id WHERE id=$1 AND suspended_at IS NULL', [x.post_id]);
    if (upd) { suspended = true; await notify(x.author_id, null, 'post_suspended', x.post_id, { offenses: n }).catch(() => {}); }
  }
  res.json({ offended: !had, suspended, offenseCount: n });
}));

// Owner only: how many people marked my post, by reason (never who)
r.get('/:id/offenses', ah(async (req, res) => {
  const x = await loadVisible(req);
  if (String(x.author_id).toLowerCase() !== String(req.user.id).toLowerCase()) throw forbidden('Only the person who posted this can see this', 'not_owner');
  const rows = await many('SELECT ISNULL(reason, N\'other\') AS reason, COUNT(*) AS n FROM post_offenses WHERE post_id=$1 GROUP BY ISNULL(reason, N\'other\')', [x.post_id]);
  const byReason = Object.fromEntries(rows.map((r) => [r.reason, Number(r.n)]));
  res.json({ total: rows.reduce((a, r) => a + Number(r.n), 0), byReason, limit: OFFENSE_LIMIT, suspended: !!x.suspended_at });
}));

r.post('/:id/share', ah(async (req, res) => {
  const x = await loadVisible(req);
  const { conversationIds } = z.object({ conversationIds: z.array(uuid).max(20).optional() }).parse(req.body || {});
  const lockedNow = x.reveal_at && new Date(x.reveal_at).getTime() > Date.now();
  const snapshot = { postId: x.post_id, caption: (x.caption || '').slice(0, 140), thumb: lockedNow ? (x.teaser_url || null) : (media(x.media_urls)[0] || null), locked: !!lockedNow, author: { username: x.username, avatarUrl: x.avatar_url } };
  const sent = [];
  for (const cid of conversationIds || []) {
    sent.push((await sharePostToChat(cid, req.user, snapshot)).id);
    await query(`INSERT INTO post_shares (post_id, user_id, channel) VALUES ($1, $2, N'chat')`, [x.post_id, req.user.id]);
  }
  if (!conversationIds?.length) await query(`INSERT INTO post_shares (post_id, user_id, channel) VALUES ($1, $2, N'external')`, [x.post_id, req.user.id]);
  const n = await one('SELECT COUNT(*) AS n FROM post_shares WHERE post_id=$1', [x.post_id]);
  res.json({ ok: true, sent: sent.length, shareCount: Number(n.n) });
}));

// Who gave this post a 👌🏻 (newest first)
r.get('/:id/likes', ah(async (req, res) => {
  const x = await loadVisible(req);
  const rows = await many(
    `SELECT TOP 300 u.* FROM post_likes l JOIN users u ON u.id = l.user_id
      WHERE l.post_id=$1
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$2 AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=$2))
      ORDER BY l.created_at DESC`, [x.post_id, req.user.id],
  );
  res.json({ users: rows.map(userCard) });
}));

// ---------- comments: replies (one level), 👌🏻 likes and offense marks ----------
const COMMENT_HIDE_AT = 10; // more than this many offense marks hides a comment (except for its writer)
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

r.get('/:id/comments', ah(async (req, res) => {
  const x = await loadVisible(req);
  const me = req.user.id;
  if (on(x.comments_off)) return res.json({ comments: [], commentsOff: true }); // hidden while commenting is off
  const rows = await many(
    `SELECT c.id AS comment_id, c.body, c.created_at AS comment_at, c.author_id, c.parent_id, c.hidden_at,
            (SELECT COUNT(*) FROM comment_likes l WHERE l.comment_id = c.id) AS like_count,
            CASE WHEN EXISTS (SELECT 1 FROM comment_likes l WHERE l.comment_id = c.id AND l.user_id = $2) THEN 1 ELSE 0 END AS liked,
            (SELECT COUNT(*) FROM comment_offenses o WHERE o.comment_id = c.id) AS offense_count,
            (SELECT TOP 1 o.reason FROM comment_offenses o WHERE o.comment_id = c.id AND o.user_id = $2) AS my_reason,
            CASE WHEN EXISTS (SELECT 1 FROM comment_offenses o WHERE o.comment_id = c.id AND o.user_id = $2) THEN 1 ELSE 0 END AS offended,
            u.*
       FROM comments c JOIN users u ON u.id = c.author_id
      WHERE c.post_id=$1 AND c.deleted_at IS NULL AND (c.hidden_at IS NULL OR c.author_id = $2)
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$2 AND b.blocked_id=c.author_id) OR (b.blocker_id=c.author_id AND b.blocked_id=$2))
      ORDER BY c.created_at`, [x.post_id, me],
  );
  const postMine = same(x.author_id, me);
  const ids = new Set(rows.map((c) => String(c.comment_id).toLowerCase()));
  res.json({
    commentsOff: false,
    comments: rows.map((c) => ({
      id: c.comment_id, body: c.body, createdAt: c.comment_at, author: userCard(c),
      // a reply whose comment was deleted shows as a normal comment
      parentId: c.parent_id && ids.has(String(c.parent_id).toLowerCase()) ? c.parent_id : null,
      likeCount: Number(c.like_count || 0), liked: !!c.liked,
      offenseCount: Number(c.offense_count || 0), offended: !!c.offended, offenseReason: c.my_reason || null,
      hidden: !!c.hidden_at, mine: same(c.author_id, me),
      canDelete: postMine || same(c.author_id, me),
    })),
  });
}));

r.post('/:id/comments', ah(async (req, res) => {
  const x = await loadVisible(req);
  const { body, parentId } = z.object({ body: z.string().trim().min(1).max(2200), parentId: uuid.optional() }).parse(req.body);
  if (on(x.comments_off)) throw forbidden('Commenting is turned off for this post', 'comments_off');
  const gate = await commentGate(await one('SELECT * FROM users WHERE id=$1', [x.author_id]), req.user, body);
  let parent = null;
  if (parentId) {
    parent = await one('SELECT * FROM comments WHERE id=$1 AND post_id=$2 AND deleted_at IS NULL', [parentId, x.post_id]);
    if (!parent) throw notFound('That comment was deleted');
    if (parent.parent_id) parent = (await one('SELECT * FROM comments WHERE id=$1', [parent.parent_id])) || parent; // replies stay one level deep
  }
  // Restrict / Hidden words: saved but hidden, so only its writer sees it (and nobody is notified)
  const c = await one('INSERT INTO comments (post_id, author_id, body, parent_id, hidden_at) OUTPUT INSERTED.* VALUES ($1, $2, $3, $4, $5)', [x.post_id, req.user.id, body, parent?.id || null, gate.hide ? new Date() : null]);
  if (!gate.hide) await notify(x.author_id, req.user.id, 'post_comment', x.post_id, { preview: body.slice(0, 80) }).catch(() => {});
  if (parent && !gate.hide && !same(parent.author_id, x.author_id)) await notify(parent.author_id, req.user.id, 'comment_reply', x.post_id, { preview: body.slice(0, 80) }).catch(() => {});
  res.status(201).json({ comment: { id: c.id, body: c.body, createdAt: c.created_at, author: userCard(req.user), parentId: parent?.id || null,
    likeCount: 0, liked: false, offenseCount: 0, offended: false, offenseReason: null, hidden: false, mine: true, canDelete: true } });
}));

async function visibleComment(req) {
  const x = await loadVisible(req);
  const cid = uuid.parse(req.params.cid);
  const c = await one('SELECT * FROM comments WHERE id=$1 AND post_id=$2 AND deleted_at IS NULL', [cid, x.post_id]);
  if (!c) throw notFound('Comment not found');
  return { x, c };
}

// 👌🏻 a comment (toggle)
r.post('/:id/comments/:cid/like', ah(async (req, res) => {
  const { x, c } = await visibleComment(req);
  const had = await one('SELECT 1 AS y FROM comment_likes WHERE comment_id=$1 AND user_id=$2', [c.id, req.user.id]);
  if (had) await query('DELETE FROM comment_likes WHERE comment_id=$1 AND user_id=$2', [c.id, req.user.id]);
  else {
    await query('INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2)', [c.id, req.user.id]);
    await notify(c.author_id, req.user.id, 'comment_like', x.post_id, { preview: String(c.body).slice(0, 80) }).catch(() => {});
  }
  const n = await one('SELECT COUNT(*) AS n FROM comment_likes WHERE comment_id=$1', [c.id]);
  res.json({ liked: !had, likeCount: Number(n.n) });
}));

// ❗ mark a comment as offensive (toggle; same reasons as posts). More than 10 marks hides it.
r.post('/:id/comments/:cid/offense', ah(async (req, res) => {
  const { c } = await visibleComment(req);
  const { reason } = z.object({ reason: z.enum(OFFENSE_REASONS).optional() }).parse(req.body || {});
  if (same(c.author_id, req.user.id)) throw badRequest("You can't mark your own comment");
  const had = await one('SELECT 1 AS y FROM comment_offenses WHERE comment_id=$1 AND user_id=$2', [c.id, req.user.id]);
  if (had) await query('DELETE FROM comment_offenses WHERE comment_id=$1 AND user_id=$2', [c.id, req.user.id]);
  else await query('INSERT INTO comment_offenses (comment_id, user_id, reason) VALUES ($1, $2, $3)', [c.id, req.user.id, reason || null]);
  const n = Number((await one('SELECT COUNT(*) AS n FROM comment_offenses WHERE comment_id=$1', [c.id])).n);
  await query(`UPDATE comments SET hidden_at = ${n > COMMENT_HIDE_AT ? 'COALESCE(hidden_at, SYSDATETIMEOFFSET())' : 'NULL'} WHERE id=$1`, [c.id]);
  res.json({ offended: !had, offenseCount: n, hidden: n > COMMENT_HIDE_AT });
}));

r.delete('/:id/comments/:cid', ah(async (req, res) => {
  const x = await loadVisible(req);
  const cid = uuid.parse(req.params.cid);
  const postMine = same(x.author_id, req.user.id);
  const upd = await one(
    `UPDATE comments SET deleted_at = SYSDATETIMEOFFSET() OUTPUT INSERTED.id WHERE id=$1 AND post_id=$2 AND deleted_at IS NULL ${postMine ? '' : 'AND author_id=$3'}`,
    postMine ? [cid, x.post_id] : [cid, x.post_id, req.user.id],
  );
  if (!upd) throw notFound('Comment not found');
  res.json({ ok: true });
}));

export default r;
