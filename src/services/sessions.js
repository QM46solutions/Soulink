// Device sessions (policy section 4). Each login creates one; the token carries its id.
//  logout          → ends this device's session only
//  delete account  → ends every session; other devices are told "No user account found"
//  Settings › Where you're logged in → see every device, log one out, or log out of all the others
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

// ---------- Settings › Where you're logged in ----------
/** A readable device name from the browser / app's user agent: "Chrome on Windows", "Soulink app on iPhone". */
export function describeDevice(ua) {
  const u = String(ua || '');
  const os = /iPhone/i.test(u) ? 'iPhone' : /iPad/i.test(u) ? 'iPad' : /Android/i.test(u) ? 'Android' : /CrOS/i.test(u) ? 'Chromebook'
    : /Windows/i.test(u) ? 'Windows' : /Macintosh|Mac OS X/i.test(u) ? 'Mac' : /Linux/i.test(u) ? 'Linux' : null;
  const app = /Expo|okhttp|CFNetwork|Dalvik|Soulink\//i.test(u);
  const browser = app ? 'Soulink app' : /Edg\//i.test(u) ? 'Edge' : /OPR\/|Opera/i.test(u) ? 'Opera' : /SamsungBrowser/i.test(u) ? 'Samsung Internet'
    : /CriOS|Chrome\//i.test(u) ? 'Chrome' : /FxiOS|Firefox\//i.test(u) ? 'Firefox' : /Safari\//i.test(u) ? 'Safari' : null;
  const kind = os === 'iPad' || (/Android/i.test(u) && !/Mobile/i.test(u)) ? 'tablet' : os === 'iPhone' || os === 'Android' ? 'phone' : os ? 'computer' : 'unknown';
  const name = browser && os ? `${browser} on ${os}` : browser || os || 'Unknown device';
  return { name, kind };
}
/** Only part of the address is shown: enough to recognise your network, not to track it. */
export function maskIp(ip) {
  const x = String(ip || '').replace(/^::ffff:/, '');
  if (!x) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(x)) return x.split('.').slice(0, 2).join('.') + '.x.x';
  return x.split(':').slice(0, 2).join(':') + ':…';
}
const ACTIVE_DAYS = 30; // a session nobody used for 30 days is shown as ended (the token behind it has expired anyway)
/** Every device for this account: still logged in first (this one on top), then the ones ended in the last 30 days. */
export async function listSessions(userId, currentSid) {
  const rows = await many(
    `SELECT TOP 50 id, device, ip, created_at, last_seen_at, revoked_at FROM user_sessions
      WHERE user_id=$1 AND (revoked_at IS NULL OR revoked_at > DATEADD(DAY, -30, SYSDATETIMEOFFSET()))
      ORDER BY CASE WHEN revoked_at IS NULL THEN 0 ELSE 1 END, last_seen_at DESC`, [userId]);
  const cur = String(currentSid || '').toLowerCase();
  const out = rows.map((r) => {
    const d = describeDevice(r.device);
    const stale = Date.now() - new Date(r.last_seen_at).getTime() > ACTIVE_DAYS * 86400000;
    return {
      id: r.id, device: d.name, kind: d.kind, ip: maskIp(r.ip),
      loggedInAt: r.created_at, lastActiveAt: r.last_seen_at, endedAt: r.revoked_at,
      active: !r.revoked_at && !stale, current: String(r.id).toLowerCase() === cur,
    };
  });
  return out.sort((a, b) => (b.current - a.current) || (b.active - a.active) || (new Date(b.lastActiveAt) - new Date(a.lastActiveAt)));
}
/** End one of my sessions (not this one: that is Log out). Returns true if it was still active. */
export async function endMySession(userId, sid) {
  const r = await query('UPDATE user_sessions SET revoked_at=SYSDATETIMEOFFSET() OUTPUT INSERTED.id WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL', [sid, userId]);
  return !!(r.rows?.length || r.rowCount);
}
/** Log out everywhere else. Returns the ended session ids. */
export async function endOtherSessions(userId, keepSid) {
  const rows = await many('SELECT id FROM user_sessions WHERE user_id=$1 AND revoked_at IS NULL AND ($2 IS NULL OR id<>$2)', [userId, keepSid || null]);
  if (rows.length) await query('UPDATE user_sessions SET revoked_at=SYSDATETIMEOFFSET() WHERE user_id=$1 AND revoked_at IS NULL AND ($2 IS NULL OR id<>$2)', [userId, keepSid || null]);
  return rows.map((r) => r.id);
}
