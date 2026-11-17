// End-to-end check for the video builder (also run by GitHub before publishing the image):
// makes two test clips and a photo with ffmpeg, serves them on a local "storage" that also accepts uploads,
// asks the builder (BUILDER_URL, default a copy started here) to build a Spark, and checks the result.
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'builder-test-'));
const ff = (...a) => { const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', ...a]); if (r.status) throw new Error(String(r.stderr)); };
ff('-f', 'lavfi', '-i', 'testsrc2=s=1080x1920:d=5', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=5', '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', path.join(dir, 'a.mp4'));
ff('-f', 'lavfi', '-i', 'mandelbrot=s=640x480:rate=25,trim=duration=4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path.join(dir, 'b.mp4')); // landscape, no sound
ff('-f', 'lavfi', '-i', 'gradients=s=800x800:d=1', '-frames:v', '1', path.join(dir, 'c.jpg'));
ff('-f', 'lavfi', '-i', 'sine=frequency=220:duration=30', path.join(dir, 'm.m4a'));

const store = http.createServer((req, res) => {
  const f = path.join(dir, path.basename(req.url));
  if (req.method === 'PUT') { const w = fs.createWriteStream(f); req.pipe(w); w.on('finish', () => { res.writeHead(201); res.end(); }); return; }
  if (!fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Length': fs.statSync(f).size }); fs.createReadStream(f).pipe(res);
}).listen(0, '127.0.0.1');
await new Promise((r) => store.once('listening', r));
const S = `http://127.0.0.1:${store.address().port}`;

const TOKEN = process.env.BUILDER_TOKEN || 'test-token';
let child = null; let url = process.env.BUILDER_URL;
if (!url) {
  child = spawn(process.execPath, [path.join(path.dirname(new URL(import.meta.url).pathname), 'server.js')], { env: { ...process.env, PORT: '18080', BUILDER_TOKEN: TOKEN }, stdio: 'inherit' });
  url = 'http://127.0.0.1:18080';
  for (let i = 0; i < 50; i += 1) { try { if ((await fetch(`${url}/health`)).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 200)); }
}
const job = {
  clips: [{ url: `${S}/a.mp4`, kind: 'video', in: 1, out: 4, speed: 1.5 }, { url: `${S}/c.jpg`, kind: 'photo', in: 0, out: 2 }, { url: `${S}/b.mp4`, kind: 'video', in: 0, out: 2, speed: 0.5 }],
  music: { url: `${S}/m.m4a`, start: 3, volume: 0.8 }, videoVolume: 0.4, filter: 'dream', adjust: { c: 0.2 }, zoom: { s: 1.1, x: 0.5, y: 0.5 }, fade: { in: 0.3, out: 0.5 }, cover: 1,
  out: { video: `${S}/out.mp4`, cover: `${S}/out.jpg` },
};
let failed = false;
try {
  const t0 = Date.now();
  const res = await fetch(`${url}/build`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(job) });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || res.status);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', path.join(dir, 'out.mp4')], { encoding: 'utf8' });
  const info = JSON.parse(probe.stdout); const v = info.streams.find((s) => s.codec_type === 'video');
  const dur = Number(info.format.duration); const want = 3 / 1.5 + 2 + 2 / 0.5;
  if (Math.abs(dur - want) > 0.15) throw new Error(`length ${dur} s, expected ${want} s`);
  if (v.width !== 720 || v.height !== 1280) throw new Error(`size ${v.width}×${v.height}`);
  if (!info.streams.some((s) => s.codec_type === 'audio')) throw new Error('no sound');
  if (!fs.existsSync(path.join(dir, 'out.jpg'))) throw new Error('no cover');
  const bad = await fetch(`${url}/build`, { method: 'POST', headers: { Authorization: 'Bearer wrong' }, body: '{}' });
  if (bad.status !== 401) throw new Error('a wrong token was accepted');
  console.log(`✔ builder OK: ${dur.toFixed(2)} s, ${v.width}×${v.height}, ${body.bytes} bytes, built in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
} catch (e) { failed = true; console.error(`✘ builder test failed: ${e.message}`); }
child?.kill(); store.close(); fs.rmSync(dir, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
