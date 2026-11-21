// Face fingerprints are encrypted in the app before they reach the database (policy section 5):
// AES-256-GCM with FACE_KEY (32 bytes, base64), held in Azure Key Vault in production.
// Stored as  v1:<base64 of iv(12) + tag(16) + ciphertext>. A stolen database copy holds no usable face data.
import crypto from 'node:crypto';
import { config } from '../config.js';
import { many, query } from '../db.js';

// FACE_KEY: its own key (Render setting, 32 random bytes in base64). Before it was set, a key worked out from the
// login secret was used ("legacy"); those values are still readable and are re-locked with FACE_KEY at start-up.
const legacyKey = () => crypto.createHash('sha256').update(`soulink-face-key:${config.jwtSecret}`).digest();
const faceKey = () => {
  if (!process.env.FACE_KEY) return null;
  const k = Buffer.from(process.env.FACE_KEY, 'base64');
  return k.length === 32 ? k : null;
};
const key = () => faceKey() || legacyKey(); // the key new values are locked with

function seal(vector, k) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', k, iv);
  const body = Buffer.concat([c.update(JSON.stringify(vector), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString('base64');
}
function open(b64, k) {
  const raw = Buffer.from(b64, 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', k, raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8'));
}

/** v2 = locked with FACE_KEY; v1 = locked with the key used before FACE_KEY was set. */
export function sealFace(vector) {
  return faceKey() ? `v2:${seal(vector, faceKey())}` : `v1:${seal(vector, legacyKey())}`;
}

/** Returns the 128 numbers, from an encrypted value or (older rows) plain JSON. null if unreadable. */
export function openFace(stored) {
  if (Array.isArray(stored)) return stored;
  if (typeof stored !== 'string') return null;
  const tries = (b64) => {
    for (const k of [faceKey(), legacyKey()].filter(Boolean)) { try { return open(b64, k); } catch { /* next key */ } }
    return null;
  };
  try {
    if (stored.startsWith('v2:') || stored.startsWith('v1:')) return tries(stored.slice(3));
    return JSON.parse(stored);
  } catch { return null; }
}

/** At start-up: lock every face fingerprint with the current key (plain JSON from long ago, or the old key once
 *  FACE_KEY is set). Also the faces kept for bans. Returns how many were re-locked. */
export async function sealPlainFaces() {
  const want = faceKey() ? 'v2:%' : 'v1:%';
  let n = 0;
  for (const [table, idCol, col] of [['face_embeddings', 'user_id', 'embedding'], ['banned_identities', 'id', 'face_embedding']]) {
    try {
      const rows = await many(`SELECT ${idCol} AS id, ${col} AS v FROM ${table} WHERE ${col} IS NOT NULL AND ${col} NOT LIKE '${want}'`);
      for (const r of rows) {
        const v = openFace(r.v);
        if (v) { await query(`UPDATE ${table} SET ${col}=$2 WHERE ${idCol}=$1`, [r.id, sealFace(v)]); n += 1; }
        else console.warn(`face data in ${table} could not be opened with FACE_KEY or the old key`);
      }
    } catch (e) { console.warn(`re-locking faces in ${table}:`, e.message); }
  }
  return n;
}
