// Soulmoji expression engine (free, runs on this laptop, no AI service needed).
// Takes the person's own Soulmoji selfie (512×512, face centred) plus its 68 face landmarks, then:
//   1. moves the landmarks for the chosen mood (smile, frown, raised brows, open mouth, squint...),
//   2. warps the photo to follow them (triangle mesh: Delaunay + piecewise affine, bilinear sampling),
//   3. adds mood details that a warp can't make: open-mouth shading and teeth, tears, blush, sunglasses,
//      hearts, confetti, and a light colour grade.
// The result is the SAME photo of the same person with a different expression.
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

export const SIZE = 512;

export function decode(buf) {
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  const img = isPng ? PNG.sync.read(buf) : jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 512 });
  return { width: img.width, height: img.height, data: img.data };
}
export const encodeJpeg = (img, quality = 88) => jpeg.encode({ width: img.width, height: img.height, data: img.data }, quality).data;

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

/** Crop a square (x0, y0, side) from an image and resize it to size×size. */
export function cropSquare(img, x0, y0, side, size = SIZE) {
  const out = new Uint8Array(size * size * 4);
  const k = side / size;
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) sample(img, x0 + (x + 0.5) * k, y0 + (y + 0.5) * k, out, (y * size + x) * 4);
  return { width: size, height: size, data: out };
}

// ---------- Delaunay (Bowyer-Watson) ----------
function delaunay(pts) {
  const n = pts.length;
  const big = 1e5;
  const all = [...pts, [-big, -big], [big * 2, -big], [-big, big * 2]];
  let tris = [[n, n + 1, n + 2]];
  const circ = (t) => {
    const [ax, ay] = all[t[0]]; const [bx, by] = all[t[1]]; const [cx, cy] = all[t[2]];
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
    return { x: ux, y: uy, r2: (ax - ux) ** 2 + (ay - uy) ** 2 };
  };
  let circles = tris.map(circ);
  for (let i = 0; i < n; i += 1) {
    const [px, py] = all[i];
    const bad = []; const keep = []; const keepC = [];
    tris.forEach((t, k) => { const c = circles[k]; if ((px - c.x) ** 2 + (py - c.y) ** 2 < c.r2) bad.push(t); else { keep.push(t); keepC.push(c); } });
    const edges = new Map();
    for (const t of bad) for (const [a, b] of [[t[0], t[1]], [t[1], t[2]], [t[2], t[0]]]) {
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      edges.set(key, edges.has(key) ? null : [a, b]);
    }
    tris = keep; circles = keepC;
    for (const e of edges.values()) if (e) { const t = [e[0], e[1], i]; tris.push(t); circles.push(circ(t)); }
  }
  return tris.filter((t) => t[0] < n && t[1] < n && t[2] < n);
}

/** Warp img so that points src[i] move to dst[i]. */
function warp(img, src, dst) {
  const { width: w, height: h } = img;
  const out = new Uint8Array(w * h * 4);
  out.set(img.data);
  for (const [a, b, c] of delaunay(dst)) {
    const [x1, y1] = dst[a]; const [x2, y2] = dst[b]; const [x3, y3] = dst[c];
    const det = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
    if (Math.abs(det) < 1e-9) continue;
    const minX = Math.max(0, Math.floor(Math.min(x1, x2, x3))); const maxX = Math.min(w - 1, Math.ceil(Math.max(x1, x2, x3)));
    const minY = Math.max(0, Math.floor(Math.min(y1, y2, y3))); const maxY = Math.min(h - 1, Math.ceil(Math.max(y1, y2, y3)));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const px = x + 0.5; const py = y + 0.5;
        const l1 = ((y2 - y3) * (px - x3) + (x3 - x2) * (py - y3)) / det;
        const l2 = ((y3 - y1) * (px - x3) + (x1 - x3) * (py - y3)) / det;
        const l3 = 1 - l1 - l2;
        if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue;
        const sx = l1 * src[a][0] + l2 * src[b][0] + l3 * src[c][0] - 0.5;
        const sy = l1 * src[a][1] + l2 * src[b][1] + l3 * src[c][1] - 0.5;
        sample(img, sx, sy, out, (y * w + x) * 4);
      }
    }
  }
  return { width: w, height: h, data: out };
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
function heart(img, cx, cy, s, rgb, alpha) {
  for (let y = Math.floor(cy - s * 1.3); y <= Math.ceil(cy + s * 1.3); y += 1) {
    for (let x = Math.floor(cx - s * 1.3); x <= Math.ceil(cx + s * 1.3); x += 1) {
      const u = (x - cx) / s; const v = -(y - cy) / s;
      if ((u * u + v * v - 1) ** 3 - u * u * v ** 3 <= 0) blend(img, x, y, rgb, alpha);
    }
  }
}
function grade(img, [mr, mg, mb], sat = 1, bright = 1) {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    d[i] = Math.min(255, (l + (d[i] - l) * sat) * mr * bright);
    d[i + 1] = Math.min(255, (l + (d[i + 1] - l) * sat) * mg * bright);
    d[i + 2] = Math.min(255, (l + (d[i + 2] - l) * sat) * mb * bright);
  }
}

// ---------- mood recipes ----------
// Each move is [landmark index, along-the-eyes, down-the-face] in units of the eye distance.
const R = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const SMILE = [[48, -0.06, -0.13], [54, 0.06, -0.13], [49, -0.02, -0.06], [53, 0.02, -0.06], [59, -0.02, -0.05], [55, 0.02, -0.05],
  [60, -0.05, -0.11], [64, 0.05, -0.11], [58, 0, -0.02], [56, 0, -0.02], [40, 0, -0.035], [41, 0, -0.035], [46, 0, -0.035], [47, 0, -0.035],
  [3, 0, -0.03], [4, 0, -0.03], [12, 0, -0.03], [13, 0, -0.03], ...R(17, 26).map((i) => [i, 0, -0.02])];
const FROWN = [[48, 0.02, 0.1], [54, -0.02, 0.1], [60, 0.02, 0.08], [64, -0.02, 0.08], [49, 0, 0.03], [53, 0, 0.03],
  [21, 0.02, -0.1], [20, 0, -0.06], [22, -0.02, -0.1], [23, 0, -0.06], [17, 0, 0.04], [26, 0, 0.04], [37, 0, 0.025], [38, 0, 0.025], [43, 0, 0.025], [44, 0, 0.025]];
const OPEN = (k) => [...[55, 56, 57, 58, 59, 65, 66, 67].map((i) => [i, 0, k]), ...[6, 7, 8, 9, 10].map((i) => [i, 0, k * 0.45])];
const scale = (moves, k) => moves.map(([i, a, b]) => [i, a * k, b * k]);

const MOODS = {
  happy: { moves: SMILE, grade: [1.04, 1.01, 0.97] },
  laugh: { moves: [...scale(SMILE, 1.25), ...OPEN(0.15), [37, 0, 0.035], [38, 0, 0.035], [43, 0, 0.035], [44, 0, 0.035]], mouth: 'teeth', grade: [1.05, 1.02, 0.96] },
  love: { moves: scale(SMILE, 0.85), blush: 0.4, hearts: true, grade: [1.06, 0.99, 1.0] },
  sad: { moves: FROWN, grade: [0.94, 0.97, 1.06], sat: 0.8 },
  cry: { moves: [...scale(FROWN, 1.2), ...OPEN(0.05)], tears: true, mouth: 'dark', grade: [0.9, 0.96, 1.1], sat: 0.75 },
  angry: { moves: [[20, 0.04, 0.1], [21, 0.04, 0.1], [22, -0.04, 0.1], [23, -0.04, 0.1], [19, 0, 0.05], [24, 0, 0.05], [17, 0, -0.02], [26, 0, -0.02],
    [37, 0, 0.03], [38, 0, 0.03], [43, 0, 0.03], [44, 0, 0.03], [40, 0, -0.02], [41, 0, -0.02], [46, 0, -0.02], [47, 0, -0.02],
    [48, 0.03, 0.05], [54, -0.03, 0.05], [60, 0.03, 0.04], [64, -0.03, 0.04]], grade: [1.12, 0.93, 0.9] },
  shocked: { moves: [...R(17, 26).map((i) => [i, 0, -0.13]), [37, 0, -0.045], [38, 0, -0.045], [43, 0, -0.045], [44, 0, -0.045],
    [40, 0, 0.02], [41, 0, 0.02], [46, 0, 0.02], [47, 0, 0.02], ...OPEN(0.18), [48, 0.05, 0.06], [54, -0.05, 0.06], [60, 0.05, 0.06], [64, -0.05, 0.06],
    [50, 0, -0.03], [51, 0, -0.03], [52, 0, -0.03], [61, 0, -0.03], [62, 0, -0.03], [63, 0, -0.03]], mouth: 'dark' },
  tired: { moves: [[37, 0, 0.07], [38, 0, 0.07], [43, 0, 0.07], [44, 0, 0.07], ...R(17, 26).map((i) => [i, 0, 0.03]), [48, 0, 0.04], [54, 0, 0.04]], grade: [0.95, 0.95, 1.0], sat: 0.7, bright: 0.92 },
  cool: { moves: [[54, 0.03, -0.08], [64, 0.03, -0.07], [53, 0.01, -0.04]], shades: true, grade: [0.98, 1.0, 1.04] },
  party: { moves: SMILE, confetti: true, grade: [1.05, 1.02, 0.96] },
  thinking: { moves: [...R(17, 21).map((i) => [i, 0, -0.09]), ...R(22, 26).map((i) => [i, 0, 0.03]), [48, 0.03, 0.02], [54, 0.03, -0.06], [60, 0.03, 0.01], [64, 0.03, -0.05]] },
  shy: { moves: [...scale(SMILE, 0.5), [21, 0.01, -0.03], [22, -0.01, -0.03]], blush: 0.55, grade: [1.04, 0.99, 1.0] },
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

const avg = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

/**
 * img: { width, height, data } (the 512×512 Soulmoji selfie), lm: 68 [x, y] landmarks on it, mood: key.
 * Returns a new image with the expression changed.
 */
export function renderMood(img, lm, mood) {
  const recipe = MOODS[mood] || MOODS.happy;
  const eyeR = avg(lm.slice(36, 42)); const eyeL = avg(lm.slice(42, 48));
  const d = Math.hypot(eyeL[0] - eyeR[0], eyeL[1] - eyeR[1]) || 60;
  const u = [(eyeL[0] - eyeR[0]) / d, (eyeL[1] - eyeR[1]) / d]; // along the eyes
  const v = [-u[1], u[0]];                                       // down the face
  const at = (p, a, b) => [p[0] + (a * u[0] + b * v[0]) * d, p[1] + (a * u[1] + b * v[1]) * d];

  // 1) points: 68 landmarks + fixed anchors (image border and a ring around the face) that keep the
  //    background and hair still, so only the face moves
  const W = img.width; const H = img.height;
  const centre = avg(lm);
  const anchors = [[0, 0], [W / 2, 0], [W - 1, 0], [W - 1, H / 2], [W - 1, H - 1], [W / 2, H - 1], [0, H - 1], [0, H / 2]];
  for (let k = 0; k < 20; k += 1) {
    const t = (k / 20) * Math.PI * 2;
    anchors.push(at(centre, Math.cos(t) * 1.55, Math.sin(t) * 1.85 - 0.1));
  }
  const src = [...lm.map((p) => [p[0], p[1]]), ...anchors.map(([x, y]) => [Math.min(W - 1, Math.max(0, x)), Math.min(H - 1, Math.max(0, y))])];
  const dst = src.map((p) => [p[0], p[1]]);
  // recipes are written small; 1.8× reads clearly at chat size without tearing the face
  const K = 1.8;
  for (const [i, a, b] of recipe.moves) dst[i] = at(lm[i], a * K, b * K);

  // 2) warp
  const out = warp(img, src, dst);

  // 3) details
  const P = (i) => dst[i];
  if (recipe.mouth) {
    const inner = smoothClosed([60, 61, 62, 63, 64, 65, 66, 67].map(P));
    const top = Math.min(...[61, 62, 63].map((i) => P(i)[1]));
    const bottom = Math.max(...[65, 66, 67].map((i) => P(i)[1]));
    const teethLine = top + (bottom - top) * 0.36;
    const mid = (top + bottom) / 2;
    // dark mouth, a little lighter towards the lips; teeth as a soft off-white band along the top
    fillPoly(out, inner, (x, y) => {
      if (recipe.mouth === 'teeth' && y < teethLine) return [226, 220, 210];
      const k = Math.min(1, Math.abs(y - mid) / Math.max(1, (bottom - top) / 2));
      return [40 + 40 * k, 10 + 14 * k, 16 + 14 * k];
    }, 0.93);
  }
  if (recipe.blush) {
    for (const side of [-1, 1]) {
      const eye = side < 0 ? avg([P(40), P(41)]) : avg([P(46), P(47)]);
      const corner = side < 0 ? P(48) : P(54);
      const mid = [(eye[0] + corner[0]) / 2, (eye[1] + corner[1]) / 2];
      const c = at(mid, side * 0.22, -0.02);
      softEllipse(out, c[0], c[1], 0.34 * d, 0.2 * d, [255, 88, 120], recipe.blush);
    }
  }
  if (recipe.tears) {
    for (const lid of [avg([P(40), P(41)]), avg([P(46), P(47)])]) {
      const poly = [at(lid, -0.035, 0.02), at(lid, 0.035, 0.02), at(lid, 0.05, 0.55), at(lid, 0.0, 0.85), at(lid, -0.05, 0.55)];
      fillPoly(out, poly, () => [150, 205, 255], 0.55);
      const hl = [at(lid, -0.006, 0.08), at(lid, 0.006, 0.08), at(lid, 0.01, 0.6), at(lid, -0.01, 0.6)];
      fillPoly(out, hl, () => [255, 255, 255], 0.45);
    }
  }
  if (recipe.shades) {
    const lens = (c) => Array.from({ length: 28 }, (_, k) => { const t = (k / 28) * Math.PI * 2; return at(c, Math.cos(t) * 0.46, Math.sin(t) * (Math.sin(t) > 0 ? 0.34 : 0.26) - 0.03); });
    const cR = avg(lm.slice(36, 42)); const cL = avg(lm.slice(42, 48));
    for (const c of [cR, cL]) fillPoly(out, lens(c), () => [14, 14, 20], 0.94);
    fillPoly(out, [at(cR, 0.4, -0.14), at(cL, -0.4, -0.14), at(cL, -0.4, -0.07), at(cR, 0.4, -0.07)], () => [14, 14, 20], 0.94);
    for (const c of [cR, cL]) fillPoly(out, [at(c, -0.25, -0.1), at(c, -0.12, -0.16), at(c, 0.05, 0.1), at(c, -0.08, 0.14)], () => [255, 255, 255], 0.18);
  }
  if (recipe.hearts) {
    const top = at(centre, 0, -1.25);
    [[-1.25, 0.1, 0.16], [1.3, -0.05, 0.2], [0.95, -0.55, 0.12], [-0.9, -0.5, 0.1]].forEach(([a, b, s]) => {
      const c = at(top, a, b); heart(out, c[0], c[1], s * d, [255, 46, 99], 0.9);
    });
  }
  if (recipe.confetti) {
    let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const cols = [[245, 200, 66], [255, 107, 157], [66, 232, 192], [124, 92, 252], [111, 214, 255]];
    for (let k = 0; k < 70; k += 1) {
      const x = rnd() * W; const y = rnd() * H * 0.9;
      if (Math.hypot(x - centre[0], y - centre[1]) < 1.45 * d) continue;
      const a = rnd() * Math.PI; const w2 = 3 + rnd() * 4; const h2 = 1.5 + rnd() * 2;
      const c = [Math.cos(a), Math.sin(a)]; const n = [-c[1], c[0]];
      fillPoly(out, [[x - c[0] * w2 - n[0] * h2, y - c[1] * w2 - n[1] * h2], [x + c[0] * w2 - n[0] * h2, y + c[1] * w2 - n[1] * h2],
        [x + c[0] * w2 + n[0] * h2, y + c[1] * w2 + n[1] * h2], [x - c[0] * w2 + n[0] * h2, y - c[1] * w2 + n[1] * h2]], () => cols[k % cols.length], 0.95);
    }
  }
  if (recipe.grade || recipe.sat || recipe.bright) grade(out, recipe.grade || [1, 1, 1], recipe.sat ?? 1, recipe.bright ?? 1);
  return out;
}
