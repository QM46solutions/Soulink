// Scheduled posts: a tiny blurred copy of the photo is all anyone else gets until the reveal time.
// 24 px on the long side, so nothing recognisable can be recovered from it (the app blurs it further).
import { downscale } from '../lib/shrink.js';
import { decode, encodeJpeg } from './soulmojiRender.js';

export function makeTeaser(buf) {
  try {
    const small = downscale(decode(buf), 24);
    return Buffer.from(encodeJpeg(small, 70));
  } catch { return null; } // not a JPG/PNG we can read (e.g. HEIC): the app shows a soft gradient instead
}
