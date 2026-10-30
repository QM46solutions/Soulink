// Soulmoji AI results are framed exactly like the Soulmoji face (an uploaded photo with a small face in it used to
// come back as the whole photo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { frameAiResult } from '../src/services/soulmojiFace.js';

const jpeg = createRequire(import.meta.url)('jpeg-js');

test('AI result is cut to the Soulmoji face square, at the face size', () => {
  const w = 1024; const data = Buffer.alloc(w * w * 4);
  for (let i = 0; i < w * w; i += 1) { const x = i % w; const y = Math.floor(i / w); const inside = x >= 300 && x < 700 && y >= 200 && y < 600; data[i * 4] = inside ? 250 : 10; data[i * 4 + 1] = 10; data[i * 4 + 2] = 10; data[i * 4 + 3] = 255; }
  const buf = Buffer.from(jpeg.encode({ data, width: w, height: w }, 95).data);
  const out = jpeg.decode(frameAiResult(buf, { x: 300, y: 200, s: 400, out: 512 }), { useTArray: true });
  assert.equal(out.width, 512); assert.equal(out.height, 512);
  const px = (x, y) => out.data[(y * 512 + x) * 4];
  assert.ok(px(10, 10) > 200 && px(256, 256) > 200 && px(500, 500) > 200, 'only the face square is kept');
});
