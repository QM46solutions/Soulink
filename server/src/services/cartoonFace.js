// Draws a simple cartoon face PNG for test accounts (so profile photos and Soulmoji work in testing).
import { PNG } from 'pngjs';

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export function cartoonFacePng({ skin = '#e9b48a', hair = '#1b1410', bg = '#2a2140', size = 256 } = {}) {
  const png = new PNG({ width: size, height: size });
  const S = hex(skin); const H = hex(hair); const B = hex(bg); const E = [27, 20, 16]; const M = [122, 59, 43];
  const c = size / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let col = B.map((v, i) => Math.round(v * (1 - y / size / 3) + [124, 92, 252][i] * (y / size / 6)));
      const dx = x - c; const dy = y - c * 0.95;
      const face = (dx * dx) / (0.3 * size) ** 2 + (dy * dy) / (0.34 * size) ** 2 <= 1;
      const hairTop = (dx * dx) / (0.33 * size) ** 2 + ((y - c * 0.72) ** 2) / (0.3 * size) ** 2 <= 1 && y < c * 0.8;
      const body = y > c * 1.55 && Math.abs(dx) < size * 0.42 - (size - y) * 0.2;
      if (body) col = [66, 90, 180];
      if (face) col = S;
      if (hairTop) col = H;
      const eyeL = (x - (c - size * 0.11)) ** 2 + (y - c) ** 2 <= (size * 0.028) ** 2;
      const eyeR = (x - (c + size * 0.11)) ** 2 + (y - c) ** 2 <= (size * 0.028) ** 2;
      if (face && (eyeL || eyeR)) col = E;
      const r = Math.sqrt(dx * dx + (y - c * 1.1) ** 2);
      if (face && y > c * 1.12 && Math.abs(r - size * 0.1) < size * 0.012) col = M;
      const i = (y * size + x) * 4;
      png.data[i] = col[0]; png.data[i + 1] = col[1]; png.data[i + 2] = col[2]; png.data[i + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}
