// Soulmoji v2: your own face, your expression.
//  GET  /soulmoji/face           → { faceUrl } (null until you take your Soulmoji selfie)
//  POST /soulmoji/face           multipart photo → checks it is one clear face AND the same person as your
//                                 verified Face ID, crops it and saves it as your Soulmoji face
//  POST /soulmoji/render {mood}  → { imageUrl, ai, pending }: the same photo with the expression changed (cached per
//                                 mood). With the cloud AI on, the built-in version comes back at once with pending:true
//                                 while the AI makes its version; asking again returns the AI one once it's ready.
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
import { frameAiResult, prepareFace } from '../services/soulmojiFace.js';
import { decode, encodeJpeg, renderMood, RENDER_MOODS, shrinkPhoto } from '../services/soulmojiRender.js';
import { aiEdit, aiInstalled, warmSoulmojiAi } from '../services/soulmojiAi.js';
import crypto from 'node:crypto';

// Soulmoji uses the built-in engine everywhere unless SOULMOJI_ENGINE=ai: laptop and cloud give the same result
const aiOn = () => config.soulmojiEngine === 'ai' && aiInstalled();
if (config.soulmojiEngine === 'ai') warmSoulmojiAi();

const r = Router();
r.use(requireAuth);

const SAME_PERSON = 0.6;
const ENGINE = 3; // bump when the expression engine changes so old renders are made again
const AI_TAG = 'ai4'; // the same for the AI versions (ai4: framed like the Soulmoji face, sharper on small faces)
const list = (v) => (Array.isArray(v) ? v : (() => { try { return JSON.parse(v || 'null'); } catch { return null; } })());

r.get('/face', ah(async (req, res) => {
  // opening Soulmoji: if some AI expressions of this selfie are still missing, make them now in the background
  // (this also wakes the cloud AI). Once all are made, opening Soulmoji doesn't wake it: it costs nothing.
  if (aiOn() && req.user.soulmoji_face_url && req.user.soulmoji_src_url) {
    const made = await one("SELECT COUNT(*) AS n FROM soulmoji_renders WHERE user_id=$1 AND face_url=$2 AND mood LIKE '%@' + $3", [req.user.id, req.user.soulmoji_face_url, AI_TAG]);
    if (Number(made?.n || 0) < RENDER_MOODS.length) renderAllInBackground(req.user);
  }
  res.json({ faceUrl: req.user.soulmoji_face_url || null, moods: RENDER_MOODS, ai: aiOn(), engine: aiOn() ? 'ai' : 'builtin' });
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
  // for the AI: a bigger square around the same face (the AI needs some surroundings), and where the face square is in it
  const srcUrl = await saveFile({ buffer: f.aiJpeg, mimetype: 'image/jpeg' }, 'soulmoji');
  const crop = JSON.stringify(f.aiRect);
  await query('UPDATE users SET soulmoji_face_url=$2, soulmoji_points=$3, soulmoji_src_url=$4, soulmoji_crop=$5 WHERE id=$1', [req.user.id, url, f.landmarks, srcUrl, crop]);
  res.json({ faceUrl: url });
  renderAllInBackground({ id: req.user.id, soulmoji_face_url: url, soulmoji_src_url: srcUrl, soulmoji_crop: crop });
}));

r.post('/render', rateLimit({ windowMs: 60_000, limit: config.env === 'test' ? 1000 : 60 }), ah(async (req, res) => {
  const { mood } = z.object({ mood: z.enum(RENDER_MOODS) }).parse(req.body);
  const faceUrl = req.user.soulmoji_face_url;
  const points = list(req.user.soulmoji_points);
  if (!faceUrl || !points) throw badRequest('Take your Soulmoji selfie first', 'no_soulmoji_face');
  const useAi = aiOn() && req.user.soulmoji_src_url;
  const find = (tag) => one('SELECT TOP 1 url FROM soulmoji_renders WHERE user_id=$1 AND face_url=$2 AND mood=$3 ORDER BY created_at DESC', [req.user.id, faceUrl, `${mood}@${tag}`]);
  let pending = false;
  if (useAi) {
    const done = await find(AI_TAG);
    if (done) return res.json({ imageUrl: done.url, mood, ai: true });
    // the AI version is made in the background (it can take a minute when the cloud AI is waking up);
    // meanwhile the built-in one is shown at once and the app asks again until the AI one is ready
    const key = `${req.user.id}|${faceUrl}|${mood}`;
    if (aiFailed.get(key) > Date.now()) pending = false;
    else {
      pending = true;
      renderWithAi(req.user, mood).catch((e) => { aiFailed.set(key, Date.now() + 10 * 60_000); console.warn('Soulmoji AI failed, the built-in one stays:', e.message); });
    }
  }
  const cached = await find(ENGINE);
  if (cached) return res.json({ imageUrl: cached.url, mood, ai: false, pending });
  const img = decode(await fs.readFile(await ensureLocal(faceUrl)));
  const out = renderMood(img, points, mood);
  const url = await saveFile({ buffer: Buffer.from(encodeJpeg(out, 95)), mimetype: 'image/jpeg' }, 'soulmoji');
  await query('INSERT INTO soulmoji_renders (user_id, face_url, mood, url) VALUES ($1, $2, $3, $4)', [req.user.id, faceUrl, `${mood}@${ENGINE}`, url]);
  res.json({ imageUrl: url, mood, ai: false, pending });
}));

/** The photo the AI works on + where the Soulmoji face sits in it. Selfies taken before this kept the whole photo:
 *  the face square is made from it once (same face, same framing) and saved. */
const sourcing = new Map();
async function aiSourceOf(user) {
  const fresh = await one('SELECT soulmoji_src_url, soulmoji_crop, soulmoji_face_url FROM users WHERE id=$1', [user.id]);
  const rect = list(fresh?.soulmoji_crop);
  if (rect && fresh.soulmoji_face_url === user.soulmoji_face_url) return { url: fresh.soulmoji_src_url, rect };
  if (sourcing.has(user.id)) return sourcing.get(user.id);
  const job = (async () => {
    const f = await prepareFace(shrinkPhoto(await fs.readFile(await ensureLocal(fresh.soulmoji_src_url))));
    if (f.error) throw new Error(`Soulmoji photo: ${f.error}`);
    const url = await saveFile({ buffer: f.aiJpeg, mimetype: 'image/jpeg' }, 'soulmoji');
    await query('UPDATE users SET soulmoji_src_url=$2, soulmoji_crop=$3 WHERE id=$1 AND soulmoji_face_url=$4', [user.id, url, JSON.stringify(f.aiRect), user.soulmoji_face_url]);
    return { url, rect: f.aiRect };
  })().finally(() => sourcing.delete(user.id));
  sourcing.set(user.id, job);
  return job;
}

/** One expression made by the Soulmoji AI (laptop or online), saved and remembered for this selfie. */
const aiFailed = new Map(); // "user|face|mood" -> time to try the AI again after it failed (no face found, AI down)
const inFlight = new Map(); // "user|face|mood" -> promise, so a background render and a tap don't do the work twice
async function renderWithAi(user, mood) {
  const key = `${user.id}|${user.soulmoji_face_url}|${mood}`;
  if (inFlight.has(key)) return inFlight.get(key);
  const job = (async () => {
    const done = await one('SELECT TOP 1 url FROM soulmoji_renders WHERE user_id=$1 AND face_url=$2 AND mood=$3 ORDER BY created_at DESC', [user.id, user.soulmoji_face_url, `${mood}@${AI_TAG}`]);
    if (done) return done.url;
    const src = await aiSourceOf(user);
    const name = `${crypto.randomUUID()}.jpg`;
    const tmp = path.join(config.uploadDir, 'soulmoji', name);
    await fs.mkdir(path.dirname(tmp), { recursive: true });
    await aiEdit(await ensureLocal(src.url), tmp, mood);
    // framed exactly like the Soulmoji face (same square, same size), whatever photo it came from
    const framed = frameAiResult(await fs.readFile(tmp), src.rect);
    // saveFile keeps it in the database too on the cloud host (the disk there is wiped on restart)
    const url = await saveFile({ buffer: framed, mimetype: 'image/jpeg' }, 'soulmoji');
    await fs.rm(tmp, { force: true });
    await query('INSERT INTO soulmoji_renders (user_id, face_url, mood, url) VALUES ($1, $2, $3, $4)', [user.id, user.soulmoji_face_url, `${mood}@${AI_TAG}`, url]);
    return url;
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

/** After a new selfie: make every expression in the background, so they're ready when you open Soulmoji. */
const allRunning = new Set(); // "user|face" while its 12 moods are being made
function renderAllInBackground(user) {
  if (!aiOn() || !user.soulmoji_src_url) return;
  const key = `${user.id}|${user.soulmoji_face_url}`;
  if (allRunning.has(key)) return;
  allRunning.add(key);
  (async () => {
    for (const mood of RENDER_MOODS) {
      try { await renderWithAi(user, mood); } catch (e) { console.warn('Soulmoji AI (background):', e.message); return; }
    }
  })().finally(() => allRunning.delete(key));
}

/** Used by chat: is this rendered Soulmoji image really this user's? */
export async function ownsSoulmoji(userId, url) {
  const rows = await many('SELECT TOP 1 id FROM soulmoji_renders WHERE user_id=$1 AND url=$2', [userId, url]);
  return rows.length > 0;
}

export default r;
