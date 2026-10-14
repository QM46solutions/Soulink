// Moments (the "+" on Home). A photo or a written card that you add to your Moments (24 hours,
// seen by your Connections and Followers) and/or send to chats (opens once, one replay, or saved).
// Not linked to profile posts in any way.
//  POST   /moments                   multipart: photo? text? bg? story=1|0 conversationIds=[json]
//  GET    /moments/feed              Moments row on Home: you first, then people you're connected to
//  GET    /moments/user/:userId      someone's active Moments
//  POST   /moments/:id/view          mark as seen
//  GET    /moments/:id/viewers       who viewed my Moment
//  POST   /moments/:id/reply         { text } reply or emoji reaction, sent to their chat
//  DELETE /moments/:id               delete my Moment
import { Router } from 'express';
import { z } from 'zod';
import { many, one, query } from '../db.js';
import { ah, badRequest, forbidden, notFound } from '../lib/errors.js';
import { requireAuth, requireSoul } from '../middleware/auth.js';
import { uploadMemory, saveFile } from '../providers/storage.js';
import { REF_RE, playPath } from '../services/music.js';
import { isBlockedEither, userCard } from '../services/social.js';
import { connectionBetween } from '../services/connections.js';
import { config } from '../config.js';
import { assertCanSend, getOrCreateDirect, postMessage } from './conversations.js';

const r = Router();
r.use(requireAuth);
const uuid = z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid id');
const BGS = ['aurora', 'sunset', 'ocean', 'forest', 'night', 'gold'];
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

const view = (m, seen) => ({ id: m.id, mediaUrl: m.media_url || null, text: m.text || null, bg: m.bg || null,
  music: m.music_url ? { url: m.music_url, title: m.music_title || 'Music', start: m.music_start || 0 } : null, createdAt: m.created_at, expiresAt: m.expires_at, seen: !!seen });

/** Can the viewer see this person's Moments? You, or you're connected to them (Connection or Follower). */
async function canSee(viewerId, authorId) {
  if (same(viewerId, authorId)) return true;
  if (await isBlockedEither(viewerId, authorId)) return false;
  return !!(await one("SELECT 1 AS y FROM follows WHERE follower_id=$1 AND followee_id=$2 AND status=N'accepted'", [viewerId, authorId]));
}

r.post('/', requireSoul, uploadMemory('image', 10).single('photo'), ah(async (req, res) => {
  const d = z.object({
    text: z.string().trim().max(500).optional(),
    bg: z.enum(BGS).optional(),
    story: z.enum(['0', '1']).default('0'),
    conversationIds: z.string().optional(),
    musicRef: z.string().regex(REF_RE, 'Pick the song again').optional(),
    musicTitle: z.string().trim().max(150).optional(),
    musicStart: z.coerce.number().int().min(0).max(1200).optional(),
  }).parse(req.body || {});
  const text = d.text || null;
  if (!req.file && !text) throw badRequest('Add a photo or write something', 'empty_moment');
  let chats = [];
  try { chats = d.conversationIds ? z.array(uuid).max(30).parse(JSON.parse(d.conversationIds)) : []; } catch { throw badRequest('Pick the chats again'); }
  if (d.story !== '1' && !chats.length) throw badRequest('Add it to your Moments or pick at least one chat', 'no_destination');
  const mediaUrl = req.file ? await saveFile(req.file, 'moments') : null;
  const bg = !req.file ? (d.bg || 'aurora') : null;

  // every Moment is kept for your own profile's Moments tab; only story ones are shown to others (24 h)
  const story = d.story === '1';
  const moment = await one('INSERT INTO moments (author_id, media_url, text, bg, is_story, music_url, music_title, music_start) OUTPUT INSERTED.* VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [req.user.id, mediaUrl, text, bg, story ? 1 : 0, d.musicRef ? playPath(d.musicRef) : null, d.musicRef ? (d.musicTitle || 'Music') : null, d.musicRef ? (d.musicStart || null) : null]);
  const sent = []; const failed = [];
  for (const cid of chats) {
    try {
      const conv = await one('SELECT c.* FROM conversations c JOIN conversation_members m ON m.conversation_id = c.id WHERE c.id=$1 AND m.user_id=$2', [cid, req.user.id]);
      if (!conv) throw notFound('Chat not found');
      await assertCanSend(conv, req.user.id);
      await postMessage(conv, req.user.id, { kind: 'moment', body: JSON.stringify({ text, bg }), mediaUrl });
      sent.push(cid);
    } catch (e) { failed.push({ conversationId: cid, reason: e.message }); }
  }
  if (sent.length) await query('UPDATE moments SET sent_chats=$2 WHERE id=$1', [moment.id, sent.length]).catch(() => {});
  res.status(201).json({ moment: story ? view(moment, true) : null, sent, failed });
}));

r.get('/feed', ah(async (req, res) => {
  const me = req.user.id;
  const rows = await many(
    `SELECT m.*, CASE WHEN v.viewer_id IS NULL THEN 0 ELSE 1 END AS seen
       FROM moments m
       LEFT JOIN moment_views v ON v.moment_id = m.id AND v.viewer_id = $1
      WHERE m.is_story = 1 AND m.deleted_at IS NULL AND m.expires_at > SYSDATETIMEOFFSET()
        AND NOT EXISTS (SELECT 1 FROM users du WHERE du.id = m.author_id AND du.deactivated_at IS NOT NULL)
        AND (m.author_id = $1 OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followee_id = m.author_id AND f.status = N'accepted'))
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = $1 AND b.blocked_id = m.author_id) OR (b.blocker_id = m.author_id AND b.blocked_id = $1))
      ORDER BY m.created_at ASC`, [me]);
  const authorIds = [...new Set(rows.map((x) => String(x.author_id).toLowerCase()))];
  const users = authorIds.length ? await many(`SELECT * FROM users WHERE id IN (${authorIds.map((_, i) => `$${i + 1}`).join(',')})`, authorIds) : [];
  const byId = Object.fromEntries(users.map((u) => [String(u.id).toLowerCase(), u]));
  const groups = authorIds.map((id) => {
    const list = rows.filter((x) => String(x.author_id).toLowerCase() === id);
    const mine = same(id, me);
    return { user: userCard(byId[id]), mine, moments: list.map((x) => view(x, mine || x.seen)), allSeen: mine || list.every((x) => x.seen), latest: list[list.length - 1].created_at };
  });
  groups.sort((a, b) => (a.mine ? -1 : b.mine ? 1 : a.allSeen !== b.allSeen ? (a.allSeen ? 1 : -1) : new Date(b.latest) - new Date(a.latest)));
  res.json({ groups, mine: groups.some((g) => g.mine) });
}));

r.get('/user/:userId', ah(async (req, res) => {
  const authorId = uuid.parse(req.params.userId);
  if (!(await canSee(req.user.id, authorId))) throw forbidden("You can see someone's Moments once you're connected to them", 'not_connected');
  const author = await one('SELECT * FROM users WHERE id=$1', [authorId]);
  if (!author) throw notFound('User not found');
  const rows = await many(
    `SELECT m.*, CASE WHEN v.viewer_id IS NULL THEN 0 ELSE 1 END AS seen FROM moments m
       LEFT JOIN moment_views v ON v.moment_id = m.id AND v.viewer_id = $2
      WHERE m.author_id=$1 AND m.is_story=1 AND m.deleted_at IS NULL AND m.expires_at > SYSDATETIMEOFFSET() ORDER BY m.created_at ASC`, [authorId, req.user.id]);
  const mine = same(authorId, req.user.id);
  const counts = mine && rows.length ? await many(`SELECT moment_id, COUNT(*) AS n FROM moment_views WHERE moment_id IN (${rows.map((_, i) => `$${i + 1}`).join(',')}) GROUP BY moment_id`, rows.map((x) => x.id)) : [];
  const n = Object.fromEntries(counts.map((c) => [String(c.moment_id).toLowerCase(), Number(c.n)]));
  res.json({ user: userCard(author), mine, moments: rows.map((x) => ({ ...view(x, mine || x.seen), ...(mine ? { viewCount: n[String(x.id).toLowerCase()] || 0 } : {}) })) });
}));

// Your own Moments tab on your profile: everything you made (story or sent to chats), newest first. Only you see this.
r.get('/archive', ah(async (req, res) => {
  const rows = await many(
    `SELECT TOP 120 m.*, (SELECT COUNT(*) FROM moment_views v WHERE v.moment_id = m.id) AS view_count
       FROM moments m WHERE m.author_id=$1 AND m.deleted_at IS NULL ORDER BY m.created_at DESC`, [req.user.id]);
  res.json({ moments: rows.map((x) => ({ ...view(x, true), isStory: !!x.is_story, sentChats: Number(x.sent_chats || 0),
    live: !!x.is_story && new Date(x.expires_at) > new Date(), viewCount: Number(x.view_count || 0) })) });
}));

async function visibleMoment(req) {
  const id = uuid.parse(req.params.id);
  const m = await one('SELECT * FROM moments WHERE id=$1 AND is_story=1 AND deleted_at IS NULL AND expires_at > SYSDATETIMEOFFSET()', [id]);
  if (!m || !(await canSee(req.user.id, m.author_id))) throw notFound('This Moment has ended');
  return m;
}

r.post('/:id/view', ah(async (req, res) => {
  const m = await visibleMoment(req);
  if (!same(m.author_id, req.user.id)) {
    await query('IF NOT EXISTS (SELECT 1 FROM moment_views WHERE moment_id=$1 AND viewer_id=$2) INSERT INTO moment_views (moment_id, viewer_id) VALUES ($1, $2)', [m.id, req.user.id]).catch(() => {});
  }
  res.json({ ok: true });
}));

r.get('/:id/viewers', ah(async (req, res) => {
  const m = await visibleMoment(req);
  if (!same(m.author_id, req.user.id)) throw forbidden('Only you can see who viewed your Moment');
  const rows = await many('SELECT v.viewed_at, u.* FROM moment_views v JOIN users u ON u.id = v.viewer_id WHERE v.moment_id=$1 ORDER BY v.viewed_at DESC', [m.id]);
  res.json({ viewers: rows.map((x) => ({ ...userCard(x), viewedAt: x.viewed_at })) });
}));

r.post('/:id/reply', requireSoul, ah(async (req, res) => {
  const m = await visibleMoment(req);
  if (same(m.author_id, req.user.id)) throw badRequest("You can't reply to your own Moment");
  const { text } = z.object({ text: z.string().trim().min(1).max(1000) }).parse(req.body || {});
  if (config.connectRequired && !(await connectionBetween(req.user.id, m.author_id))) {
    throw forbidden('You can reply once you two are Connections.', 'not_connected');
  }
  const conv = await getOrCreateDirect(req.user.id, m.author_id);
  await assertCanSend(conv, req.user.id);
  const message = await postMessage(conv, req.user.id, { kind: 'text', body: text, momentRef: { momentId: m.id, mediaUrl: m.media_url || null, text: m.text ? m.text.slice(0, 80) : null, bg: m.bg || null } });
  res.status(201).json({ conversationId: conv.id, message });
}));

r.delete('/:id', ah(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const m = await one('UPDATE moments SET deleted_at=SYSDATETIMEOFFSET() OUTPUT INSERTED.id WHERE id=$1 AND author_id=$2 AND deleted_at IS NULL', [id, req.user.id]);
  if (!m) throw notFound('Moment not found');
  res.json({ ok: true });
}));

export default r;
