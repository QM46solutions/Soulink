// Unfinished sign-ups. Someone who starts creating an account (code checked, face scan, profile...) has 1 hour
// to come back and carry on from where they stopped; the hour counts from the last time they did anything.
// After that the half-made account is erased completely (same as deleting an account), and if they come back
// they start again as a brand-new user. A sign-up that failed or broke (face scan rejected, app closed, a crash)
// is cleared the same way.
import { many, one, query } from '../db.js';
import { deleteAccount } from './account.js';

export const UNFINISHED_HOURS = 1;
const ms = (d) => (d ? new Date(d).getTime() : 0);

/** Is this an unfinished sign-up that nobody touched for more than an hour? */
export function isExpiredSignup(u, now = Date.now()) {
  if (!u || u.onboarding_done || u.deactivated_at) return false;
  const last = Math.max(ms(u.last_active_at), ms(u.updated_at), ms(u.created_at));
  return now - last > UNFINISHED_HOURS * 3600 * 1000;
}

// Safety net: someone who already has connections, followers or posts is a real member (whatever the flag says)
const REAL_MEMBER_SQL = (col) => `(EXISTS (SELECT 1 FROM connections c WHERE c.user_a = ${col} OR c.user_b = ${col})
  OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ${col} OR f.followee_id = ${col})
  OR EXISTS (SELECT 1 FROM posts p WHERE p.author_id = ${col}))`;
export async function isRealMember(userId) {
  return !!(await one(`SELECT CASE WHEN ${REAL_MEMBER_SQL('$1')} THEN 1 ELSE 0 END AS y`, [userId]))?.y;
}

/** Erase one expired sign-up (and note it in the audit log). */
export async function expireSignup(u, reason = 'unfinished_signup_expired') {
  await deleteAccount(u.id, reason);
  await query("INSERT INTO audit_log (actor_id, action, detail) VALUES (NULL, 'signup_expired', $1)", [`user ${u.id} (${reason})`]).catch(() => {});
}

/** Erase every unfinished sign-up older than the hour. Returns how many. */
export async function purgeUnfinishedSignups() {
  const rows = await many(
    `SELECT * FROM users WHERE onboarding_done = 0 AND deactivated_at IS NULL
        AND created_at < DATEADD(HOUR, -${UNFINISHED_HOURS}, SYSDATETIMEOFFSET())
        AND (updated_at IS NULL OR updated_at < DATEADD(HOUR, -${UNFINISHED_HOURS}, SYSDATETIMEOFFSET()))
        AND (last_active_at IS NULL OR last_active_at < DATEADD(HOUR, -${UNFINISHED_HOURS}, SYSDATETIMEOFFSET()))
        AND NOT ${REAL_MEMBER_SQL('users.id')}`, [],
  );
  let n = 0;
  for (const u of rows) {
    try { await expireSignup(u); n += 1; } catch (e) { console.error(`unfinished sign-up ${String(u.id).slice(0, 8)}: ${e.message}`); }
  }
  if (n) console.log(`   Cleared ${n} unfinished sign-up(s) older than ${UNFINISHED_HOURS} hour`);
  return n;
}
