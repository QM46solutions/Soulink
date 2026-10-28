import { badRequest } from '../lib/errors.js';
import { downscale, MAX_SIDE } from '../lib/shrink.js';
// Soulmoji expression engine (free, runs anywhere Node runs: laptop and cloud give the same result).
// Takes the person's own Soulmoji selfie (face centred) plus its 68 face landmarks, then:
//   1. moves the landmarks for the chosen mood (smile, frown, raised brows, open mouth) and tilts the head,
//   2. warps the photo to follow them with one smooth thin-plate spline (no creases),
//   3. works the eyes on their own: upper lid comes down (half-closed, squint, wink, shut), the cheek pushes
//      the lower lid up when smiling, and the iris can look up/down/sideways,
//   4. adds what a warp can't make: a dark open mouth for "shocked" and blue tears for laugh / cry.
// The result is the SAME photo of the same person with a different expression, no stickers.
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

export const SIZE = 1024; // Soulmoji selfie size (kept at the photo's own resolution when smaller)

export function decode(buf) {
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  let img;
  // jpeg-js needs ~18 MB per megapixel: refuse giant photos instead of running the server out of memory
  try { img = isPng ? PNG.sync.read(buf) : jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 140, maxResolutionInMP: 8 }); }
  catch (e) {
    if (/maxMemoryUsage|maxResolution/.test(e.message)) throw badRequest('This photo is too big. Please choose a smaller one or take a new selfie.', 'photo_too_big');
    throw badRequest("We couldn't read this photo. Please use a JPG or PNG.", 'bad_photo');
  }
  return { width: img.width, height: img.height, data: img.data };
}
export const encodeJpeg = (img, quality = 95) => jpeg.encode({ width: img.width, height: img.height, data: img.data }, quality).data;

/** A big photo becomes a JPEG at most 1280 px on the long side (small photos come back unchanged). */
export function shrinkPhoto(buf, maxSide = MAX_SIDE) {
  const img = decode(buf);
  if (Math.max(img.width, img.height) <= maxSide) return buf;
  return Buffer.from(encodeJpeg(downscale(img, maxSide), 92));
}

function sample(img, x, y, out, o) {
  const { width: w, height: h, data } = img;
  x = Math.min(w - 1.001, Math.max(0, x)); y = Math.min(h - 1.001, Math.max(0, y));
  const x0 = x | 0; const y0 = y | 0; const fx = x - x0; const fy = y - y0;
  const i00 = (y0 * w + x0) * 4; const i10 = i00 + 4; const i01 = i00 + w * 4; const i11 = i01 + 4;
  for (let c = 0; c < 3; c += 1) {
    out[o + c] = (data[i00 + c] * (1 - fx) + data[i10 + c] * fx) * (1 - fy) + (data[i01 + c] * (1 - fx) + data[i11 + c] * fx) * fy;
  }
  out[o + 3] = 255;
}

// Catmull-Rom bicubic sample: keeps skin texture, hair and eyes sharp when pixels move
function cubic(p0, p1, p2, p3, t) {
  return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
}
const cw = (t) => [((-0.5 * t + 1) * t - 0.5) * t, (1.5 * t - 2.5) * t * t + 1, ((-1.5 * t + 2) * t + 0.5) * t, (0.5 * t - 0.5) * t * t];
function sampleCubic(img, x, y, out, o) {
  const { width: w, height: h, data } = img;
  const xi = Math.floor(x); const yi = Math.floor(y);
  const wx = cw(x - xi); const wy = cw(y - yi);
  let r = 0; let g = 0; let b = 0;
  for (let m = 0; m < 4; m += 1) {
    const yy = Math.min(h - 1, Math.max(0, yi + m - 1)) * w;
    let rr = 0; let gg = 0; let bb = 0;
    for (let n = 0; n < 4; n += 1) {
      const i = (yy + Math.min(w - 1, Math.max(0, xi + n - 1))) * 4; const k = wx[n];
      rr += data[i] * k; gg += data[i + 1] * k; bb += data[i + 2] * k;
    }
    r += rr * wy[m]; g += gg * wy[m]; b += bb * wy[m];
  }
  out[o] = Math.min(255, Math.max(0, r)); out[o + 1] = Math.min(255, Math.max(0, g)); out[o + 2] = Math.min(255, Math.max(0, b)); out[o + 3] = 255;
}

/** Crop a square (x0, y0, side) from an image and resize it to size×size. */
export function cropSquare(img, x0, y0, side, size = SIZE) {
  const out = new Uint8Array(size * size * 4);
  const k = side / size;
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) sample(img, x0 + (x + 0.5) * k, y0 + (y + 0.5) * k, out, (y * size + x) * 4);
  return { width: size, height: size, data: out };
}
// ---------- painting helpers (alpha blending onto the RGBA image) ----------
function blend(img, x, y, rgb, a) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height || a <= 0) return;
  const i = (y * img.width + x) * 4; const d = img.data;
  d[i] = d[i] * (1 - a) + rgb[0] * a; d[i + 1] = d[i + 1] * (1 - a) + rgb[1] * a; d[i + 2] = d[i + 2] * (1 - a) + rgb[2] * a;
}
const inPoly = (poly, x, y) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i]; const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
/** Fill a polygon with 4× anti-aliasing. colorAt(x, y) may vary the colour (e.g. teeth band). */
function fillPoly(img, poly, colorAt, alpha = 1) {
  const xs = poly.map((p) => p[0]); const ys = poly.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y += 1) {
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x += 1) {
      let cov = 0;
      for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) if (inPoly(poly, x + ox, y + oy)) cov += 0.25;
      if (cov) blend(img, x, y, colorAt(x, y), cov * alpha);
    }
  }
}
/** Soft glow / blush: radial falloff ellipse. */
function softEllipse(img, cx, cy, rx, ry, rgb, alpha) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d < 1) blend(img, x, y, rgb, alpha * (1 - d) ** 1.5);
    }
  }
}

// ---------- smooth warp (thin-plate spline) ----------
// Fits a smooth map from where each control point should end up (dst) back to where it was (src), so every
// output pixel knows which photo pixel to show. Smooth everywhere: no creases between mesh triangles.
function solve(A, b) { // Gaussian elimination with partial pivoting (A: n×n, b: n×m), returns n×m
  const n = A.length; const m = b[0].length;
  const M = A.map((row, i) => [...row, ...b[i]]);
  for (let c = 0; c < n; c += 1) {
    let p = c; for (let r = c + 1; r < n; r += 1) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const piv = M[c][c] || 1e-12;
    for (let r = c + 1; r < n; r += 1) {
      const f = M[r][c] / piv; if (!f) continue;
      for (let k = c; k < n + m; k += 1) M[r][k] -= f * M[c][k];
    }
  }
  const x = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let r = n - 1; r >= 0; r -= 1) for (let j = 0; j < m; j += 1) {
    let s = M[r][n + j]; for (let k = r + 1; k < n; k += 1) s -= M[r][k] * x[k][j];
    x[r][j] = s / (M[r][r] || 1e-12);
  }
  return x;
}
const tpsU = (r2) => (r2 < 1e-12 ? 0 : r2 * Math.log(r2) * 0.5);
function fitTps(dst, src, unit) {
  const n = dst.length; const P = dst.map(([x, y]) => [x / unit, y / unit]);
  const A = Array.from({ length: n + 3 }, () => new Array(n + 3).fill(0));
  const b = Array.from({ length: n + 3 }, () => [0, 0]);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) A[i][j] = tpsU((P[i][0] - P[j][0]) ** 2 + (P[i][1] - P[j][1]) ** 2) + (i === j ? 1e-6 : 0);
    A[i][n] = 1; A[i][n + 1] = P[i][0]; A[i][n + 2] = P[i][1];
    A[n][i] = 1; A[n + 1][i] = P[i][0]; A[n + 2][i] = P[i][1];
    b[i] = [(src[i][0] - dst[i][0]) / unit, (src[i][1] - dst[i][1]) / unit]; // fit the displacement
  }
  const w = solve(A, b);
  return (x, y) => {
    const px = x / unit; const py = y / unit;
    let dx = w[n][0] + w[n + 1][0] * px + w[n + 2][0] * py; let dy = w[n][1] + w[n + 1][1] * px + w[n + 2][1] * py;
    for (let i = 0; i < n; i += 1) { const k = tpsU((px - P[i][0]) ** 2 + (py - P[i][1]) ** 2); dx += w[i][0] * k; dy += w[i][1] * k; }
    return [dx * unit, dy * unit];
  };
}
/** Warp img so that points src[i] move to dst[i], only inside box [x0,y0,x1,y1] (the rest stays exactly as is). */
function warp(img, src, dst, unit, box) {
  const { width: w, height: h } = img;
  const out = { width: w, height: h, data: new Uint8Array(img.data) };
  if (src.every((p, i) => Math.abs(p[0] - dst[i][0]) < 0.01 && Math.abs(p[1] - dst[i][1]) < 0.01)) return out;
  const f = fitTps(dst, src, unit);
  const x0 = Math.max(0, Math.floor(box[0])); const y0 = Math.max(0, Math.floor(box[1]));
  const x1 = Math.min(w - 1, Math.ceil(box[2])); const y1 = Math.min(h - 1, Math.ceil(box[3]));
  const G = 4; const gw = Math.ceil((x1 - x0) / G) + 2; const gh = Math.ceil((y1 - y0) / G) + 2;
  const fx = new Float32Array(gw * gh); const fy = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j += 1) for (let i = 0; i < gw; i += 1) { const [a, b] = f(x0 + i * G, y0 + j * G); fx[j * gw + i] = a; fy[j * gw + i] = b; }
  for (let y = y0; y <= y1; y += 1) {
    const gy = (y - y0) / G; const j = Math.min(gh - 2, gy | 0); const ty = gy - j;
    for (let x = x0; x <= x1; x += 1) {
      const gx = (x - x0) / G; const i = Math.min(gw - 2, gx | 0); const tx = gx - i;
      const k = j * gw + i;
      const dx = (fx[k] * (1 - tx) + fx[k + 1] * tx) * (1 - ty) + (fx[k + gw] * (1 - tx) + fx[k + gw + 1] * tx) * ty;
      const dy = (fy[k] * (1 - tx) + fy[k + 1] * tx) * (1 - ty) + (fy[k + gw] * (1 - tx) + fy[k + gw + 1] * tx) * ty;
      if (Math.abs(dx) < 0.02 && Math.abs(dy) < 0.02) continue;
      sampleCubic(img, x + dx, y + dy, out.data, (y * w + x) * 4);
    }
  }
  return out;
}

// ---------- eyes: lids, gaze ----------
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
/** Smooth curve through points (Catmull-Rom), returned as a lookup y(s) over the eye's width. */
function curveLut(pts) {
  const P = [pts[0], ...pts, pts[pts.length - 1]]; const dense = [];
  for (let i = 1; i < P.length - 2; i += 1) for (let k = 0; k <= 10; k += 1) {
    const t = k / 10; const t2 = t * t; const t3 = t2 * t;
    dense.push([0, 1].map((c) => 0.5 * (2 * P[i][c] + (-P[i - 1][c] + P[i + 1][c]) * t + (2 * P[i - 1][c] - 5 * P[i][c] + 4 * P[i + 1][c] - P[i + 2][c]) * t2 + (-P[i - 1][c] + 3 * P[i][c] - 3 * P[i + 1][c] + P[i + 2][c]) * t3)));
  }
  return (s) => {
    if (s <= dense[0][0]) return dense[0][1];
    for (let i = 1; i < dense.length; i += 1) if (s <= dense[i][0]) { const [a, ay] = dense[i - 1]; const [b, by] = dense[i]; return lerp(ay, by, (s - a) / (b - a || 1)); }
    return dense[dense.length - 1][1];
  };
}
/**
 * One eye in its own frame: s along the eyes, t down the face (pixels), origin at the eye centre.
 * close: 0 open … 1 shut (upper lid comes down, lash line drawn); raise: lower lid pushed up by the cheek (smiles);
 * gaze: [along, down] as a share of the eye's width.
 */
function eyeOp(img, pts, u, v, d, { close = 0, raise = 0, gaze = null }) {
  const c = avg(pts);
  const loc = (p) => [(p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1], (p[0] - c[0]) * v[0] + (p[1] - c[1]) * v[1]];
  const L = pts.map(loc); // order: corner, upper, upper, corner, lower, lower (dlib order)
  let ord = [0, 1, 2, 3, 4, 5]; if (L[0][0] > L[3][0]) ord = [3, 2, 1, 0, 5, 4]; // make s grow left→right
  // corners pushed out a little: detected corners usually sit inside the real ones
  const w0 = Math.abs(L[ord[3]][0] - L[ord[0]][0]);
  const cA = [L[ord[0]][0] - 0.1 * w0, L[ord[0]][1]]; const cB = [L[ord[3]][0] + 0.1 * w0, L[ord[3]][1]];
  const up = [cA, L[ord[1]], L[ord[2]], cB].sort((a, b) => a[0] - b[0]);
  const lo = [cA, L[ord[5]], L[ord[4]], cB].sort((a, b) => a[0] - b[0]);
  const top = curveLut(up); const bot = curveLut(lo);
  const sA = Math.min(cA[0], cB[0]); const sB = Math.max(cA[0], cB[0]); const width = sB - sA;
  const hMax = Math.max(2, ...[...Array(11)].map((_, i) => bot(lerp(sA, sB, i / 10)) - top(lerp(sA, sB, i / 10))));
  const lidSkin = 0.3 * d; const cheek = 0.32 * d; const pad = 0.12 * d;
  const src = { width: img.width, height: img.height, data: new Uint8Array(img.data) };
  const out = img.data;
  const toImg = (s, t) => [c[0] + s * u[0] + t * v[0], c[1] + s * u[1] + t * v[1]];

  // iris centre: centroid of the darkest pixels inside the eye opening
  let iris = [0, 0];
  if (gaze) {
    const vals = [];
    for (let s = sA; s <= sB; s += 1) for (let t = top(s); t <= bot(s); t += 1) {
      const [x, y] = toImg(s, t); const i = ((y | 0) * img.width + (x | 0)) * 4;
      vals.push([s, t, 0.3 * src.data[i] + 0.59 * src.data[i + 1] + 0.11 * src.data[i + 2]]);
    }
    const sorted = vals.map((q) => q[2]).sort((a, b) => a - b); const thr = sorted[Math.floor(sorted.length * 0.35)] ?? 0;
    let ws = 0; for (const [s, t, l] of vals) if (l <= thr) { const wgt = thr - l + 1; iris[0] += s * wgt; iris[1] += t * wgt; ws += wgt; }
    if (ws) iris = [iris[0] / ws, iris[1] / ws];
  }
  const gS = gaze ? gaze[0] * width : 0; const gT = gaze ? gaze[1] * hMax : 0;

  // walk the output pixels of the eye box
  const sMin = sA - pad; const sMax = sB + pad; const tMin = -hMax - lidSkin - 0.1 * d; const tMax = hMax + cheek + 0.1 * d;
  const corners = [toImg(sMin, tMin), toImg(sMax, tMin), toImg(sMin, tMax), toImg(sMax, tMax)];
  const bx0 = Math.max(0, Math.floor(Math.min(...corners.map((q) => q[0])))); const bx1 = Math.min(img.width - 1, Math.ceil(Math.max(...corners.map((q) => q[0]))));
  const by0 = Math.max(0, Math.floor(Math.min(...corners.map((q) => q[1])))); const by1 = Math.min(img.height - 1, Math.ceil(Math.max(...corners.map((q) => q[1]))));
  const lash = [];
  for (let y = by0; y <= by1; y += 1) for (let x = bx0; x <= bx1; x += 1) {
    const [s, t] = loc([x + 0.5, y + 0.5]);
    if (s < sMin || s > sMax) continue;
    const sc = Math.min(sB, Math.max(sA, s));
    const ws = smooth(sMin, sA, s) * smooth(sMax, sB, s); // full effect across the eye, fading out past the corners
    const h0 = Math.max(0, bot(sc) - top(sc));
    const grow = close > 0.5 ? 0.12 : 0;                // landmarks sit a hair inside the real lids: cover them fully
    const gp = grow ? grow * h0 + 0.025 * d * ws : 0;
    const T = top(sc) - gp * 0.6; const B = bot(sc) + gp; const h = B - T;
    const crease = T - lidSkin; const cheekLow = B + cheek;
    if (t < crease || t > cheekLow) continue;
    const nB = B - raise * h * ws;
    const nT = Math.min(nB, T + close * (nB - T) * ws);
    let ss = s; let tt = t;
    if (t <= nT) tt = crease + (t - crease) * (T - crease) / Math.max(1e-3, nT - crease);           // lid skin slides down
    else if (t <= nB) {                                                                            // what's left of the eye
      const sTop = T + close * (B - T) * ws; tt = lerp(sTop, B, (t - nT) / Math.max(1e-3, nB - nT));
      if (gaze) { // move the iris inside the opening, stretching the white on one side and squeezing the other
        const ic = iris[0] + gS; const k = ws;
        ss = s < ic ? lerp(sA, iris[0], (s - sA) / Math.max(1e-3, ic - sA)) : lerp(sB, iris[0], (sB - s) / Math.max(1e-3, sB - ic));
        ss = lerp(s, ss, k);
        tt -= gT * Math.sin(Math.PI * Math.min(1, Math.max(0, (t - nT) / Math.max(1e-3, nB - nT)))) * k;
      }
    } else tt = B + (t - nB) * (cheekLow - B) / Math.max(1e-3, cheekLow - nB);                   // cheek pushes the lower lid up
    if (Math.abs(ss - s) < 0.01 && Math.abs(tt - t) < 0.01) continue;
    const [sx, sy] = toImg(ss, tt);
    sampleCubic(src, sx - 0.5, sy - 0.5, out, (y * img.width + x) * 4);
    if (close > 0.45) lash.push([x, y, Math.abs(t - nT), ws]);
  }
  // a lash line where the upper lid now sits (darker, thicker in the middle)
  if (close > 0.45) {
    const thick = 0.028 * d * Math.min(1, (close - 0.45) * 2.5);
    for (const [x, y, dist, ws] of lash) {
      const th = thick * (0.35 + 0.65 * ws);
      if (dist > th) continue;
      const a = (1 - dist / th) * 0.75 * ws;
      const i = (y * img.width + x) * 4;
      for (let k = 0; k < 3; k += 1) out[i + k] *= 1 - a * 0.7;
    }
  }
}

/**
 * Look sideways: the iris slides along the eye opening as one piece (gaze[0] as a share of the eye's width);
 * the white on the side it leaves stretches, the white on the side it moves to squeezes. Up/down gaze is
 * handled by the lids (eyeOp), which reads more naturally than moving the iris vertically.
 */
function gazeOp(img, pts, u, v, d, gaze) {
  const c = avg(pts);
  const loc = (p) => [(p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1], (p[0] - c[0]) * v[0] + (p[1] - c[1]) * v[1]];
  const toImg = (s, t) => [c[0] + s * u[0] + t * v[0], c[1] + s * u[1] + t * v[1]];
  const L = pts.map(loc);
  let ord = [0, 1, 2, 3, 4, 5]; if (L[0][0] > L[3][0]) ord = [3, 2, 1, 0, 5, 4];
  const w0 = Math.abs(L[ord[3]][0] - L[ord[0]][0]);
  const cA = [L[ord[0]][0] - 0.08 * w0, L[ord[0]][1]]; const cB = [L[ord[3]][0] + 0.08 * w0, L[ord[3]][1]];
  const top = curveLut([cA, L[ord[1]], L[ord[2]], cB].sort((a, b) => a[0] - b[0]));
  const bot = curveLut([cA, L[ord[5]], L[ord[4]], cB].sort((a, b) => a[0] - b[0]));
  const sA = Math.min(cA[0], cB[0]); const sB = Math.max(cA[0], cB[0]); const width = sB - sA;
  const T = (s) => top(s) - 0.015 * d; const B = (s) => bot(s) + 0.015 * d;
  const src = { width: img.width, height: img.height, data: new Uint8Array(img.data) };
  const lumAt = (s, t) => { const [x, y] = toImg(s, t); const i = ((Math.round(y) * img.width) + Math.round(x)) * 4; return 0.3 * src.data[i] + 0.59 * src.data[i + 1] + 0.11 * src.data[i + 2]; };
  // iris: darkest columns of the opening
  const cols = [];
  for (let s = sA + 0.1 * width; s <= sB - 0.1 * width; s += 0.5) {
    let sum = 0; let n = 0; for (let t = top(s); t <= bot(s); t += 0.5) { sum += lumAt(s, t); n += 1; }
    if (n) cols.push([s, sum / n]);
  }
  if (cols.length < 4) return;
  const sorted = cols.map((q) => q[1]).sort((a, b) => a - b); const thr = sorted[Math.floor(sorted.length * 0.3)];
  let ic = 0; let wsum = 0; for (const [s, l] of cols) if (l <= thr) { const w = thr - l + 1; ic += s * w; wsum += w; }
  ic /= wsum;
  const hMax = Math.max(2, ...[...Array(11)].map((_, k) => bot(lerp(sA, sB, k / 10)) - top(lerp(sA, sB, k / 10))));
  const r = Math.min(0.18 * width, 0.5 * hMax + 1);                         // iris half-width
  const room = gaze[0] > 0 ? sB - ic - 0.2 * width : ic - sA - 0.2 * width; // the iris may tuck into the corner
  const gS = Math.sign(gaze[0]) * Math.max(0, Math.min(Math.abs(gaze[0]) * width, room));
  if (Math.abs(gS) < 0.5) return;
  const a0 = ic - r; const a1 = ic + r; const b0 = a0 + gS; const b1 = a1 + gS; // iris [a0,a1] → [b0,b1]
  const back = (s) => (s < b0 ? lerp(sA, a0, (s - sA) / Math.max(1e-3, b0 - sA)) : s > b1 ? (b1 >= sB ? a1 : lerp(a1, sB, (s - b1) / Math.max(1e-3, sB - b1))) : s - gS);
  const box = [toImg(sA - 2, -hMax - 4), toImg(sB + 2, -hMax - 4), toImg(sA - 2, hMax + 4), toImg(sB + 2, hMax + 4)];
  const x0 = Math.max(0, Math.floor(Math.min(...box.map((q) => q[0])))); const x1 = Math.min(img.width - 1, Math.ceil(Math.max(...box.map((q) => q[0]))));
  const y0 = Math.max(0, Math.floor(Math.min(...box.map((q) => q[1])))); const y1 = Math.min(img.height - 1, Math.ceil(Math.max(...box.map((q) => q[1]))));
  const tmp = [0, 0, 0, 0];
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) {
    const [s, t] = loc([x + 0.5, y + 0.5]);
    if (s <= sA || s >= sB) continue;
    const tt = T(s); const bb = B(s); if (t <= tt || t >= bb) continue;
    const ss = back(s);
    // keep the row's position relative to the lids, so the iris follows the lid curve
    const k = (t - tt) / (bb - tt); const st = lerp(T(ss), B(ss), k);
    const [sx, sy] = toImg(ss, st); sampleCubic(src, sx - 0.5, sy - 0.5, tmp, 0);
    const a = smooth(0, 1.2, Math.min(t - tt, bb - t));
    const o = (y * img.width + x) * 4;
    for (let q = 0; q < 3; q += 1) img.data[o + q] = img.data[o + q] * (1 - a) + tmp[q] * a;
  }
}

function tear(img, at, base, kind, d) {
  const drop = (c, r) => { // round bottom, pointed top
    const poly = Array.from({ length: 30 }, (_, k) => {
      const t = (k / 30) * Math.PI * 2; const sn = Math.sin(t);
      return at(c, Math.cos(t) * r * (sn < 0 ? 1 + sn * 0.75 : 1), sn < 0 ? sn * r * 1.9 : sn * r);
    });
    fillPoly(img, poly, () => [120, 190, 255], 0.72);
    fillPoly(img, Array.from({ length: 12 }, (_, k) => { const t = (k / 12) * Math.PI * 2; return at(c, -r * 0.35 + Math.cos(t) * r * 0.22, -r * 0.1 + Math.sin(t) * r * 0.3); }), () => [255, 255, 255], 0.8);
  };
  if (kind === 'sad') {
    const poly = [at(base, -0.008, 0.02), at(base, 0.008, 0.02), at(base, 0.016, 0.16), at(base, 0.012, 0.3), at(base, -0.012, 0.3), at(base, -0.016, 0.16)];
    fillPoly(img, poly, () => [160, 210, 255], 0.28);
    drop(at(base, 0, 0.36), 0.048);
  } else drop(at(base, 0, 0.12), 0.045);
}

// ---------- mood recipes ----------
// moves: [landmark index, along-the-eyes, down-the-face] in units of the eye distance.
// eyes: { close, raise, gaze } for both eyes, or eyeR / eyeL (the photo's left / right eye) separately.
// roll: head tilt in degrees. tears: 'happy' (outer corner drop) or 'sad' (track down the cheek).
const R = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const SMILE = [[48, -0.09, -0.1], [54, 0.09, -0.1], [49, -0.045, -0.05], [53, 0.045, -0.05], [59, -0.045, -0.045], [55, 0.045, -0.045],
  [60, -0.08, -0.09], [64, 0.08, -0.09], [61, -0.025, -0.025], [63, 0.025, -0.025], [67, -0.025, -0.03], [65, 0.025, -0.03], [58, -0.01, -0.02], [56, 0.01, -0.02],
  [57, 0, -0.03], [66, 0, -0.025], [51, 0, 0.008], [62, 0, 0.005], [31, -0.012, -0.01], [35, 0.012, -0.01], [3, -0.01, -0.03], [4, -0.01, -0.04], [12, 0.01, -0.04], [13, 0.01, -0.03]];
const FROWN = [[48, 0.02, 0.09], [54, -0.02, 0.09], [60, 0.02, 0.07], [64, -0.02, 0.07], [49, 0, 0.03], [53, 0, 0.03], [59, 0, 0.02], [55, 0, 0.02],
  [50, 0, -0.01], [51, 0, -0.015], [52, 0, -0.01]];
const WORRY = [[21, 0.02, -0.11], [20, 0, -0.06], [22, -0.02, -0.11], [23, 0, -0.06], [17, 0, 0.04], [18, 0, 0.02], [25, 0, 0.02], [26, 0, 0.04]];
const BROWS = (k) => R(17, 26).map((i) => [i, 0, -k]);
const OPEN = (k) => [...[55, 56, 57, 58, 59, 65, 66, 67].map((i) => [i, 0, k]), ...[7, 8, 9].map((i) => [i, 0, k * 0.4]), [6, 0, k * 0.3], [10, 0, k * 0.3], [5, 0, k * 0.15], [11, 0, k * 0.15]];
const scale = (moves, k) => moves.map(([i, a, b]) => [i, a * k, b * k]);

const MOODS = {
  happy: { moves: [...SMILE, ...BROWS(0.02)], eyes: { close: 0.12, raise: 0.25 } },
  laugh: { moves: [...scale(SMILE, 1.3), ...BROWS(0.045)], eyes: { close: 1, raise: 0.45 }, tears: 'happy', roll: -3 },
  love: { moves: [...scale(SMILE, 0.75), ...BROWS(0.03)], eyes: { close: 0.38, raise: 0.2 }, roll: 3, blush: 0.12 },
  sad: { moves: [...FROWN, ...WORRY], eyes: { close: 0.35 } },
  cry: { moves: [...scale(FROWN, 1.25), ...scale(WORRY, 1.3)], eyes: { close: 0.95, raise: 0.15 }, tears: 'sad' },
  angry: { moves: [[20, 0.04, 0.09], [21, 0.05, 0.1], [22, -0.05, 0.1], [23, -0.04, 0.09], [19, 0, 0.05], [24, 0, 0.05], [17, 0, -0.01], [26, 0, -0.01],
    [27, 0, 0.015], ...scale(FROWN, 0.6), [48, 0.02, 0], [54, -0.02, 0]], eyes: { close: 0.25, raise: 0.25 } },
  shocked: { moves: [...BROWS(0.075), [37, 0, -0.03], [38, 0, -0.03], [43, 0, -0.03], [44, 0, -0.03],
    ...OPEN(0.15), [48, 0.075, 0.06], [54, -0.075, 0.06], [60, 0.07, 0.06], [64, -0.07, 0.06], [49, 0.04, 0], [53, -0.04, 0], [59, 0.04, 0.03], [55, -0.04, 0.03],
    [50, 0.02, -0.015], [51, 0, -0.02], [52, -0.02, -0.015], [61, 0.04, -0.01], [62, 0, -0.015], [63, -0.04, -0.01]], mouth: 'dark' },
  tired: { moves: [...BROWS(-0.015), ...scale(FROWN, 0.3)], eyes: { close: 0.6 }, roll: -4 },
  cool: { moves: [...scale(SMILE, 0.7), [54, 0.1, -0.13], [64, 0.09, -0.11], [53, 0.05, -0.07], [55, 0.05, -0.06],
    [17, 0, 0.035], [18, 0, 0.04], [19, 0, 0.04], [20, 0, 0.03], [21, 0, 0.02], ...R(22, 26).map((i) => [i, 0, -0.025])],
  eyeR: { close: 1, raise: 0.5 }, eyeL: { close: 0.2, raise: 0.25 }, roll: 3 },
  party: { moves: [...scale(SMILE, 1.1), ...BROWS(0.035)], eyes: { close: 0.55, raise: 0.4 }, roll: -5 },
  thinking: { moves: [...R(22, 26).map((i, k) => [i, 0, -0.06 - k * 0.006]), ...R(17, 21).map((i) => [i, 0, 0.015]),
    [48, 0.035, 0.015], [54, 0.035, -0.045], [60, 0.03, 0.01], [64, 0.03, -0.035], [49, 0.02, 0], [53, 0.03, -0.02], [59, 0.02, 0], [55, 0.03, -0.015]],
  eyes: { gaze: [0.5, 0] }, roll: 5 },
  shy: { moves: [...scale(SMILE, 0.7), [21, 0.01, -0.03], [22, -0.01, -0.03]], eyes: { close: 0.5 }, roll: 3, blush: 0.1 },
};
export const RENDER_MOODS = Object.keys(MOODS);

/** Smooth a closed polygon (Catmull-Rom), so an open mouth looks round instead of angular. */
function smoothClosed(pts, steps = 6) {
  const out = []; const n = pts.length;
  for (let i = 0; i < n; i += 1) {
    const p0 = pts[(i - 1 + n) % n]; const p1 = pts[i]; const p2 = pts[(i + 1) % n]; const p3 = pts[(i + 2) % n];
    for (let k = 0; k < steps; k += 1) {
      const t = k / steps; const t2 = t * t; const t3 = t2 * t;
      out.push([0, 1].map((c) => 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  return out;
}

function avg(pts) { return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length]; }

/**
 * img: { width, height, data } (the Soulmoji selfie), lm: 68 [x, y] landmarks on it, mood: key.
 * Returns a new image with the expression changed: same photo, same person, no stickers.
 */
export function renderMood(img, lm, mood, override) {
  const recipe = override || MOODS[mood] || MOODS.happy;
  const eyeR = avg(lm.slice(36, 42)); const eyeL = avg(lm.slice(42, 48));
  const d = Math.hypot(eyeL[0] - eyeR[0], eyeL[1] - eyeR[1]) || 60;
  const u = [(eyeL[0] - eyeR[0]) / d, (eyeL[1] - eyeR[1]) / d]; // along the eyes
  const v = [-u[1], u[0]];                                       // down the face
  const at = (p, a, b) => [p[0] + (a * u[0] + b * v[0]) * d, p[1] + (a * u[1] + b * v[1]) * d];
  const W = img.width; const H = img.height;

  // 1) control points: 68 landmarks + an inner ring (moves with the head) + an outer ring (stays still)
  const centre = avg(lm);
  const inner = []; const outer = [];
  for (let k = 0; k < 20; k += 1) {
    const t = (k / 20) * Math.PI * 2;
    inner.push(at(centre, Math.cos(t) * 1.25, Math.sin(t) * 1.45 - 0.15));
    outer.push(at(centre, Math.cos(t) * 2.0, Math.sin(t) * 2.3 - 0.15));
  }
  const src = [...lm.map((p) => [p[0], p[1]]), ...inner, ...outer];
  const dst = src.map((p) => [p[0], p[1]]);
  for (const [i, a, b] of recipe.moves || []) dst[i] = at(lm[i], a, b);
  if (recipe.roll) { // tilt the head around the chin-ish pivot
    const piv = at(centre, 0, 0.6); const r = (recipe.roll * Math.PI) / 180; const cs = Math.cos(r); const sn = Math.sin(r);
    for (let i = 0; i < 68 + inner.length; i += 1) {
      const [x, y] = dst[i]; const dx = x - piv[0]; const dy = y - piv[1];
      dst[i] = [piv[0] + dx * cs - dy * sn, piv[1] + dx * sn + dy * cs];
    }
  }
  const xs = outer.map((p) => p[0]); const ys = outer.map((p) => p[1]);
  const out = warp(img, src, dst, d, [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);

  // 2) eyes (on the warped face): lids, squint, gaze
  const P = (i) => dst[i];
  const eR = recipe.eyeR || recipe.eyes; const eL = recipe.eyeL || recipe.eyes;
  for (const [e, idx] of [[eR, R(36, 41)], [eL, R(42, 47)]]) {
    if (!e) continue;
    if (e.gaze) gazeOp(out, idx.map(P), u, v, d, e.gaze);
    eyeOp(out, idx.map(P), u, v, d, { ...e, gaze: null });
  }

  // 3) details a warp can't make
  if (recipe.mouth) {
    const poly = smoothClosed([60, 61, 62, 63, 64, 65, 66, 67].map(P));
    const top = Math.min(...[61, 62, 63].map((i) => P(i)[1])); const bottom = Math.max(...[65, 66, 67].map((i) => P(i)[1]));
    // shadowed under the upper lip, a hint of tongue towards the bottom
    fillPoly(out, poly, (x, y) => { const k = Math.min(1, Math.max(0, (y - top) / Math.max(1, bottom - top))) ** 1.6; return [28 + 80 * k, 8 + 30 * k, 12 + 34 * k]; }, 0.88);
  }
  if (recipe.blush) {
    for (const side of [-1, 1]) {
      const eye = side < 0 ? avg([P(40), P(41)]) : avg([P(46), P(47)]); const corner = side < 0 ? P(48) : P(54);
      const c = at([(eye[0] + corner[0]) / 2, (eye[1] + corner[1]) / 2], side * 0.2, -0.04);
      softEllipse(out, c[0], c[1], 0.3 * d, 0.17 * d, [235, 90, 110], recipe.blush);
    }
  }
  if (recipe.tears) {
    const lids = recipe.tears === 'sad' ? [avg([P(39), P(40)]), avg([P(42), P(47)])] : [at(P(36), -0.02, 0.04), at(P(45), 0.02, 0.04)];
    for (const base of lids) tear(out, at, base, recipe.tears, d);
  }
  return out;
}
