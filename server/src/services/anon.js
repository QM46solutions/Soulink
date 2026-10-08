// Anonymous messages: the sender stays hidden for 7 days after the first message,
import { recentlyActive } from '../activity.js';
// or until the two people become a Soul Connection. Then both are told, and the
// recipient sees exactly who it was (name + profile).
// Privacy rule: nothing about the sender (id, name, photo) leaves the server for the
// recipient before the reveal: not in lists, messages, notifications or realtime events.
import { many, one } from '../db.js';
import { notify, userCard } from './social.js';

export const REVEAL_DAYS = 7;
export const LIMITS = { newThreadsPerDay: 5, unansweredMessages: 3, bodyMax: 500 };

const ADJ = ['Mystery', 'Secret', 'Hidden', 'Quiet', 'Masked', 'Silent', 'Shy', 'Midnight', 'Velvet', 'Cosmic'];
const NOUN = ['Soul', 'Comet', 'Star', 'Moon', 'Spark', 'Owl', 'Echo', 'Aura', 'Nova', 'Wave'];
export const randomAlias = () => `${ADJ[Math.floor(Math.random() * ADJ.length)]} ${NOUN[Math.floor(Math.random() * NOUN.length)]}`;

const CONNECTED_SQL = `EXISTS (SELECT 1 FROM connections c WHERE (c.user_a=t.sender_id AND c.user_b=t.recipient_id) OR (c.user_a=t.recipient_id AND c.user_b=t.sender_id))`;

async function reveal(t, reason) {
  const upd = await one(
    `UPDATE anon_threads SET revealed_at=SYSDATETIMEOFFSET(), reveal_reason=$2 OUTPUT INSERTED.* WHERE id=$1 AND revealed_at IS NULL`, [t.id, reason],
  );
  if (!upd) return false;
  await notify(t.recipient_id, t.sender_id, 'anon_revealed', t.id, { alias: t.alias, reason });
  await notify(t.sender_id, t.recipient_id, 'anon_revealed_sender', t.id, { alias: t.alias, reason });
  try { (await import('../realtime.js')).emitToUsers([t.sender_id, t.recipient_id], 'anon:update', { threadId: t.id }); } catch { /* tests */ }
  return true;
}

/** Reveals every thread whose 7 days are over, or whose two people are now connected. */
export async function processAnonReveals(now = new Date()) {
  const due = await many(
    `SELECT t.*, CASE WHEN ${CONNECTED_SQL} THEN 1 ELSE 0 END AS is_connected FROM anon_threads t
      WHERE t.revealed_at IS NULL AND (t.reveal_at <= $1 OR ${CONNECTED_SQL})`, [now],
  );
  let revealed = 0;
  for (const t of due) if (await reveal(t, t.is_connected ? 'connected' : 'time')) revealed += 1;
  return { revealed };
}

/** Called when two people connect: any anonymous chat between them is revealed straight away. */
export async function revealBetween(a, b) {
  const rows = await many(
    `SELECT * FROM anon_threads WHERE revealed_at IS NULL AND ((sender_id=$1 AND recipient_id=$2) OR (sender_id=$2 AND recipient_id=$1))`, [a, b],
  );
  for (const t of rows) await reveal(t, 'connected');
}

/** A thread as one of its two people sees it. Sender details only after the reveal. */
export function threadView(t, meId, users = {}) {
  const isSender = String(t.sender_id).toUpperCase() === String(meId).toUpperCase();
  const revealed = !!t.revealed_at;
  const sender = users[String(t.sender_id).toUpperCase()];
  const recipient = users[String(t.recipient_id).toUpperCase()];
  const myRead = isSender ? t.sender_read_at : t.recipient_read_at;
  return {
    id: t.id,
    role: isSender ? 'sender' : 'recipient',
    alias: t.alias,
    revealed,
    revealAt: t.reveal_at,
    revealedAt: t.revealed_at,
    revealReason: t.reveal_reason,
    // The person on the other side: always known to the sender; to the recipient only after the reveal
    other: isSender ? (recipient ? userCard(recipient) : null) : revealed && sender ? userCard(sender) : null,
    closed: !!t.hidden_by_recipient,
    lastMessage: t.last_body != null ? { body: t.last_body, mine: !!t.last_from_sender === isSender, createdAt: t.last_message_at } : null,
    unread: t.last_message_at && t.last_from_sender != null && !!t.last_from_sender !== isSender && (!myRead || new Date(myRead) < new Date(t.last_message_at)),
    createdAt: t.created_at,
  };
}

export async function usersById(ids) {
  const list = [...new Set(ids.filter(Boolean).map((x) => String(x).toUpperCase()))];
  if (!list.length) return {};
  const params = list.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await many(`SELECT * FROM users WHERE id IN (${params})`, list);
  return Object.fromEntries(rows.map((u) => [String(u.id).toUpperCase(), u]));
}

let timer = null;
export function startAnonTimer() {
  if (timer) return;
  // only while people are using Soulink, so the free cloud database can pause when it's quiet
  const run = () => { if (recentlyActive()) processAnonReveals().catch((e) => console.error('anon reveal timer:', e.message)); };
  timer = setInterval(run, 60_000);
  timer.unref?.();
}
