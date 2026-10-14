// Device sessions (policy section 4). Each login creates one; the token carries its id.
//  logout          → ends this device's session only
//  delete account  → ends every session; other devices are told "No user account found"
import { many, one, query } from '../db.js';
import { signToken } from '../lib/auth.js';
import { clientIp } from '../lib/log.js';

export async function startSession(userId, req) {
  const device = String(req?.headers?.['user-agent'] || '').slice(0, 200) || null;
  const s = await one('INSERT INTO user_sessions (user_id, device, ip) OUTPUT INSERTED.id VALUES ($1, $2, $3)', [userId, device, clientIp(req)]);
  return signToken(userId, s.id);
}

/** 'ok' | 'ended' (logged out / account deleted) */
export async function checkSession(userId, sid) {
  if (!sid) return 'ok'; // tokens from before sessions existed: valid until they expire (7 days)
  const s = await one('SELECT revoked_at, last_seen_at FROM user_sessions WHERE id=$1 AND user_id=$2', [sid, userId]);
  if (!s || s.revoked_at) return 'ended';
  if (Date.now() - new Date(s.last_seen_at).getTime() > 60_000) query('UPDATE user_sessions SET last_seen_at=SYSDATETIMEOFFSET() WHERE id=$1', [sid]).catch(() => {});
  return 'ok';
}

export const endSession = (sid) => query('UPDATE user_sessions SET revoked_at=SYSDATETIMEOFFSET() WHERE id=$1 AND revoked_at IS NULL', [sid]);

export async function endAllSessions(userId) {
  const rows = await many('SELECT id FROM user_sessions WHERE user_id=$1 AND revoked_at IS NULL', [userId]);
  await query('UPDATE user_sessions SET revoked_at=SYSDATETIMEOFFSET() WHERE user_id=$1 AND revoked_at IS NULL', [userId]);
  return rows.map((r) => r.id);
}
