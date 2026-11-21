// Anonymous messages, only between Connections (never to people you aren't connected with).
// The sender chooses how long they stay hidden (1 hour to 30 days, 7 days by default). When the time is up both
// are told, and the recipient sees exactly who it was (name + profile).
import { recentlyActive } from '../activity.js';
// Privacy rule: nothing about the sender (id, name, photo) leaves the server for the
// recipient before the reveal: not in lists, messages, notifications or realtime events.
import { many, one } from '../db.js';
import { notify, userCard } from './social.js';

export const REVEAL_DAYS = 7; // the default
/** How long the sender can stay hidden, in hours: 1 h, 6 h, 1 day, 3 days, 7 days, 14 days, 30 days */
export const REVEAL_HOURS = [1, 6, 24, 72, 168, 336, 720];
export const LIMITS = { newThreadsPerDay: 5, unansweredMessages: 3, bodyMax: 500 };

const ADJ = ['Mystery', 'Secret', 'Hidden', 'Quiet', 'Masked', 'Silent', 'Shy', 'Midnight', 'Velvet', 'Cosmic'];
const NOUN = ['Soul', 'Comet', 'Star', 'Moon', 'Spark', 'Owl', 'Echo', 'Aura', 'Nova', 'Wave'];
export const randomAlias = () => `${ADJ[Math.floor(Math.random() * ADJ.length)]} ${NOUN[Math.floor(Math.random() * NOUN.length)]}`;

export const CONNECTED_SQL = `EXISTS (SELECT 1 FROM connections c WHERE (c.user_a=t.sender_id AND c.user_b=t.recipient_id) OR (c.user_a=t.recipient_id AND c.user_b=t.sender_id))`;

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

/** Reveals every thread whose hidden time (chosen by the sender) is over. */
export async function processAnonReveals(now = new Date()) {
  const due = await many(`SELECT t.* FROM anon_threads t WHERE t.revealed_at IS NULL AND t.reveal_at <= $1`, [now]);
  let revealed = 0;
  for (const t of due) if (await reveal(t, 'time')) revealed += 1;
  return { revealed };
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
    revealHours: t.reveal_hours ?? REVEAL_DAYS * 24,
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
