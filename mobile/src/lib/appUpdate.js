// Update App (Settings › Update App, and the "please update" screen for versions that are no longer supported).
//
// Two kinds of update, both through official, platform-supported paths:
//  1. Over-the-air (Expo Updates): new screens and fixes for the version already installed. Downloaded by Expo's own
//     updater, then the app restarts with Updates.reloadAsync() (the supported restart). The login, settings and
//     everything saved on the phone stay, because they live outside the app bundle.
//  2. Store version (Google Play / App Store): needed for new native features. The server says which version is the
//     latest and which is the oldest still supported (GET /app/version, edited in the team console). We only open the
//     official store listing; the store downloads and installs. The app never downloads or installs a file itself.
// Google's in-app update (download inside the app) needs native code that today's build doesn't have; it can be
// added in the next store build. Installed store versions can't be rolled back from here: problems are fixed by
// stopping the store rollout and publishing a corrected version (see docs/RELEASES.md).
import { useEffect } from 'react';
import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { api } from './api';
import { reportError } from './telemetry';

export const installedVersion = String(Constants.expoConfig?.version || '0.0.0');
export const isStoreApp = Platform.OS === 'android' || Platform.OS === 'ios';

/** -1, 0 or 1 ("1.0.10" > "1.0.9"). */
export function compareVersions(a, b) {
  const pa = String(a || '0').split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b || '0').split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

/** What the server says about store versions for this phone. Throws if it can't be reached. */
export async function checkStoreVersion() {
  const p = await api('/app/version', { timeoutMs: 10000 });
  const mine = Platform.OS === 'ios' ? p.ios : p.android;
  if (!mine) return { status: 'unsupported' };
  const behindLatest = compareVersions(installedVersion, mine.latest) < 0;
  const belowMinimum = compareVersions(installedVersion, mine.minimum) < 0 || (!!p.mandatory && behindLatest);
  return { status: behindLatest ? 'available' : 'latest', latest: mine.latest, minimum: mine.minimum, belowMinimum, storeUrl: mine.storeUrl || null, package: mine.package || null, message: p.message || '' };
}

/** Opens the official store listing. Returns false when there is no listing yet (iPhone before the App Store). */
export async function openStore(info) {
  if (Platform.OS === 'android') {
    const pkg = info?.package || 'app.soulink.mobile';
    try { await Linking.openURL(`market://details?id=${pkg}`); return true; } catch { /* no Play Store app: use the web listing */ }
    await Linking.openURL(info?.storeUrl || `https://play.google.com/store/apps/details?id=${pkg}`);
    return true;
  }
  if (Platform.OS === 'ios' && info?.storeUrl && /^https:\/\/apps\.apple\.com\//.test(info.storeUrl)) { await Linking.openURL(info.storeUrl); return true; }
  return false;
}

/** Over-the-air: is a newer bundle waiting for this version? (false on the web and in development) */
export async function checkOtaUpdate() {
  if (!isStoreApp || !Updates.isEnabled || __DEV__) return { available: false, supported: false };
  const r = await Updates.checkForUpdateAsync();
  return { available: !!r.isAvailable, supported: true };
}

/** Downloads the over-the-air update. The app keeps working meanwhile. Returns true when it's ready to apply. */
export async function downloadOtaUpdate() {
  const r = await Updates.fetchUpdateAsync();
  return !!r.isNew;
}

/** Restarts into the downloaded update (Expo's supported restart). If it fails the current version keeps running. */
export async function applyOtaUpdate() {
  try { await Updates.reloadAsync(); } catch (e) { reportError(e, 'settings/update-app'); throw e; }
}

// ---------- on opening the app: newer over-the-air code (unchanged) ----------
// When Soulink opens, check Expo for newer app code. If there is some and it arrives within the first few seconds,
// restart into it right away (on the splash/first screen, before you've started doing anything), so you never need
// to close and reopen the app twice to see the latest version. A slower download is kept and used next time.
const QUICK_MS = 8000;

export function useAppUpdate() {
  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    const opened = Date.now();
    (async () => {
      try {
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable) return;
        const got = await Updates.fetchUpdateAsync();
        if (got.isNew && Date.now() - opened < QUICK_MS) await Updates.reloadAsync();
      } catch { /* offline: try next time */ }
    })();
  }, []);
}

// ---------- start-up check: versions that are no longer supported ----------
let startupCheck = null;
/** Once per app start, quietly. Resolves to the store info only when this version is below the minimum. */
export function checkMinimumOnStart() {
  if (!isStoreApp) return Promise.resolve(null);
  if (!startupCheck) startupCheck = checkStoreVersion().then((r) => (r.belowMinimum ? r : null)).catch(() => null); // can't check = never block
  return startupCheck;
}
