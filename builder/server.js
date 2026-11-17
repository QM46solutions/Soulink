// Soulink video builder: a small web service with ffmpeg. The Soulink server sends it a Studio recipe with
// short-lived links to read the clips and to write the result; it builds the finished Spark and its cover.
// One job at a time (a Spark is short). Runs on Azure Container Apps and sleeps (scale to zero) when idle.
//   GET  /health
//   POST /build   Authorization: Bearer <BUILDER_TOKEN>
//        { clips: [{ url, kind: 'video'|'photo', in, out, speed }], music?: { url, start, volume }, voice?: { url, volume },
//          videoVolume, filter, adjust, zoom, fade, cover, out: { video: <upload url>, cover: <upload url> } }
//        -> { ok: true, seconds, bytes }
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { buildArgs } from './render.js';

const PORT = Number(process.env.PORT || 8080);
const TOKEN = process.env.BUILDER_TOKEN || '';
const MAX_SECONDS = 61;
const MAX_FILE = 200 * 1024 * 1024;

function run(cmd, args, ms) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args); let err = ''; let out = '';
    const t = setTimeout(() => { p.kill('SIGKILL'); reject(new Error(`${cmd} took too long`)); }, ms);
    p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { err += d; if (err.length > 20000) err = err.slice(-20000); });
    p.on('close', (code) => { clearTimeout(t); code === 0 ? resolve(out) : reject(new Error(`${cmd} failed: ${err.slice(-600)}`)); });
  });
}
const hasAudio = async (file) => (await run('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', file], 30000)).trim().length > 0;

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not read a clip (${res.status})`);
  if (Number(res.headers.get('content-length') || 0) > MAX_FILE) throw new Error('A clip is too big');
  await pipeline(Readable.fromWeb(res.body), createWriteStream(file));
}
async function upload(url, file, type) {
  const body = await fs.readFile(file);
  const res = await fetch(url, { method: 'PUT', body, headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': type } });
  if (!res.ok) throw new Error(`Could not save the result (${res.status})`);
  return body.length;
}

const num = (v, a, b, d) => (Number.isFinite(Number(v)) ? Math.max(a, Math.min(b, Number(v))) : d);
function check(job) {
  if (!Array.isArray(job?.clips) || !job.clips.length || job.clips.length > 20) throw new Error('1 to 20 clips');
  const clips = job.clips.map((c) => {
    if (!/^https:\/\//.test(c.url || '') && !/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(c.url || '')) throw new Error('Bad clip link');
    const kind = c.kind === 'photo' ? 'photo' : 'video';
    const inS = num(c.in, 0, 3600, 0); const out = num(c.out, inS + 0.1, 3600, inS + 3);
    return { url: c.url, kind, in: kind === 'photo' ? 0 : inS, out: kind === 'photo' ? num(out - inS, 0.3, 15, 3) : out, speed: kind === 'photo' ? 1 : num(c.speed, 0.25, 4, 1) };
  });
  const total = clips.reduce((s, c) => s + (c.out - c.in) / c.speed, 0);
  if (total > MAX_SECONDS) throw new Error('A Spark is up to 60 seconds');
  if (!job.out?.video || !job.out?.cover) throw new Error('Where to save the result is missing');
  return { ...job, clips, total };
}

let busy = Promise.resolve();
async function build(raw) {
  const job = check(raw);
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'spark-'));
  try {
    const clips = [];
    for (const [i, c] of job.clips.entries()) {
      const file = path.join(dir, `in${i}${c.kind === 'photo' ? '.img' : '.vid'}`);
      await download(c.url, file);
      clips.push({ ...c, file, hasAudio: c.kind === 'video' ? await hasAudio(file).catch(() => false) : false });
    }
    let music = null; let voice = null;
    if (job.music?.url) { const f = path.join(dir, 'music.aud'); await download(job.music.url, f); music = { file: f, start: num(job.music.start, 0, 3600, 0), volume: num(job.music.volume, 0, 2, 1) }; }
    if (job.voice?.url) { const f = path.join(dir, 'voice.aud'); await download(job.voice.url, f); voice = { file: f, volume: num(job.voice.volume, 0, 2, 1) }; }
    const out = path.join(dir, 'spark.mp4'); const cover = path.join(dir, 'cover.jpg');
    const { args, seconds } = buildArgs({ clips, music, voice, videoVolume: num(job.videoVolume, 0, 2, 1), filter: job.filter, adjust: job.adjust, zoom: job.zoom, fade: job.fade }, out);
    await run('ffmpeg', args, 10 * 60_000);
    await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(num(job.cover, 0, seconds - 0.05, 0)), '-i', out, '-frames:v', '1', '-q:v', '3', cover], 60_000);
    const bytes = await upload(job.out.video, out, 'video/mp4');
    await upload(job.out.cover, cover, 'image/jpeg');
    return { ok: true, seconds, bytes };
  } finally { await fs.rm(dir, { recursive: true, force: true }).catch(() => {}); }
}

const send = (res, code, body) => { const b = JSON.stringify(body); res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) }); res.end(b); };
const authorised = (req) => { const h = String(req.headers.authorization || ''); const a = Buffer.from(h); const b = Buffer.from(`Bearer ${TOKEN}`); return !!TOKEN && a.length === b.length && crypto.timingSafeEqual(a, b); };

http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true, name: 'soulink-builder' });
  if (req.method !== 'POST' || req.url !== '/build') return send(res, 404, { error: 'Not found' });
  if (!authorised(req)) return send(res, 401, { error: 'Not allowed' });
  let body = '';
  req.on('data', (d) => { body += d; if (body.length > 200_000) req.destroy(); });
  req.on('end', () => {
    let job; try { job = JSON.parse(body); } catch { return send(res, 400, { error: 'Bad request' }); }
    const t0 = Date.now();
    busy = busy.then(() => build(job)).then((r) => { console.log(`built ${r.seconds.toFixed(1)} s in ${((Date.now() - t0) / 1000).toFixed(1)} s`); send(res, 200, r); },
      (e) => { console.error('build failed:', e.message); send(res, 422, { error: e.message }); });
  });
}).listen(PORT, () => console.log(`Soulink video builder on :${PORT}`));
