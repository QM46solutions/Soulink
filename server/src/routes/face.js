// Face ID at registration: one real face = one Soulink account. Works the same for phone and laptop cameras.
//  POST /face/check   one camera frame → is it clear enough? which way is the head turned? (live coaching)
//  POST /face/enroll  the 3 good frames (straight, turned one way, turned the other) → verify + save
// We keep only the 128-number face fingerprint. Photos are thrown away (the straight one is kept
// only if the person chooses it as their profile picture).
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { clientKey } from '../lib/clientKey.js';
import { z } from 'zod';
import { many, tx } from '../db.js';
import { config } from '../config.js';
import { ah, HttpError } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { saveFile } from '../providers/storage.js';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { analyzeFaces, faceDistance, quickFaces } from '../services/faceEngine.js';
import { meView } from '../services/social.js';

const r = Router();
r.use(requireAuth);

// Tuned for real phone cameras and laptop webcams (2026-09-29, after the first real-camera test)
export const FACE = {
  sameAccountMax: 0.5,  // average of the 3 new photos closer than this to a stored face = same person → blocked
  sameShotMax: 0.46,    // ...or at least 2 of the 3 single photos closer than this → blocked
  samePersonMax: 0.6,   // the 3 photos must be at least this close to each other
  straightMaxYaw: 0.18, // live check: looking straight
  turnMinYaw: 0.22,     // live check: head turned
  minScore: 0.55,       // detector confidence: lower = face partly hidden or unclear
  minBrightness: 45, maxBrightness: 215,
  minSharpness: 35,
  minWidth: 0.15, maxWidth: 0.85, // face width as a share of the photo width
  maxOffCentre: 0.25,
};

// Every check is written to server/face-debug.log so problems on real cameras can be diagnosed
const LOG = fileURLToPath(new URL('../../face-debug.log', import.meta.url));
const flog = (line) => { if (config.env !== 'test') fs.appendFile(LOG, `${new Date().toISOString()} ${line}\n`, () => {}); };
flog('face rules loaded (v5: duplicate = average < 0.5 or 2 photos < 0.46)');

const frame = z.string().min(500, 'Photo missing').max(4_000_000, 'Photo too large');
const toBuffer = (b64) => Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
const fail = (message, code, status = 400) => new HttpError(status, message, code);

/**
 * Looks at one frame and returns what the person should fix, if anything.
 * { ok, code, hint, yaw, face } — hints are short, friendly instructions shown under the camera.
 */
export async function assessFrame(buf, { accurate = false } = {}) {
  const faces = accurate ? await analyzeFaces(buf) : await quickFaces(buf);
  const img = faces.image;
  if (!faces.length) {
    if (img.brightness < FACE.minBrightness - 10) return { ok: false, code: 'too_dark', hint: "It's too dark. Turn towards a light." };
    if (img.sharpness < 120) return { ok: false, code: 'blurry', hint: 'Hold still, the picture is blurry.' };
    return { ok: false, code: 'no_face', hint: "We can't see your face. Bring it into the circle." };
  }
  if (faces.length > 1) return { ok: false, code: 'multiple', hint: 'Only you in the frame, please.' };
  const f = faces[0];
  const w = f.box.width / img.width;
  const cx = (f.box.x + f.box.width / 2) / img.width - 0.5;
  const cy = (f.box.y + f.box.height / 2) / img.height - 0.5;
  const base = { yaw: f.yaw, face: f };
  if (f.brightness < FACE.minBrightness) return { ...base, ok: false, code: 'too_dark', hint: "It's too dark. Turn towards a light." };
  if (f.brightness > FACE.maxBrightness) return { ...base, ok: false, code: 'too_bright', hint: 'Too bright. Move out of direct light.' };
  if (w < FACE.minWidth) return { ...base, ok: false, code: 'too_far', hint: 'Move a little closer.' };
  if (w > FACE.maxWidth) return { ...base, ok: false, code: 'too_close', hint: 'Move back a little.' };
  if (Math.abs(cx) > FACE.maxOffCentre || Math.abs(cy) > FACE.maxOffCentre + 0.05) return { ...base, ok: false, code: 'off_centre', hint: 'Centre your face in the circle.' };
  if (f.sharpness < FACE.minSharpness) return { ...base, ok: false, code: 'blurry', hint: 'Hold still, the picture is blurry.' };
  if (f.score < FACE.minScore) return { ...base, ok: false, code: 'unclear', hint: 'Face not clear. Remove glasses, mask or anything covering it.' };
  return { ...base, ok: true, code: 'clear', hint: 'Looking good.' };
}

// Live check, called about once a second while the camera is open
r.post('/check',
  rateLimit({ windowMs: 15 * 60_000, limit: config.env === 'test' ? 5000 : config.testing ? 20000 : 900, keyGenerator: clientKey, standardHeaders: true, legacyHeaders: false }),
  ah(async (req, res) => {
    const { frame: f } = z.object({ frame }).parse(req.body);
    const t0 = Date.now();
    const a = await assessFrame(toBuffer(f));
    const fc = a.face;
    flog(`check user=${req.user.id.slice(0, 8)} ${Date.now() - t0}ms ${a.code} yaw=${a.yaw?.toFixed(2) ?? '-'}${fc ? ` score=${fc.score.toFixed(2)} bright=${fc.brightness.toFixed(0)} sharp=${fc.sharpness.toFixed(0)}` : ''}`);
    res.json({ ok: a.ok, code: a.code, hint: a.hint, yaw: a.yaw ?? null });
  }),
);

r.post('/enroll',
  rateLimit({ windowMs: 15 * 60_000, limit: config.env === 'test' ? 1000 : config.testing ? 300 : 20, keyGenerator: clientKey, standardHeaders: true, legacyHeaders: false }),
  ah(async (req, res) => {
    const { frames, useAsAvatar } = z.object({ frames: z.array(frame).length(3), useAsAvatar: z.boolean().optional() }).parse(req.body);
    if (req.user.face_verified) return res.json({ user: meView(req.user), already: true });

    const bufs = frames.map(toBuffer);
    const t0 = Date.now();
    const found = [];
    for (const b of bufs) found.push(await analyzeFaces(b)); // one at a time: keeps memory low
    const names = ['first', 'second', 'third'];
    found.forEach((f, i) => flog(`enroll user=${req.user.id.slice(0, 8)} photo${i + 1} faces=${f.length} ${f.map((x) => `yaw=${x.yaw.toFixed(2)} score=${x.score.toFixed(2)}`).join(' ')}`));
    for (let i = 0; i < 3; i += 1) {
      if (!found[i].length) throw fail(`We couldn't see your face clearly in the ${names[i]} photo. Please try again with more light.`, 'face_not_found');
      if (found[i].length > 1) throw fail('More than one face was in view. Make sure only you are in the frame.', 'face_multiple');
    }
    const [front, sideA, sideB] = found.map((f) => f[0]);
    // Lenient here: the live check already coached light, distance and pose
    if (Math.abs(front.yaw) > 0.3) throw fail('For the first photo, look straight at the camera.', 'face_not_straight');
    if (Math.abs(sideA.yaw) < 0.12 || Math.abs(sideB.yaw) < 0.12 || Math.sign(sideA.yaw) === Math.sign(sideB.yaw)) {
      throw fail('We need to see you turn your head left and right.', 'face_liveness');
    }
    if (faceDistance(front.descriptor, sideA.descriptor) > FACE.samePersonMax || faceDistance(front.descriptor, sideB.descriptor) > FACE.samePersonMax) {
      throw fail('The photos did not look like the same person. Please try again.', 'face_mismatch');
    }
    flog(`enroll user=${req.user.id.slice(0, 8)} passed checks in ${Date.now() - t0}ms`);

    // One face = one account. Two measures against every stored face (stored = average of that person's 3 photos):
    //  1) the average of the 3 new photos vs the stored average: steadiest, noise from one bad frame cancels out
    //  2) how many of the 3 single photos are very close
    // v3 used only "closest single photo < 0.6", which blocked a different person at 0.557 on a laptop webcam.
    const mine = [front.descriptor, sideA.descriptor, sideB.descriptor];
    const avg = front.descriptor.map((v, i) => (v + sideA.descriptor[i] + sideB.descriptor[i]) / 3);
    const others = await many('SELECT user_id, embedding FROM face_embeddings WHERE user_id <> $1 AND embedding IS NOT NULL', [req.user.id]);
    let match = null;
    let nearest = null;
    for (const o of others) {
      const stored = typeof o.embedding === 'string' ? JSON.parse(o.embedding) : o.embedding;
      const avgD = faceDistance(avg, stored);
      const singles = mine.map((m) => faceDistance(m, stored));
      const closeShots = singles.filter((d) => d < FACE.sameShotMax).length;
      const hit = avgD < FACE.sameAccountMax || closeShots >= 2;
      if (!nearest || avgD < nearest.avgD) nearest = { avgD, singles, closeShots, user: o.user_id };
      if (hit && !match) match = o.user_id;
    }
    flog(`enroll user=${req.user.id.slice(0, 8)} compared with ${others.length} stored face(s), nearest ${nearest ? `avg=${nearest.avgD.toFixed(3)} photos=${nearest.singles.map((d) => d.toFixed(3)).join('/')} (${nearest.user.slice(0, 8)})` : 'none'}`);
    if (match) {
      flog(`enroll user=${req.user.id.slice(0, 8)} BLOCKED duplicate face`);
      throw fail('This face is already linked to another Soulink account. One person, one profile.', 'face_taken', 409);
    }

    const avatarUrl = useAsAvatar ? await saveFile({ buffer: bufs[0], mimetype: bufs[0][0] === 0x89 ? 'image/png' : 'image/jpeg' }, 'avatars') : null;
    const embedding = JSON.stringify(avg.map((v) => Math.round(v * 1e6) / 1e6));
    flog(`enroll user=${req.user.id.slice(0, 8)} SAVED face`);
    const user = await tx(async (c) => {
      await c.query('DELETE FROM face_embeddings WHERE user_id=$1', [req.user.id]);
      await c.query('INSERT INTO face_embeddings (user_id, provider, embedding) VALUES ($1, $2, $3)', [req.user.id, 'local', embedding]);
      return (await c.query(
        `UPDATE users SET face_verified = 1, face_consent_at = COALESCE(face_consent_at, SYSDATETIMEOFFSET())${avatarUrl ? ', avatar_url = $2' : ''}, updated_at = SYSDATETIMEOFFSET() OUTPUT INSERTED.* WHERE id=$1`,
        avatarUrl ? [req.user.id, avatarUrl] : [req.user.id],
      )).rows[0];
    });
    res.json({ user: meView(user) });
  }),
);

export default r;
