// Prepares a Soulmoji selfie: finds the one face, crops a square around it (face centred, some hair and
// chin room), resizes to 512×512 and finds the 68 landmarks on the crop.
import { analyzeFaces } from './faceEngine.js';
import { cropSquare, decode, encodeJpeg, SIZE } from './soulmojiRender.js';

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
  return { crop, jpeg: Buffer.from(encodeJpeg(crop, 95)), landmarks, descriptor: f.descriptor, yaw: f.yaw, score: f.score };
}
