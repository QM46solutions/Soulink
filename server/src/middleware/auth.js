import { HttpError } from '../lib/errors.js';
import { config } from '../config.js';
import { verifyToken } from '../lib/auth.js';
import { one, query } from '../db.js';
import { unauthorized } from '../lib/errors.js';

async function loadUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  const id = verifyToken(token);
  if (!id) return null;
  return one('SELECT * FROM users WHERE id = $1', [id]);
}

/** Requires a valid token. Sets req.user (full DB row). */
export async function requireAuth(req, res, next) {
  try {
    const user = await loadUser(req);
    if (!user) return next(unauthorized());
    req.user = user;
    // Cheap activity heartbeat (at most once a minute per user)
    if (!user.last_active_at || Date.now() - new Date(user.last_active_at).getTime() > 60_000) {
      query('UPDATE users SET last_active_at = SYSDATETIMEOFFSET() WHERE id = $1', [user.id]).catch(() => {});
    }
    next();
  } catch (e) {
    next(e);
  }
}

/** Blocks connecting (follow, requests, new chats) until the person has created their Soul DNA. */
export function requireSoul(req, res, next) {
  if (config.soulRequired && !req.user?.soul_ready) {
    return next(new HttpError(403, 'Create your Soul DNA first to start connecting.', 'soul_required'));
  }
  return next();
}
