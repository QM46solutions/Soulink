// Connect requests: "someone I know / someone new" + intent + optional note + Soul Score.
// The receiver can Accept (or accept as something else), Hold for a chosen time, or Reject.
// The sender is always told the outcome. Accepting creates the connection and opens a chat.
import { Router } from 'express';
import { z } from 'zod';
import { many, one, query, tx } from '../db.js';
import { ah, badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { requireAuth, requireSoul } from '../middleware/auth.js';
import { isBlockedEither, meView, notify, userCard } from '../services/social.js';
import { COOLDOWN, HOLD_DAYS, INTENTS, INTENT_KEYS, KNOWN_AS, closeHeldChat, connectionBetween, pairOf } from '../services/connections.js';
import { directKey, getOrCreateDirect, postMessage, systemMessage } from './conversations.js';
import { scoreFor } from '../services/soulStore.js';
import { nudgeDueTimer } from '../services/dueTimer.js';

const r = Router();
r.use(requireAuth);

const uuid = z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid id');
const intent = z.enum(INTENT_KEYS);
const list = (v) => (Array.isArray(v) ? v : (() => { try { return JSON.parse(v || '[]'); } catch { return []; } })());
const daysAgo = (d) => new Date(Date.now() - d * 86400000);

/** Soul Score for a pair, for the kind of connection asked for (Soul DNA v2). */
async function scoreBetween(a, b, theIntent = 'friendship') {
  if (!a.soul_ready || !b.soul_ready) return null;
  return scoreFor(a.id, b.id, theIntent);
}

function view(q, meId, other) {
  return {
    id: q.id,
    direction: q.from_id === meId ? 'outgoing' : 'incoming',
    user: other ? userCard(other) : null,
    knows: !!q.knows,
    knownAs: q.known_as || null,
    intent: q.intent,
    intentLabel: INTENTS[q.intent]?.label,
    acceptedIntent: q.accepted_intent,
    note: q.note,
    soulScore: q.soul_score,
    status: q.status,
    holdDays: q.hold_days,
    holdUntil: q.hold_until,
    canExtend: q.status === 'held' && !q.hold_extended,
    decideBy: q.status === 'held' ? q.hold_decide_until || null : null, // the hold is over: accept or reject by then
    autoRejected: !!q.auto_rejected,
    createdAt: q.created_at,
    respondedAt: q.responded_at,
  };
}

async function loadRequest(req, who) {
  const id = uuid.parse(req.params.id);
  const q = await one('SELECT * FROM connection_requests WHERE id=$1', [id]);
  if (!q) throw notFound('Request not found');
  if (who === 'to' && q.to_id !== req.user.id) throw notFound('Request not found');
  if (who === 'from' && q.from_id !== req.user.id) throw notFound('Request not found');
  return q;
}

/** Everything the profile screen needs to show the right Connect button. */
r.get('/status/:userId', ah(async (req, res) => {
  const other = await one('SELECT * FROM users WHERE id=$1 AND onboarding_done=1 AND deactivated_at IS NULL', [uuid.parse(req.params.userId)]);
  if (!other) throw notFound('User not found');
  const me = req.user.id;
  const conn = await connectionBetween(me, other.id);
  const open = await one(
    `SELECT TOP 1 * FROM connection_requests WHERE status IN (N'pending', N'held')
      AND ((from_id=$1 AND to_id=$2) OR (from_id=$2 AND to_id=$1)) ORDER BY created_at DESC`, [me, other.id],
  );
  const last = await one(`SELECT TOP 1 * FROM connection_requests WHERE from_id=$1 AND to_id=$2 AND status IN (N'rejected', N'suspended') ORDER BY responded_at DESC`, [me, other.id]);
  let cooldownUntil = null;
  if (last) {
    const days = last.status === 'rejected' ? COOLDOWN.rejectedDays : COOLDOWN.suspendedDays;
    const until = new Date(new Date(last.responded_at).getTime() + days * 86400000);
    if (until > new Date()) cooldownUntil = until;
  }
  res.json({
    connected: conn ? { intent: conn.intent, intentLabel: INTENTS[conn.intent]?.label, since: conn.created_at } : null,
    request: open ? view(open, me, other) : null,
    cooldownUntil,
    lastOutcome: last && cooldownUntil ? last.status : null,
    iConnect: await connectsTo(me, other.id),      // I'm connected to them
    theyConnect: await connectsTo(other.id, me),   // they're connected to me (can connect back)
    soulScore: await scoreBetween(req.user, other, (conn?.intent) || open?.accepted_intent || open?.intent || 'friendship'),
  });
}));

// Send a Connect request
r.post('/requests', requireSoul, ah(async (req, res) => {
  // no note: nothing can be sent to someone before they accept (old apps may still send one; it's ignored)
  // First: do you already know them? Known → family / friend / colleague / other. New → what you're hoping for.
  const data = z.object({ toUserId: uuid, intent: intent.optional(), knows: z.boolean().default(false), knownAs: z.enum(Object.keys(KNOWN_AS)).optional(), note: z.string().optional() })
    .refine((d) => (d.knows ? !!(d.knownAs || d.intent) : !!d.intent && !INTENTS[d.intent].known), { message: 'Say who they are to you, or what you are hoping for' })
    .parse(req.body);
  if (data.knows && data.knownAs) data.intent = KNOWN_AS[data.knownAs];
  const me = req.user;
  const to = await one('SELECT * FROM users WHERE id=$1 AND onboarding_done=1 AND deactivated_at IS NULL', [data.toUserId]);
  if (!to || (await isBlockedEither(me.id, to.id))) throw notFound('User not found');
  if (to.id === me.id) throw badRequest("You can't connect with yourself");
  if (await connectionBetween(me.id, to.id)) throw conflict('You are already connected', 'already_connected');
  if (await connectsTo(to.id, me.id)) throw conflict(`${to.display_name || to.username} is already connected to you. Tap Connect back.`, 'can_connect_back');
  if (await connectsTo(me.id, to.id)) throw conflict(`You're already connected to ${to.display_name || to.username}.`, 'already_connecting');
  const incoming = await one(`SELECT TOP 1 id FROM connection_requests WHERE from_id=$1 AND to_id=$2 AND status IN (N'pending', N'held')`, [to.id, me.id]);
  if (incoming) throw conflict(`${to.display_name || to.username} already sent you a request. Answer it from your requests.`, 'incoming_pending');
  const outgoing = await one(`SELECT TOP 1 id FROM connection_requests WHERE from_id=$1 AND to_id=$2 AND status IN (N'pending', N'held')`, [me.id, to.id]);
  if (outgoing) throw conflict('You already sent a request. Wait for their answer.', 'already_requested');
  const rejected = await one(`SELECT TOP 1 id FROM connection_requests WHERE from_id=$1 AND to_id=$2 AND status=N'rejected' AND responded_at > $3`, [me.id, to.id, daysAgo(COOLDOWN.rejectedDays)]);
  if (rejected) throw forbidden(`Your last request was rejected. You can send a new one after ${COOLDOWN.rejectedDays} days.`, 'cooldown');
  const suspended = await one(`SELECT TOP 1 id FROM connection_requests WHERE from_id=$1 AND to_id=$2 AND status=N'suspended' AND responded_at > $3`, [me.id, to.id, daysAgo(COOLDOWN.suspendedDays)]);
  if (suspended) throw forbidden(`Your last request expired without an answer. You can try again after ${COOLDOWN.suspendedDays} days.`, 'cooldown');
  // ("Open to" was removed from settings: every intent can be sent; the receiver chooses when answering)

  const score = await scoreBetween(me, to, data.intent);
  const q = await one(
    `INSERT INTO connection_requests (from_id, to_id, knows, intent, note, soul_score, known_as) OUTPUT INSERTED.* VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [me.id, to.id, data.knows ? 1 : 0, data.intent, null, score, data.knows ? data.knownAs || null : null],
  );
  await notify(to.id, me.id, 'connect_request', q.id, { intent: q.intent, soulScore: score });
  res.status(201).json({ request: view(q, me.id, to) });
}));

// My requests: incoming (to answer) or outgoing (sent)
r.get('/requests', ah(async (req, res) => {
  const box = z.enum(['incoming', 'outgoing']).default('incoming').parse(req.query.box);
  const me = req.user.id;
  const col = box === 'incoming' ? 'from_id' : 'to_id';
  const where = box === 'incoming' ? 'q.to_id=$1' : 'q.from_id=$1';
  const rows = await many(
    `SELECT TOP 100 q.*, u.id AS u_id, u.username, u.display_name, u.avatar_url, u.is_private, u.face_verified, u.soul_type
       FROM connection_requests q JOIN users u ON u.id = q.${col}
      WHERE ${where} AND q.status IN (N'pending', N'held')
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=$1))
      ORDER BY CASE q.status WHEN N'pending' THEN 0 ELSE 1 END, q.created_at DESC`,
    [me],
  );
  const out = rows.map((x) => view(x, me, { ...x, id: x.u_id }));
  // a held request has a chat (in Messages › Requests) while the hold lasts
  for (const v of out) {
    if (v.status !== 'held') continue;
    v.conversationId = (await one('SELECT id FROM conversations WHERE direct_key=$1', [directKey(me, v.user.id)]))?.id || null;
  }
  res.json({ requests: out });
}));

// ---------- the Connect model ----------
// A connects to B  = follow A -> B (accepted)  → A is one of B's Followers
// both directions  = a connections row           → "Connections" (+ a chat opens)
const followSql = `IF NOT EXISTS (SELECT 1 FROM follows WHERE follower_id=$1 AND followee_id=$2)
                     INSERT INTO follows (follower_id, followee_id, status) VALUES ($1, $2, N'accepted')
                   ELSE UPDATE follows SET status=N'accepted' WHERE follower_id=$1 AND followee_id=$2`;
const connectsTo = async (a, b) => !!(await one(`SELECT 1 AS y FROM follows WHERE follower_id=$1 AND followee_id=$2 AND status=N'accepted'`, [a, b]));

/** Both people are connected to each other: Connections row, chat, welcome message. Returns the conversation. */
async function makeMutual(x, y, theIntent, { requestId = null, soulScore = null, note = null, noteFrom = null } = {}) {
  const [a, b] = pairOf(x, y);
  const key = directKey(x, y);
  const conv = await tx(async (c) => {
    await c.query(followSql, [x, y]);
    await c.query(followSql, [y, x]);
    await c.query(`IF NOT EXISTS (SELECT 1 FROM connections WHERE user_a=$1 AND user_b=$2) INSERT INTO connections (user_a, user_b, intent, request_id) VALUES ($1, $2, $3, $4)`, [a, b, theIntent, requestId]);
    let cv = (await c.query('SELECT * FROM conversations WHERE direct_key=$1', [key])).rows[0];
    if (!cv) cv = (await c.query('INSERT INTO conversations (is_group, created_by, direct_key) OUTPUT INSERTED.* VALUES (0, $1, $2)', [y, key])).rows[0];
    for (const uid of [x, y]) {
      await c.query(`IF NOT EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id=$1 AND user_id=$2)
                       INSERT INTO conversation_members (conversation_id, user_id, is_request) VALUES ($1, $2, 0)
                     ELSE UPDATE conversation_members SET is_request=0, hidden_at=NULL WHERE conversation_id=$1 AND user_id=$2`, [cv.id, uid]);
    }
    return cv;
  });
  const label = INTENTS[theIntent] || INTENTS.friendship;
  await systemMessage(conv, `You're connected for ${label.label} ${label.emoji}${soulScore ? ` · Soul Score ${soulScore}%` : ''}`);
  return conv;
}

// Accept (optionally as a different intent): the sender is now connected to you (one of your Followers).
// You're then asked to connect back; send { connectBack: true } to do both at once. If you were already
// connected to them, you become Connections straight away.
r.post('/requests/:id/accept', requireSoul, ah(async (req, res) => {
  const q = await loadRequest(req, 'to');
  if (!['pending', 'held'].includes(q.status)) throw conflict('This request is no longer open', 'closed');
  const body = z.object({ asIntent: intent.optional(), connectBack: z.boolean().optional() }).parse(req.body || {});
  const { asIntent } = body;
  // a held request already has a chat going: accepting it makes you Connections and the chat moves to Chats
  const connectBack = body.connectBack || q.status === 'held';
  const finalIntent = asIntent || q.intent;
  const from = await one('SELECT * FROM users WHERE id=$1', [q.from_id]);
  if (await isBlockedEither(q.from_id, q.to_id)) throw notFound('User not found');
  await tx(async (c) => {
    const upd = (await c.query(
      `UPDATE connection_requests SET status=N'accepted', accepted_intent=$2, responded_at=SYSDATETIMEOFFSET() OUTPUT INSERTED.* WHERE id=$1 AND status IN (N'pending', N'held')`,
      [q.id, finalIntent !== q.intent ? finalIntent : null],
    )).rows[0];
    if (!upd) throw conflict('This request is no longer open', 'closed');
    await c.query(followSql, [q.from_id, q.to_id]);
  });
  let conv = null;
  if (connectBack || (await connectsTo(q.to_id, q.from_id))) {
    conv = await makeMutual(q.from_id, q.to_id, finalIntent, { requestId: q.id, soulScore: q.soul_score, note: q.note, noteFrom: q.from_id });
  }
  await notify(q.from_id, q.to_id, 'connect_accepted', q.id, { intent: q.intent, acceptedIntent: finalIntent !== q.intent ? finalIntent : null, conversationId: conv?.id || null, mutual: !!conv });
  res.json({ ok: true, mutual: !!conv, canConnectBack: !conv, conversationId: conv?.id || null, intent: finalIntent, user: userCard(from) });
}));

// Connect back with someone who is connected to you → you're Connections (chat opens)
r.post('/back/:userId', requireSoul, ah(async (req, res) => {
  const other = await one('SELECT * FROM users WHERE id=$1 AND onboarding_done=1 AND deactivated_at IS NULL', [uuid.parse(req.params.userId)]);
  if (!other || (await isBlockedEither(req.user.id, other.id))) throw notFound('User not found');
  if (!(await connectsTo(other.id, req.user.id))) throw forbidden(`${other.display_name || other.username} isn't connected to you. Send a Connect request instead.`, 'not_connected_to_you');
  const existing = await connectionBetween(req.user.id, other.id);
  if (existing) {
    const cv = await one('SELECT id FROM conversations WHERE direct_key=$1', [directKey(req.user.id, other.id)]);
    return res.json({ ok: true, conversationId: cv?.id || null, already: true });
  }
  const q = await one(`SELECT TOP 1 * FROM connection_requests WHERE from_id=$1 AND to_id=$2 AND status=N'accepted' ORDER BY responded_at DESC`, [other.id, req.user.id]);
  const conv = await makeMutual(other.id, req.user.id, q?.accepted_intent || q?.intent || 'friendship', { requestId: q?.id || null, soulScore: q?.soul_score || null });
  await notify(other.id, req.user.id, 'connect_back', conv.id, { conversationId: conv.id });
  res.json({ ok: true, conversationId: conv.id });
}));

// Disconnect: stop being connected to them (if you were Connections, they stay connected to you as a Follower)
r.delete('/with/:userId', ah(async (req, res) => {
  const otherId = uuid.parse(req.params.userId);
  const [a, b] = pairOf(req.user.id, otherId);
  await query('DELETE FROM follows WHERE follower_id=$1 AND followee_id=$2', [req.user.id, otherId]);
  await query('DELETE FROM connections WHERE user_a=$1 AND user_b=$2', [a, b]);
  res.json({ ok: true });
}));

r.post('/requests/:id/reject', ah(async (req, res) => {
  const q = await loadRequest(req, 'to');
  const upd = await one(`UPDATE connection_requests SET status=N'rejected', responded_at=SYSDATETIMEOFFSET() OUTPUT INSERTED.* WHERE id=$1 AND status IN (N'pending', N'held')`, [q.id]);
  if (!upd) throw conflict('This request is no longer open', 'closed');
  if (q.status === 'held') await closeHeldChat(q.from_id, q.to_id); // the chat they had during the hold is hidden (kept, never shown)
  await notify(q.from_id, q.to_id, 'connect_rejected', q.id, { intent: q.intent });
  res.json({ ok: true });
}));

const dayText = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
/** On hold = you two can chat until the hold ends. The chat sits in Messages › Requests for both of you. */
async function openHeldChat(q, holdUntil, extended) {
  const conv = await getOrCreateDirect(q.to_id, q.from_id);
  for (const uid of [q.from_id, q.to_id]) {
    await query(`IF NOT EXISTS (SELECT 1 FROM conversation_members WHERE conversation_id=$1 AND user_id=$2)
                   INSERT INTO conversation_members (conversation_id, user_id, is_request) VALUES ($1, $2, 1)
                 ELSE UPDATE conversation_members SET is_request=1, hidden_at=NULL WHERE conversation_id=$1 AND user_id=$2`, [conv.id, uid]);
  }
  await systemMessage(conv, extended
    ? `The hold was extended to ${dayText(holdUntil)}. You can keep chatting here until then.`
    : `Request on hold until ${dayText(holdUntil)}. You can chat here until then.`);
  return conv;
}

// Hold for 1, 3, 7, 14 or 30 days. "Extend once" uses the same call on a held request.
r.post('/requests/:id/hold', ah(async (req, res) => {
  const q = await loadRequest(req, 'to');
  const { days } = z.object({ days: z.number().int().refine((d) => HOLD_DAYS.includes(d), `Choose ${HOLD_DAYS.join(', ')} days`) }).parse(req.body);
  let upd;
  if (q.status === 'pending') {
    upd = await one(
      `UPDATE connection_requests SET status=N'held', hold_days=$2, hold_until=DATEADD(DAY, $2, SYSDATETIMEOFFSET()), hold_reminded=0, responded_at=SYSDATETIMEOFFSET()
         OUTPUT INSERTED.* WHERE id=$1 AND status=N'pending'`, [q.id, days],
    );
  } else if (q.status === 'held') {
    if (q.hold_extended) throw conflict('You can extend a hold only once', 'hold_extended');
    upd = await one(
      `UPDATE connection_requests SET hold_days=$2, hold_until=DATEADD(DAY, $2, CASE WHEN hold_until > SYSDATETIMEOFFSET() THEN hold_until ELSE SYSDATETIMEOFFSET() END),
         hold_reminded=0, hold_decide_until=NULL, hold_extended=1
         OUTPUT INSERTED.* WHERE id=$1 AND status=N'held'`, [q.id, days],
    );
  }
  if (!upd) throw conflict('This request is no longer open', 'closed');
  await openHeldChat(q, upd.hold_until, q.status === 'held');
  nudgeDueTimer(); // the end of the hold is a due time
  await notify(q.from_id, q.to_id, q.status === 'held' ? 'connect_hold_extended' : 'connect_held', q.id, { intent: q.intent, days, holdUntil: upd.hold_until });
  res.json({ ok: true, holdUntil: upd.hold_until });
}));

// Sender takes a pending or held request back
r.post('/requests/:id/withdraw', ah(async (req, res) => {
  const q = await loadRequest(req, 'from');
  const upd = await one(`UPDATE connection_requests SET status=N'withdrawn', responded_at=SYSDATETIMEOFFSET() OUTPUT INSERTED.* WHERE id=$1 AND status IN (N'pending', N'held')`, [q.id]);
  if (!upd) throw conflict('This request is no longer open', 'closed');
  if (q.status === 'held') await closeHeldChat(q.from_id, q.to_id);
  res.json({ ok: true });
}));

// My connections
r.get('/', ah(async (req, res) => {
  const me = String(req.user.id).toUpperCase();
  const rows = await many(
    `SELECT c.intent, c.created_at AS since, u.* FROM connections c
       JOIN users u ON u.id = CASE WHEN c.user_a=$1 THEN c.user_b ELSE c.user_a END
      WHERE c.user_a=$1 OR c.user_b=$1 ORDER BY c.created_at DESC`, [me],
  );
  res.json({ connections: rows.map((x) => ({ ...userCard(x), intent: x.intent, intentLabel: INTENTS[x.intent]?.label, since: x.since })) });
}));

// Settings: which intents I accept ("Open to")
r.put('/open-to', ah(async (req, res) => {
  const { openTo } = z.object({ openTo: z.array(intent).min(1, 'Keep at least one option on') }).parse(req.body);
  const u = await one('UPDATE users SET open_to=$2 OUTPUT INSERTED.* WHERE id=$1', [req.user.id, JSON.stringify([...new Set(openTo)])]);
  res.json({ user: meView(u) });
}));

r.get('/intents', (req, res) => res.json({ intents: INTENT_KEYS.map((k) => ({ key: k, ...INTENTS[k] })), holdDays: HOLD_DAYS }));

export default r;
