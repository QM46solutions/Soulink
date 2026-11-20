// Account Data & Backup in the browser: the ZIP downloads with progress and the browser saves it (Downloads, or
// where the browser asks); Restore uploads a chosen ZIP with progress. The phone version is backup.js.
import { api, ApiError, getAccess, getServer, getToken } from './api';

export const requestExport = () => api('/account/backup/export', { method: 'POST' });
export const exportStatus = (id) => api(`/account/backup/export/${id}`);
export const backupHistory = () => api('/account/backup/history');
export const startRestore = (id) => api(`/account/backup/restore/${id}/start`, { method: 'POST' });
export const restoreStatus = (id) => api(`/account/backup/restore/${id}`);
export const restoreLegacy = (file) => api('/users/me/restore', { method: 'POST', body: file, timeoutMs: 60000 });

const headers = () => ({ ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}), ...(getAccess() ? { 'x-soulink-access': getAccess() } : {}) });
export const backupName = (username) => `Soulink_Backup_${String(username || 'account').replace(/[^a-zA-Z0-9._-]/g, '')}_${new Date().toISOString().slice(0, 10)}.zip`;

export async function downloadBackup(job, username, onProgress, control) {
  const ctrl = new AbortController();
  if (control) control.current = { cancel: () => ctrl.abort() };
  let res;
  try { res = await fetch(`${getServer()}/account/backup/export/${job.id}/download`, { headers: headers(), signal: ctrl.signal }); } catch (e) {
    throw new ApiError(0, e?.name === 'AbortError' ? 'Download cancelled.' : 'The download was interrupted. Check your connection and try again: your backup is still ready.', 'download_interrupted');
  }
  if (!res.ok) { const d = await res.json().catch(() => ({})); throw new ApiError(res.status, d?.error?.message || `Download failed (${res.status})`, d?.error?.code); }
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body?.getReader?.();
  const parts = []; let got = 0;
  try {
    if (reader) {
      for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); got += value.length; onProgress?.(total ? Math.min(1, got / total) : null, got); }
    } else parts.push(new Uint8Array(await res.arrayBuffer()));
  } catch (e) {
    throw new ApiError(0, e?.name === 'AbortError' ? 'Download cancelled.' : 'The download was interrupted. Check your connection and try again: your backup is still ready.', 'download_interrupted');
  }
  return { name: backupName(username), blob: new Blob(parts, { type: 'application/zip' }) };
}

export async function saveBackupToDevice(file) {
  const url = URL.createObjectURL(file.blob);
  const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { saved: true, where: "your browser's Downloads" };
}

export function pickBackupFile() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.zip,application/zip,application/x-zip-compressed,.json,application/json';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      resolve({ file: f, name: f.name, size: f.size, kind: /\.json$/i.test(f.name) ? 'json' : 'zip' });
    };
    input.click();
  });
}

export async function readLegacyJson(picked) {
  if (picked.size > 15 * 1024 * 1024) throw new ApiError(0, 'That file is too big to be a Soulink download.', 'too_big');
  try { return JSON.parse(await picked.file.text()); } catch { throw new ApiError(0, "That file isn't a Soulink backup.", 'not_backup'); }
}

export function uploadBackupForCheck(picked, onProgress, control) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    if (control) control.current = { cancel: () => xhr.abort() };
    xhr.open('POST', `${getServer()}/account/backup/restore/validate`);
    Object.entries(headers()).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => onProgress?.(e.lengthComputable ? e.loaded / e.total : null);
    xhr.onload = () => {
      let d = {}; try { d = JSON.parse(xhr.responseText || '{}'); } catch { /* not JSON */ }
      if (xhr.status >= 400) reject(new ApiError(xhr.status, d?.error?.message || `Couldn't check the backup (${xhr.status}).`, d?.error?.code));
      else resolve(d);
    };
    xhr.onerror = () => reject(new ApiError(0, 'The upload was interrupted. Check your connection and try again.', 'upload_interrupted'));
    xhr.onabort = () => reject(new ApiError(0, 'Upload cancelled.', 'upload_cancelled'));
    const form = new FormData(); form.append('backup', picked.file, picked.name);
    xhr.send(form);
  });
}

export const canSaveToFolder = false;
