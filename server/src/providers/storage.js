import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { config } from '../config.js';
import { badRequest } from '../lib/errors.js';

const ALLOWED = {
  image: { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic' },
  audio: { 'audio/m4a': '.m4a', 'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/aac': '.aac', 'audio/mpeg': '.mp3', 'audio/webm': '.webm', 'audio/3gpp': '.3gp' },
};
// Chat attachments: a photo or a voice note
ALLOWED.media = { ...ALLOWED.image, ...ALLOWED.audio };

export const mediaKind = (mimetype) => (ALLOWED.image[mimetype] ? 'image' : ALLOWED.audio[mimetype] ? 'voice' : null);

/** Multer middleware keeping the file in memory; we decide where it goes afterwards. */
export const uploadMemory = (kind = 'image', maxMb = 10) =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) =>
      ALLOWED[kind][file.mimetype] ? cb(null, true) : cb(badRequest(`Unsupported file type ${file.mimetype}`)),
  });

/** Saves a buffer and returns its public URL. Local disk now; S3 at cloud move. */
export async function saveFile(file, folder, kind = 'image') {
  if (!file) throw badRequest('No file uploaded');
  const ext = ALLOWED[kind][file.mimetype] || '';
  const name = `${crypto.randomUUID()}${ext}`;
  if (config.storage === 'local') {
    const dir = path.join(config.uploadDir, folder);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, name), file.buffer);
    return `/uploads/${folder}/${name}`;
  }
  throw new Error(`Storage "${config.storage}" is not set up yet`);
}

// Note: local files are returned as relative paths (/uploads/...). The app prefixes its API URL,
// so it works whatever IP your laptop has. S3 URLs will be absolute and used as-is.
