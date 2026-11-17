// Sign-in for the team console: password (scrypt) + 6-digit Google Authenticator code (TOTP, RFC 6238).
// Console tokens are separate from app tokens: different secret, 8-hour life.
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { one } from '../db.js';
import { HttpError } from './errors.js';

const SECRET = () => `${config.jwtSecret}|soulink-console`;
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 });
  return `s1$${salt.toString('base64')}$${key.toString('base64')}`;
}
export function checkPassword(pw, stored) {
  if (!stored || !stored.startsWith('s1$')) return false;
  const [, s, k] = stored.split('$');
  const key = crypto.scryptSync(pw, Buffer.from(s, 'base64'), 32, { N: 16384, r: 8, p: 1 });
  const want = Buffer.from(k, 'base64');
  return want.length === key.length && crypto.timingSafeEqual(key, want);
}

export function newTotpSecret() {
  const b = crypto.randomBytes(20); let bits = ''; let out = '';
  for (const x of b) bits += x.toString(2).padStart(8, '0');
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}
function b32decode(s) {
  let bits = '';
  for (const c of s.replace(/=+$/, '').toUpperCase()) { const v = B32.indexOf(c); if (v < 0) throw new Error('bad secret'); bits += v.toString(2).padStart(5, '0'); }
  const bytes = []; for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function totpAt(secret, step) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac('sha1', b32decode(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000)).padStart(6, '0');
}
/** Accepts the current code and one step either side (clock drift). */
export function checkTotp(secret, code) {
  if (!secret || !/^\d{6}$/.test(String(code || ''))) return false;
  const step = Math.floor(Date.now() / 30_000);
  return [-1, 0, 1].some((d) => totpAt(secret, step + d) === String(code));
}
export const otpauthUrl = (email, secret) => `otpauth://totp/Soulink%20Console:${encodeURIComponent(email)}?secret=${secret}&issuer=Soulink%20Console&digits=6&period=30`;

export const signConsole = (u) => jwt.sign({ cid: u.id, role: u.role }, SECRET(), { expiresIn: '8h' });

/** Middleware: a signed-in console user with one of the given roles (owner can do everything). */
export function requireConsole(...roles) {
  return async (req, res, next) => {
    try {
      const h = req.headers.authorization || '';
      const token = h.startsWith('Bearer ') ? h.slice(7) : null;
      if (!token) throw new HttpError(401, 'Please sign in to the console', 'console_signin');
      let p; try { p = jwt.verify(token, SECRET()); } catch { throw new HttpError(401, 'Your console session ended. Sign in again.', 'console_signin'); }
      const u = await one('SELECT id, email, name, role, disabled_at FROM console_users WHERE id=$1', [p.cid]);
      if (!u || u.disabled_at) throw new HttpError(401, 'This console account is turned off', 'console_signin');
      if (u.role !== 'owner' && roles.length && !roles.includes(u.role)) throw new HttpError(403, "Your role can't open this page", 'console_role');
      req.cu = u;
      next();
    } catch (e) { next(e); }
  };
}
