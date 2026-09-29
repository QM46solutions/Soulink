// Writes face-report.txt in the Soulink folder: every account, whether its face is verified,
// its stored face fingerprint (128 numbers), and how close every pair of faces is.
// Run with SHOW-FACE-DATA.bat. Read-only: changes nothing in the database.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { many, closePool } from '../src/db.js';
import { FACE } from '../src/routes/face.js';
import { faceDistance } from '../src/services/faceEngine.js';

const out = fileURLToPath(new URL('../../face-report.txt', import.meta.url));
const rows = await many(`
  SELECT u.id, u.username, u.display_name, u.phone, u.email, u.face_verified, u.onboarding_done, u.created_at,
         f.provider, f.embedding, f.created_at AS face_at
  FROM users u LEFT JOIN face_embeddings f ON f.user_id = u.id
  ORDER BY u.created_at`);
const L = [];
L.push(`SOULINK FACE REPORT  ${new Date().toString()}`, '');
L.push('Rules in force:');
L.push(`  same person (3 scan photos must match)   distance <= ${FACE.samePersonMax}`);
L.push(`  duplicate account blocked                distance <  ${FACE.sameAccountMax}`);
L.push(`  looking straight |yaw| <= ${FACE.straightMaxYaw}, head turned |yaw| >= ${FACE.turnMinYaw}, face width ${FACE.minWidth}-${FACE.maxWidth} of photo`);
L.push(`  brightness ${FACE.minBrightness}-${FACE.maxBrightness}, sharpness >= ${FACE.minSharpness}, detector confidence >= ${FACE.minScore}`, '');
L.push(`ACCOUNTS (${rows.length})`);
for (const r of rows) {
  L.push(`- @${r.username || '(no username yet)'}  ${r.display_name || ''}  ${r.phone || r.email || ''}  face_verified=${r.face_verified ? 'YES' : 'no'}  profile_done=${r.onboarding_done ? 'yes' : 'no'}`);
}
const withFace = rows.filter((r) => r.embedding).map((r) => ({ ...r, v: JSON.parse(r.embedding) }));
for (const r of withFace) {
  L.push('', `FACE FINGERPRINT  @${r.username || r.phone || r.email}  (engine: ${r.provider}, saved ${new Date(r.face_at).toString()})`);
  const n = Math.sqrt(r.v.reduce((s, x) => s + x * x, 0));
  L.push(`  128 numbers, length ${n.toFixed(4)}, min ${Math.min(...r.v).toFixed(4)}, max ${Math.max(...r.v).toFixed(4)}`);
  for (let i = 0; i < r.v.length; i += 8) L.push(`  [${String(i).padStart(3)}] ${r.v.slice(i, i + 8).map((x) => x.toFixed(5).padStart(9)).join(' ')}`);
}
if (withFace.length > 1) {
  L.push('', 'DISTANCES BETWEEN FACES (lower = more alike)');
  for (let i = 0; i < withFace.length; i += 1) for (let j = i + 1; j < withFace.length; j += 1) {
    const d = faceDistance(withFace[i].v, withFace[j].v);
    L.push(`  @${withFace[i].username} vs @${withFace[j].username}: ${d.toFixed(4)}  ${d < FACE.sameAccountMax ? '<< SAME PERSON' : 'different people'}`);
  }
}
fs.writeFileSync(out, `${L.join('\r\n')}\r\n`);
console.log(`Saved ${out}`);
await closePool();
process.exit(0);
