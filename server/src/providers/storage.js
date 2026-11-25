import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { config } from '../config.js';
import { badRequest } from '../lib/errors.js';

const ALLOWED = {
  image: { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic' },
  audio: { 'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/ogg': '.ogg', 'audio/flac': '.flac', 'audio/mp3': '.mp3', 'audio/aacp': '.aac', 'audio/m4a': '.m4a', 'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/aac': '.aac', 'audio/mpeg': '.mp3', 'audio/webm': '.webm', 'audio/3gpp': '.3gp' },
};
// Chat attachments: a photo or a voice note
ALLOWED.media = { ...ALLOWED.image, ...ALLOWED.audio };
// Chat documents (the "+" menu): PDFs, Office files, text, CSV, zip — never HTML/SVG/scripts
ALLOWED.document = {
  'application/pdf': '.pdf', 'text/plain': '.txt', 'text/csv': '.csv', 'application/zip': '.zip', 'application/x-zip-compressed': '.zip',
  'application/msword': '.doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
};
// Sparks: a short video (+ optional music from the phone)
ALLOWED.video = { 'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm', 'video/x-m4v': '.m4v', 'video/3gpp': '.3gp' };
ALLOWED.spark = { ...ALLOWED.video, ...ALLOWED.audio };
ALLOWED.post = { ...ALLOWED.image, ...ALLOWED.video }; // posts: photos and videos
ALLOWED.idproof = { ...ALLOWED.image, 'application/pdf': '.pdf' }; // event registration: a photo or PDF of a government ID

export const mediaKind = (mimetype) => (ALLOWED.image[mimetype] ? 'image' : ALLOWED.audio[mimetype] ? 'voice' : null);

/** Multer middleware keeping the file in memory; we decide where it goes afterwards. */
export const uploadMemory = (kind = 'image', maxMb = 10, maxFiles = 1) =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxMb * 1024 * 1024, files: maxFiles },
    fileFilter: (req, file, cb) =>
      ALLOWED[kind][file.mimetype] ? cb(null, true) : cb(badRequest(`Unsupported file type ${file.mimetype}`)),
  });

// ---------- Azure Blob Storage (STORAGE=blob) ----------
// Files live in a private Blob container (AZURE_STORAGE_CONNECTION_STRING, AZURE_STORAGE_CONTAINER, default "media"),
// under the same name as their /uploads/ path, with the server's disk as a cache. Files saved before the switch are
// still in the database (stored_files): they're read from there and copied to Blob on first use, and
// moveStoredFilesToBlob() moves the rest in small, verified batches (BLOB_MIGRATE=on), freeing the database.
let blobApi = null;
async function blob() {
  if (blobApi) return blobApi;
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!conn) throw new Error('STORAGE=blob needs AZURE_STORAGE_CONNECTION_STRING');
  const { BlobServiceClient, BlobSASPermissions } = await import('@azure/storage-blob');
  const container = BlobServiceClient.fromConnectionString(conn).getContainerClient(process.env.AZURE_STORAGE_CONTAINER || 'media');
  await container.createIfNotExists(); // private: nothing in it is public
  blobApi = { container, BlobSASPermissions };
  return blobApi;
}
export const blobOn = () => config.storage === 'blob';
const blobNameOf = (url) => String(url).replace(/^\/uploads\//, '');
async function putBlob(url, buffer, mimetype) {
  const { container } = await blob();
  await container.getBlockBlobClient(blobNameOf(url)).uploadData(buffer, { blobHTTPHeaders: { blobContentType: mimetype || MIME[path.extname(url).toLowerCase()] || 'application/octet-stream' } });
}
/** A short-lived link to read (r) or write (cw) one file in Blob directly, for the video builder and direct uploads. */
export async function blobLink(name, perms = 'r', minutes = 30) {
  const { container, BlobSASPermissions } = await blob();
  return container.getBlockBlobClient(blobNameOf(name)).generateSasUrl({ permissions: BlobSASPermissions.parse(perms), startsOn: new Date(Date.now() - 5 * 60_000), expiresOn: new Date(Date.now() + minutes * 60_000) });
}
/** Size in bytes of a file in Blob, or null if it isn't there. */
export async function blobSize(name) {
  const { container } = await blob();
  try { return (await container.getBlockBlobClient(blobNameOf(name)).getProperties()).contentLength; } catch (e) { if (e.statusCode === 404) return null; throw e; }
}
/** Rename a file in Blob (an uploaded clip becomes a Spark's file): copy, check, delete the old one. */
export async function blobMove(from, to) {
  const { container } = await blob();
  const src = container.getBlockBlobClient(blobNameOf(from)); const dst = container.getBlockBlobClient(blobNameOf(to));
  await (await dst.beginCopyFromURL(await blobLink(from, 'r', 30))).pollUntilDone();
  await src.deleteIfExists();
  return to;
}
/** A read link that stays the same for the whole hour (so phones and browsers can keep their copy), valid 2 hours. */
export async function blobReadLink(name) {
  const { container, BlobSASPermissions } = await blob();
  const hour = Math.floor(Date.now() / 3600_000) * 3600_000;
  return container.getBlockBlobClient(blobNameOf(name)).generateSasUrl({ permissions: BlobSASPermissions.parse('r'), startsOn: new Date(hour - 5 * 60_000), expiresOn: new Date(hour + 2 * 3600_000) });
}
const inBlobMemo = new Map(); // path -> { yes, at }: saves a Blob lookup on every request
/** Is this /uploads/... file in Blob? (remembered for 10 minutes; "no" for 1 minute) */
export async function inBlob(url) {
  const m = inBlobMemo.get(url);
  if (m && Date.now() - m.at < (m.yes ? 600_000 : 60_000)) return m.yes;
  const yes = (await blobSize(url).catch(() => null)) != null;
  if (inBlobMemo.size > 5000) inBlobMemo.clear();
  inBlobMemo.set(url, { yes, at: Date.now() });
  return yes;
}
export const forgetInBlob = (url) => inBlobMemo.delete(url);
/** Size in bytes of an /uploads/... file wherever it is (Blob, the database, or this computer's disk), or null. */
export async function fileSize(url) {
  if (config.storage === 'blob') { const n = await blobSize(url).catch(() => null); if (n != null) return n; }
  if (config.storage === 'db' || config.storage === 'blob') {
    const { one } = await import('../db.js');
    const r = await one('SELECT DATALENGTH(data) AS n FROM stored_files WHERE path=$1', [url]).catch(() => null);
    if (r?.n != null) return Number(r.n);
  }
  try { return (await fs.stat(diskOf(url))).size; } catch { return null; }
}
/** Removes an /uploads/... file everywhere it may be kept. */
export async function removeFile(url) {
  if (config.storage === 'blob') { await blobDelete(url).catch(() => {}); forgetInBlob(url); }
  if (config.storage === 'db' || config.storage === 'blob') { const { query } = await import('../db.js'); await query('DELETE FROM stored_files WHERE path=$1', [url]).catch(() => {}); }
  await fs.rm(diskOf(url), { force: true }).catch(() => {});
}
export async function blobDelete(name) { const { container } = await blob(); await container.getBlockBlobClient(blobNameOf(name)).deleteIfExists(); }

/** Saves a buffer and returns its public URL (/uploads/folder/name).
 *  STORAGE=local: file on this computer's disk (server/uploads).
 *  STORAGE=db:    file on disk as a cache AND in the database (stored_files), for cloud hosts whose disk is wiped on restart.
 *  STORAGE=blob:  file on disk as a cache AND in Azure Blob Storage. */
export async function saveFile(file, folder, kind = 'image') {
  if (!file) throw badRequest('No file uploaded');
  const ext = ALLOWED[kind][file.mimetype] || '';
  const name = `${crypto.randomUUID()}${ext}`;
  if (!['local', 'db', 'blob'].includes(config.storage)) throw new Error(`Storage "${config.storage}" is not set up yet`);
  const dir = path.join(config.uploadDir, folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), file.buffer);
  const url = `/uploads/${folder}/${name}`;
  if (config.storage === 'db') await storeInDb(url, file.buffer, file.mimetype);
  if (config.storage === 'blob') await putBlob(url, file.buffer, file.mimetype);
  return url;
}

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.mp3': 'audio/mpeg', '.webm': 'video/webm', '.3gp': 'video/3gpp', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.m4v': 'video/x-m4v', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.flac': 'audio/flac',
  '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv', '.zip': 'application/zip', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
const diskOf = (url) => path.join(config.uploadDir, String(url).replace(/^\/uploads\//, ''));

async function storeInDb(url, buffer, mimetype) {
  const { query, queryLong } = await import('../db.js');
  // big files (Spark videos) get the long-timeout connection
  await (buffer && buffer.length > 8 * 1024 * 1024 ? queryLong : query)(
    `IF NOT EXISTS (SELECT 1 FROM stored_files WHERE path=$1) INSERT INTO stored_files (path, mime, data) VALUES ($1, $2, $3)`,
    [url, mimetype || MIME[path.extname(url).toLowerCase()] || 'application/octet-stream', buffer],
  );
}

/** A file written straight to disk by other code (e.g. a translated voice clip): also keep it in the database. */
export async function persistFile(url) {
  if (config.storage === 'db') await storeInDb(url, await fs.readFile(diskOf(url)));
  if (config.storage === 'blob') await putBlob(url, await fs.readFile(diskOf(url)));
}

/** Makes sure an /uploads/... file is on this computer's disk (restores it from the database if needed). Returns the disk path. */
export async function ensureLocal(url) {
  const file = diskOf(url);
  if (config.storage !== 'db' && config.storage !== 'blob') return file;
  try { await fs.access(file); return file; } catch { /* not cached yet */ }
  await fs.mkdir(path.dirname(file), { recursive: true });
  if (config.storage === 'blob') {
    try { await (await blob()).container.getBlockBlobClient(blobNameOf(url)).downloadToFile(file); return file; }
    catch (e) { if (e.statusCode !== 404) throw e; await fs.rm(file, { force: true }); } // not in Blob: an older file, still in the database
  }
  const { one } = await import('../db.js');
  const row = await one('SELECT data, mime FROM stored_files WHERE path=$1', [url]);
  if (!row?.data) return file;
  await fs.writeFile(file, row.data);
  if (config.storage === 'blob') putBlob(url, row.data, row.mime).catch(() => {}); // copied to Blob on first use
  return file;
}

/** STORAGE=blob + BLOB_MIGRATE=on: moves files saved in the database to Blob, a few at a time, and frees the database.
 *  Each file is uploaded, its size in Blob is checked, and only then is the database copy deleted. Returns how many moved. */
export async function moveStoredFilesToBlob(batch = 10) {
  if (config.storage !== 'blob' || process.env.BLOB_MIGRATE !== 'on') return 0;
  const { many, query } = await import('../db.js');
  const rows = await many(`SELECT TOP ${Math.max(1, Math.min(50, batch))} path, mime, data FROM stored_files ORDER BY created_at`);
  let moved = 0;
  for (const r of rows) {
    const len = r.data?.length || 0;
    try {
      if ((await blobSize(r.path)) !== len) await putBlob(r.path, r.data, r.mime);
      if ((await blobSize(r.path)) === len) { await query('DELETE FROM stored_files WHERE path=$1', [r.path]); moved += 1; }
    } catch { /* this one stays in the database; tried again next time */ }
  }
  return moved;
}
