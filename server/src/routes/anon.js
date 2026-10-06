// Anonymous messages (see services/anon.js for the rules).
import { Router } from 'express';
import { z } from 'zod';
import { many, one, query } from '../db.js';
import { ah, badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { requireAuth, requireSoul } from '../middleware/auth.js';
import { isBlockedEither, notify } from '../services/social.js';
import { connectionBetween } from '../services/connections.js';
import { LIMITS, REVEAL_DAYS, processAnonReveals, randomAlias, threadView, usersById } from '../services/anon.js';

const r = Router();
r.use(requireAuth);

const uuid = z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid id');
const body = z.string().trim().min(1, 'Write a message').max(LIMITS.bodyMax, `Keep it under ${LIMITS.bodyMax} characters`);
const same = (a, b) => String(a).toUpperCase() === String(b).toUpperCase();

const THREAD_SELECT = `SELECT t.*, lm.body AS last_body, lm.from_sender AS last_from_sender
  FROM anon_threads t
  OUTER APPLY (SELECT TOP 1 m.body, m.from_sender FROM anon_messages m WHERE m.thread_id=t.id ORDER BY m.created_at DESC) lm`;

const live = (ids) => { try { import('../realtime.js').then((m) => m.emitToUsers(ids, 'anon:update', {})).catch(() => {}); } catch { /* tests */ } };

async function loadThread(req) {
  const t = await one(`${THREAD_SELECT} WHERE t.id=$1`, [uuid.parse(req.params.id)]);
  if (!t) throw notFound('Chat not found');
  const isSender = same(t.sender_id, req.user.id);
  if (!isSender && !same(t.recipient_id, req.user.id)) throw notFound('Chat not found');
  if (await isBlockedEither(t.sender_id, t.recipient_id)) throw notFound('Chat not found');
  return { t, isSender };
}

async function addMessage(t, fromSender, text) {
  const m = await one(`INSERT INTO anon_messages (thread_id, from_sender, body) OUTPUT INSERTED.* VALUES ($1, $2, $3)`, [t.id, fromSender ? 1 : 0, text]);
  await query(
    `UPDATE anon_threads SET last_message_at=SYSDATETIMEOFFSET(), ${fromSender ? 'sender_read_at=SYSDATETIMEOFFSET(), hidden_by_sender=0' : 'recipient_read_at=SYSDATETIMEOFFSET(), hidden_by_recipient=0'} WHERE id=$1`, [t.id],
  );
  if (fromSender) {
    // Recipient is told "someone" wrote: no actor, so nothing about the sender leaks
    await notify(t.recipient_id, null, 'anon_message', t.id, { alias: t.alias });
  } else {
    await notify(t.sender_id, t.recipient_id, 'anon_reply', t.id, { alias: t.alias });
  }
  live([t.sender_id, t.recipient_id]);
  return m;
}

/** Can I send an anonymous message to this person? (used by the profile button) */
r.get('/can/:userId', ah(async (req, res) => {
  const to = await one('SELECT id FROM users WHERE id=$1 AND onboarding_done=1', [uuid.parse(req.params.userId)]);
  if (!to || same(to.id, req.user.id) || (await isBlockedEither(req.user.id, to.id))) return res.json({ allowed: false });
  if (await connectionBetween(req.user.id, to.id)) return res.json({ allowed: false, reason: 'connected' });
  const t = await one('SELECT id FROM anon_threads WHERE sender_id=$1 AND recipient_id=$2', [req.user.id, to.id]);
  res.json({ allowed: true, threadId: t?.id || null, revealDays: REVEAL_DAYS });
}));

// Start (or continue) an anonymous chat with someone
r.post('/', requireSoul, ah(async (req, res) => {
  const data = z.object({ toUserId: uuid, body }).parse(req.body);
  const me = req.user;
  const to = await one('SELECT * FROM users WHERE id=$1 AND onboarding_done=1', [data.toUserId]);
  if (!to || (await isBlockedEither(me.id, to.id))) throw notFound('User not found');
  if (same(to.id, me.id)) throw badRequest("You can't send yourself an anonymous message");
  if (await connectionBetween(me.id, to.id)) throw conflict("You're already Soul Connected. Message them directly.", 'already_connected');

  let t = await one('SELECT * FROM anon_threads WHERE sender_id=$1 AND recipient_id=$2', [me.id, to.id]);
  if (t) {
    if (t.hidden_by_recipient) throw forbidden("They closed this anonymous chat. You can't send more messages.", 'anon_closed');
  } else {
    const recent = await one(`SELECT COUNT(*) AS n FROM anon_threads WHERE sender_id=$1 AND created_at > DATEADD(HOUR, -24, SYSDATETIMEOFFSET())`, [me.id]);
    if (Number(recent?.n || 0) >= LIMITS.newThreadsPerDay) throw forbidden(`You can start ${LIMITS.newThreadsPerDay} anonymous chats a day. Try again tomorrow.`, 'anon_limit');
    t = await one(
      `INSERT INTO anon_threads (sender_id, recipient_id, alias, reveal_at) OUTPUT INSERTED.* VALUES ($1, $2, $3, DATEADD(DAY, ${REVEAL_DAYS}, SYSDATETIMEOFFSET()))`,
      [me.id, to.id, randomAlias()],
    );
  }
  await guardUnanswered(t);
  await addMessage(t, true, data.body);
  res.status(201).json({ threadId: t.id });
}));

/** Until they reply, the sender can send only a few messages (stops spamming someone anonymously). */
async function guardUnanswered(t) {
  if (t.revealed_at) return;
  const replied = await one('SELECT TOP 1 1 AS x FROM anon_messages WHERE thread_id=$1 AND from_sender=0', [t.id]);
  if (replied) return;
  const sent = await one('SELECT COUNT(*) AS n FROM anon_messages WHERE thread_id=$1 AND from_sender=1', [t.id]);
  if (Number(sent?.n || 0) >= LIMITS.unansweredMessages) {
    throw forbidden(`You've sent ${LIMITS.unansweredMessages} messages. Wait for them to reply.`, 'anon_wait');
  }
}

// My anonymous chats: received (from hidden people) and sent (by me, hidden)
r.get('/', ah(async (req, res) => {
  await processAnonReveals();
  const me = req.user.id;
  const rows = await many(
    `${THREAD_SELECT}
      WHERE ((t.sender_id=$1 AND t.hidden_by_sender=0) OR (t.recipient_id=$1 AND t.hidden_by_recipient=0))
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=t.sender_id AND b.blocked_id=t.recipient_id) OR (b.blocker_id=t.recipient_id AND b.blocked_id=t.sender_id))
      ORDER BY t.last_message_at DESC`, [me],
  );
  const users = await usersById(rows.flatMap((t) => [t.recipient_id, t.revealed_at || same(t.sender_id, me) ? t.sender_id : null]));
  const threads = rows.map((t) => threadView(t, me, users));
  res.json({ threads, unread: threads.filter((t) => t.unread).length });
}));

// One chat with its messages (marks it read)
r.get('/:id', ah(async (req, res) => {
  await processAnonReveals();
  const { t, isSender } = await loadThread(req);
  const msgs = await many('SELECT TOP 300 * FROM anon_messages WHERE thread_id=$1 ORDER BY created_at ASC', [t.id]);
  await query(`UPDATE anon_threads SET ${isSender ? 'sender_read_at' : 'recipient_read_at'}=SYSDATETIMEOFFSET() WHERE id=$1`, [t.id]);
  const users = await usersById([t.recipient_id, t.revealed_at || isSender ? t.sender_id : null]);
  const connected = !!(await connectionBetween(t.sender_id, t.recipient_id));
  let conversationId = null;
  if (connected) {
    const key = [String(t.sender_id).toUpperCase(), String(t.recipient_id).toUpperCase()].sort().join(':');
    conversationId = (await one('SELECT id FROM conversations WHERE direct_key=$1', [key]))?.id || null;
  }
  res.json({
    thread: { ...threadView(t, req.user.id, users), connected, conversationId },
    messages: msgs.map((m) => ({ id: m.id, body: m.body, mine: !!m.from_sender === isSender, createdAt: m.created_at })),
  });
}));

r.post('/:id/messages', ah(async (req, res) => {
  const { t, isSender } = await loadThread(req);
  const text = z.object({ body }).parse(req.body).body;
  if (t.hidden_by_recipient && isSender) throw forbidden("They closed this anonymous chat. You can't send more messages.", 'anon_closed');
  if (isSender) await guardUnanswered(t);
  const m = await addMessage(t, isSender, text);
  res.status(201).json({ message: { id: m.id, body: m.body, mine: true, createdAt: m.created_at } });
}));

// Recipient: close the chat. The sender can't send anything more; their name is still shown after 7 days.
r.post('/:id/close', ah(async (req, res) => {
  const { t, isSender } = await loadThread(req);
  if (isSender) throw forbidden('Only the person who received it can close it');
  await query('UPDATE anon_threads SET hidden_by_recipient=1 WHERE id=$1', [t.id]);
  live([t.sender_id, t.recipient_id]);
  res.json({ ok: true });
}));

// Sender: remove it from my list
r.post('/:id/hide', ah(async (req, res) => {
  const { t, isSender } = await loadThread(req);
  await query(`UPDATE anon_threads SET ${isSender ? 'hidden_by_sender' : 'hidden_by_recipient'}=1 WHERE id=$1`, [t.id]);
  res.json({ ok: true });
}));

export default r;
