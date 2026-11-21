// Update App policy, kept centrally in console_settings (key "app_update") and edited in the team console
// (Releases › Update policy). The app reads it from GET /app/version and compares with its own version.
//   android / ios: { latest, minimum }   latest = newest store version; below minimum the app asks people to update
//   message: optional text shown with an update; mandatory: true = treat every older version as below minimum
// Store links are the official listings only (Google Play / App Store). Nothing is ever downloaded by the app itself.
import { one, query } from '../db.js';

export const ANDROID_PACKAGE = 'app.soulink.mobile';
export const PLAY_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
/** The App Store link once the iPhone app is published (APP_STORE_ID = the numeric Apple ID), otherwise null. */
export const appStoreUrl = () => (/^\d{6,12}$/.test(process.env.APP_STORE_ID || '') ? `https://apps.apple.com/app/id${process.env.APP_STORE_ID}` : null);

const VERSION = /^\d{1,4}(\.\d{1,4}){0,3}$/;
export const isVersion = (v) => typeof v === 'string' && VERSION.test(v);
const DEFAULT = { android: { latest: '1.0.0', minimum: '1.0.0' }, ios: { latest: '1.0.0', minimum: '1.0.0' }, message: '', mandatory: false };

/** -1, 0 or 1. "1.0.10" > "1.0.9"; missing parts count as 0. */
export function compareVersions(a, b) {
  const pa = String(a || '0').split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b || '0').split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

const clean = (p) => {
  const plat = (x) => ({ latest: isVersion(x?.latest) ? x.latest : '1.0.0', minimum: isVersion(x?.minimum) ? x.minimum : '1.0.0' });
  return { android: plat(p?.android), ios: plat(p?.ios), message: String(p?.message || '').slice(0, 300), mandatory: !!p?.mandatory };
};

export async function getUpdatePolicy() {
  const row = await one(`SELECT value FROM console_settings WHERE [key] = N'app_update'`).catch(() => null);
  try { return clean(row ? JSON.parse(row.value) : DEFAULT); } catch { return clean(DEFAULT); }
}

export async function setUpdatePolicy(p) {
  const v = JSON.stringify(clean(p));
  await query(`IF EXISTS (SELECT 1 FROM console_settings WHERE [key] = N'app_update')
      UPDATE console_settings SET value=$1, updated_at=SYSDATETIMEOFFSET() WHERE [key] = N'app_update'
    ELSE INSERT INTO console_settings ([key], value) VALUES (N'app_update', $1)`, [v]);
  return clean(p);
}

/** What the app gets: the policy plus the official store links. */
export async function publicPolicy() {
  const p = await getUpdatePolicy();
  return { ...p, android: { ...p.android, storeUrl: PLAY_URL, package: ANDROID_PACKAGE }, ios: { ...p.ios, storeUrl: appStoreUrl() } };
}
