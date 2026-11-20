// Account Data & Backup: "Download My Data" as a ZIP (profile, posts, Sparks, photos, videos) and "Restore My Data".
//
// Export: a background job lists everything that is the person's own (never other people's likes or comments),
// computes a SHA-256 for every file and signs the manifest (lib/exportSign.js). The ZIP itself is built while it
// downloads (streamed, nothing stored), through an authenticated link that stops working after 7 days.
//
// Restore: the uploaded ZIP is checked first (safe file names, sizes, signature, every checksum, and that the backup
// belongs to this account by its verified email or phone), then a plan is shown; nothing changes until the person
// confirms. Then, in the background:
//   - posts / Sparks that still exist are left alone (no duplicates, nothing newer is overwritten);
//   - posts / Sparks the person deleted come back, with the likes and comments still on Soulink, but only from
//     people who are still their Connections, still active, and not blocked either way. Everything else on them is
//     removed (likes) or hidden (comments), so counts only ever reflect eligible interactions;
//   - posts / Sparks that are gone (the account was deleted and re-created) are recreated from the backup with their
//     original photos, videos, captions and dates, without likes or comments (the backup holds none: own content only);
//   - profile fields are filled only where they are empty now; Soul DNA only if there is none.
// Re-running the same restore is safe: everything is matched by its original id.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import yazl from 'yazl';
import yauzl from 'yauzl';
import { many, one, query } from '../db.js';
import { ensureLocal, saveFile } from '../providers/storage.js';
import { signExport, verifyExport } from '../lib/exportSign.js';
import { exportAccount } from './account.js';
import { audit } from './audit.js';
import { HttpError } from '../lib/errors.js';
import { QUESTIONS, isComplete, validAnswer } from './soulDna.js';
import { saveCompletedDna } from './soulStore.js';

const QMAP = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

export const FORMAT = 2;                       // backup format written now; 1 = the old JSON-only download
export const EXPIRE_DAYS = 7;
export const MAX_BACKUP_BYTES = 300 * 1024 * 1024;   // free hosting: keep backups under this (raise on a paid plan)
export const MAX_UPLOAD_BYTES = 320 * 1024 * 1024;
const MAX_FILE_BYTES = 150 * 1024 * 1024;
const MAX_ENTRIES = 5000;
const ROOT = 'Soulink_Backup/';
export const RESTORE_DIR = path.join(os.tmpdir(), 'soulink-restore');

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic', 'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm', 'video/x-m4v': '.m4v', 'video/3gpp': '.3gp', 'audio/mp4': '.m4a', 'audio/aac': '.aac', 'audio/mpeg': '.mp3' };
const MIME = Object.fromEntries(Object.entries(EXT).map(([m, e]) => [e, m]));
MIME['.jpeg'] = 'image/jpeg';
const extOf = (url) => (path.extname(String(url).split('?')[0]).toLowerCase() || '.bin');
const isVideo = (url) => ['.mp4', '.mov', '.webm', '.m4v', '.3gp'].includes(extOf(url));
const list = (v) => (Array.isArray(v) ? v : (() => { try { return JSON.parse(v || '[]'); } catch { return []; } })());
const iso = (d) => (d ? new Date(d).toISOString() : null);
const sameText = (a, b) => !!a && !!b && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
const appVersion = () => process.env.npm_package_version || '1.0.0';

async function setJob(id, fields) {
  const keys = Object.keys(fields);
  await query(`UPDATE account_backups SET ${keys.map((k, i) => `${k}=$${i + 2}`).join(', ')} WHERE id=$1`, [id, ...keys.map((k) => fields[k])]);
}
const fail = (id, message) => setJob(id, { status: 'failed', error: String(message).slice(0, 400), finished_at: new Date() }).catch(() => {});

async function sha256OfFile(file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256'); let bytes = 0;
    fs.createReadStream(file).on('data', (c) => { h.update(c); bytes += c.length; }).on('error', reject).on('end', () => resolve({ sha256: h.digest('hex'), bytes }));
  });
}
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// ===================================================================== export

/** Starts an export (or returns the one already being made). */
export async function startExport(user) {
  const busy = await one(`SELECT TOP 1 * FROM account_backups WHERE user_id=$1 AND kind=N'export' AND status IN (N'queued', N'running') ORDER BY created_at DESC`, [user.id]);
  if (busy) return busy;
  const job = await one(`INSERT INTO account_backups (user_id, kind, status, stage) OUTPUT INSERTED.* VALUES ($1, N'export', N'queued', N'Getting ready')`, [user.id]);
  setImmediate(() => buildExport(job.id, user.id).catch((e) => fail(job.id, e.message)));
  return job;
}

async function buildExport(jobId, userId) {
  await setJob(jobId, { status: 'running', stage: 'Collecting your profile and posts', progress: 5 });
  const user = await one('SELECT * FROM users WHERE id=$1', [userId]);
  if (!user) throw new Error('Account not found');
  const legacy = await exportAccount(userId); // read for Soul DNA and birth date only (its lists name other people, so it isn't copied in)
  const posts = await many(`SELECT * FROM posts WHERE author_id=$1 AND deleted_at IS NULL ORDER BY created_at`, [userId]);
  const sparks = await many(`SELECT * FROM sparks WHERE author_id=$1 AND deleted_at IS NULL ORDER BY created_at`, [userId]);
  const moments = await many(`SELECT id, media_url, created_at, expires_at FROM moments WHERE author_id=$1 AND expires_at > SYSDATETIMEOFFSET() AND media_url IS NOT NULL`, [userId]).catch(() => []);
  const counts = async (sql, ids) => {
    const m = {};
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      if (!chunk.length) continue;
      const rows = await many(sql.replace('@IDS', chunk.map((_, k) => `$${k + 1}`).join(',')), chunk);
      for (const r of rows) m[String(r.id).toLowerCase()] = { likes: Number(r.likes || 0), comments: Number(r.comments || 0) };
    }
    return m;
  };
  const postCounts = await counts(`SELECT p.id, (SELECT COUNT(*) FROM post_likes l WHERE l.post_id=p.id) AS likes,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id AND c.deleted_at IS NULL) AS comments FROM posts p WHERE p.id IN (@IDS)`, posts.map((p) => p.id));
  const sparkCounts = await counts(`SELECT s.id, (SELECT COUNT(*) FROM spark_reactions r WHERE r.spark_id=s.id) AS likes,
      (SELECT COUNT(*) FROM spark_comments c WHERE c.spark_id=s.id AND c.deleted_at IS NULL) AS comments FROM sparks s WHERE s.id IN (@IDS)`, sparks.map((s) => s.id));
  const myLikes = await many(`SELECT post_id, created_at FROM post_likes WHERE user_id=$1`, [userId]).catch(() => []);
  const myComments = await many(`SELECT id, post_id, parent_id, body, created_at FROM comments WHERE author_id=$1 AND deleted_at IS NULL`, [userId]).catch(() => []);
  const mySparkComments = await many(`SELECT id, spark_id, parent_id, body, created_at FROM spark_comments WHERE author_id=$1 AND deleted_at IS NULL`, [userId]).catch(() => []);
  const rel = await one(`SELECT (SELECT COUNT(*) FROM connections WHERE user_a=$1 OR user_b=$1) AS connections,
      (SELECT COUNT(*) FROM follows WHERE followee_id=$1 AND status=N'accepted') AS followers,
      (SELECT COUNT(*) FROM follows WHERE follower_id=$1 AND status=N'accepted') AS following`, [userId]).catch(() => ({}));

  // media to include: path in the ZIP -> where it is stored on Soulink
  const sources = {}; const missing = [];
  const addMedia = (zipPath, url) => { if (url && String(url).startsWith('/uploads/')) { sources[zipPath] = String(url).split('?')[0]; return zipPath; } return null; };
  const avatarPath = user.avatar_url ? addMedia(`account/avatar${extOf(user.avatar_url)}`, user.avatar_url) : null;
  const postsOut = posts.map((p) => {
    const media = list(p.media_urls).map((u, i) => {
      const file = addMedia(`media/${isVideo(u) ? 'videos' : 'images'}/post_${String(p.id).toLowerCase()}_${i + 1}${extOf(u)}`, u);
      return file ? { file, type: isVideo(u) ? 'video' : 'image', order: i + 1 } : null;
    }).filter(Boolean);
    const c = postCounts[String(p.id).toLowerCase()] || { likes: 0, comments: 0 };
    return { id: String(p.id).toLowerCase(), caption: p.caption || '', createdAt: iso(p.created_at), place: p.place || null, musicTitle: p.music_title || null,
      hideLikes: !!p.hide_likes, commentsOff: !!p.comments_off, archived: !!p.archived_at, pinned: !!p.pinned_at,
      removedByModeration: p.suspended_at ? (p.suspended_reason || 'suspended') : null, media, likeCountAtExport: c.likes, commentCountAtExport: c.comments };
  });
  const sparksOut = sparks.map((s) => {
    const file = addMedia(`media/videos/spark_${String(s.id).toLowerCase()}${extOf(s.video_url)}`, s.video_url);
    const c = sparkCounts[String(s.id).toLowerCase()] || { likes: 0, comments: 0 };
    return { id: String(s.id).toLowerCase(), category: s.category, caption: s.caption || '', createdAt: iso(s.created_at), place: s.place || null, musicTitle: s.music_title || null,
      micTopic: s.mic_topic || null, isVoice: !!s.is_voice, oneTake: !!s.one_take, removedByModeration: s.suspended_at ? (s.suspended_reason || 'suspended') : null,
      media: file ? [{ file, type: 'video', order: 1 }] : [], likeCountAtExport: c.likes, commentCountAtExport: c.comments };
  });
  const momentsOut = moments.map((m) => ({ id: String(m.id).toLowerCase(), createdAt: iso(m.created_at), file: addMedia(`media/moments/moment_${String(m.id).toLowerCase()}${extOf(m.media_url)}`, m.media_url) }));

  // checksums of every media file (and drop files that are no longer on the server)
  const paths = Object.keys(sources);
  const files = []; let total = 0;
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    if (i % 5 === 0) await setJob(jobId, { stage: `Checking your photos and videos (${i + 1} of ${paths.length})`, progress: 10 + Math.round((i / Math.max(1, paths.length)) * 75) });
    try {
      const local = await ensureLocal(sources[p]);
      const { sha256: h, bytes } = await sha256OfFile(local);
      if (bytes > MAX_FILE_BYTES) { missing.push({ file: p, reason: 'too_big' }); delete sources[p]; continue; }
      files.push({ path: p, sha256: h, bytes }); total += bytes;
    } catch { missing.push({ file: p, reason: 'not_found' }); delete sources[p]; }
  }
  const missingSet = new Set(missing.map((m) => m.file));
  for (const p of postsOut) p.media = p.media.filter((m) => !missingSet.has(m.file));
  for (const s of sparksOut) s.media = s.media.filter((m) => !missingSet.has(m.file));

  const exportedAt = new Date().toISOString();
  const profile = legacy?.profile || {};
  const docs = {
    'account/profile.json': { id: String(user.id).toLowerCase(), username: user.username, displayName: user.display_name, bio: user.bio, city: user.city, profession: user.profession,
      gender: user.gender, interests: list(user.interests), languages: list(user.languages), isCreator: !!user.is_creator, isPrivate: !!user.is_private,
      avatar: avatarPath && !missingSet.has(avatarPath) ? avatarPath : null, createdAt: iso(user.created_at) },
    'account/account_metadata.json': { email: user.email || null, phone: user.phone || null, emailVerified: !!user.email_verified_at, birthDate: profile.birth_date || null, termsVersion: user.terms_version || null, soulDna: legacy?.soulDna || null },
    'posts/posts.json': postsOut,
    'sparks/sparks.json': sparksOut,
    'moments/moments.json': momentsOut.filter((m) => m.file && !missingSet.has(m.file)),
    'interactions/likes.json': myLikes.map((l) => ({ postId: String(l.post_id).toLowerCase(), likedAt: iso(l.created_at) })),
    'interactions/comments.json': [...myComments.filter((c) => !c.parent_id).map((c) => ({ id: String(c.id).toLowerCase(), postId: String(c.post_id).toLowerCase(), text: c.body, createdAt: iso(c.created_at) })),
      ...mySparkComments.filter((c) => !c.parent_id).map((c) => ({ id: String(c.id).toLowerCase(), sparkId: String(c.spark_id).toLowerCase(), text: c.body, createdAt: iso(c.created_at) }))],
    'interactions/replies.json': [...myComments.filter((c) => c.parent_id).map((c) => ({ id: String(c.id).toLowerCase(), postId: String(c.post_id).toLowerCase(), parentId: String(c.parent_id).toLowerCase(), text: c.body, createdAt: iso(c.created_at) })),
      ...mySparkComments.filter((c) => c.parent_id).map((c) => ({ id: String(c.id).toLowerCase(), sparkId: String(c.spark_id).toLowerCase(), parentId: String(c.parent_id).toLowerCase(), text: c.body, createdAt: iso(c.created_at) }))],
    'metadata/relationships.json': { note: 'Counts only. Other people’s details are not part of your backup.', connections: Number(rel?.connections || 0), followers: Number(rel?.followers || 0), following: Number(rel?.following || 0) },
    'metadata/export_information.json': { exportedAt, formatVersion: FORMAT, contains: 'Your own profile, posts, Sparks, photos, videos, Moments that are still up, and the likes and comments you made. Other people’s likes and comments on your posts are not included (only their counts). Face data, passwords and login codes are never included.', missing },
  };
  const docBufs = Object.fromEntries(Object.entries(docs).map(([p, v]) => [p, Buffer.from(JSON.stringify(v, null, 2))]));
  for (const [p, b] of Object.entries(docBufs)) { files.push({ path: p, sha256: sha256(b), bytes: b.length }); total += b.length; }
  if (total > MAX_BACKUP_BYTES) throw new Error(`This backup would be ${Math.round(total / 1048576)} MB; the limit for now is ${Math.round(MAX_BACKUP_BYTES / 1048576)} MB.`);

  const manifest = signExport({
    soulinkBackup: true, formatVersion: FORMAT, appVersion: appVersion(), exportedAt,
    account: { id: String(user.id).toLowerCase(), username: user.username, email: user.email || null, phone: user.phone || null },
    counts: { posts: postsOut.length, sparks: sparksOut.length, photos: files.filter((f) => f.path.startsWith('media/images/')).length,
      videos: files.filter((f) => f.path.startsWith('media/videos/')).length, moments: docs['moments/moments.json'].length,
      likesOnYourPosts: postsOut.reduce((s, p) => s + p.likeCountAtExport, 0) + sparksOut.reduce((s, p) => s + p.likeCountAtExport, 0),
      commentsOnYourPosts: postsOut.reduce((s, p) => s + p.commentCountAtExport, 0) + sparksOut.reduce((s, p) => s + p.commentCountAtExport, 0),
      likesYouGave: docs['interactions/likes.json'].length, commentsYouWrote: docs['interactions/comments.json'].length + docs['interactions/replies.json'].length },
    files,
  });
  await setJob(jobId, {
    status: 'ready', stage: 'Ready to download', progress: 100, size_bytes: total, finished_at: new Date(),
    expires_at: new Date(Date.now() + EXPIRE_DAYS * 86400_000),
    manifest: JSON.stringify({ manifest, sources, docs: Object.fromEntries(Object.entries(docBufs).map(([p, b]) => [p, b.toString('base64')])) }),
  });
  await audit(null, 'data_export', { actorId: userId, targetUserId: userId, detail: `backup v${FORMAT} ${files.length} files ${total} bytes` });
}

/** Streams the ZIP for a ready export. Content-Length is set so phones can show progress. */
export async function streamExport(job, user, res) {
  const stored = JSON.parse(job.manifest);
  const { manifest, sources, docs } = stored;
  const zip = new yazl.ZipFile();
  const mtime = new Date(manifest.exportedAt);
  zip.addBuffer(Buffer.from(JSON.stringify(manifest, null, 2)), `${ROOT}backup_manifest.json`, { mtime, compress: false });
  for (const [p, b64] of Object.entries(docs)) zip.addBuffer(Buffer.from(b64, 'base64'), ROOT + p, { mtime, compress: false });
  for (const f of manifest.files) {
    if (!sources[f.path]) continue;
    const url = sources[f.path];
    const open = (cb) => { ensureLocal(url).then((local) => cb(null, fs.createReadStream(local)), (e) => cb(e)); };
    if (typeof zip.addReadStreamLazy === 'function') zip.addReadStreamLazy(ROOT + f.path, { mtime, size: f.bytes, compress: false }, open);
    else zip.addReadStream(fs.createReadStream(await ensureLocal(url)), ROOT + f.path, { mtime, size: f.bytes, compress: false });
  }
  const day = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="Soulink_Backup_${String(user.username || 'account').replace(/[^a-zA-Z0-9._-]/g, '')}_${day}.zip"`);
  res.setHeader('Cache-Control', 'private, no-store');
  zip.end({}, (finalSize) => { if (finalSize > 0 && !res.headersSent) res.setHeader('Content-Length', String(finalSize)); });
  zip.outputStream.on('error', () => res.destroy());
  zip.outputStream.pipe(res);
}

// ===================================================================== restore: reading the ZIP safely

/** Opens the ZIP and indexes its entries, refusing unsafe or oversized archives. */
function openZip(file) {
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true, autoClose: false, validateEntrySizes: true, strictFileNames: true, decodeStrings: true }, (err, zip) => {
      if (err) return reject(bad('This file is not a valid ZIP.', 'restore_not_zip'));
      const entries = new Map(); let total = 0;
      zip.on('entry', (e) => {
        const name = e.fileName;
        if (entries.size >= MAX_ENTRIES) { zip.close(); return reject(bad('This backup has too many files.', 'restore_too_many')); }
        // no absolute paths, no "..", no drive letters: nothing can be written outside where we put it
        if (name.startsWith('/') || /(^|\/)\.\.(\/|$)/.test(name) || /^[a-zA-Z]:/.test(name) || name.includes('\0')) { zip.close(); return reject(bad('This file contains unsafe paths.', 'restore_unsafe')); }
        total += e.uncompressedSize;
        const ratio = e.compressedSize ? e.uncompressedSize / e.compressedSize : 1;
        if (e.uncompressedSize > MAX_FILE_BYTES || total > MAX_BACKUP_BYTES * 1.2 || ratio > 200) { zip.close(); return reject(bad('This backup is too large to restore.', 'restore_too_big', 413)); }
        if (!name.endsWith('/')) entries.set(name.startsWith(ROOT) ? name.slice(ROOT.length) : name, e);
        zip.readEntry();
      });
      zip.on('end', () => resolve({ zip, entries }));
      zip.on('error', (e) => reject(bad(`This ZIP is damaged (${e.message}).`, 'restore_damaged')));
      zip.readEntry();
    });
  });
}
function readEntry(zip, entry, max = MAX_FILE_BYTES) {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (err, s) => {
      if (err) return reject(err);
      const parts = []; let n = 0;
      s.on('data', (c) => { n += c.length; if (n > max) { s.destroy(); reject(new Error('File too large')); } else parts.push(c); });
      s.on('end', () => resolve(Buffer.concat(parts)));
      s.on('error', reject);
    });
  });
}
const readJson = async (zip, entries, p) => { const e = entries.get(p); if (!e) return null; return JSON.parse((await readEntry(zip, e, 50 * 1024 * 1024)).toString('utf8')); };
const closeZip = (z) => { try { z?.close(); } catch { /* ignore */ } };
const bad = (message, code, status = 400) => new HttpError(status, message, code);

// ===================================================================== restore: eligibility of other people's interactions

// someone else's like / comment on a restored item stays only if, right now: their account exists and is active,
// they are this person's Connection, and neither has blocked the other (checked against the database, never the file)
const ELIGIBLE = (col, me) => `${col} = ${me} OR (
    EXISTS (SELECT 1 FROM users bk_u WHERE bk_u.id = ${col} AND bk_u.deactivated_at IS NULL)
    AND EXISTS (SELECT 1 FROM connections bk_c WHERE (bk_c.user_a = ${col} AND bk_c.user_b = ${me}) OR (bk_c.user_a = ${me} AND bk_c.user_b = ${col}))
    AND NOT EXISTS (SELECT 1 FROM blocks bk_b WHERE (bk_b.blocker_id = ${col} AND bk_b.blocked_id = ${me}) OR (bk_b.blocker_id = ${me} AND bk_b.blocked_id = ${col})))`;
const KIND = {
  post: { table: 'posts', likes: 'post_likes', likeKey: 'post_id', comments: 'comments', commentKey: 'post_id' },
  spark: { table: 'sparks', likes: 'spark_reactions', likeKey: 'spark_id', comments: 'spark_comments', commentKey: 'spark_id' },
};
async function interactionCounts(kind, id, me) {
  const k = KIND[kind];
  const r = await one(`SELECT
      (SELECT COUNT(*) FROM ${k.likes} l WHERE l.${k.likeKey} = $1 AND (${ELIGIBLE('l.user_id', '$2')})) AS likes_ok,
      (SELECT COUNT(*) FROM ${k.likes} l WHERE l.${k.likeKey} = $1 AND NOT (${ELIGIBLE('l.user_id', '$2')})) AS likes_skip,
      (SELECT COUNT(*) FROM ${k.comments} c WHERE c.${k.commentKey} = $1 AND c.deleted_at IS NULL AND (${ELIGIBLE('c.author_id', '$2')})) AS comments_ok,
      (SELECT COUNT(*) FROM ${k.comments} c WHERE c.${k.commentKey} = $1 AND c.deleted_at IS NULL AND NOT (${ELIGIBLE('c.author_id', '$2')})) AS comments_skip`, [id, me]);
  return { likesOk: Number(r.likes_ok), likesSkip: Number(r.likes_skip), commentsOk: Number(r.comments_ok), commentsSkip: Number(r.comments_skip) };
}
/** Removes ineligible likes and hides ineligible comments (and replies under them) on one of this person's items. */
async function pruneInteractions(kind, id, me) {
  const k = KIND[kind];
  await query(`DELETE FROM ${k.likes} WHERE ${k.likeKey} = $1 AND NOT (${ELIGIBLE(`${k.likes}.user_id`, '$2')})`, [id, me]);
  const hidden = await many(`UPDATE ${k.comments} SET deleted_at = SYSDATETIMEOFFSET() OUTPUT INSERTED.id
    WHERE ${k.commentKey} = $1 AND deleted_at IS NULL AND NOT (${ELIGIBLE(`${k.comments}.author_id`, '$2')})`, [id, me]);
  if (hidden.length) {
    await query(`UPDATE ${k.comments} SET deleted_at = SYSDATETIMEOFFSET() WHERE ${k.commentKey} = $1 AND deleted_at IS NULL
      AND parent_id IN (SELECT id FROM ${k.comments} WHERE ${k.commentKey} = $1 AND deleted_at IS NOT NULL)`, [id]);
  }
}

// ===================================================================== restore: validate + plan

/** Checks an uploaded backup and works out what a restore would do. Throws { code, message } when it can't be used. */
export async function validateRestore(file, user) {
  let z = null;
  try {
    const { zip, entries } = await openZip(file); z = zip;
    const manifest = await readJson(zip, entries, 'backup_manifest.json').catch(() => null);
    if (!manifest) throw bad('This is not a Soulink backup (no backup_manifest.json).', 'restore_not_soulink');
    if (!verifyExport(manifest)) throw bad("This backup isn't genuine or was changed. Use the ZIP exactly as you downloaded it.", 'restore_invalid');
    if (!Number.isInteger(manifest.formatVersion) || manifest.formatVersion < 2) throw bad('This backup format is too old for this screen. Older JSON downloads can still be restored: choose the .json file.', 'restore_old_format');
    if (manifest.formatVersion > FORMAT) throw bad('This backup was made by a newer Soulink. Update the app, then try again.', 'restore_newer_format');
    const acc = manifest.account || {};
    // the same account, or (after deleting and re-joining) the same verified email or phone number
    const mine = String(acc.id || '').toLowerCase() === String(user.id).toLowerCase()
      || (sameText(acc.email, user.email) && !!user.email_verified_at) || sameText(acc.phone, user.phone);
    if (!mine) throw bad('This backup belongs to a different account (its email and phone number don’t match your verified ones).', 'restore_not_yours', 403);
    // every file must be present and unchanged
    for (const f of manifest.files || []) {
      const e = entries.get(f.path);
      if (!e) throw bad(`The backup is incomplete (${f.path} is missing).`, 'restore_incomplete');
      if (e.uncompressedSize !== f.bytes) throw bad(`The backup is damaged (${f.path} has the wrong size).`, 'restore_damaged');
      const h = await new Promise((resolve, reject) => zip.openReadStream(e, (err, s) => {
        if (err) return reject(err);
        const hash = crypto.createHash('sha256'); s.on('data', (c) => hash.update(c)); s.on('end', () => resolve(hash.digest('hex'))); s.on('error', reject);
      }));
      if (h !== f.sha256) throw bad(`The backup is damaged (${f.path} doesn't match its checksum).`, 'restore_damaged');
    }
    const posts = (await readJson(zip, entries, 'posts/posts.json')) || [];
    const sparks = (await readJson(zip, entries, 'sparks/sparks.json')) || [];
    const profile = (await readJson(zip, entries, 'account/profile.json')) || {};
    const meta = (await readJson(zip, entries, 'account/account_metadata.json')) || {};
    const plan = { posts: [], sparks: [], profileFields: [], avatar: false, soulDna: false };
    const summary = { postsToRestore: 0, photosToRestore: 0, videosToRestore: 0, postsBroughtBack: 0, duplicatesSkipped: 0, removedByModeration: 0,
      likesEligible: 0, commentsEligible: 0, interactionsExcluded: 0, conflicts: [] };
    for (const [kind, items] of [['post', posts], ['spark', sparks]]) {
      const k = KIND[kind];
      for (const it of items) {
        const id = String(it.id || '').toLowerCase();
        if (!/^[0-9a-f-]{36}$/.test(id)) continue;
        if (it.removedByModeration) { summary.removedByModeration++; continue; } // takedowns are never undone by a backup
        const row = await one(`SELECT id, author_id, deleted_at, suspended_at FROM ${k.table} WHERE id=$1`, [id]);
        let action;
        if (!row) action = 'recreate';
        else if (String(row.author_id).toLowerCase() !== String(user.id).toLowerCase()) action = 'recreate_new_id';
        else if (row.suspended_at) { summary.removedByModeration++; continue; }
        else if (!row.deleted_at) { summary.duplicatesSkipped++; continue; }
        else action = 'bring_back';
        const media = (it.media || []).filter((m) => entries.has(m.file));
        if (action === 'bring_back') {
          const c = await interactionCounts(kind, id, user.id);
          summary.postsBroughtBack++; summary.likesEligible += c.likesOk; summary.commentsEligible += c.commentsOk; summary.interactionsExcluded += c.likesSkip + c.commentsSkip;
        } else {
          summary.postsToRestore++;
          summary.photosToRestore += media.filter((m) => m.type === 'image').length; summary.videosToRestore += media.filter((m) => m.type === 'video').length;
          if (action === 'recreate_new_id') summary.conflicts.push(`A ${kind} id in the backup is used by someone else's content; it will be restored as a new ${kind}.`);
          if (kind === 'spark' && !media.length) { summary.postsToRestore--; continue; }
          if (kind === 'post' && !media.length && !String(it.caption || '').trim()) { summary.postsToRestore--; continue; }
        }
        (kind === 'post' ? plan.posts : plan.sparks).push({ id, action, item: { ...it, media } });
      }
    }
    // profile: only fill what is empty now (newer details are never overwritten)
    const fields = { display_name: profile.displayName, bio: profile.bio, city: profile.city, profession: profile.profession, gender: profile.gender };
    for (const [col, v] of Object.entries(fields)) if (v && !user[col]) plan.profileFields.push(col);
    if (profile.avatar && entries.has(profile.avatar) && !user.avatar_url) plan.avatar = true;
    const dna = await one('SELECT TOP 1 user_id FROM soul_dna WHERE user_id=$1', [user.id]);
    if (!dna && meta.soulDna?.answers && Object.keys(meta.soulDna.answers).length) plan.soulDna = true;
    summary.profileFieldsToFill = plan.profileFields.length + (plan.avatar ? 1 : 0);
    summary.soulDna = plan.soulDna;
    return { manifest: { exportedAt: manifest.exportedAt, formatVersion: manifest.formatVersion, counts: manifest.counts }, plan, summary, profile, meta };
  } finally { closeZip(z); }
}

// ===================================================================== restore: run

export async function runRestore(jobId, user, file, req) {
  const job = await one('SELECT * FROM account_backups WHERE id=$1', [jobId]);
  const stored = JSON.parse(job.manifest);
  const { plan, profile, meta } = stored;
  const result = { postsRestored: 0, photosRestored: 0, videosRestored: 0, sparksRestored: 0, broughtBack: 0, likesRestored: 0, commentsRestored: 0,
    interactionsSkipped: 0, duplicatesSkipped: stored.summary?.duplicatesSkipped || 0, notRecovered: [] };
  let z = null;
  const stage = (s, progress) => setJob(jobId, { stage: s, progress }).catch(() => {});
  try {
    await setJob(jobId, { status: 'running', stage: 'Validating backup', progress: 2 });
    const { zip, entries } = await openZip(file); z = zip;
    await stage('Verifying account ownership', 5);
    await stage('Restoring profile information', 8);
    if (plan.profileFields.length) {
      const vals = [user.id]; const sets = [];
      const map = { display_name: profile.displayName, bio: profile.bio, city: profile.city, profession: profile.profession, gender: profile.gender };
      const LIMIT = { display_name: 50, bio: 300, city: 60, profession: 80, gender: 20 };
      for (const col of plan.profileFields) { vals.push(String(map[col]).slice(0, LIMIT[col])); sets.push(`${col} = CASE WHEN ${col} IS NULL OR ${col} = N'' THEN $${vals.length} ELSE ${col} END`); }
      await query(`UPDATE users SET ${sets.join(', ')}, updated_at = SYSDATETIMEOFFSET() WHERE id=$1`, vals).catch(() => result.notRecovered.push('some profile details'));
    }
    if (plan.avatar) {
      try {
        const buf = await readEntry(zip, entries.get(profile.avatar), 20 * 1024 * 1024);
        const url = await saveFile({ buffer: buf, mimetype: MIME[extOf(profile.avatar)] || 'image/jpeg' }, 'avatars');
        await query('UPDATE users SET avatar_url = $2 WHERE id=$1 AND avatar_url IS NULL', [user.id, url]);
      } catch { result.notRecovered.push('profile photo'); }
    }
    if (plan.soulDna && meta.soulDna?.answers) {
      try {
        const good = Object.fromEntries(Object.entries(meta.soulDna.answers).filter(([id, v]) => QMAP[id] && validAnswer(QMAP[id], v)));
        if (Object.keys(good).length) {
          const r = await one(`IF NOT EXISTS (SELECT 1 FROM soul_dna WHERE user_id=$1) INSERT INTO soul_dna (user_id, answers) OUTPUT INSERTED.user_id VALUES ($1, $2)`, [user.id, JSON.stringify(good)]);
          if (r && isComplete(good)) await saveCompletedDna(user.id, good);
          if (r) result.soulDna = true;
        }
      } catch { result.notRecovered.push('Soul DNA'); }
    }
    const all = [...plan.posts.map((x) => ['post', x]), ...plan.sparks.map((x) => ['spark', x])];
    for (let i = 0; i < all.length; i++) {
      const [kind, p] = all[i];
      await stage(i < plan.posts.length ? `Restoring posts (${i + 1} of ${plan.posts.length})` : `Restoring Sparks (${i - plan.posts.length + 1} of ${plan.sparks.length})`, 10 + Math.round((i / Math.max(1, all.length)) * 80));
      try {
        if (p.action === 'bring_back') {
          const k = KIND[kind];
          const back = await one(`UPDATE ${k.table} SET deleted_at = NULL OUTPUT INSERTED.id WHERE id=$1 AND author_id=$2 AND deleted_at IS NOT NULL AND suspended_at IS NULL`, [p.id, user.id]);
          if (!back) { result.duplicatesSkipped++; continue; } // already back (a re-run)
          const c = await interactionCounts(kind, p.id, user.id);
          await pruneInteractions(kind, p.id, user.id);
          result.broughtBack++; result.likesRestored += c.likesOk; result.commentsRestored += c.commentsOk; result.interactionsSkipped += c.likesSkip + c.commentsSkip;
          continue;
        }
        // recreate from the backup: original photos / videos, caption and date; a new id only if the old one is taken
        const urls = [];
        for (const m of (p.item.media || []).sort((a, b) => (a.order || 0) - (b.order || 0))) {
          const e = entries.get(m.file); if (!e) continue;
          const buf = await readEntry(zip, e);
          const mimetype = MIME[extOf(m.file)];
          if (!mimetype) continue;
          urls.push(await saveFile({ buffer: buf, mimetype }, kind === 'post' ? 'posts' : 'sparks', kind));
          if (m.type === 'video') result.videosRestored++; else result.photosRestored++;
        }
        const id = p.action === 'recreate' ? p.id : crypto.randomUUID();
        const created = p.item.createdAt && !Number.isNaN(Date.parse(p.item.createdAt)) ? new Date(p.item.createdAt) : new Date();
        if (kind === 'post') {
          const r = await one(`IF NOT EXISTS (SELECT 1 FROM posts WHERE id=$1)
              INSERT INTO posts (id, author_id, caption, media_urls, created_at, place, music_title, hide_likes, comments_off, archived_at)
              OUTPUT INSERTED.id VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [id, user.id, String(p.item.caption || '').slice(0, 2200), JSON.stringify(urls), created, p.item.place || null, p.item.musicTitle || null,
            p.item.hideLikes ? 1 : 0, p.item.commentsOff ? 1 : 0, p.item.archived ? new Date() : null]);
          if (r) result.postsRestored++; else result.duplicatesSkipped++;
        } else {
          if (!urls.length) { result.notRecovered.push('a Spark without its video'); continue; }
          const r = await one(`IF NOT EXISTS (SELECT 1 FROM sparks WHERE id=$1)
              INSERT INTO sparks (id, author_id, category, video_url, caption, place, music_title, created_at, mic_topic, is_voice, one_take)
              OUTPUT INSERTED.id VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [id, user.id, p.item.category || 'travel', urls[0], String(p.item.caption || '').slice(0, 1000), p.item.place || null, p.item.musicTitle || null, created,
            p.item.micTopic || null, p.item.isVoice ? 1 : 0, p.item.oneTake ? 1 : 0]);
          if (r) result.sparksRestored++; else result.duplicatesSkipped++;
        }
      } catch (e) {
        result.notRecovered.push(`${kind === 'post' ? 'a post' : 'a Spark'} from ${String(p.item.createdAt || '').slice(0, 10) || 'an unknown date'}`);
        if (process.env.NODE_ENV !== 'test') console.warn('restore item failed:', e.message);
      }
    }
    await stage('Recalculating interaction counts', 94);
    await stage('Finalizing restoration', 98);
    await setJob(jobId, { status: 'done', stage: 'Done', progress: 100, finished_at: new Date(), manifest: JSON.stringify({ ...stored, result, profile: undefined, meta: undefined }) });
    await audit(req || null, 'data_restored', { actorId: user.id, targetUserId: user.id, detail: `backup v${stored.manifest?.formatVersion}: ${result.postsRestored} posts, ${result.sparksRestored} Sparks, ${result.broughtBack} back, ${result.interactionsSkipped} interactions skipped` });
    return result;
  } catch (e) {
    await fail(jobId, e.message);
    throw e;
  } finally {
    closeZip(z);
    await fsp.rm(file, { force: true }).catch(() => {});
  }
}

// ===================================================================== housekeeping

/** At start-up: jobs that were running when the server stopped are marked interrupted (restores can be re-run). */
export async function recoverBackupJobs() {
  await query(`UPDATE account_backups SET status = N'interrupted', stage = N'Stopped when the server restarted. Please try again.', finished_at = SYSDATETIMEOFFSET()
    WHERE status IN (N'queued', N'running', N'validated')`).catch(() => {});
  await fsp.rm(RESTORE_DIR, { recursive: true, force: true }).catch(() => {});
}
/** Hourly: expired downloads and unconfirmed restores are closed; their temporary data is removed. */
export async function expireBackupJobs() {
  await query(`UPDATE account_backups SET status = N'expired', manifest = NULL WHERE kind = N'export' AND status = N'ready' AND expires_at < SYSDATETIMEOFFSET()`).catch(() => {});
  const stale = await many(`SELECT id FROM account_backups WHERE kind = N'restore' AND status = N'validated' AND created_at < DATEADD(HOUR, -2, SYSDATETIMEOFFSET())`).catch(() => []);
  for (const s of stale) {
    await query(`UPDATE account_backups SET status = N'expired', manifest = NULL WHERE id=$1`, [s.id]).catch(() => {});
    await fsp.rm(path.join(RESTORE_DIR, `${String(s.id).toLowerCase()}.zip`), { force: true }).catch(() => {});
  }
}
