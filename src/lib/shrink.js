// Big phone photos (12 MP and up) use hundreds of MB once decoded, more than a free cloud server has.
// Everything face-related works on a copy at most ~1280 px on the long side (plenty for faces and Soulmojis).
export const MAX_SIDE = 1280;

/** Box-average downscale of decoded RGBA pixels so the long side is at most maxSide. Returns the same object if already small. */
export function downscale(img, maxSide = MAX_SIDE) {
  const { width: w, height: h, data } = img;
  const k = Math.max(w, h) / maxSide;
  if (k <= 1) return img;
  const W = Math.max(1, Math.round(w / k)); const H = Math.max(1, Math.round(h / k));
  const out = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y += 1) {
    const y0 = Math.floor(y * k); const y1 = Math.min(h, Math.max(y0 + 1, Math.floor((y + 1) * k)));
    for (let x = 0; x < W; x += 1) {
      const x0 = Math.floor(x * k); const x1 = Math.min(w, Math.max(x0 + 1, Math.floor((x + 1) * k)));
      let r = 0; let g = 0; let b = 0; let n = 0;
      for (let yy = y0; yy < y1; yy += 1) {
        let i = (yy * w + x0) * 4;
        for (let xx = x0; xx < x1; xx += 1, i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n += 1; }
      }
      const o = (y * W + x) * 4;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
    }
  }
  return { width: W, height: H, data: out };
}
