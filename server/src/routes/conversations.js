// Milestone 2: chat. 1:1 and group conversations, message requests, photos, voice notes,
// read receipts ("Seen") and unsend. Real-time delivery goes through realtime.js.
import { Router } from 'express';
import { z } from 'zod';
import { one, many, query, tx } from '../db.js';
import { ah, badRequest, forbidden, notFound } from '../lib/errors.js';
import { requireAuth, requireSoul } from '../middleware/auth.js';
import { uploadMemory, saveFile, mediaKind } from '../providers/storage.js';
import { isBlockedEither, userCard } from '../services/social.js';
import { emitToUsers } from '../realtime.js';
import { config } from '../config.js';
import { connectionBetween } from '../services/connections.js';
import { ownsSoulmoji } from './soulmoji.js';

const r = Router();
r.use(requireAuth);

const MAX_GROUP_MEMBERS = 32;
const uuid = z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid id').transform((v) => v.toLowerCase());
const displayName = (u) => u.display_name || u.username;

// ---------- helpers ----------

// Upper-case both ids first so the same pair always gives the same key, whoever starts the chat
export const directKey = (a, b) => [String(a).toUpperCase(), String(b).toUpperCase()].sort().join(':');

/** Does `follower` follow `followee` (accepted)? */
async function follows(follower, followee) {
  return !!(await one(`SELECT TOP 1 1 AS x FROM follows WHERE follower_id=$1 AND followee_id=$2 AND status=N'accepted'`, [follower, followee]));
}

/** A message from me lands in someone's Requests unless they follow me. */
async function isRequestFor(recipientId, senderId) {
  return !(await follows(recipientId, senderId));
}

async function membership(conversationId, userId) {
  return one('SELECT * FROM conversation_members WHERE conversation_id=$1 AND user_id=$2', [conversationId, userId]);
}

async function loadConversation(req) {
  const id = uuid.parse(req.params.id);
  const conv = await one('SELECT * FROM conversations WHERE id=$1', [id]);
  const me = conv && (await membership(id, req.user.id));
  if (!conv || !me) throw notFound('Conversation not found');
  return { conv, me };
}

async function memberRows(conversationIds) {
  if (!conversationIds.length) return [];
  const ph = conversationIds.map((_, i) => `$${i + 1}`).join(',');
  return many(
    `SELECT cm.conversation_id, cm.role, cm.is_request, cm.last_read_at, cm.joined_at, u.*
       FROM conversation_members cm JOIN users u ON u.id = cm.user_id
      WHERE cm.conversation_id IN (${ph})
      ORDER BY cm.joined_at`,
    conversationIds,
  );
}

export function serializeMessage(m) {
  const deleted = !!m.deleted_at;
  return {
    id: m.id,
    conversationId: m.conversation_id,
    senderId: m.sender_id,
    kind: m.kind,
    body: deleted ? null : m.body,
    mediaUrl: deleted ? null : m.media_url,
    durationMs: m.duration_ms,
    createdAt: m.created_at,
    deleted,
    replyToId: m.reply_to_id ?? null,
    // Soulmoji: a sticker of the sender's own face with a mood + caption (drawn by the app)
    soulmoji: !deleted && m.kind === 'soulmoji' && m.body ? (() => { try { return JSON.parse(m.body); } catch { return null; } })() : null,
  };
}

const SOULMOJI_MOODS = ['happy', 'laugh', 'love', 'sad', 'cry', 'angry', 'shocked', 'tired', 'cool', 'party', 'thinking', 'shy'];

/** Adds reactions and the replied-to message preview (Instagram-style) to a list of messages. */
export async function enrich(messages, meId) {
  if (!messages.length) return messages;
  const ids = messages.map((m) => m.id);
  const ph = ids.map((_, i) => `$${i + 1}`).join(',');
  const reacts = await many(`SELECT message_id, user_id, emoji FROM message_reactions WHERE message_id IN (${ph})`, ids);
  const replyIds = [...new Set(messages.map((m) => m.replyToId).filter(Boolean))];
  const replies = replyIds.length
    ? await many(`SELECT id, sender_id, kind, body, deleted_at FROM messages WHERE id IN (${replyIds.map((_, i) => `$${i + 1}`).join(',')})`, replyIds)
    : [];
  return messages.map((m) => {
    const mine = reacts.filter((x) => x.message_id === m.id);
    const counts = {};
    for (const x of mine) counts[x.emoji] = (counts[x.emoji] || 0) + 1;
    const rp = m.replyToId ? replies.find((x) => x.id === m.replyToId) : null;
    return {
      ...m,
      reactions: Object.entries(counts).map(([emoji, count]) => ({ emoji, count, mine: mine.some((x) => x.emoji === emoji && x.user_id === meId) })),
      replyTo: rp ? { id: rp.id, senderId: rp.sender_id, kind: rp.kind, text: rp.deleted_at ? 'Message unsent' : rp.kind === 'image' ? '📷 Photo' : rp.kind === 'voice' ? '🎤 Voice message' : rp.kind === 'soulmoji' ? '✨ Soulmoji' : rp.body } : null,
    };
  });
}

function preview(m, meId) {
  if (!m) return null;
  let text;
  if (m.deleted) text = 'Message unsent';
  else if (m.kind === 'image') text = '📷 Photo';
  else if (m.kind === 'voice') text = '🎤 Voice message';
  else if (m.kind === 'soulmoji') text = '✨ Soulmoji';
  else text = m.body;
  return { ...m, text: m.kind !== 'system' && m.senderId === meId ? `You: ${text}` : text };
}

function serializeConversation(c, members, meId, lastMessage = null, unread = 0) {
  const others = members.filter((m) => m.id !== meId);
  const mine = members.find((m) => m.id === meId);
  const direct = !c.is_group;
  const other = direct ? others[0] || null : null;
  return {
    id: c.id,
    isGroup: !!c.is_group,
    title: direct ? (other ? displayName(other) : 'Soulink user') : (c.title || others.map(displayName).slice(0, 3).join(', ') || 'Group'),
    avatarUrl: direct ? other?.avatar_url ?? null : c.avatar_url,
    other: other ? userCard(other) : null,
    members: members.map((m) => ({ ...userCard(m), role: m.role, lastReadAt: m.last_read_at })),
    myRole: mine?.role ?? null,
    isRequest: !!mine?.is_request,
    lastMessage: preview(lastMessage, meId),
    unreadCount: unread,
    updatedAt: c.last_message_at || c.created_at,
    createdAt: c.created_at,
  };
}

async function conversationPayload(conv, meId) {
  const members = await memberRows([conv.id]);
  return serializeConversation(conv, members, meId);
}

async function memberIds(conversationId) {
  return (await many('SELECT user_id FROM conversation_members WHERE conversation_id=$1', [conversationId])).map((r) => r.user_id);
}

/** Inserts a message (and bumps the conversation), then pushes it to every member's phone. */
export async function postMessage(conv, senderId, { kind, body = null, mediaUrl = null, durationMs = null, replyToId = null }) {
  const msg = await tx(async (c) => {
    const m = (await c.query(
      `INSERT INTO messages (conversation_id, sender_id, kind, body, media_url, duration_ms, reply_to_id)
       OUTPUT INSERTED.* VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [conv.id, senderId, kind, body, mediaUrl, durationMs, replyToId],
    )).rows[0];
    await c.query('UPDATE conversations SET last_message_at = $2 WHERE id=$1', [conv.id, m.created_at]);
    if (senderId) {
      // Sending a message marks the thread as read for me, and replying to a request accepts it.
      await c.query('UPDATE conversation_members SET last_read_at = $3, is_request = 0 WHERE conversation_id=$1 AND user_id=$2', [conv.id, senderId, m.created_at]);
    }
    return m;
  });
  const [message] = await enrich([serializeMessage(msg)], senderId);
  emitToUsers(await memberIds(conv.id), 'message:new', { conversationId: conv.id, message: { ...message, reactions: [] } });
  return message;
}

export async function systemMessage(conv, text) {
  return postMessage(conv, null, { kind: 'system', body: text });
}

/** In a 1:1 chat, blocked people can't message each other. */
async function assertCanSend(conv, meId) {
  if (conv.is_group) return;
  const others = (await memberIds(conv.id)).filter((id) => id !== meId);
  const otherId = others[0] || conv.direct_key.split(':').find((id) => id !== meId);
  if (await isBlockedEither(meId, otherId)) throw forbidden("You can't message this account", 'blocked');
  // If the other person had deleted this thread, bring it back to them as a request.
  if (!others.length) {
    await query('INSERT INTO conversation_members (conversation_id, user_id, is_request) VALUES ($1, $2, $3)', [conv.id, otherId, (await isRequestFor(otherId, meId)) ? 1 : 0]);
  }
}

// ---------- inbox ----------

// GET /conversations?box=inbox|requests
r.get('/', ah(async (req, res) => {
  const box = req.query.box === 'requests' ? 1 : 0;
  const me = req.user.id;
  const rows = await many(
    `SELECT TOP 50 c.*, cm.is_request AS my_is_request, cm.last_read_at AS my_last_read,
            lm.id AS lm_id, lm.conversation_id AS lm_conversation_id, lm.sender_id AS lm_sender_id, lm.kind AS lm_kind,
            lm.body AS lm_body, lm.media_url AS lm_media_url, lm.duration_ms AS lm_duration_ms,
            lm.created_at AS lm_created_at, lm.deleted_at AS lm_deleted_at,
            (SELECT COUNT(*) FROM messages m
              WHERE m.conversation_id = c.id AND m.kind <> N'system' AND m.sender_id <> $1
                AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)) AS unread
       FROM conversation_members cm
       JOIN conversations c ON c.id = cm.conversation_id
       OUTER APPLY (SELECT TOP 1 * FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC) lm
      WHERE cm.user_id = $1 AND cm.is_request = $2
        AND (c.is_group = 1 OR c.last_message_at IS NOT NULL OR c.created_by = $1)
        AND ($2 = 0 OR c.last_message_at IS NOT NULL)
        AND (c.is_group = 1 OR NOT EXISTS (
              SELECT 1 FROM conversation_members o JOIN blocks b
                ON (b.blocker_id = $1 AND b.blocked_id = o.user_id) OR (b.blocker_id = o.user_id AND b.blocked_id = $1)
               WHERE o.conversation_id = c.id AND o.user_id <> $1))
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`,
    [me, box],
  );
  const members = await memberRows(rows.map((c) => c.id));
  const byConv = new Map();
  for (const m of members) {
    if (!byConv.has(m.conversation_id)) byConv.set(m.conversation_id, []);
    byConv.get(m.conversation_id).push(m);
  }
  const conversations = rows.map((c) => {
    const lm = c.lm_id ? serializeMessage({
      id: c.lm_id, conversation_id: c.lm_conversation_id, sender_id: c.lm_sender_id, kind: c.lm_kind, body: c.lm_body,
      media_url: c.lm_media_url, duration_ms: c.lm_duration_ms, created_at: c.lm_created_at, deleted_at: c.lm_deleted_at,
    }) : null;
    return serializeConversation(c, byConv.get(c.id) || [], me, lm, c.unread);
  });
  const requests = box === 0
    ? (await one(`SELECT COUNT(*) AS n FROM conversation_members cm JOIN conversations c ON c.id = cm.conversation_id
                   WHERE cm.user_id=$1 AND cm.is_request = 1 AND c.last_message_at IS NOT NULL`, [me])).n
    : conversations.length;
  res.json({ conversations, requestCount: requests });
}));

// Badge on the Messages icon: chats with unread messages, plus pending requests
r.get('/unread', ah(async (req, res) => {
  const row = await one(
    `SELECT
       (SELECT COUNT(*) FROM conversation_members cm
         WHERE cm.user_id = $1 AND cm.is_request = 0
           AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = cm.conversation_id AND m.kind <> N'system'
                        AND m.sender_id <> $1 AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at))) AS chats,
       (SELECT COUNT(*) FROM conversation_members cm JOIN conversations c ON c.id = cm.conversation_id
         WHERE cm.user_id = $1 AND cm.is_request = 1 AND c.last_message_at IS NOT NULL) AS requests`,
    [req.user.id],
  );
  res.json(row);
}));

// ---------- start conversations ----------

// POST /conversations/direct { userId } → the 1:1 thread with that person (created if needed)
r.post('/direct', requireSoul, ah(async (req, res) => {
  const { userId } = z.object({ userId: uuid }).parse(req.body);
  const me = req.user.id;
  if (userId === me) throw badRequest("You can't message yourself");
  const target = await one('SELECT * FROM users WHERE id=$1 AND onboarding_done = 1', [userId]);
  if (!target || (await isBlockedEither(me, userId))) throw notFound('User not found');
  if (config.connectRequired && !(await connectionBetween(me, userId))) {
    throw forbidden('Connect first: the chat opens once they accept your request.', 'not_connected');
  }

  const key = directKey(me, userId);
  let conv = await one('SELECT * FROM conversations WHERE direct_key=$1', [key]);
  if (!conv) {
    const targetIsRequest = await isRequestFor(userId, me);
    try {
      conv = await tx(async (c) => {
        const created = (await c.query('INSERT INTO conversations (is_group, created_by, direct_key) OUTPUT INSERTED.* VALUES (0, $1, $2)', [me, key])).rows[0];
        await c.query('INSERT INTO conversation_members (conversation_id, user_id, is_request) VALUES ($1, $2, 0), ($1, $3, $4)', [created.id, me, userId, targetIsRequest ? 1 : 0]);
        return created;
      });
    } catch (e) {
      if (e?.number !== 2601 && e?.number !== 2627 && e?.originalError?.info?.number !== 2601) throw e;
      conv = await one('SELECT * FROM conversations WHERE direct_key=$1', [key]); // created by a double tap
    }
  } else if (!(await membership(conv.id, me))) {
    await query('INSERT INTO conversation_members (conversation_id, user_id, is_request) VALUES ($1, $2, 0)', [conv.id, me]);
  }
  res.json({ conversation: await conversationPayload(conv, me) });
}));

// POST /conversations/group { title?, userIds[] }
r.post('/group', requireSoul, ah(async (req, res) => {
  const data = z.object({
    title: z.string().trim().max(100).optional(),
    userIds: z.array(uuid).min(2, 'Pick at least 2 people for a group').max(MAX_GROUP_MEMBERS - 1),
  }).parse(req.body);
  const me = req.user.id;
  const ids = [...new Set(data.userIds.filter((id) => id !== me))];
  if (ids.length < 2) throw badRequest('Pick at least 2 people for a group');
  const ph = ids.map((_, i) => `$${i + 1}`).join(',');
  const users = await many(`SELECT * FROM users WHERE onboarding_done = 1 AND id IN (${ph})`, ids);
  if (users.length !== ids.length) throw badRequest('Some of those people could not be found');
  for (const id of ids) if (await isBlockedEither(me, id)) throw badRequest('Some of those people could not be found');
  if (config.connectRequired) {
    for (const id of ids) if (!(await connectionBetween(me, id))) throw forbidden('You can only add people you are connected with.', 'not_connected');
  }

  const requestFlags = await Promise.all(ids.map((id) => isRequestFor(id, me)));
  const conv = await tx(async (c) => {
    const created = (await c.query('INSERT INTO conversations (is_group, title, created_by) OUTPUT INSERTED.* VALUES (1, $1, $2)', [data.title || null, me])).rows[0];
    await c.query(`INSERT INTO conversation_members (conversation_id, user_id, role, is_request) VALUES ($1, $2, N'admin', 0)`, [created.id, me]);
    for (let i = 0; i < ids.length; i++) {
      await c.query(`INSERT INTO conversation_members (conversation_id, user_id, role, is_request) VALUES ($1, $2, N'member', $3)`, [created.id, ids[i], requestFlags[i] ? 1 : 0]);
    }
    return created;
  });
  await systemMessage(conv, `${displayName(req.user)} created the group`);
  const fresh = await one('SELECT * FROM conversations WHERE id=$1', [conv.id]);
  res.status(201).json({ conversation: await conversationPayload(fresh, me) });
}));

// ---------- one conversation ----------

r.get('/:id', ah(async (req, res) => {
  const { conv } = await loadConversation(req);
  res.json({ conversation: await conversationPayload(conv, req.user.id) });
}));

// GET /conversations/:id/messages?before=ISO&limit=30  (newest first)
r.get('/:id/messages', ah(async (req, res) => {
  const { conv } = await loadConversation(req);
  const limit = z.coerce.number().int().min(1).max(100).default(30).parse(req.query.limit ?? undefined);
  const before = req.query.before ? z.string().datetime({ offset: true }).parse(req.query.before) : null;
  const rows = await many(
    `SELECT TOP (${limit}) * FROM messages WHERE conversation_id=$1 AND ($2 IS NULL OR created_at < CAST($2 AS DATETIMEOFFSET))
      ORDER BY created_at DESC`,
    [conv.id, before],
  );
  res.json({ messages: await enrich(rows.map(serializeMessage), req.user.id), hasMore: rows.length === limit });
}));

// POST /conversations/:id/messages { body, replyToId? } or { soulmoji: { mood, caption }, replyToId? }
r.post('/:id/messages', ah(async (req, res) => {
  const { conv } = await loadConversation(req);
  const data = z.object({
    body: z.string().trim().min(1, 'Write a message').max(2000).optional(),
    soulmoji: z.object({ mood: z.enum(SOULMOJI_MOODS), caption: z.string().trim().max(40).optional(), imageUrl: z.string().max(300).optional() }).optional(),
    replyToId: uuid.optional(),
  }).refine((d) => !!d.body !== !!d.soulmoji, 'Send a message or a Soulmoji').parse(req.body);
  await assertCanSend(conv, req.user.id);
  if (data.replyToId && !(await one('SELECT id FROM messages WHERE id=$1 AND conversation_id=$2', [data.replyToId, conv.id]))) throw badRequest('That message is not in this chat');
  if (data.soulmoji?.imageUrl && !(await ownsSoulmoji(req.user.id, data.soulmoji.imageUrl))) throw badRequest('That Soulmoji is not yours', 'not_your_soulmoji');
  if (data.soulmoji && !data.soulmoji.imageUrl && !req.user.avatar_url) throw badRequest('Take your Soulmoji selfie first', 'no_face_photo');
  const payload = data.soulmoji
    ? { kind: 'soulmoji', body: JSON.stringify({ mood: data.soulmoji.mood, caption: data.soulmoji.caption || null, faceUrl: req.user.avatar_url, imageUrl: data.soulmoji.imageUrl || null }) }
    : { kind: 'text', body: data.body };
  res.status(201).json({ message: await postMessage(conv, req.user.id, { ...payload, replyToId: data.replyToId || null }) });
}));

// POST /conversations/:id/messages/:messageId/react { emoji }  (one reaction per person; same emoji again removes it)
r.post('/:id/messages/:messageId/react', ah(async (req, res) => {
  const { conv } = await loadConversation(req);
  const messageId = uuid.parse(req.params.messageId);
  const { emoji } = z.object({ emoji: z.string().min(1).max(16) }).parse(req.body);
  const msg = await one('SELECT id FROM messages WHERE id=$1 AND conversation_id=$2 AND deleted_at IS NULL', [messageId, conv.id]);
  if (!msg) throw notFound('Message not found');
  const existing = await one('SELECT emoji FROM message_reactions WHERE message_id=$1 AND user_id=$2', [messageId, req.user.id]);
  if (existing?.emoji === emoji) await query('DELETE FROM message_reactions WHERE message_id=$1 AND user_id=$2', [messageId, req.user.id]);
  else if (existing) await query('UPDATE message_reactions SET emoji=$3, created_at=SYSDATETIMEOFFSET() WHERE message_id=$1 AND user_id=$2', [messageId, req.user.id, emoji]);
  else await query('INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)', [messageId, req.user.id, emoji]);
  const rows = await many('SELECT user_id, emoji FROM message_reactions WHERE message_id=$1', [messageId]);
  const counts = {};
  for (const x of rows) counts[x.emoji] = (counts[x.emoji] || 0) + 1;
  const reactions = Object.entries(counts).map(([e, count]) => ({ emoji: e, count, userIds: rows.filter((x) => x.emoji === e).map((x) => x.user_id) }));
  emitToUsers(await memberIds(conv.id), 'message:reactions', { conversationId: conv.id, messageId, reactions });
  res.json({ messageId, reactions: reactions.map((x) => ({ emoji: x.emoji, count: x.count, mine: x.userIds.includes(req.user.id) })) });
}));

// POST /conversations/:id/media  (multipart: file = photo or voice note, durationMs for voice)
r.post('/:id/media', uploadMemory('media', 25).single('file'), ah(async (req, res) => {
  const { conv } = await loadConversation(req);
  if (!req.file) throw badRequest('No file uploaded');
  const kind = mediaKind(req.file.mimetype);
  await assertCanSend(conv, req.user.id);
  const url = await saveFile(req.file, 'chat', 'media');
  const durationMs = kind === 'voice' ? z.coerce.number().int().min(0).max(10 * 60 * 1000).parse(req.body.durationMs ?? 0) : null;
  const body = kind === 'image' ? z.string().max(2000).optional().parse(req.body.caption) || null : null;
  res.status(201).json({ message: await postMessage(conv, req.user.id, { kind, mediaUrl: url, durationMs, body }) });
}));

// POST /conversations/:id/read → "Seen"
r.post('/:id/read', ah(async (req, res) => {
  const { conv } = await loadConversation(req);
  const row = await one('UPDATE conversation_members SET last_read_at = SYSDATETIMEOFFSET() OUTPUT INSERTED.last_read_at WHERE conversation_id=$1 AND user_id=$2', [conv.id, req.user.id]);
  emitToUsers(await memberIds(conv.id), 'read', { conversationId: conv.id, userId: req.user.id, at: row.last_read_at });
  res.json({ ok: true });
}));

// DELETE /conversations/:id/messages/:messageId → unsend your own message
r.delete('/:id/messages/:messageId', ah(async (req, res) => {
  const { conv } = await loadConversation(req);
  const messageId = uuid.parse(req.params.messageId);
  const row = await one(
    `UPDATE messages SET deleted_at = SYSDATETIMEOFFSET(), body = NULL, media_url = NULL
     OUTPUT INSERTED.* WHERE id=$1 AND conversation_id=$2 AND sender_id=$3 AND deleted_at IS NULL`,
    [messageId, conv.id, req.user.id],
  );
  if (!row) throw notFound('Message not found');
  const message = serializeMessage(row);
  emitToUsers(await memberIds(conv.id), 'message:deleted', { conversationId: conv.id, message });
  res.json({ message });
}));

// ---------- message requests ----------

r.post('/:id/accept', ah(async (req, res) => {
  const { conv } = await loadConversation(req);
  await query('UPDATE conversation_members SET is_request = 0 WHERE conversation_id=$1 AND user_id=$2', [conv.id, req.user.id]);
  res.json({ conversation: await conversationPayload(conv, req.user.id) });
}));

// Delete a request, or delete a 1:1 chat from your inbox (it comes back if they message again)
r.delete('/:id', ah(async (req, res) => {
  const { conv } = await loadConversation(req);
  if (conv.is_group) throw badRequest('Use "Leave group" for groups');
  await query('DELETE FROM conversation_members WHERE conversation_id=$1 AND user_id=$2', [conv.id, req.user.id]);
  res.json({ ok: true });
}));

// ---------- groups ----------

async function requireAdmin(me) {
  if (me.role !== 'admin') throw forbidden('Only group admins can do that');
}
async function requireGroup(conv) {
  if (!conv.is_group) throw badRequest('This is not a group');
}

r.patch('/:id', ah(async (req, res) => {
  const { conv } = await loadConversation(req);
  await requireGroup(conv);
  const { title } = z.object({ title: z.string().trim().min(1).max(100) }).parse(req.body);
  const updated = await one('UPDATE conversations SET title=$2 OUTPUT INSERTED.* WHERE id=$1', [conv.id, title]);
  await systemMessage(updated, `${displayName(req.user)} named the group "${title}"`);
  res.json({ conversation: await conversationPayload(updated, req.user.id) });
}));

r.post('/:id/members', ah(async (req, res) => {
  const { conv, me } = await loadConversation(req);
  await requireGroup(conv);
  await requireAdmin(me);
  const { userIds } = z.object({ userIds: z.array(uuid).min(1).max(MAX_GROUP_MEMBERS) }).parse(req.body);
  const current = new Set(await memberIds(conv.id));
  const toAdd = [...new Set(userIds)].filter((id) => !current.has(id));
  if (current.size + toAdd.length > MAX_GROUP_MEMBERS) throw badRequest(`Groups can have up to ${MAX_GROUP_MEMBERS} people`);
  const added = [];
  for (const id of toAdd) {
    const u = await one('SELECT * FROM users WHERE id=$1 AND onboarding_done = 1', [id]);
    if (!u || (await isBlockedEither(req.user.id, id))) continue;
    await query(`INSERT INTO conversation_members (conversation_id, user_id, role, is_request) VALUES ($1, $2, N'member', $3)`, [conv.id, id, (await isRequestFor(id, req.user.id)) ? 1 : 0]);
    added.push(displayName(u));
  }
  if (added.length) await systemMessage(conv, `${displayName(req.user)} added ${added.join(', ')}`);
  const fresh = await one('SELECT * FROM conversations WHERE id=$1', [conv.id]);
  res.json({ conversation: await conversationPayload(fresh, req.user.id) });
}));

// DELETE /conversations/:id/members/:userId  ("me" = leave the group)
r.delete('/:id/members/:userId', ah(async (req, res) => {
  const { conv, me } = await loadConversation(req);
  await requireGroup(conv);
  const leaving = req.params.userId === 'me' || req.params.userId.toLowerCase() === req.user.id;
  const targetId = leaving ? req.user.id : uuid.parse(req.params.userId);
  if (!leaving) await requireAdmin(me);
  const target = await one('SELECT * FROM users WHERE id=$1', [targetId]);
  const removed = await one('DELETE FROM conversation_members OUTPUT DELETED.role WHERE conversation_id=$1 AND user_id=$2', [conv.id, targetId]);
  if (!removed) throw notFound('That person is not in this group');
  // A group always keeps an admin: promote the longest-standing member if needed.
  const admins = await one(`SELECT COUNT(*) AS n FROM conversation_members WHERE conversation_id=$1 AND role=N'admin'`, [conv.id]);
  if (admins.n === 0) {
    await query(`UPDATE conversation_members SET role=N'admin' WHERE conversation_id=$1 AND user_id =
                  (SELECT TOP 1 user_id FROM conversation_members WHERE conversation_id=$1 ORDER BY joined_at)`, [conv.id]);
  }
  await systemMessage(conv, leaving ? `${displayName(req.user)} left the group` : `${displayName(req.user)} removed ${displayName(target)}`);
  res.json({ ok: true });
}));

export default r;
