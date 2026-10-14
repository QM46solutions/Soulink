// Face fingerprints are encrypted in the app before they reach the database (policy section 5):
// AES-256-GCM with FACE_KEY (32 bytes, base64), held in Azure Key Vault in production.
// Stored as  v1:<base64 of iv(12) + tag(16) + ciphertext>. A stolen database copy holds no usable face data.
import crypto from 'node:crypto';
import { config } from '../config.js';
import { many, query } from '../db.js';

const key = () => (process.env.FACE_KEY
  ? Buffer.from(process.env.FACE_KEY, 'base64')
  : crypto.createHash('sha256').update(`soulink-face-key:${config.jwtSecret}`).digest()); // development only

export function sealFace(vector) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([c.update(JSON.stringify(vector), 'utf8'), c.final()]);
  return `v1:${Buffer.concat([iv, c.getAuthTag(), body]).toString('base64')}`;
}

/** Returns the 128 numbers, from an encrypted value or (older rows) plain JSON. null if unreadable. */
export function openFace(stored) {
  if (Array.isArray(stored)) return stored;
  if (typeof stored !== 'string') return null;
  try {
    if (!stored.startsWith('v1:')) return JSON.parse(stored);
    const raw = Buffer.from(stored.slice(3), 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', key(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8'));
  } catch { return null; }
}

/** At start-up: encrypt any face fingerprint still stored as plain JSON. */
export async function sealPlainFaces() {
  try {
    const rows = await many("SELECT user_id, embedding FROM face_embeddings WHERE embedding IS NOT NULL AND embedding NOT LIKE 'v1:%'");
    for (const r of rows) {
      const v = openFace(r.embedding);
      if (v) await query('UPDATE face_embeddings SET embedding=$2 WHERE user_id=$1', [r.user_id, sealFace(v)]);
    }
    return rows.length;
  } catch { return 0; }
}
