// Settings › Account Data & Backup (login required; everything is about the signed-in person only).
//  POST /account/backup/export                 start "Download My Data" (a ZIP is prepared in the background)
//  GET  /account/backup/export/:id             how far along it is (stage, progress, ready, size, expiry)
//  GET  /account/backup/export/:id/download    the ZIP (only for its owner, only until it expires: 7 days)
//  GET  /account/backup/history                past downloads and restores
//  POST /account/backup/restore/validate       upload a backup ZIP (field "backup"): checked, then a summary is returned
//  POST /account/backup/restore/:id/start      the person confirmed: restore in the background
//  GET  /account/backup/restore/:id            restore progress, then what was restored
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { many, one, query } from '../db.js';
import { ah, badRequest, notFound, tooMany, HttpError } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { audit } from '../services/audit.js';
import { config } from '../config.js';
import { EXPIRE_DAYS, FORMAT, MAX_UPLOAD_BYTES, RESTORE_DIR, runRestore, startExport, streamExport, validateRestore } from '../services/backup.js';

const r = Router();
r.use(requireAuth);

const EXPORTS_PER_DAY = 3;
const RESTORES_PER_DAY = 5;
const isId = (id) => /^[0-9a-f-]{36}$/i.test(String(id || ''));
const view = (j) => {
  let summary = null; let result = null; let counts = null;
  try { const m = j.manifest ? JSON.parse(j.manifest) : null; summary = m?.summary || null; result = m?.result || null; counts = m?.manifest?.counts || null; } catch { /* ignore */ }
  return { id: j.id, kind: j.kind, status: j.status, stage: j.stage, progress: j.progress, sizeBytes: j.size_bytes != null ? Number(j.size_bytes) : null,
    error: j.error, createdAt: j.created_at, finishedAt: j.finished_at, expiresAt: j.expires_at, counts, summary: j.status === 'validated' ? summary : undefined, result };
};
async function myJob(req, kind) {
  if (!isId(req.params.id)) throw notFound('Backup not found');
  const j = await one('SELECT * FROM account_backups WHERE id=$1 AND user_id=$2 AND kind=$3', [req.params.id, req.user.id, kind]);
  if (!j) throw notFound('Backup not found');
  return j;
}
async function underLimit(userId, kind, max) {
  const n = await one(`SELECT COUNT(*) AS n FROM account_backups WHERE user_id=$1 AND kind=$2 AND created_at > DATEADD(HOUR, -24, SYSDATETIMEOFFSET())`, [userId, kind]);
  if (!config.testing && Number(n.n) >= max) throw tooMany(`You can do this ${max} times a day. Please try again tomorrow.`);
}

// ---------------------------------------------------------------- export
r.post('/export', ah(async (req, res) => {
  const busy = await one(`SELECT TOP 1 * FROM account_backups WHERE user_id=$1 AND kind=N'export' AND status IN (N'queued', N'running') ORDER BY created_at DESC`, [req.user.id]);
  if (!busy) await underLimit(req.user.id, 'export', EXPORTS_PER_DAY);
  const job = await startExport(req.user);
  await audit(req, 'data_export_requested', { detail: `backup v${FORMAT}` });
  res.status(202).json({ backup: view(job), expiresInDays: EXPIRE_DAYS });
}));

r.get('/export/:id', ah(async (req, res) => {
  const j = await myJob(req, 'export');
  if (j.status === 'ready' && j.expires_at && new Date(j.expires_at) < new Date()) j.status = 'expired';
  res.json({ backup: view(j) });
}));

r.get('/export/:id/download', ah(async (req, res) => {
  const j = await myJob(req, 'export');
  if (j.status === 'expired' || (j.expires_at && new Date(j.expires_at) < new Date())) throw new HttpError(410, 'This download has expired. Request your data again.', 'backup_expired');
  if (j.status !== 'ready' || !j.manifest) throw new HttpError(409, 'Your backup is not ready yet.', 'backup_not_ready');
  await audit(req, 'data_export_downloaded', { detail: String(j.id) });
  try { await streamExport(j, req.user, res); } catch (e) {
    if (!res.headersSent) throw new HttpError(409, "Some of your files changed since this backup was prepared. Please request your data again.", 'backup_changed');
    res.destroy(e);
  }
}));

r.get('/history', ah(async (req, res) => {
  const rows = await many(`SELECT TOP 20 * FROM account_backups WHERE user_id=$1 ORDER BY created_at DESC`, [req.user.id]);
  res.json({ backups: rows.map((j) => ({ ...view(j), status: j.status === 'ready' && j.expires_at && new Date(j.expires_at) < new Date() ? 'expired' : j.status, summary: undefined })) });
}));

// ---------------------------------------------------------------- restore
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => { fsp.mkdir(RESTORE_DIR, { recursive: true }).then(() => cb(null, RESTORE_DIR), cb); },
    filename: (req, file, cb) => cb(null, `upload-${crypto.randomUUID()}.zip`),
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5 },
});

r.post('/restore/validate', ah(async (req, res, next) => {
  await underLimit(req.user.id, 'restore', RESTORES_PER_DAY);
  next();
}), upload.single('backup'), ah(async (req, res) => {
  if (!req.file) throw badRequest('Choose your Soulink backup file (.zip).', 'restore_no_file');
  const tmp = req.file.path;
  let job = null;
  try {
    // a ZIP starts with "PK"; the old JSON download goes to Settings › Restore my data's JSON path
    const head = Buffer.alloc(2); const fd = await fsp.open(tmp, 'r'); await fd.read(head, 0, 2, 0); await fd.close();
    if (head.toString() !== 'PK') throw badRequest(head[0] === 0x7b ? 'This is an older Soulink download (.json). The app restores it automatically: pick it again in the latest app.' : 'This is not a Soulink backup ZIP.', head[0] === 0x7b ? 'restore_legacy_json' : 'restore_not_zip');
    const checked = await validateRestore(tmp, req.user);
    job = await one(`INSERT INTO account_backups (user_id, kind, status, stage, manifest, size_bytes, expires_at)
      OUTPUT INSERTED.* VALUES ($1, N'restore', N'validated', N'Waiting for your confirmation', $2, $3, DATEADD(HOUR, 2, SYSDATETIMEOFFSET()))`,
    [req.user.id, JSON.stringify(checked), req.file.size]);
    await fsp.rename(tmp, path.join(RESTORE_DIR, `${String(job.id).toLowerCase()}.zip`));
    await audit(req, 'data_restore_validated', { detail: `${checked.summary.postsToRestore} to restore, ${checked.summary.duplicatesSkipped} already there` });
    res.json({ restore: { id: job.id, status: 'validated' }, backup: checked.manifest, summary: checked.summary });
  } catch (e) {
    await fsp.rm(tmp, { force: true }).catch(() => {});
    await audit(req, 'data_restore_refused', { detail: String(e.code || e.message).slice(0, 200) }).catch(() => {});
    throw e;
  }
}));

r.post('/restore/:id/start', ah(async (req, res) => {
  const j = await myJob(req, 'restore');
  if (j.status === 'running' || j.status === 'done') return res.json({ restore: view(j) }); // a second tap does nothing
  if (j.status !== 'validated') throw new HttpError(409, 'This restore can’t be started any more. Choose the backup file again.', 'restore_stale');
  const file = path.join(RESTORE_DIR, `${String(j.id).toLowerCase()}.zip`);
  if (!fs.existsSync(file)) {
    await query(`UPDATE account_backups SET status=N'expired', manifest=NULL WHERE id=$1`, [j.id]);
    throw new HttpError(409, 'The uploaded backup is no longer on the server. Choose the backup file again.', 'restore_stale');
  }
  // only one start wins, even with two quick taps
  const claimed = await one(`UPDATE account_backups SET status=N'running', stage=N'Validating backup', progress=1 OUTPUT INSERTED.* WHERE id=$1 AND status=N'validated'`, [j.id]);
  if (!claimed) return res.json({ restore: view(await myJob(req, 'restore')) });
  const user = await one('SELECT * FROM users WHERE id=$1', [req.user.id]);
  setImmediate(() => runRestore(j.id, user, file, null).catch(() => {}));
  res.status(202).json({ restore: view(claimed) });
}));

r.get('/restore/:id', ah(async (req, res) => {
  res.json({ restore: view(await myJob(req, 'restore')) });
}));

export default r;
