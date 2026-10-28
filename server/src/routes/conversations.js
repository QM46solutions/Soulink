// Milestone 2: chat. 1:1 and group conversations, message requests, photos, voice notes,
// read receipts ("Seen") and unsend. Real-time delivery goes through realtime.js.
import { Router } from 'express';
import { z } from 'zod';
import { one, many, query, tx } from '../db.js';
import { ah, badRequest, forbidden, notFound, HttpError } from '../lib/errors.js';
import { requireAuth, requireSoul } from '../middleware/auth.js';
import { uploadMemory, saveFile, mediaKind, persistFile } from '../providers/storage.js';
import { isBlockedEither, userCard } from '../services/social.js';
import { emitToUsers } from '../realtime.js';
import { config } from '../config.js';
import { pushTo } from '../services/push.js';
import { connectionBetween, heldBetween } from '../services/connections.js';
import { ownsSoulmoji } from './soulmoji.js';
import { paymentsLive, testPaymentsAllowed } from '../lib/payments.js';
import { aiSpeak, aiTranscribe, aiTranslate, canTranslate, detectLanguage, TRANSLATE_LANGS, voiceInstalled } from '../services/soulmojiAi.js';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

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
  if (!conv || !me || me.hidden_at) throw notFound('Conversation not found'); // hidden = a held chat that ended without a connection
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
    // a shared post: small preview (the post itself is checked again when it's opened)
    post: !deleted && m.kind === 'post' && m.body ? (() => { try { return JSON.parse(m.body); } catch { return null; } })() : null,
    // "+" menu attachments: location { lat, lon, label }, contact { userId, username, displayName, avatarUrl },
    // document { name, size }, poll { question, options[] } (votes are added in enrich)
    ...(!deleted && ['location', 'contact', 'document', 'poll'].includes(m.kind) && m.body ? (() => { try { return { [m.kind]: JSON.parse(m.body) }; } catch { return {}; } })() : {}),
    vanish: !!m.vanish, // sent in private chat: disappears after it's seen
    savedAt: m.saved_at ?? null,
    // a reply to someone's Moment: small preview of that Moment
    momentRef: !deleted && m.moment_ref ? (() => { try { return JSON.parse(m.moment_ref); } catch { return null; } })() : null,
  };
}

const momentBody = (b) => { try { return JSON.parse(b || '{}'); } catch { return {}; } };
/** A chat Moment as one person sees it: opens once, one replay, or saved to stay. Hidden content is never sent. */
function momentFor(m, meId, opensByUser) {
  const body = momentBody(m.body);
  const mine = String(m.senderId).toLowerCase() === String(meId).toLowerCase();
  const saved = !!m.savedAt;
  const base = { ...m, body: null, mediaUrl: null };
  if (mine) {
    const others = Object.entries(opensByUser).filter(([u]) => u !== String(meId).toLowerCase()).map(([, n]) => n);
    const most = others.length ? Math.max(...others) : 0;
    return { ...m, body: null, moment: { text: body.text || null, bg: body.bg || null, hasPhoto: !!m.mediaUrl, status: saved ? 'saved' : most >= 2 ? 'replayed' : most === 1 ? 'opened' : 'delivered', mine: true } };
  }
  const opens = opensByUser[String(meId).toLowerCase()] || 0;
  if (saved) return { ...m, body: null, moment: { text: body.text || null, bg: body.bg || null, hasPhoto: !!m.mediaUrl, status: 'saved', mine: false } };
  return { ...base, moment: { text: null, bg: body.bg || null, hasPhoto: !!m.mediaUrl, status: opens === 0 ? 'new' : opens === 1 ? 'opened' : 'gone', canReplay: opens === 1, mine: false } };
}

const SOULMOJI_MOODS = ['happy', 'laugh', 'love', 'sad', 'cry', 'angry', 'shocked', 'tired', 'cool', 'party', 'thinking', 'shy'];

/** Adds reactions and the replied-to message preview (Instagram-style) to a list of messages. */
// polls: counts per option + what I picked
async function withPolls(messages, meId) {
  const ids = messages.filter((m) => m.kind === 'poll' && m.poll).map((m) => m.id);
  if (!ids.length) return messages;
  const rows = await many(`SELECT message_id, user_id, option_idx FROM poll_votes WHERE message_id IN (${ids.map((_, i) => `$${i + 1}`).join(',')})`, ids);
  return messages.map((m) => {
    if (m.kind !== 'poll' || !m.poll) return m;
    const mine = rows.filter((r) => String(r.message_id).toLowerCase() === String(m.id).toLowerCase());
    const counts = m.poll.options.map((_, i) => mine.filter((r) => Number(r.option_idx) === i).length);
    const myVote = mine.find((r) => String(r.user_id).toLowerCase() === String(meId).toLowerCase());
    return { ...m, poll: { ...m.poll, counts, total: mine.length, myVote: myVote ? Number(myVote.option_idx) : null } };
  });
}

export async function enrich(messages, meId) {
  if (!messages.length) return messages;
  const out = await withPolls(await enrichBase(messages, meId), meId);
  const momentIds = out.filter((m) => m.kind === 'moment' && !m.deleted).map((m) => m.id);
  if (!momentIds.length) return out;
  const rows = await many(`SELECT message_id, user_id, opens FROM chat_moment_opens WHERE message_id IN (${momentIds.map((_, i) => `$${i + 1}`).join(',')})`, momentIds);
  const by = {};
  for (const r of rows) ((by[String(r.message_id).toLowerCase()] ||= {})[String(r.user_id).toLowerCase()] = Number(r.opens));
  return out.map((m) => (m.kind === 'moment' && !m.deleted ? momentFor(m, meId, by[String(m.id).toLowerCase()] || {}) : m));
}

async function enrichBase(messages, meId) {
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
      replyTo: rp ? { id: rp.id, senderId: rp.sender_id, kind: rp.kind, text: rp.deleted_at ? 'Message unsent' : rp.kind === 'image' ? '📷 Photo' : rp.kind === 'voice' ? '🎤 Voice message' : rp.kind === 'soulmoji' ? '✨ Soulmoji' : rp.kind === 'post' ? '📮 Post' : rp.kind === 'location' ? '📍 Location' : rp.kind === 'contact' ? '👤 Contact' : rp.kind === 'document' ? '📄 Document' : rp.kind === 'poll' ? '📊 Poll' : rp.body } : null,
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
  else if (m.kind === 'post') text = '📮 Shared a post';
  else if (m.kind === 'moment') text = '📸 Moment';
  else if (m.kind === 'location') text = '📍 Location';
  else if (m.kind === 'contact') text = `👤 ${m.contact?.displayName || 'Contact'}`;
  else if (m.kind === 'document') text = `📄 ${m.document?.name || 'Document'}`;
  else if (m.kind === 'poll') text = `📊 ${m.poll?.question || 'Poll'}`;
  else if (m.momentRef) text = `↩︎ Moment: ${m.body}`;
  else text = m.body;
  const safe = m.kind === 'moment' ? { ...m, body: null, mediaUrl: null } : m; // a Moment's content never travels in the inbox
  return { ...safe, text: m.kind !== 'system' && m.senderId === meId ? `You: ${text}` : text };
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
    other: other ? { ...userCard(other), chatLanguage: other.chat_language || null } : null, // chatLanguage: default for the message-box translator
    members: members.map((m) => ({ ...userCard(m), role: m.role, lastReadAt: m.last_read_at })),
    myRole: mine?.role ?? null,
    isRequest: !!mine?.is_request,
    privateMode: !!c.private_mode,
    lastMessage: preview(lastMessage, meId),
    unreadCount: unread,
    updatedAt: c.last_message_at || c.created_at,
    createdAt: c.created_at,
  };
}

/** A held Connect request between me and them, as the chat shows it (null if none). */
export async function heldInfo(meId, otherId) {
  const h = await heldBetween(meId, otherId);
  if (!h) return null;
  return { requestId: h.id, until: h.hold_until, decideBy: h.hold_decide_until || null, iHeld: String(h.to_id).toLowerCase() === String(meId).toLowerCase(), canExtend: !h.hold_extended };
}

async function conversationPayload(conv, meId) {
  const members = await memberRows([conv.id]);
  const out = serializeConversation(conv, members, meId);
  // 1:1 chats only work between Connections, or while a Connect request is on hold (that chat sits in Requests).
  // Otherwise the app shows "Connect to chat" instead of the message box.
  out.held = null;
  if (!conv.is_group && out.other && config.connectRequired) {
    out.canMessage = !!(await connectionBetween(meId, out.other.id));
    if (!out.canMessage) { out.held = await heldInfo(meId, out.other.id); out.canMessage = !!out.held; }
  } else out.canMessage = true;
  return out;
}

async function memberIds(conversationId) {
  return (await many('SELECT user_id FROM conversation_members WHERE conversation_id=$1', [conversationId])).map((r) => r.user_id);
}

/** Inserts a message (and bumps the conversation), then pushes it to every member's phone. */
export async function postMessage(conv, senderId, { kind, body = null, mediaUrl = null, durationMs = null, replyToId = null, momentRef = null }) {
  // replying moves a chat out of Requests, but only between Connections (a held chat or a paid message stays a request)
  let clearRequest = true;
  if (config.connectRequired && senderId && !conv.is_group && conv.direct_key) {
    const otherId = conv.direct_key.split(':').find((id) => id.toUpperCase() !== String(senderId).toUpperCase());
    if (otherId && !(await connectionBetween(senderId, otherId))) clearRequest = false;
  }
  const msg = await tx(async (c) => {
    const vanish = !!conv.private_mode && kind !== 'system' ? 1 : 0; // private chat: gone once it's been seen
    const m = (await c.query(
      `INSERT INTO messages (conversation_id, sender_id, kind, body, media_url, duration_ms, reply_to_id, moment_ref, vanish)
       OUTPUT INSERTED.* VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [conv.id, senderId, kind, body, mediaUrl, durationMs, replyToId, momentRef ? JSON.stringify(momentRef) : null, vanish],
    )).rows[0];
    await c.query('UPDATE conversations SET last_message_at = $2 WHERE id=$1', [conv.id, m.created_at]);
    if (senderId) {
      // Sending a message marks the thread as read for me, and replying to a request accepts it.
      await c.query(`UPDATE conversation_members SET last_read_at = $3${clearRequest ? ', is_request = 0' : ''} WHERE conversation_id=$1 AND user_id=$2`, [conv.id, senderId, m.created_at]);
    }
    return m;
  });
  const [message] = await enrich([serializeMessage(msg)], senderId);
  const members = await memberIds(conv.id);
  if (kind === 'moment') {
    // everyone else gets the closed Moment (tap to open); the content is never pushed to them
    const closed = momentFor(serializeMessage(msg), null, {});
    emitToUsers([senderId], 'message:new', { conversationId: conv.id, message: { ...message, reactions: [] } });
    emitToUsers(members.filter((id) => String(id).toLowerCase() !== String(senderId).toLowerCase()), 'message:new', { conversationId: conv.id, message: { ...closed, reactions: [] } });
  } else emitToUsers(members, 'message:new', { conversationId: conv.id, message: { ...message, reactions: [] } });
  if (senderId) pushMessage(conv, senderId, members, kind, body).catch(() => {}); // phone notifications, in the background
  return message;
}

// Phone notification for a new chat message ("Nikhil: see you at 6" / "Nikhil sent a photo")
async function pushMessage(conv, senderId, members, kind, body) {
  const others = members.filter((id) => String(id).toLowerCase() !== String(senderId).toLowerCase());
  if (!others.length) return;
  const s = await one('SELECT username, display_name FROM users WHERE id=$1', [senderId]);
  const who = s?.display_name || s?.username || 'Someone';
  const what = kind === 'text' ? String(body || '').slice(0, 140) : kind === 'image' ? '📷 Photo' : kind === 'voice' ? '🎤 Voice message' : kind === 'soulmoji' ? '😊 Soulmoji' : kind === 'post' ? '📌 Shared a post' : kind === 'moment' ? '📸 Sent you a Moment' : kind === 'location' ? '📍 Shared a location' : kind === 'contact' ? '👤 Shared a contact' : kind === 'document' ? '📄 Sent a document' : kind === 'poll' ? '📊 Started a poll' : 'New message';
  const title = conv.is_group && conv.title ? `${who} · ${conv.title}` : who;
  for (const id of others) await pushTo(id, 'messages', { title, body: what, url: `/chat/${conv.id}`, tag: `chat-${conv.id}` });
}

export async function systemMessage(conv, text) {
  return postMessage(conv, null, { kind: 'system', body: text });
}

/** In a 1:1 chat, blocked people can't message each other. */
export async function assertCanSend(conv, meId) {
  if (conv.is_group) return;
  const others = (await memberIds(conv.id)).filter((id) => id !== meId);
  // direct_key is stored in upper case, ids may come back in either case: compare case-insensitively
  const otherId = others[0] || conv.direct_key.split(':').find((id) => id.toUpperCase() !== String(meId).toUpperCase());
  if (await isBlockedEither(meId, otherId)) throw forbidden("You can't message this account", 'blocked');
  // No messages (not even a first "hi") until you're connected. Exceptions: one paid message (/paid-message), and a
  // Connect request on hold: the two can chat until the hold ends (that chat stays in Requests).
  if (config.connectRequired && !(await connectionBetween(meId, otherId)) && !(await heldBetween(meId, otherId))) {
    throw forbidden('You can message them once you are connected. Send a Connect request first.', 'not_connected');
  }
  // If the other person had deleted this thread, bring it back to them as a request.
  if (!others.length) {
    await query('INSERT INTO conversation_members (conversation_id, user_id, is_request) VALUES ($1, $2, $3)', [conv.id, otherId, (await isRequestFor(otherId, meId)) ? 1 : 0]);
  }
}

/** Send a post into a chat I'm in (used by "Share" on a post). The message keeps a small preview of the post. */
export async function sharePostToChat(conversationId, user, snapshot) {
  const conv = await one(
    'SELECT c.* FROM conversations c JOIN conversation_members m ON m.conversation_id = c.id WHERE c.id=$1 AND m.user_id=$2', [conversationId, user.id],
  );
  if (!conv) throw notFound('Chat not found');
  await assertCanSend(conv, user.id);
  return postMessage(conv, user.id, { kind: 'post', body: JSON.stringify(snapshot) });
}

// ---------- inbox ----------

// GET /conversations?box=inbox|requests   (?kind=group: all my groups, inbox and requests together)
r.get('/', ah(async (req, res) => {
  const box = req.query.box === 'requests' ? 1 : 0;
  const groupsOnly = req.query.kind === 'group' ? 1 : 0;
  const me = req.user.id;
  const rows = await many(
    `SELECT TOP 200 c.*, cm.is_request AS my_is_request, cm.last_read_at AS my_last_read,
            lm.id AS lm_id, lm.conversation_id AS lm_conversation_id, lm.sender_id AS lm_sender_id, lm.kind AS lm_kind,
            lm.body AS lm_body, lm.media_url AS lm_media_url, lm.duration_ms AS lm_duration_ms,
            lm.created_at AS lm_created_at, lm.deleted_at AS lm_deleted_at,
            (SELECT COUNT(*) FROM messages m
              WHERE m.conversation_id = c.id AND m.kind <> N'system' AND m.sender_id <> $1
                AND (c.history_from IS NULL OR m.created_at > c.history_from)
                AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)) AS unread
       FROM conversation_members cm
       JOIN conversations c ON c.id = cm.conversation_id
       OUTER APPLY (SELECT TOP 1 * FROM messages m WHERE m.conversation_id = c.id AND m.vanished_at IS NULL
                     AND (c.history_from IS NULL OR m.created_at > c.history_from) ORDER BY m.created_at DESC) lm
      WHERE cm.user_id = $1 AND cm.hidden_at IS NULL AND ($3 = 1 OR cm.is_request = $2) AND ($3 = 0 OR c.is_group = 1)
        AND (c.is_group = 1 OR c.last_message_at IS NOT NULL OR c.created_by = $1)
        AND ($3 = 1 OR $2 = 0 OR c.last_message_at IS NOT NULL)
        AND (c.is_group = 1 OR NOT EXISTS (
              SELECT 1 FROM conversation_members o JOIN blocks b
                ON (b.blocker_id = $1 AND b.blocked_id = o.user_id) OR (b.blocker_id = o.user_id AND b.blocked_id = $1)
               WHERE o.conversation_id = c.id AND o.user_id <> $1))
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`,
    [me, box, groupsOnly],
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
  // Requests are only ever (1) a paid message from someone you're not connected with, or (2) a chat while a
  // Connect request is on hold. Tell the app which is which.
  if (box === 1) {
    for (const cv of conversations) {
      if (cv.isGroup || !cv.other) continue;
      cv.held = await heldInfo(me, cv.other.id);
      if (!cv.held) cv.paid = !!(await one('SELECT TOP 1 1 AS x FROM paid_messages WHERE conversation_id=$1', [cv.id]));
    }
  }
  const requests = box === 0
    ? (await one(`SELECT COUNT(*) AS n FROM conversation_members cm JOIN conversations c ON c.id = cm.conversation_id
                   WHERE cm.user_id=$1 AND cm.is_request = 1 AND cm.hidden_at IS NULL AND c.last_message_at IS NOT NULL`, [me])).n
    : conversations.length;
  res.json({ conversations, requestCount: requests });
}));

// Badge on the Messages icon: chats with unread messages, plus pending requests
r.get('/unread', ah(async (req, res) => {
  const row = await one(
    `SELECT
       (SELECT COUNT(*) FROM conversation_members cm
         WHERE cm.user_id = $1 AND cm.is_request = 0 AND cm.hidden_at IS NULL
           AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = cm.conversation_id AND m.kind <> N'system'
                        AND m.sender_id <> $1 AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at))) AS chats,
       (SELECT COUNT(*) FROM conversation_members cm JOIN conversations c ON c.id = cm.conversation_id
         WHERE cm.user_id = $1 AND cm.is_request = 1 AND cm.hidden_at IS NULL AND c.last_message_at IS NOT NULL) AS requests,
       (SELECT COUNT(*) FROM anon_threads t
         WHERE ((t.sender_id = $1 AND t.hidden_by_sender = 0) OR (t.recipient_id = $1 AND t.hidden_by_recipient = 0))
           AND EXISTS (SELECT 1 FROM connections cx WHERE (cx.user_a = t.sender_id AND cx.user_b = t.recipient_id) OR (cx.user_a = t.recipient_id AND cx.user_b = t.sender_id))
           AND EXISTS (SELECT 1 FROM anon_messages am WHERE am.thread_id = t.id
                        AND am.from_sender = CASE WHEN t.sender_id = $1 THEN 0 ELSE 1 END
                        AND am.created_at > ISNULL(CASE WHEN t.sender_id = $1 THEN t.sender_read_at ELSE t.recipient_read_at END, '1900-01-01'))) AS anon`,
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
  const target = await one('SELECT * FROM users WHERE id=$1 AND onboarding_done = 1 AND deactivated_at IS NULL', [userId]);
  if (!target || (await isBlockedEither(me, userId))) throw notFound('User not found');
  if (config.connectRequired && !(await connectionBetween(me, userId)) && !(await heldBetween(me, userId))) {
    throw forbidden('Connect first: the chat opens once they accept your request.', 'not_connected');
  }

  const conv = await getOrCreateDirect(me, userId);
  res.json({ conversation: await conversationPayload(conv, me) });
}));

/** The 1:1 chat between two people, created if needed (callers check who may chat first). */
export async function getOrCreateDirect(me, userId) {
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
  return conv;
}

// ---------- Premium: one paid message to someone you're not connected with (₹500 each) ----------
export const PAID_MESSAGE_INR = 500;

// GET /conversations/paid-message → { priceInr, available, test }
r.get('/paid-message', (req, res) => res.json({ priceInr: PAID_MESSAGE_INR, available: paymentsLive() || testPaymentsAllowed(), test: !paymentsLive() && testPaymentsAllowed() }));

// POST /conversations/paid-message { userId, body, paymentRef? } → the message lands in their Requests
r.post('/paid-message', requireSoul, ah(async (req, res) => {
  const data = z.object({ userId: uuid, body: z.string().trim().min(1, 'Write your message').max(500), paymentRef: z.string().trim().max(120).optional() }).parse(req.body);
  const me = req.user.id;
  if (data.userId === me) throw badRequest("You can't message yourself");
  const target = await one('SELECT * FROM users WHERE id=$1 AND onboarding_done = 1 AND deactivated_at IS NULL', [data.userId]);
  if (!target || (await isBlockedEither(me, data.userId))) throw notFound('User not found');
  if (await connectionBetween(me, data.userId)) throw badRequest("You're connected: just open the chat", 'already_connected');
  const recent = await one(`SELECT TOP 1 id FROM paid_messages WHERE sender_id=$1 AND recipient_id=$2 AND created_at > DATEADD(day, -1, SYSDATETIMEOFFSET())`, [me, data.userId]);
  if (recent) throw new HttpError(429, 'You already sent them a paid message today. Wait for them to connect.', 'paid_message_limit');
  let status;
  if (paymentsLive()) {
    // TODO when Razorpay is set up: verify data.paymentRef with Razorpay before sending
    if (!data.paymentRef) throw new HttpError(402, 'Payment needed', 'payment_required');
    throw new HttpError(503, "Payments aren't switched on yet.", 'payments_off');
  } else if (testPaymentsAllowed()) status = 'test';
  else throw new HttpError(503, 'Paid messages are coming soon: payments are not switched on yet.', 'payments_off');

  const conv = await getOrCreateDirect(me, data.userId);
  // it always lands in their Requests, however they know you (and brings back a chat that was hidden earlier)
  await query('UPDATE conversation_members SET hidden_at=NULL WHERE conversation_id=$1', [conv.id]);
  await query('UPDATE conversation_members SET is_request=1 WHERE conversation_id=$1 AND user_id=$2', [conv.id, data.userId]);
  const message = await postMessage(conv, me, { kind: 'text', body: data.body });
  await query('INSERT INTO paid_messages (sender_id, recipient_id, conversation_id, message_id, amount_paise, payment_ref, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [me, data.userId, conv.id, message.id, PAID_MESSAGE_INR * 100, data.paymentRef || null, status]);
  res.status(201).json({ conversation: await conversationPayload(await one('SELECT * FROM conversations WHERE id=$1', [conv.id]), me), message, test: status === 'test' });
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
  const users = await many(`SELECT * FROM users WHERE onboarding_done = 1 AND deactivated_at IS NULL AND id IN (${ph})`, ids);
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

// GET /conversations/translator -> what the translator can do here (the online version has text only)
r.get('/translator', (req, res) => res.json({ text: canTranslate(), voice: voiceInstalled() }));

r.get('/:id', ah(async (req, res) => {
  const { conv } = await loadConversation(req);
  res.json({ conversation: await conversationPayload(conv, req.user.id) });
}));

// GET /conversations/:id/messages?before=ISO&limit=30  (newest first)
r.get('/:id/messages', ah(async (req, res) => {
  const { conv } = await loadConversation(req);
  const limit = z.coerce.number().int().min(1).max(100).default(30).parse(req.query.limit ?? undefined);
  const before = req.query.before ? z.string().datetime({ offset: true }).parse(req.query.before) : null;
  // private chat shows only its own (disappearing) messages; the regular chat never shows them
  const mode = req.query.vanish === '1' ? ' AND vanish = 1' : req.query.vanish === '0' ? ' AND vanish = 0' : '';
  const rows = await many(
    `SELECT TOP (${limit}) * FROM messages WHERE conversation_id=$1 AND vanished_at IS NULL${mode} AND ($2 IS NULL OR created_at < CAST($2 AS DATETIMEOFFSET))
        AND ($3 IS NULL OR created_at > CAST($3 AS DATETIMEOFFSET))
      ORDER BY created_at DESC`,
    [conv.id, before, conv.history_from ? new Date(conv.history_from).toISOString() : null],
  );
  res.json({ messages: await enrich(rows.map(serializeMessage), req.user.id), hasMore: rows.length === limit });
}));

// POST /conversations/:id/messages { body, replyToId? } or { soulmoji: { mood, caption }, replyToId? }
r.post('/:id/messages', ah(async (req, res) => {
  const { conv } = await loadConversation(req);
  const data = z.object({
    body: z.string().trim().min(1, 'Write a message').max(2000).optional(),
    soulmoji: z.object({ mood: z.enum(SOULMOJI_MOODS), caption: z.string().trim().max(40).optional(), imageUrl: z.string().max(300).optional() }).optional(),
    voice: z.object({ url: z.string().max(300), durationMs: z.number().int().min(0).max(10 * 60 * 1000), text: z.string().trim().max(2000).optional() }).optional(),
    location: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180), label: z.string().trim().max(150).optional() }).optional(),
    contact: z.object({ userId: uuid }).optional(),
    poll: z.object({ question: z.string().trim().min(1, 'Ask a question').max(200), options: z.array(z.string().trim().min(1).max(80)).min(2, 'Add at least 2 options').max(6) }).optional(),
    replyToId: uuid.optional(),
  }).refine((d) => [d.body, d.soulmoji, d.voice, d.location, d.contact, d.poll].filter(Boolean).length === 1, 'Send one thing at a time').parse(req.body);
  await assertCanSend(conv, req.user.id);
  if (data.replyToId && !(await one('SELECT id FROM messages WHERE id=$1 AND conversation_id=$2', [data.replyToId, conv.id]))) throw badRequest('That message is not in this chat');
  if (data.soulmoji?.imageUrl && !(await ownsSoulmoji(req.user.id, data.soulmoji.imageUrl))) throw badRequest('That Soulmoji is not yours', 'not_your_soulmoji');
  if (data.soulmoji && !data.soulmoji.imageUrl && !req.user.avatar_url) throw badRequest('Take your Soulmoji selfie first', 'no_face_photo');
  // A translated voice note made by the voice translator (only your own clips can be sent)
  if (data.voice && !ownsVoiceClip(req.user.id, data.voice.url)) throw badRequest('That voice clip is not yours', 'not_your_voice');
  let contactCard = null;
  if (data.contact) {
    const u = await one('SELECT id, username, display_name, avatar_url FROM users WHERE id=$1', [data.contact.userId]);
    if (!u) throw notFound('That person is not on Soulink');
    contactCard = { userId: u.id, username: u.username, displayName: u.display_name || u.username, avatarUrl: u.avatar_url || null };
  }
  const payload = data.location ? { kind: 'location', body: JSON.stringify({ lat: Math.round(data.location.lat * 1e5) / 1e5, lon: Math.round(data.location.lon * 1e5) / 1e5, label: data.location.label || null }) }
    : contactCard ? { kind: 'contact', body: JSON.stringify(contactCard) }
    : data.poll ? { kind: 'poll', body: JSON.stringify({ question: data.poll.question, options: data.poll.options }) }
    : data.voice
    ? { kind: 'voice', mediaUrl: data.voice.url, durationMs: data.voice.durationMs, body: data.voice.text || null }
    : data.soulmoji
    ? { kind: 'soulmoji', body: JSON.stringify({ mood: data.soulmoji.mood, caption: data.soulmoji.caption || null, faceUrl: req.user.avatar_url, imageUrl: data.soulmoji.imageUrl || null }) }
    : { kind: 'text', body: data.body };
  res.status(201).json({ message: await postMessage(conv, req.user.id, { ...payload, replyToId: data.replyToId || null }) });
}));

// POST /conversations/:id/messages/:messageId/react { emoji }  (one reaction per person; same emoji again removes it)
// Chat translator: POST /conversations/:id/messages/:messageId/translate { to? } -> { text, from, to }
// to defaults to the reader's chat language. Saved per message + language, so each translation is made once.
r.post('/:id/messages/:messageId/translate', ah(async (req, res) => {
  const { conv } = await loadConversation(req);
  const messageId = uuid.parse(req.params.messageId);
  const { to: asked } = z.object({ to: z.enum(TRANSLATE_LANGS).optional() }).parse(req.body || {});
  const to = asked || req.user.chat_language || 'en';
  const msg = await one("SELECT id, body, kind FROM messages WHERE id=$1 AND conversation_id=$2 AND deleted_at IS NULL", [messageId, conv.id]);
  if (!msg || msg.kind !== 'text' || !msg.body) throw notFound('Message not found');
  const from = detectLanguage(msg.body);
  if (from === to) return res.json({ text: msg.body, from, to, same: true });
  const saved = await one('SELECT text, src_lang FROM message_translations WHERE message_id=$1 AND lang=$2', [messageId, to]);
  if (saved) return res.json({ text: saved.text, from: saved.src_lang, to });
  if (!canTranslate()) throw new HttpError(503, 'The chat translator is not available right now.', 'translator_missing');
  let text;
  try { text = await aiTranslate(msg.body, from, to); } catch (e) { throw new HttpError(502, e.message || 'Translation failed', 'translate_failed'); }
  await query(`IF NOT EXISTS (SELECT 1 FROM message_translations WHERE message_id=$1 AND lang=$2)
                 INSERT INTO message_translations (message_id, lang, src_lang, text) VALUES ($1, $2, $3, $4)`, [messageId, to, from, text]);
  res.json({ text, from, to });
}));

// ---------- Translator in the message box: write or speak in your language, send in theirs ----------
const VOICE_DIR = 'voice-tr';
function ownsVoiceClip(userId, url) {
  const m = /^\/uploads\/voice-tr\/([0-9a-fA-F-]{36})-[0-9a-fA-F-]{36}\.(m4a|wav|mp3)$/.exec(url || '');
  return !!m && m[1].toUpperCase() === String(userId).toUpperCase() && fsSync.existsSync(path.join(config.uploadDir, VOICE_DIR, path.basename(url)));
}
const translatorMissing = () => new HttpError(503, 'The chat translator is not available right now.', 'translator_missing');
const voiceMissing = () => new HttpError(503, "Voice translation isn't available right now. Type your message instead and it will be translated, or choose Text as the output.", 'voice_missing');

async function makeVoiceClip(userId, text, lang) {
  const dir = path.join(config.uploadDir, VOICE_DIR);
  await fs.mkdir(dir, { recursive: true });
  let clip;
  try { clip = await aiSpeak(text, lang, path.join(dir, `${String(userId).toUpperCase()}-${crypto.randomUUID()}.m4a`)); }
  catch (e) { throw new HttpError(502, e.message || "Couldn't make the voice clip. Try again.", 'voice_failed'); }
  const { file, durationMs } = clip;
  const url = `/uploads/${VOICE_DIR}/${path.basename(file)}`;
  await persistFile(url);
  return { url, durationMs };
}

// POST /conversations/:id/translate-draft { text, to, output: 'text' | 'voice' } -> { from, to, text, same, voice? }
r.post('/:id/translate-draft', ah(async (req, res) => {
  const { conv } = await loadConversation(req);
  const data = z.object({ text: z.string().trim().min(1).max(2000), to: z.enum(TRANSLATE_LANGS), output: z.enum(['text', 'voice']).default('text') }).parse(req.body);
  await assertCanSend(conv, req.user.id);
  const from = detectLanguage(data.text);
  let text = data.text;
  if (from !== data.to) {
    if (!canTranslate()) throw translatorMissing();
    try { text = await aiTranslate(data.text, from, data.to); } catch (e) { throw new HttpError(502, e.message || 'Translation failed', 'translate_failed'); }
  }
  let voice = null;
  if (data.output === 'voice') {
    if (!voiceInstalled()) throw voiceMissing();
    voice = await makeVoiceClip(req.user.id, text, data.to);
  }
  res.json({ from, to: data.to, original: data.text, text, same: from === data.to, voice });
}));

// POST /conversations/:id/voice-translate (multipart: file = voice note, to, output) -> what you said + translation (+ voice clip)
r.post('/:id/voice-translate', uploadMemory('media', 25).single('file'), ah(async (req, res) => {
  const { conv } = await loadConversation(req);
  if (!req.file || mediaKind(req.file.mimetype) !== 'voice') throw badRequest('Record a voice note first');
  const { to, output } = z.object({ to: z.enum(TRANSLATE_LANGS), output: z.enum(['text', 'voice']).default('text') }).parse(req.body);
  await assertCanSend(conv, req.user.id);
  if (!voiceInstalled()) throw voiceMissing();
  const dir = path.join(config.uploadDir, VOICE_DIR, 'in');
  await fs.mkdir(dir, { recursive: true });
  const tmp = path.join(dir, `${crypto.randomUUID()}${path.extname(req.file.originalname || '') || '.webm'}`);
  await fs.writeFile(tmp, req.file.buffer);
  let original;
  try { original = await aiTranscribe(tmp); }
  catch (e) { throw new HttpError(502, e.message || "Couldn't understand this voice note. Try again.", 'voice_failed'); }
  finally { fs.unlink(tmp).catch(() => {}); }
  if (!original) throw badRequest("Couldn't hear anything. Try again a little closer to the mic.", 'no_speech');
  const from = detectLanguage(original);
  const text = from === to ? original : await aiTranslate(original, from, to);
  const voice = output === 'voice' ? await makeVoiceClip(req.user.id, text, to) : null;
  res.json({ from, to, original, text, same: from === to, voice });
}));

// ---------- Moments in chat: open once, replay once, or save ----------
// POST /conversations/:id/messages/:messageId/open -> { message } with the content (counts as an open for the receiver)
r.post('/:id/messages/:messageId/open', ah(async (req, res) => {
  const { conv } = await loadConversation(req);
  const messageId = uuid.parse(req.params.messageId);
  const m = await one("SELECT * FROM messages WHERE id=$1 AND conversation_id=$2 AND kind=N'moment' AND deleted_at IS NULL", [messageId, conv.id]);
  if (!m) throw notFound('Moment not found');
  const mine = String(m.sender_id).toLowerCase() === String(req.user.id).toLowerCase();
  if (!mine && !m.saved_at) {
    const row = await one('SELECT opens FROM chat_moment_opens WHERE message_id=$1 AND user_id=$2', [messageId, req.user.id]);
    const opens = Number(row?.opens || 0);
    if (opens >= 2) throw new HttpError(410, 'This Moment is gone. It could be opened once and replayed once.', 'moment_gone');
    if (row) await query('UPDATE chat_moment_opens SET opens=opens+1, last_opened_at=SYSDATETIMEOFFSET() WHERE message_id=$1 AND user_id=$2', [messageId, req.user.id]);
    else await query('INSERT INTO chat_moment_opens (message_id, user_id, opens) VALUES ($1, $2, 1)', [messageId, req.user.id]);
    emitToUsers([m.sender_id], 'message:moment', { conversationId: conv.id, messageId, status: opens === 0 ? 'opened' : 'replayed' });
  }
  const b = momentBody(m.body);
  const [view] = await enrich([serializeMessage(m)], req.user.id);
  res.json({ message: view, content: { text: b.text || null, bg: b.bg || null, mediaUrl: m.media_url || null }, canReplay: !mine && !m.saved_at && view.moment?.status === 'opened' });
}));

// POST /conversations/:id/messages/:messageId/save -> keeps the Moment in the chat for everyone (like Snapchat)
r.post('/:id/messages/:messageId/save', ah(async (req, res) => {
  const { conv } = await loadConversation(req);
  const messageId = uuid.parse(req.params.messageId);
  const m = await one("SELECT * FROM messages WHERE id=$1 AND conversation_id=$2 AND kind=N'moment' AND deleted_at IS NULL", [messageId, conv.id]);
  if (!m) throw notFound('Moment not found');
  const mine = String(m.sender_id).toLowerCase() === String(req.user.id).toLowerCase();
  if (!mine && !m.saved_at) {
    const row = await one('SELECT opens FROM chat_moment_opens WHERE message_id=$1 AND user_id=$2', [messageId, req.user.id]);
    if (Number(row?.opens || 0) >= 2) throw new HttpError(410, 'This Moment is already gone.', 'moment_gone');
  }
  if (!m.saved_at) await query('UPDATE messages SET saved_at=SYSDATETIMEOFFSET() WHERE id=$1', [messageId]);
  const fresh = await one('SELECT * FROM messages WHERE id=$1', [messageId]);
  emitToUsers(await memberIds(conv.id), 'message:moment', { conversationId: conv.id, messageId, status: 'saved' });
  const [view] = await enrich([serializeMessage(fresh)], req.user.id);
  res.json({ message: view });
}));

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

// POST /conversations/:id/document (multipart file, name) → a document in the chat
r.post('/:id/document', uploadMemory('document', 25).single('file'), ah(async (req, res) => {
  const { conv } = await loadConversation(req);
  if (!req.file) throw badRequest('No file uploaded');
  await assertCanSend(conv, req.user.id);
  const url = await saveFile(req.file, 'chat', 'document');
  const name = z.string().trim().min(1).max(150).catch('Document').parse(req.body?.name || req.file.originalname || 'Document');
  res.status(201).json({ message: await postMessage(conv, req.user.id, { kind: 'document', mediaUrl: url, body: JSON.stringify({ name, size: req.file.size }) }) });
}));

// POST /conversations/:id/messages/:messageId/vote { option } → vote in a poll (same option again removes your vote)
r.post('/:id/messages/:messageId/vote', ah(async (req, res) => {
  const { conv } = await loadConversation(req);
  const messageId = uuid.parse(req.params.messageId);
  const { option } = z.object({ option: z.number().int().min(0).max(5) }).parse(req.body || {});
  const m = await one("SELECT * FROM messages WHERE id=$1 AND conversation_id=$2 AND kind=N'poll' AND deleted_at IS NULL", [messageId, conv.id]);
  if (!m) throw notFound('Poll not found');
  const poll = JSON.parse(m.body);
  if (option >= poll.options.length) throw badRequest('Pick one of the options');
  const cur = await one('SELECT option_idx FROM poll_votes WHERE message_id=$1 AND user_id=$2', [m.id, req.user.id]);
  if (cur && Number(cur.option_idx) === option) await query('DELETE FROM poll_votes WHERE message_id=$1 AND user_id=$2', [m.id, req.user.id]);
  else if (cur) await query('UPDATE poll_votes SET option_idx=$3, voted_at=SYSDATETIMEOFFSET() WHERE message_id=$1 AND user_id=$2', [m.id, req.user.id, option]);
  else await query('INSERT INTO poll_votes (message_id, user_id, option_idx) VALUES ($1, $2, $3)', [m.id, req.user.id, option]);
  const rows = await many('SELECT user_id, option_idx FROM poll_votes WHERE message_id=$1', [m.id]);
  const counts = poll.options.map((_, i) => rows.filter((r) => Number(r.option_idx) === i).length);
  emitToUsers(await memberIds(conv.id), 'message:poll', { conversationId: conv.id, messageId: m.id, counts, total: rows.length, votes: rows.map((r) => ({ userId: r.user_id, option: Number(r.option_idx) })) });
  const mineNow = rows.find((r) => String(r.user_id).toLowerCase() === String(req.user.id).toLowerCase());
  res.json({ counts, total: rows.length, myVote: mineNow ? Number(mineNow.option_idx) : null });
}));

// ---------- Private chat (tap 3 times in the chat) ----------
// POST /conversations/:id/private { on } → turn private chat on/off for everyone in the chat
r.post('/:id/private', ah(async (req, res) => {
  const { conv } = await loadConversation(req);
  const { on } = z.object({ on: z.boolean() }).parse(req.body || {});
  if (!!conv.private_mode === on) return res.json({ privateMode: on });
  await query('UPDATE conversations SET private_mode=$2 WHERE id=$1', [conv.id, on ? 1 : 0]);
  const who = req.user.display_name || req.user.username;
  await systemMessage({ ...conv, private_mode: 0 }, on
    ? `🔒 ${who} turned on private chat. Messages disappear after they're seen and you leave the chat.`
    : `${who} turned off private chat.`);
  emitToUsers(await memberIds(conv.id), 'conversation:private', { conversationId: conv.id, on, by: req.user.id });
  res.json({ privateMode: on });
}));

// POST /conversations/:id/leave → I left the chat: private messages everyone has already seen disappear now
r.post('/:id/leave', ah(async (req, res) => {
  const { conv } = await loadConversation(req);
  // (a message request isn't marked as seen just by looking at it)
  await query('UPDATE conversation_members SET last_read_at = SYSDATETIMEOFFSET() WHERE conversation_id=$1 AND user_id=$2 AND is_request = 0', [conv.id, req.user.id]);
  const gone = await many(
    `UPDATE m SET m.vanished_at = SYSDATETIMEOFFSET(), m.body = NULL, m.media_url = NULL
       OUTPUT INSERTED.id
       FROM messages m
      WHERE m.conversation_id = $1 AND m.vanish = 1 AND m.vanished_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM conversation_members cm
                         WHERE cm.conversation_id = m.conversation_id AND cm.user_id <> m.sender_id
                           AND (cm.last_read_at IS NULL OR cm.last_read_at < m.created_at))`, [conv.id]);
  if (gone.length) emitToUsers(await memberIds(conv.id), 'message:vanished', { conversationId: conv.id, ids: gone.map((g) => g.id) });
  res.json({ vanished: gone.length });
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
  // a chat during a hold moves to Chats only when the Connect request itself is accepted
  if (!conv.is_group && conv.direct_key) {
    const otherId = conv.direct_key.split(':').find((id) => id.toUpperCase() !== String(req.user.id).toUpperCase());
    if (otherId && (await heldBetween(req.user.id, otherId))) throw badRequest('Accept or reject their Connect request to move this chat', 'held_request');
  }
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
    const u = await one('SELECT * FROM users WHERE id=$1 AND onboarding_done = 1 AND deactivated_at IS NULL', [id]);
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
