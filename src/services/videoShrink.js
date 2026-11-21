// Makes posted Spark videos small and quick to start. Phones record at full quality (a 30 s clip can be 40+ MB),
// which takes far too long to load on mobile data. After a Spark is posted, the video builder (builder/, /compress)
// turns its video into 720p H.264, at most 30 frames a second, with the index at the front so it plays while it
// downloads, plus a cover picture. Then the Spark points at the small file and the big one is removed.
// Newest Sparks first, one at a time; older Sparks are worked through in the background. Needs the builder
// (BUILDER_URL + BUILDER_TOKEN) and Blob storage, like Soulink Studio. A video that's already small is left as it is.
import crypto from 'node:crypto';
import { one, query } from '../db.js';
import { blobLink, blobOn, fileSize, inBlob, removeFile } from '../providers/storage.js';
import { signPath } from '../lib/fileLinks.js';

export const SHRINK_OVER_BYTES = 6 * 1024 * 1024; // smaller than this already starts quickly
const VIDEO = /\.(mp4|mov|m4v|webm|3gp|mkv)$/i;
const MAX_TRIES = 3;
const on = () => blobOn() && !!process.env.BUILDER_URL && !!process.env.BUILDER_TOKEN;
let running = false; let timer = null;

export function startShrinking() {
  if (timer || !on()) return;
  timer = setInterval(() => { runShrinks().catch(() => {}); }, 60_000);
  timer.unref?.();
  setTimeout(() => { runShrinks().catch(() => {}); }, 20_000).unref?.();
}
/** a Spark was just posted: start on it now */
export const kickShrink = () => { if (on()) setTimeout(() => { runShrinks().catch(() => {}); }, 2_000); };

/** Where the builder can read a file: Blob directly, or (a file from before Blob) this server's own signed link. */
async function readLink(url) {
  if (await inBlob(url)) return blobLink(url, 'r', 30);
  const base = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
  if (!base) throw new Error('No public address for this server (PUBLIC_URL)');
  return `${base}${signPath(url, null, 1800)}`;
}

export async function runShrinks() {
  if (running || !on()) return;
  running = true;
  try {
    for (let n = 0; n < 20; n += 1) { // at most 20 a round, then a breather
      const s = await one(`SELECT TOP 1 id, video_url, details, shrink_tries FROM sparks
        WHERE shrunk_at IS NULL AND shrink_tries < ${MAX_TRIES} AND is_voice = 0 AND video_url LIKE N'/uploads/%'
        ORDER BY created_at DESC`);
      if (!s) break;
      await shrinkOne(s);
    }
  } finally { running = false; }
}

async function done(id, extra = '') { await query(`UPDATE sparks SET shrunk_at = SYSDATETIMEOFFSET()${extra} WHERE id = $1`, [id]); }

async function shrinkOne(s) {
  const url = s.video_url;
  if (!VIDEO.test(url)) return done(s.id); // a photo Spark: nothing to do
  const size = await fileSize(url).catch(() => null);
  if (size == null) return query('UPDATE sparks SET shrink_tries = shrink_tries + 1 WHERE id = $1', [s.id]); // not found (yet): try later
  if (size <= SHRINK_OVER_BYTES) return done(s.id);
  await query('UPDATE sparks SET shrink_tries = shrink_tries + 1 WHERE id = $1', [s.id]);

  const base = crypto.randomUUID();
  const videoUrl = `/uploads/sparks/${base}.mp4`; const posterUrl = `/uploads/sparks/${base}.jpg`;
  try {
    const body = { in: await readLink(url), out: { video: await blobLink(videoUrl, 'cw', 60), cover: await blobLink(posterUrl, 'cw', 60) } };
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12 * 60_000);
    let res;
    try { res = await fetch(`${process.env.BUILDER_URL.replace(/\/$/, '')}/compress`, { method: 'POST', signal: ctrl.signal, headers: { Authorization: `Bearer ${process.env.BUILDER_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
    finally { clearTimeout(t); }
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || `The builder answered ${res.status}`);
    if (!out.bytes || out.bytes >= size * 0.9) { // didn't get meaningfully smaller: keep the original
      await removeFile(videoUrl); await removeFile(posterUrl);
      return done(s.id);
    }
    // point the Spark at the small file (only if nobody changed the video meanwhile), keep its cover, then remove the big one
    let details = {}; try { details = JSON.parse(s.details || '{}') || {}; } catch { details = {}; }
    const edit = details.edit || {};
    const next = JSON.stringify({ ...details, edit: { ...edit, poster: edit.poster || posterUrl }, shrunk: { from: size, to: out.bytes } });
    const r = await query(`UPDATE sparks SET video_url = $2, details = $3, shrunk_at = SYSDATETIMEOFFSET() WHERE id = $1 AND video_url = $4`, [s.id, videoUrl, next, url]);
    if (!r.rowCount) { await removeFile(videoUrl); await removeFile(posterUrl); return; }
    if (edit.poster) await removeFile(posterUrl); // it already had a cover
    await removeFile(url);
  } catch (e) {
    await removeFile(videoUrl).catch(() => {}); await removeFile(posterUrl).catch(() => {});
    console.warn(`[shrink] ${s.id}: ${String(e.message || e).slice(0, 200)}`);
  }
}

/** For the team console: how far the background work has got. */
export async function shrinkStatus() {
  const r = await one(`SELECT SUM(CASE WHEN shrunk_at IS NOT NULL THEN 1 ELSE 0 END) AS done,
    SUM(CASE WHEN shrunk_at IS NULL AND shrink_tries < ${MAX_TRIES} AND is_voice = 0 THEN 1 ELSE 0 END) AS waiting,
    SUM(CASE WHEN shrunk_at IS NULL AND shrink_tries >= ${MAX_TRIES} THEN 1 ELSE 0 END) AS gave_up FROM sparks`);
  return { on: on(), done: Number(r?.done || 0), waiting: Number(r?.waiting || 0), gaveUp: Number(r?.gave_up || 0) };
}
export const _test = { shrinkOne, readLink };
