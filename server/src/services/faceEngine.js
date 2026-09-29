// Local face engine (free, runs on this laptop): finds the face, measures head turn, and makes a
// 128-number "face fingerprint". Uses @vladmandic/face-api on TensorFlow's WebAssembly backend.
// At the cloud move this can be swapped for AWS Rekognition via FACE_PROVIDER.
import path from 'node:path';
import { createRequire } from 'node:module';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

const require = createRequire(import.meta.url);
let faceapi;
let ready;

export function initFaceEngine() {
  if (!ready) {
    ready = (async () => {
      faceapi = await import('@vladmandic/face-api/dist/face-api.node-wasm.js');
      const { tf } = faceapi;
      const wasmDir = `${path.dirname(require.resolve('@tensorflow/tfjs-backend-wasm/package.json'))}${path.sep}dist${path.sep}`;
      tf.setWasmPaths?.(wasmDir);
      await tf.setBackend('wasm');
      await tf.ready();
      const dir = path.join(path.dirname(require.resolve('@vladmandic/face-api/package.json')), 'model');
      await faceapi.nets.ssdMobilenetv1.loadFromDisk(dir);
      await faceapi.nets.faceLandmark68Net.loadFromDisk(dir);
      await faceapi.nets.faceRecognitionNet.loadFromDisk(dir);
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

function decodeImage(buf) {
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  const img = isPng ? PNG.sync.read(buf) : jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 256 });
  return { width: img.width, height: img.height, rgba: img.data };
}

/** Brightness (0-255) and sharpness (edge strength) of a region, measured on a grey version of the photo. */
function quality({ width, height, rgba }, box) {
  const x0 = Math.max(0, Math.floor(box ? box.x : 0));
  const y0 = Math.max(0, Math.floor(box ? box.y : 0));
  const x1 = Math.min(width - 1, Math.ceil(box ? box.x + box.width : width - 1));
  const y1 = Math.min(height - 1, Math.ceil(box ? box.y + box.height : height - 1));
  const step = Math.max(1, Math.floor((x1 - x0) / 160)); // sample ~160px across so it's fast
  const grey = (x, y) => { const i = (y * width + x) * 4; return 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]; };
  let sum = 0; let n = 0; let lapSum = 0; let lapSq = 0; let m = 0;
  for (let y = y0 + step; y < y1 - step; y += step) {
    for (let x = x0 + step; x < x1 - step; x += step) {
      const c = grey(x, y);
      sum += c; n += 1;
      const lap = grey(x - step, y) + grey(x + step, y) + grey(x, y - step) + grey(x, y + step) - 4 * c;
      lapSum += lap; lapSq += lap * lap; m += 1;
    }
  }
  const mean = m ? lapSum / m : 0;
  return { brightness: n ? sum / n : 0, sharpness: m ? lapSq / m - mean * mean : 0 };
}

/**
 * Every face in the photo: { score, yaw, box, descriptor[128], brightness, sharpness }
 * yaw ≈ 0 looking straight, ≈ ±0.5 head turned. Also returns the whole photo's size and brightness.
 */
export async function analyzeFaces(buf) {
  await initFaceEngine();
  const img = decodeImage(buf);
  const rgb = new Uint8Array(img.width * img.height * 3);
  for (let i = 0, j = 0; i < img.rgba.length; i += 4, j += 3) { rgb[j] = img.rgba[i]; rgb[j + 1] = img.rgba[i + 1]; rgb[j + 2] = img.rgba[i + 2]; }
  const t = faceapi.tf.tensor3d(rgb, [img.height, img.width, 3]);
  try {
    const found = await faceapi
      .detectAllFaces(t, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
      .withFaceLandmarks()
      .withFaceDescriptors();
    const faces = found.map((f) => {
      const p = f.landmarks.positions;
      const avgX = (pts) => pts.reduce((s, q) => s + q.x, 0) / pts.length;
      const left = avgX(p.slice(36, 42));
      const right = avgX(p.slice(42, 48));
      const { x, y, width, height } = f.detection.box;
      return {
        score: f.detection.score,
        yaw: (p[30].x - (left + right) / 2) / Math.max(1, Math.abs(right - left)),
        box: { x, y, width, height },
        descriptor: Array.from(f.descriptor),
        ...quality(img, { x, y, width, height }),
      };
    });
    faces.image = { width: img.width, height: img.height, ...quality(img) };
    return faces;
  } finally { t.dispose(); }
}

export const faceDistance = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
