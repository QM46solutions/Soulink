// Connections: shared rules used by the Connect routes, chat, and the hold timer.
import { recentlyActive } from '../activity.js';
import { many, one, query } from '../db.js';
import { notify } from './social.js';

export const INTENTS = {
  life_partner: { label: 'Life partner', emoji: '💍' },
  friendship: { label: 'Friendship', emoji: '🤝' },
  dating: { label: 'Dating', emoji: '💘' },
  situationship: { label: 'Situationship', emoji: '🌗' },
  buddy: { label: 'Study / Work buddy', emoji: '📚' },
  networking: { label: 'Networking', emoji: '💼' },
  vibing: { label: 'Just vibing', emoji: '✨' },
  unsure: { label: 'Not sure yet', emoji: '🤔' },
  // someone you already know (asked first when connecting: family, friend, colleague or other)
  family: { label: 'Family', emoji: '👨‍👩‍👧', known: true },
  known_friend: { label: 'Friend', emoji: '🫂', known: true },
  colleague: { label: 'Colleague', emoji: '🧑‍💼', known: true },
  known_other: { label: 'Someone I know', emoji: '🙂', known: true },
};
/** Someone you already know → the intent the request carries */
export const KNOWN_AS = { family: 'family', friend: 'known_friend', colleague: 'colleague', other: 'known_other' };
export const INTENT_KEYS = Object.keys(INTENTS);
export const HOLD_DAYS = [1, 3, 7, 14, 30];
export const COOLDOWN = { rejectedDays: 30, suspendedDays: 7 };

export const pairOf = (a, b) => [String(a).toUpperCase(), String(b).toUpperCase()].sort();

export async function connectionBetween(a, b) {
  const [x, y] = pairOf(a, b);
  return one('SELECT * FROM connections WHERE user_a=$1 AND user_b=$2', [x, y]);
}

/** After a hold ends, the receiver has this long to accept or reject; then it's rejected automatically. */
export const DECIDE_HOURS = 24;

/** An open hold between two people (either direction): while it lasts they can chat (in Requests). */
export async function heldBetween(a, b) {
  return one(`SELECT TOP 1 * FROM connection_requests WHERE status=N'held'
               AND ((from_id=$1 AND to_id=$2) OR (from_id=$2 AND to_id=$1)) ORDER BY created_at DESC`, [a, b]);
}

const keyOf = (a, b) => pairOf(a, b).join(':');

/** A held chat ended without a connection (rejected, withdrawn or timed out): hidden from both, kept in the database. */
export async function closeHeldChat(a, b) {
  if (await connectionBetween(a, b)) return;
  const conv = await one('SELECT id FROM conversations WHERE direct_key=$1', [keyOf(a, b)]);
  if (!conv) return;
  await query('UPDATE conversation_members SET hidden_at=SYSDATETIMEOFFSET() WHERE conversation_id=$1 AND hidden_at IS NULL', [conv.id]);
  await query('UPDATE conversations SET history_from=SYSDATETIMEOFFSET() WHERE id=$1', [conv.id]);
  try { (await import('../realtime.js')).emitToUsers([a, b], 'conversation:hidden', { conversationId: conv.id }); } catch { /* tests */ }
}

/**
 * Runs every minute.
 *  1. A hold has ended → ask the receiver: "still on hold: accept or reject?" (they have DECIDE_HOURS to answer)
 *  2. No answer by then → rejected automatically; the sender is told and the held chat is hidden.
 * Returns what it did (used by tests).
 */
export async function processHolds(now = new Date()) {
  const held = await many(`SELECT * FROM connection_requests WHERE status=N'held'`, []);
  let asked = 0; let rejected = 0;
  for (const r of held) {
    const until = new Date(r.hold_until);
    if (until > now) continue;
    if (!r.hold_decide_until) {
      const decide = new Date(now.getTime() + DECIDE_HOURS * 3600 * 1000);
      const upd = await one(`UPDATE connection_requests SET hold_decide_until=$2, hold_reminded=1 OUTPUT INSERTED.* WHERE id=$1 AND status=N'held' AND hold_decide_until IS NULL`, [r.id, decide]);
      if (upd) {
        asked += 1;
        await notify(r.to_id, r.from_id, 'connect_hold_decide', r.id, { intent: r.intent, decideBy: decide.toISOString() });
      }
    } else if (new Date(r.hold_decide_until) <= now) {
      const upd = await one(
        `UPDATE connection_requests SET status=N'rejected', auto_rejected=1, responded_at=SYSDATETIMEOFFSET() OUTPUT INSERTED.* WHERE id=$1 AND status=N'held'`, [r.id],
      );
      if (upd) {
        rejected += 1;
        await closeHeldChat(r.from_id, r.to_id);
        await notify(r.from_id, r.to_id, 'connect_rejected', r.id, { intent: r.intent, auto: true });
      }
    }
  }
  return { asked, rejected };
}

let timer = null;
export function startHoldTimer() {
  if (timer) return;
  // only while people are using Soulink, so the free cloud database can pause when it's quiet
  timer = setInterval(() => { if (recentlyActive()) processHolds().catch((e) => console.error('hold timer:', e.message)); }, 60_000);
  timer.unref?.();
}
