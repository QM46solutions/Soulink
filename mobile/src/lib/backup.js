// Account Data & Backup on the phone: download the backup ZIP with progress and save it where the person chooses
// (Android: a folder they pick, through the system file picker; iPhone: the share sheet's "Save to Files"), and
// upload a backup ZIP for Restore My Data with progress. The web version is backup.web.js.
import { Platform } from 'react-native';
import { api, ApiError, getAccess, getServer, getToken, uploadFile } from './api';

export const requestExport = () => api('/account/backup/export', { method: 'POST' });
export const exportStatus = (id) => api(`/account/backup/export/${id}`);
export const backupHistory = () => api('/account/backup/history');
export const startRestore = (id) => api(`/account/backup/restore/${id}/start`, { method: 'POST' });
export const restoreStatus = (id) => api(`/account/backup/restore/${id}`);
export const restoreLegacy = (file) => api('/users/me/restore', { method: 'POST', body: file, timeoutMs: 60000 });

const headers = () => ({ ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}), ...(getAccess() ? { 'x-soulink-access': getAccess() } : {}) });
export const backupName = (username) => `Soulink_Backup_${String(username || 'account').replace(/[^a-zA-Z0-9._-]/g, '')}_${new Date().toISOString().slice(0, 10)}.zip`;

/** The server's error for a download that failed (it answers JSON, which ends up in the file). */
async function errorIn(file) {
  try {
    if ((file.size ?? 0) > 4096) return null;
    const t = await file.text();
    if (!t.startsWith('{')) return null;
    const j = JSON.parse(t);
    return j?.error ? new ApiError(0, j.error.message || 'The download failed.', j.error.code) : null;
  } catch { return null; }
}

/**
 * Downloads the ready backup into the app's cache with progress (fraction 0-1, or null when the size is unknown).
 * `control.current` gets a cancel() function. Returns the downloaded file.
 */
export async function downloadBackup(job, username, onProgress, control) {
  const { File, Paths } = await import('expo-file-system');
  const name = backupName(username);
  const dest = new File(Paths.cache, name);
  try { if (dest.exists) dest.delete(); } catch { /* ignore */ }
  const url = `${getServer()}/account/backup/export/${job.id}/download`;
  let file;
  if (typeof File.createDownloadTask === 'function') {
    const task = File.createDownloadTask(url, dest, {
      headers: headers(),
      onProgress: ({ bytesWritten, totalBytes }) => onProgress?.(totalBytes > 0 ? Math.min(1, bytesWritten / totalBytes) : null, bytesWritten),
    });
    if (control) control.current = { cancel: () => { try { task.cancel(); } catch { /* ignore */ } } };
    try { file = await task.downloadAsync(); } catch (e) {
      throw new ApiError(0, /cancel/i.test(e?.message || '') ? 'Download cancelled.' : "The download was interrupted. Check your connection and tap Download again: your backup is still ready.", 'download_interrupted');
    }
    if (!file) throw new ApiError(0, 'Download cancelled.', 'download_cancelled');
  } else {
    // older app builds: no progress, but the same file
    try { file = await File.downloadFileAsync(url, dest, { headers: headers(), idempotent: true }); } catch (e) {
      throw new ApiError(0, "The download was interrupted. Check your connection and tap Download again: your backup is still ready.", 'download_interrupted');
    }
  }
  const err = await errorIn(file);
  if (err) { try { file.delete(); } catch { /* ignore */ } throw err; }
  return file;
}

/**
 * Lets the person keep the downloaded file. Android: they choose a folder (Downloads, Documents, an SD card...);
 * iPhone: the share sheet, where "Save to Files" puts it in Files / iCloud Drive. Returns { saved, where }.
 */
export async function saveBackupToDevice(file) {
  if (Platform.OS === 'android') {
    try {
      const { Directory } = await import('expo-file-system');
      const dir = await Directory.pickDirectoryAsync();
      if (!dir) return { saved: false, cancelled: true };
      const out = dir.createFile(file.name, 'application/zip');
      await file.copy(out);
      try { file.delete(); } catch { /* the cache copy is no longer needed */ }
      return { saved: true, where: 'the folder you chose' };
    } catch (e) {
      if (/cancel/i.test(e?.message || '')) return { saved: false, cancelled: true };
      // some phones' file pickers can't be written to: fall back to the share sheet
    }
  }
  const Sharing = await import('expo-sharing');
  if (!(await Sharing.isAvailableAsync())) throw new ApiError(0, "This phone can't save files from Soulink.", 'no_share');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/zip', dialogTitle: 'Save your Soulink backup', UTI: 'public.zip-archive' });
  return { saved: true, where: Platform.OS === 'ios' ? 'Files (where you chose)' : 'where you chose' };
}

/** Opens the phone's file picker. Returns { uri, name, size, kind: 'zip' | 'json' } or null if cancelled. */
export async function pickBackupFile() {
  const DocumentPicker = await import('expo-document-picker');
  const r = await DocumentPicker.getDocumentAsync({ type: ['application/zip', 'application/x-zip-compressed', 'application/json', '*/*'], copyToCacheDirectory: true, multiple: false });
  const a = r.canceled ? null : r.assets?.[0];
  if (!a) return null;
  const name = a.name || 'backup';
  const kind = /\.json$/i.test(name) || a.mimeType === 'application/json' ? 'json' : 'zip';
  return { uri: a.uri, name, size: a.size ?? null, kind };
}

/** Reads an older JSON download (Soulink's first "Download my data"). */
export async function readLegacyJson(picked) {
  if (picked.size && picked.size > 15 * 1024 * 1024) throw new ApiError(0, 'That file is too big to be a Soulink download.', 'too_big');
  const { File } = await import('expo-file-system');
  try { return JSON.parse(await new File(picked.uri).text()); } catch { throw new ApiError(0, "That file isn't a Soulink backup.", 'not_backup'); }
}

/** Uploads the backup ZIP for checking, with progress. Returns the server's summary. */
export async function uploadBackupForCheck(picked, onProgress, control) {
  const { File, UploadType } = await import('expo-file-system');
  const f = new File(picked.uri);
  if (typeof f.createUploadTask !== 'function') {
    onProgress?.(null);
    return uploadFile('/account/backup/restore/validate', { uri: picked.uri, name: picked.name, type: 'application/zip' }, 'backup', {}, 15 * 60_000);
  }
  const task = f.createUploadTask(`${getServer()}/account/backup/restore/validate`, {
    httpMethod: 'POST', uploadType: UploadType.MULTIPART, fieldName: 'backup', mimeType: 'application/zip', headers: headers(),
    onProgress: ({ bytesSent, totalBytes }) => onProgress?.(totalBytes > 0 ? Math.min(1, bytesSent / totalBytes) : null),
  });
  if (control) control.current = { cancel: () => { try { task.cancel(); } catch { /* ignore */ } } };
  let res;
  try { res = await task.uploadAsync(); } catch (e) {
    throw new ApiError(0, /cancel/i.test(e?.message || '') ? 'Upload cancelled.' : "The upload was interrupted. Check your connection and try again.", 'upload_interrupted');
  }
  let data = {};
  try { data = JSON.parse(res.body || '{}'); } catch { /* not JSON */ }
  if (res.status >= 400) throw new ApiError(res.status, data?.error?.message || `Couldn't check the backup (${res.status}).`, data?.error?.code);
  return data;
}

export const canSaveToFolder = Platform.OS === 'android';
