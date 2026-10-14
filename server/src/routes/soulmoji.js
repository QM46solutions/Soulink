// Soulmoji v2: your own face, your expression.
//  GET  /soulmoji/face           → { faceUrl } (null until you take your Soulmoji selfie)
//  POST /soulmoji/face           multipart photo → checks it is one clear face AND the same person as your
//                                 verified Face ID, crops it and saves it as your Soulmoji face
//  POST /soulmoji/render {mood}  → { imageUrl }: the same photo with the expression changed (cached per mood)
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { many, one, query } from '../db.js';
import { config } from '../config.js';
import { ah, badRequest } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadMemory, saveFile, ensureLocal } from '../providers/storage.js';
import { faceDistance } from '../services/faceEngine.js';
import { openFace } from '../lib/faceCrypto.js';
import { prepareFace } from '../services/soulmojiFace.js';
import { decode, encodeJpeg, renderMood, RENDER_MOODS, shrinkPhoto } from '../services/soulmojiRender.js';
import { aiEdit, aiInstalled, wakeRemoteAi, warmSoulmojiAi } from '../services/soulmojiAi.js';
import crypto from 'node:crypto';

warmSoulmojiAi();

const r = Router();
r.use(requireAuth);

const SAME_PERSON = 0.6;
const ENGINE = 2; // bump when the expression engine changes so old renders are made again
const list = (v) => (Array.isArray(v) ? v : (() => { try { return JSON.parse(v || 'null'); } catch { return null; } })());

r.get('/face', ah(async (req, res) => {
  wakeRemoteAi(); // opening Soulmoji wakes the online AI so the first expression is quick
  res.json({ faceUrl: req.user.soulmoji_face_url || null, moods: RENDER_MOODS, ai: aiInstalled() });
}));

r.post('/face', rateLimit({ windowMs: 15 * 60_000, limit: config.env === 'test' ? 1000 : 30 }), uploadMemory('image', 12).single('photo'), ah(async (req, res) => {
  if (!req.file) throw badRequest('Take a selfie first', 'no_photo');
  // phone photos can be 12 MP+: work on a 1280 px copy so a small cloud server doesn't run out of memory
  const photo = shrinkPhoto(req.file.buffer);
  const f = await prepareFace(photo);
  if (f.error === 'no_face') throw badRequest("We couldn't see your face. Face the camera in good light and try again.", 'no_face');
  if (f.error === 'multiple') throw badRequest('Only you in the photo, please.', 'multiple_faces');
  if (Math.abs(f.yaw) > 0.3) throw badRequest('Look straight at the camera for your Soulmoji selfie.', 'not_straight');
  // Only your own face: compare with your verified Face ID
  const mine = await one('SELECT embedding FROM face_embeddings WHERE user_id=$1', [req.user.id]);
  const stored = openFace(mine?.embedding);
  if (stored && faceDistance(f.descriptor, stored) > SAME_PERSON) {
    throw badRequest("This doesn't look like the face you verified. Soulmojis can only be made from your own face.", 'not_you');
  }
  const url = await saveFile({ buffer: f.jpeg, mimetype: 'image/jpeg' }, 'soulmoji');
  // the whole selfie is kept too: the AI needs the face with some surroundings
  const srcUrl = await saveFile({ buffer: photo, mimetype: photo === req.file.buffer && req.file.mimetype === 'image/png' ? 'image/png' : 'image/jpeg' }, 'soulmoji');
  await query('UPDATE users SET soulmoji_face_url=$2, soulmoji_points=$3, soulmoji_src_url=$4 WHERE id=$1', [req.user.id, url, f.landmarks, srcUrl]);
  res.json({ faceUrl: url });
  renderAllInBackground({ id: req.user.id, soulmoji_face_url: url, soulmoji_src_url: srcUrl });
}));

r.post('/render', rateLimit({ windowMs: 60_000, limit: config.env === 'test' ? 1000 : 60 }), ah(async (req, res) => {
  const { mood } = z.object({ mood: z.enum(RENDER_MOODS) }).parse(req.body);
  const faceUrl = req.user.soulmoji_face_url;
  const points = list(req.user.soulmoji_points);
  if (!faceUrl || !points) throw badRequest('Take your Soulmoji selfie first', 'no_soulmoji_face');
  const useAi = aiInstalled() && req.user.soulmoji_src_url;
  const engine = useAi ? 'ai3' : ENGINE;
  const cached = await one('SELECT TOP 1 url FROM soulmoji_renders WHERE user_id=$1 AND face_url=$2 AND mood=$3 ORDER BY created_at DESC', [req.user.id, faceUrl, `${mood}@${engine}`]);
  if (cached) return res.json({ imageUrl: cached.url, mood, ai: useAi });
  if (useAi) {
    try {
      const aiUrl = await renderWithAi(req.user, mood);
      return res.json({ imageUrl: aiUrl, mood, ai: true });
    } catch (e) {
      console.warn('Soulmoji AI failed, using the built-in engine:', e.message);
    }
  }
  const img = decode(await fs.readFile(await ensureLocal(faceUrl)));
  const out = renderMood(img, points, mood);
  const url = await saveFile({ buffer: Buffer.from(encodeJpeg(out, 95)), mimetype: 'image/jpeg' }, 'soulmoji');
  await query('INSERT INTO soulmoji_renders (user_id, face_url, mood, url) VALUES ($1, $2, $3, $4)', [req.user.id, faceUrl, `${mood}@${ENGINE}`, url]);
  res.json({ imageUrl: url, mood });
}));

/** One expression made by the Soulmoji AI (laptop or online), saved and remembered for this selfie. */
const inFlight = new Map(); // "user|face|mood" -> promise, so a background render and a tap don't do the work twice
async function renderWithAi(user, mood) {
  const key = `${user.id}|${user.soulmoji_face_url}|${mood}`;
  if (inFlight.has(key)) return inFlight.get(key);
  const job = (async () => {
    const done = await one('SELECT TOP 1 url FROM soulmoji_renders WHERE user_id=$1 AND face_url=$2 AND mood=$3 ORDER BY created_at DESC', [user.id, user.soulmoji_face_url, `${mood}@ai3`]);
    if (done) return done.url;
    const name = `${crypto.randomUUID()}.jpg`;
    const tmp = path.join(config.uploadDir, 'soulmoji', name);
    await fs.mkdir(path.dirname(tmp), { recursive: true });
    await aiEdit(await ensureLocal(user.soulmoji_src_url), tmp, mood);
    // saveFile keeps it in the database too on the cloud host (the disk there is wiped on restart)
    const url = await saveFile({ buffer: await fs.readFile(tmp), mimetype: 'image/jpeg' }, 'soulmoji');
    await fs.rm(tmp, { force: true });
    await query('INSERT INTO soulmoji_renders (user_id, face_url, mood, url) VALUES ($1, $2, $3, $4)', [user.id, user.soulmoji_face_url, `${mood}@ai3`, url]);
    return url;
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

/** After a new selfie: make every expression in the background, so they're ready when you open Soulmoji. */
function renderAllInBackground(user) {
  if (!aiInstalled() || !user.soulmoji_src_url) return;
  (async () => {
    for (const mood of RENDER_MOODS) {
      try { await renderWithAi(user, mood); } catch (e) { console.warn('Soulmoji AI (background):', e.message); return; }
    }
  })();
}

/** Used by chat: is this rendered Soulmoji image really this user's? */
export async function ownsSoulmoji(userId, url) {
  const rows = await many('SELECT TOP 1 id FROM soulmoji_renders WHERE user_id=$1 AND url=$2', [userId, url]);
  return rows.length > 0;
}

export default r;
