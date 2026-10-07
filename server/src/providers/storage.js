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
// Sparks: a short video (+ optional music from the phone)
ALLOWED.video = { 'video/mp4': '.mp4', 'video/quicktime': '.mov', 'video/webm': '.webm', 'video/x-m4v': '.m4v', 'video/3gpp': '.3gp' };
ALLOWED.spark = { ...ALLOWED.video, ...ALLOWED.audio };

export const mediaKind = (mimetype) => (ALLOWED.image[mimetype] ? 'image' : ALLOWED.audio[mimetype] ? 'voice' : null);

/** Multer middleware keeping the file in memory; we decide where it goes afterwards. */
export const uploadMemory = (kind = 'image', maxMb = 10, maxFiles = 1) =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxMb * 1024 * 1024, files: maxFiles },
    fileFilter: (req, file, cb) =>
      ALLOWED[kind][file.mimetype] ? cb(null, true) : cb(badRequest(`Unsupported file type ${file.mimetype}`)),
  });

/** Saves a buffer and returns its public URL (/uploads/folder/name).
 *  STORAGE=local: file on this computer's disk (server/uploads).
 *  STORAGE=db:    file on disk as a cache AND in the database (stored_files), for cloud hosts whose disk is wiped on restart. */
export async function saveFile(file, folder, kind = 'image') {
  if (!file) throw badRequest('No file uploaded');
  const ext = ALLOWED[kind][file.mimetype] || '';
  const name = `${crypto.randomUUID()}${ext}`;
  if (config.storage !== 'local' && config.storage !== 'db') throw new Error(`Storage "${config.storage}" is not set up yet`);
  const dir = path.join(config.uploadDir, folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), file.buffer);
  const url = `/uploads/${folder}/${name}`;
  if (config.storage === 'db') await storeInDb(url, file.buffer, file.mimetype);
  return url;
}

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.mp3': 'audio/mpeg', '.webm': 'video/webm', '.3gp': 'video/3gpp', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.m4v': 'video/x-m4v', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.flac': 'audio/flac' };
const diskOf = (url) => path.join(config.uploadDir, String(url).replace(/^\/uploads\//, ''));

async function storeInDb(url, buffer, mimetype) {
  const { query } = await import('../db.js');
  await query(
    `IF NOT EXISTS (SELECT 1 FROM stored_files WHERE path=$1) INSERT INTO stored_files (path, mime, data) VALUES ($1, $2, $3)`,
    [url, mimetype || MIME[path.extname(url).toLowerCase()] || 'application/octet-stream', buffer],
  );
}

/** A file written straight to disk by other code (e.g. a translated voice clip): also keep it in the database. */
export async function persistFile(url) {
  if (config.storage !== 'db') return;
  await storeInDb(url, await fs.readFile(diskOf(url)));
}

/** Makes sure an /uploads/... file is on this computer's disk (restores it from the database if needed). Returns the disk path. */
export async function ensureLocal(url) {
  const file = diskOf(url);
  if (config.storage !== 'db') return file;
  try { await fs.access(file); return file; } catch { /* not cached yet */ }
  const { one } = await import('../db.js');
  const row = await one('SELECT data FROM stored_files WHERE path=$1', [url]);
  if (!row?.data) return file;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, row.data);
  return file;
}
