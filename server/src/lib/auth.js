import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { config } from '../config.js';

/** A login token for one device session (sid). Logging out ends that session; deleting the account ends all of them. */
export const signToken = (userId, sid) => jwt.sign(sid ? { sub: userId, sid } : { sub: userId }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

/** Returns { userId, sid } or null. */
export function verifyToken(token) {
  try {
    const p = jwt.verify(token, config.jwtSecret);
    return { userId: p.sub, sid: p.sid || null, iat: p.iat || 0 };
  } catch {
    return null;
  }
}

export const hashCode = (target, code) =>
  crypto.createHmac('sha256', config.jwtSecret).update(`${target}:${code}`).digest('hex');

export const randomOtp = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

/** Normalizes Indian 10-digit numbers to +91..., accepts E.164 otherwise. Returns null if invalid. */
export function normalizePhone(raw) {
  if (!raw) return null;
  let p = String(raw).replace(/[\s\-()]/g, '');
  if (/^[6-9]\d{9}$/.test(p)) p = `+91${p}`;
  if (/^0[6-9]\d{9}$/.test(p)) p = `+91${p.slice(1)}`;
  if (/^91[6-9]\d{9}$/.test(p)) p = `+${p}`;
  return /^\+[1-9]\d{7,14}$/.test(p) ? p : null;
}

export function normalizeEmail(raw) {
  if (!raw) return null;
  const e = String(raw).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
}

export function ageFrom(birthDate, now = new Date()) {
  const b = new Date(`${birthDate}T00:00:00Z`);
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age--;
  return age;
}
