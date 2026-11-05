// "Download my data" files are signed (HMAC-SHA256), so "Restore my data" can trust them:
// a changed or made-up file is refused. EXPORT_KEY in production (Key Vault); development derives one.
import crypto from 'node:crypto';
import { config } from '../config.js';

const key = () => process.env.EXPORT_KEY || crypto.createHash('sha256').update(`soulink-export-key:${config.jwtSecret}`).digest('hex');

// stable JSON: object keys sorted, so the signature does not depend on key order
const stable = (v) => (Array.isArray(v) ? `[${v.map(stable).join(',')}]`
  : v && typeof v === 'object' && !(v instanceof Date) ? `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`
    : JSON.stringify(v instanceof Date ? v.toISOString() : v));

const mac = (data) => crypto.createHmac('sha256', key()).update(stable(data)).digest('hex');

export function signExport(data) {
  const plain = JSON.parse(JSON.stringify(data)); // dates → strings, exactly as the user will download it
  return { ...plain, signature: mac(plain) };
}

export function verifyExport(file) {
  if (!file || typeof file !== 'object' || typeof file.signature !== 'string') return false;
  const { signature, ...data } = file;
  const want = Buffer.from(mac(data), 'hex');
  const got = Buffer.from(signature, 'hex');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
