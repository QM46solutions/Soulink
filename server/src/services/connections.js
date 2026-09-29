// Connections: shared rules used by the Connect routes, chat, and the hold timer.
import { many, one, query } from '../db.js';
import { notify } from './social.js';

export const INTENTS = {
  friendship: { label: 'Friendship', emoji: '🤝' },
  dating: { label: 'Dating', emoji: '💘' },
  situationship: { label: 'Situationship', emoji: '🌗' },
  buddy: { label: 'Study / Work buddy', emoji: '📚' },
  networking: { label: 'Networking', emoji: '💼' },
  vibing: { label: 'Just vibing', emoji: '✨' },
  unsure: { label: 'Not sure yet', emoji: '🤔' },
};
export const INTENT_KEYS = Object.keys(INTENTS);
export const HOLD_DAYS = [1, 3, 7, 14, 30];
export const COOLDOWN = { rejectedDays: 30, suspendedDays: 7 };

export const pairOf = (a, b) => [String(a).toUpperCase(), String(b).toUpperCase()].sort();

export async function connectionBetween(a, b) {
  const [x, y] = pairOf(a, b);
  return one('SELECT * FROM connections WHERE user_a=$1 AND user_b=$2', [x, y]);
}

/** Reminder time before a hold ends: 24 h, or 3 h for a 1-day hold. */
export const reminderLeadMs = (days) => (days <= 1 ? 3 : 24) * 3600 * 1000;

/**
 * Runs every minute: sends "hold ends soon" reminders and suspends holds that ran out.
 * Returns what it did (used by tests).
 */
export async function processHolds(now = new Date()) {
  const held = await many(`SELECT * FROM connection_requests WHERE status=N'held'`, []);
  let reminded = 0; let suspended = 0;
  for (const r of held) {
    const until = new Date(r.hold_until);
    if (until <= now) {
      const upd = await one(
        `UPDATE connection_requests SET status=N'suspended', responded_at=SYSDATETIMEOFFSET() OUTPUT INSERTED.* WHERE id=$1 AND status=N'held'`, [r.id],
      );
      if (upd) {
        suspended += 1;
        await notify(r.from_id, r.to_id, 'connect_suspended', r.id, { intent: r.intent });
      }
    } else if (!r.hold_reminded && until.getTime() - now.getTime() <= reminderLeadMs(r.hold_days)) {
      await query('UPDATE connection_requests SET hold_reminded=1 WHERE id=$1', [r.id]);
      reminded += 1;
      await notify(r.to_id, r.from_id, 'connect_hold_reminder', r.id, { intent: r.intent, holdUntil: until.toISOString() });
    }
  }
  return { reminded, suspended };
}

let timer = null;
export function startHoldTimer() {
  if (timer) return;
  timer = setInterval(() => { processHolds().catch((e) => console.error('hold timer:', e.message)); }, 60_000);
  timer.unref?.();
}
