// Soulink Studio → the video builder (builder/ on Azure Container Apps; BUILDER_URL + BUILDER_TOKEN).
// A Spark with several clips or photos, or a Soul Look, is posted as a build job (spark_builds). This runner sends the
// job to the builder with short-lived Blob links, and when the finished video is back it creates the Spark exactly
// like a normal post and tells the author. A job that fails is tried once more; then the author is told.
import crypto from 'node:crypto';
import { many, one, query } from '../db.js';
import { blobDelete, blobLink, blobOn } from '../providers/storage.js';
import { notify } from './social.js';

export const builderOn = () => blobOn() && !!process.env.BUILDER_URL && !!process.env.BUILDER_TOKEN;
const MAX_ATTEMPTS = 2;
let running = false; let timer = null; let createSpark = null;

/** routes/sparks.js hands over its createSpark (avoids an import loop) */
export function startBuilds(create) {
  createSpark = create;
  if (timer || !builderOn()) return;
  timer = setInterval(() => { runNext().catch(() => {}); }, 30_000);
  timer.unref?.();
  runNext().catch(() => {});
}
export const kickBuilds = () => { setTimeout(() => { runNext().catch(() => {}); }, 50); };

async function runNext() {
  if (running || !builderOn() || !createSpark) return;
  running = true;
  try {
    for (;;) {
      // the oldest waiting job, or one stuck "building" for 15 minutes (the server restarted mid-build)
      const job = await one(`SELECT TOP 1 * FROM spark_builds WHERE status = N'queued' OR (status = N'building' AND updated_at < DATEADD(minute, -15, SYSDATETIMEOFFSET())) ORDER BY created_at`);
      if (!job) break;
      await runJob(job);
    }
  } finally { running = false; }
}

async function runJob(job) {
  await query(`UPDATE spark_builds SET status = N'building', attempts = attempts + 1, updated_at = SYSDATETIMEOFFSET() WHERE id = $1`, [job.id]);
  const p = JSON.parse(job.payload);
  const base = crypto.randomUUID();
  const videoUrl = `/uploads/sparks/${base}.mp4`; const posterUrl = `/uploads/sparks/${base}.jpg`;
  try {
    const r = p.recipe;
    let music = null;
    if (p.files.music) music = { url: await blobLink(p.files.music, 'r', 60), start: r.music?.start || 0, volume: r.music?.volume ?? 1 };
    else if (p.musicRef) {
      const { streamUrl } = await import('./music.js');
      const u = await streamUrl(p.musicRef).catch(() => null);
      if (u) music = { url: u, start: r.music?.start || 0, volume: r.music?.volume ?? 1 };
    }
    const body = {
      clips: await Promise.all(r.clips.map(async (c, i) => ({ url: await blobLink(p.files.clips[i], 'r', 60), kind: c.kind, in: c.in, out: c.out, speed: c.speed || 1 }))),
      ...(music ? { music } : {}),
      ...(p.files.voice ? { voice: { url: await blobLink(p.files.voice, 'r', 60), volume: r.voice?.volume ?? 1 } } : {}),
      videoVolume: r.videoVolume ?? 1, filter: r.filter, adjust: r.adjust, zoom: r.zoom, fade: r.fade, cover: r.cover || 0,
      out: { video: await blobLink(videoUrl, 'cw', 60), cover: await blobLink(posterUrl, 'cw', 60) },
    };
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12 * 60_000);
    let res;
    try { res = await fetch(`${process.env.BUILDER_URL.replace(/\/$/, '')}/build`, { method: 'POST', signal: ctrl.signal, headers: { Authorization: `Bearer ${process.env.BUILDER_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
    finally { clearTimeout(t); }
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || `The builder answered ${res.status}`);

    // the sound, the look, the crop and the fades are in the video now: only text, stickers and the cover stay as edits
    const edit = p.details?.edit || {};
    const keep = { ...(edit.texts ? { texts: edit.texts } : {}), ...(edit.stickers ? { stickers: edit.stickers } : {}), ...(edit.cover != null ? { cover: edit.cover } : {}), studio: r, poster: posterUrl };
    const sparkId = await createSpark(job.author_id, { ...p.post, details: { ...(p.details || {}), edit: keep }, videoUrl, musicUrl: null });
    await query(`UPDATE spark_builds SET status = N'done', spark_id = $2, error = NULL, updated_at = SYSDATETIMEOFFSET() WHERE id = $1`, [job.id, sparkId]);
    for (const f of [...p.files.clips, p.files.music, p.files.voice].filter(Boolean)) blobDelete(f).catch(() => {}); // the uploaded pieces aren't needed now
    await notify(job.author_id, null, 'spark_ready', sparkId, { seconds: Math.round(out.seconds || 0) }).catch(() => {});
  } catch (e) {
    const last = job.attempts + 1 >= MAX_ATTEMPTS;
    await query(`UPDATE spark_builds SET status = $2, error = $3, updated_at = SYSDATETIMEOFFSET() WHERE id = $1`, [job.id, last ? 'failed' : 'queued', String(e.message || e).slice(0, 400)]);
    blobDelete(videoUrl).catch(() => {}); blobDelete(posterUrl).catch(() => {});
    if (last) await notify(job.author_id, null, 'spark_build_failed', null, {}).catch(() => {});
  }
}

/** my Sparks still being put together (or that failed) in the last day */
export async function myBuilds(userId) {
  const rows = await many(`SELECT TOP 10 id, status, error, created_at FROM spark_builds WHERE author_id = $1 AND status <> N'done' AND created_at > DATEADD(day, -1, SYSDATETIMEOFFSET()) ORDER BY created_at DESC`, [userId]);
  return rows.map((x) => ({ id: x.id, status: x.status, createdAt: x.created_at, ...(x.status === 'failed' ? { error: "Your Spark couldn't be put together. Try posting it again." } : {}) }));
}
