// Face ID at registration: one real face = one Soulink account. Works the same for phone and laptop cameras.
//  POST /face/check   one camera frame → is it clear enough? which way is the head turned? (live coaching)
//  POST /face/enroll  the 3 good frames (straight, turned one way, turned the other) → verify + save
// We keep only the 128-number face fingerprint. Photos are thrown away (the straight one is kept
// only if the person chooses it as their profile picture).
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { many, tx } from '../db.js';
import { config } from '../config.js';
import { ah, HttpError } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { saveFile } from '../providers/storage.js';
import { analyzeFaces, faceDistance } from '../services/faceEngine.js';
import { meView } from '../services/social.js';

const r = Router();
r.use(requireAuth);

export const FACE = {
  sameAccountMax: 0.45, // closer than this to someone else's face = same person → blocked
  samePersonMax: 0.6,   // the 3 photos must be at least this close to each other
  straightMaxYaw: 0.15,
  turnMinYaw: 0.25,
  minScore: 0.8,        // detector confidence: lower = face partly hidden or unclear
  minBrightness: 55, maxBrightness: 205,
  minSharpness: 60,
  minWidth: 0.22, maxWidth: 0.8, // face width as a share of the photo width
  maxOffCentre: 0.22,
};

const frame = z.string().min(500, 'Photo missing').max(4_000_000, 'Photo too large');
const toBuffer = (b64) => Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
const fail = (message, code, status = 400) => new HttpError(status, message, code);

/**
 * Looks at one frame and returns what the person should fix, if anything.
 * { ok, code, hint, yaw, face } — hints are short, friendly instructions shown under the camera.
 */
export async function assessFrame(buf) {
  const faces = await analyzeFaces(buf);
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
  rateLimit({ windowMs: 15 * 60_000, limit: config.env === 'test' ? 5000 : 900, standardHeaders: true, legacyHeaders: false }),
  ah(async (req, res) => {
    const { frame: f } = z.object({ frame }).parse(req.body);
    const a = await assessFrame(toBuffer(f));
    res.json({ ok: a.ok, code: a.code, hint: a.hint, yaw: a.yaw ?? null });
  }),
);

r.post('/enroll',
  rateLimit({ windowMs: 15 * 60_000, limit: config.env === 'test' ? 1000 : 20, standardHeaders: true, legacyHeaders: false }),
  ah(async (req, res) => {
    const { frames, useAsAvatar } = z.object({ frames: z.array(frame).length(3), useAsAvatar: z.boolean().optional() }).parse(req.body);
    if (req.user.face_verified) return res.json({ user: meView(req.user), already: true });

    const bufs = frames.map(toBuffer);
    const checks = [];
    for (const b of bufs) checks.push(await assessFrame(b)); // one at a time: keeps memory low
    const bad = checks.find((c) => !c.ok);
    if (bad) throw fail(bad.hint, `face_${bad.code}`);
    const [front, sideA, sideB] = checks.map((c) => c.face);

    if (Math.abs(front.yaw) > FACE.straightMaxYaw + 0.07) throw fail('For the first photo, look straight at the camera.', 'face_not_straight');
    const turnedEnough = Math.abs(sideA.yaw) >= FACE.turnMinYaw - 0.05 && Math.abs(sideB.yaw) >= FACE.turnMinYaw - 0.05;
    if (!turnedEnough || Math.sign(sideA.yaw) === Math.sign(sideB.yaw)) {
      throw fail('We need to see you turn your head left and right.', 'face_liveness');
    }
    if (faceDistance(front.descriptor, sideA.descriptor) > FACE.samePersonMax || faceDistance(front.descriptor, sideB.descriptor) > FACE.samePersonMax) {
      throw fail('The photos did not look like the same person. Please try again.', 'face_mismatch');
    }

    // One face = one account
    const others = await many('SELECT user_id, embedding FROM face_embeddings WHERE user_id <> $1 AND embedding IS NOT NULL', [req.user.id]);
    if (others.some((o) => faceDistance(front.descriptor, JSON.parse(o.embedding)) < FACE.sameAccountMax)) {
      throw fail('This face is already linked to another Soulink account. One person, one profile.', 'face_taken', 409);
    }

    const avatarUrl = useAsAvatar ? await saveFile({ buffer: bufs[0], mimetype: bufs[0][0] === 0x89 ? 'image/png' : 'image/jpeg' }, 'avatars') : null;
    const embedding = JSON.stringify(front.descriptor.map((v) => Math.round(v * 1e6) / 1e6));
    const user = await tx(async (c) => {
      await c.query('DELETE FROM face_embeddings WHERE user_id=$1', [req.user.id]);
      await c.query('INSERT INTO face_embeddings (user_id, provider, embedding) VALUES ($1, $2, $3)', [req.user.id, 'local', embedding]);
      return (await c.query(
        `UPDATE users SET face_verified = 1${avatarUrl ? ', avatar_url = $2' : ''}, updated_at = SYSDATETIMEOFFSET() OUTPUT INSERTED.* WHERE id=$1`,
        avatarUrl ? [req.user.id, avatarUrl] : [req.user.id],
      )).rows[0];
    });
    res.json({ user: meView(user) });
  }),
);

export default r;
