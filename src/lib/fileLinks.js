// Private file links. Every photo, video, voice note, document and selfie under /uploads is served ONLY through a
// signed link that expires: the server adds "?t=<expiry>.<viewer>.<signature>" to each /uploads/... path in what it
// sends to a logged-in person (and only things they are allowed to see are ever sent to them). A copied link stops
// working after 1-2 hours. Without a valid signature a file is refused, so nothing is public by link.
// Exceptions: ad pictures (ads are meant to be seen). A shared post / Spark gives a visitor a 2-minute link to that
// one post's media only (see routes/share.js).
import crypto from 'node:crypto';
import { config } from '../config.js';

const SECRET = () => process.env.FILE_LINK_SECRET || `soulink-file-links:${config.jwtSecret}`;
const PUBLIC_DIRS = ['/uploads/ads/'];
export const isPublicFile = (p) => PUBLIC_DIRS.some((d) => p.startsWith(d));

const sign = (path, exp, who) => crypto.createHmac('sha256', SECRET()).update(`${path}|${exp}|${who}`).digest('base64url').slice(0, 24);

/** A signed link for one viewer. ttlSec: for visitors; logged-in people get the same link for the whole hour
 *  (so the phone can cache it), valid 1-2 hours. */
export function signPath(path, who, ttlSec) {
  if (typeof path !== 'string' || !path.startsWith('/uploads/') || isPublicFile(path) || path.includes('?')) return path;
  const now = Math.floor(Date.now() / 1000);
  const exp = ttlSec ? now + ttlSec : (Math.floor(now / 3600) + 2) * 3600;
  const w = String(who || 'g').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || 'g';
  return `${path}?t=${exp}.${w}.${sign(path, exp, w)}`;
}

/** Is this /uploads path + t= value a valid, unexpired link? */
export function checkSigned(path, t) {
  if (isPublicFile(path)) return true;
  const m = /^(\d{9,11})\.([a-z0-9-]{1,40})\.([A-Za-z0-9_-]{24})$/.exec(String(t || ''));
  if (!m) return false;
  if (Number(m[1]) < Date.now() / 1000) return false;
  const want = Buffer.from(sign(path, m[1], m[2])); const got = Buffer.from(m[3]);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

/** Signs every /uploads/... string inside a response (objects, arrays, nested). */
export function signDeep(v, who, ttlSec, depth = 0) {
  if (depth > 12 || v == null) return v;
  if (typeof v === 'string') return v.startsWith('/uploads/') ? signPath(v, who, ttlSec) : v;
  if (Array.isArray(v)) return v.map((x) => signDeep(x, who, ttlSec, depth + 1));
  if (typeof v === 'object' && v.constructor === Object) {
    const out = {};
    for (const [k, x] of Object.entries(v)) out[k] = signDeep(x, who, ttlSec, depth + 1);
    return out;
  }
  return v;
}

/** The app sends links back sometimes (a Soulmoji it picked, a voice clip it made): drop the signature so the
 *  server compares the plain path it stored. */
export function stripDeep(v, depth = 0) {
  if (depth > 12 || v == null) return v;
  if (typeof v === 'string') return v.startsWith('/uploads/') && v.includes('?') ? v.slice(0, v.indexOf('?')) : v;
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i += 1) v[i] = stripDeep(v[i], depth + 1); return v; }
  if (typeof v === 'object') { for (const k of Object.keys(v)) v[k] = stripDeep(v[k], depth + 1); return v; }
  return v;
}
export const plainPath = (u) => (typeof u === 'string' && u.includes('?') ? u.slice(0, u.indexOf('?')) : u);
