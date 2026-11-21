// Prepares a Soulmoji selfie: finds the one face, crops a square around it (face centred, some hair and
// chin room), resizes to 512×512 and finds the 68 landmarks on the crop.
// For the Soulmoji AI it also makes a bigger square around the same face (more room around it, 1024 px), and
// notes where the Soulmoji face square sits inside it, so the AI's result can be framed exactly the same way.
import { analyzeFaces } from './faceEngine.js';
import { cropSquare, decode, encodeJpeg, SIZE } from './soulmojiRender.js';

const AI_SIZE = 1024;

/** The AI's result (a photo the size of the AI source) → framed like the Soulmoji face, as a JPEG. */
export function frameAiResult(buf, rect) {
  const img = decode(buf);
  const k = img.width / AI_SIZE; // the AI keeps the size it was given; just in case it didn't
  return Buffer.from(encodeJpeg(cropSquare(img, rect.x * k, rect.y * k, rect.s * k, rect.out), 95));
}

export async function prepareFace(buf) {
  const faces = await analyzeFaces(buf);
  if (!faces.length) return { error: 'no_face' };
  if (faces.length > 1) return { error: 'multiple' };
  const f = faces[0];
  const img = decode(buf);
  const side = Math.min(img.width, img.height, f.box.width * 1.75);
  const cx = f.box.x + f.box.width / 2;
  const cy = f.box.y + f.box.height * 0.45;
  const x0 = Math.max(0, Math.min(img.width - side, cx - side / 2));
  const y0 = Math.max(0, Math.min(img.height - side, cy - side / 2));
  const out = Math.round(Math.min(SIZE, side)); // never upscale: keeps the photo's real sharpness
  const crop = cropSquare(img, x0, y0, side, out);
  const k = out / side;
  const landmarks = f.landmarks.map(([x, y]) => [Math.round((x - x0) * k * 10) / 10, Math.round((y - y0) * k * 10) / 10]);
  // the AI's photo: 2.8× the face, centred the same way, 1024 px (small faces in a big photo get enough pixels)
  const sideA = Math.max(side, Math.min(img.width, img.height, f.box.width * 2.8));
  const xa = Math.max(0, Math.min(img.width - sideA, cx - sideA / 2));
  const ya = Math.max(0, Math.min(img.height - sideA, cy - sideA / 2));
  const kA = AI_SIZE / sideA;
  const ai = cropSquare(img, xa, ya, sideA, AI_SIZE);
  const aiRect = { x: Math.round((x0 - xa) * kA * 10) / 10, y: Math.round((y0 - ya) * kA * 10) / 10, s: Math.round(side * kA * 10) / 10, out };
  return { crop, jpeg: Buffer.from(encodeJpeg(crop, 95)), landmarks, descriptor: f.descriptor, yaw: f.yaw, score: f.score, aiJpeg: Buffer.from(encodeJpeg(ai, 95)), aiRect };
}
