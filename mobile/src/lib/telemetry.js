// What the phone tells the team console (server: routes/telemetry.js), only while someone is signed in:
//  - how long each screen takes to finish loading (screen name pattern only, e.g. "user/[username]": never who or what)
//  - slow (2 s+) or failed requests: path pattern, method, status and time only (never what was sent or received)
//  - crashes and non-fatal errors (the error message and where it happened, no personal data), under Issues
//  - "Report a problem" from Settings
// Every item carries the app version, the over-the-air bundle ("build"), the phone model and OS version, so the team
// can see which release, phone or screen a problem belongs to. Everything is sent in small batches and never slows
// the app down; if sending fails it is dropped. No passwords, codes, tokens or chat text are ever included.
import { useEffect, useRef } from 'react';
import { AppState, InteractionManager, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Updates from 'expo-updates';
import { api, getToken, netState, setRequestObserver, uploadFile } from './api';

export const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
export const appVersion = String(Constants.expoConfig?.version || '').slice(0, 20) || undefined;
const safe = (fn) => { try { return fn(); } catch { return undefined; } };
/** The JavaScript bundle the app is running: "ota-1a2b3c4d" (an over-the-air update) or "store" (the one in the build). */
export const build = Platform.OS === 'web' ? undefined : safe(() => (Updates.updateId ? `ota-${String(Updates.updateId).slice(0, 8)}` : 'store')) || undefined;
const osVersion = safe(() => { const v = String(Device.osVersion || Platform.Version || '').slice(0, 30); return v && v !== '0.0.0' ? v : undefined; });
const device = safe(() => String(Device.modelName || '').slice(0, 80)) || undefined;
/** The details every item carries (no personal data). */
export const diagnostics = () => ({ platform, ...(appVersion ? { appVersion } : {}), ...(build ? { build } : {}), ...(osVersion ? { osVersion } : {}), ...(device ? { device } : {}) });
let currentScreen = null; // route pattern of the screen on view (set by useScreenTimings)

// ---------- screen load times ----------
const MAX_MS = 20000; // slower than this = the person probably left the app; not counted
let queue = [];
let flushTimer = null;

function flush() {
  if (!getToken()) return;
  if (queue.length) {
    const items = queue.splice(0, 30);
    api('/telemetry/screens', { method: 'POST', body: { items } }).catch(() => {});
  }
  flushRequests();
}
function record(screen, ms) {
  if (!screen || ms < 1 || ms > MAX_MS) return;
  queue.push({ screen: screen.slice(0, 60), ms: Math.round(ms), platform, ...(appVersion ? { appVersion } : {}), ...(build ? { build } : {}) });
  if (queue.length > 200) queue = queue.slice(-200);
  if (queue.length >= 20) flush();
}

/** Root layout: times every screen change, from navigation until the screen's data requests have finished
 *  (no request for 300 ms) and its animations are done. `where` = route pattern, e.g. "(tabs)/index". */
export function useScreenTimings(where, enabled) {
  const run = useRef(0);
  useEffect(() => { if (where) currentScreen = String(where).slice(0, 60); }, [where]);
  useEffect(() => {
    if (!enabled) return undefined;
    flushTimer = setInterval(flush, 30000);
    const sub = AppState.addEventListener('change', (s) => { if (s !== 'active') flush(); });
    return () => { clearInterval(flushTimer); sub.remove(); flush(); };
  }, [enabled]);
  useEffect(() => {
    if (!enabled || !where) return undefined;
    const id = ++run.current; const t0 = Date.now();
    let settledUi = false; let poll = null;
    const task = InteractionManager.runAfterInteractions(() => { settledUi = true; });
    poll = setInterval(() => {
      if (id !== run.current) { clearInterval(poll); return; } // moved on to another screen first
      const net = netState(); const now = Date.now();
      if (now - t0 > MAX_MS) { clearInterval(poll); return; }
      if (settledUi && net.inflight === 0 && now - net.changedAt >= 300) {
        clearInterval(poll);
        // finished = when its last data request came back (or, with no requests, when the screen settled)
        record(where, net.changedAt > t0 ? net.changedAt - t0 : now - t0);
      }
    }, 100);
    return () => { clearInterval(poll); task?.cancel?.(); };
  }, [where, enabled]);
}

// ---------- slow or failed requests ----------
const SLOW_MS = 2000;
let requests = [];
function flushRequests() {
  if (!requests.length || !getToken()) return;
  const items = requests.splice(0, 30);
  api('/telemetry/api', { method: 'POST', body: { items } }).catch(() => {});
}
setRequestObserver(({ path, method, status, ms }) => {
  // only what helps find problems: slow requests, no response, server errors (not "wrong code" and the like)
  if (!(ms >= SLOW_MS || status === 0 || status >= 500)) return;
  if (requests.length >= 100) return;
  requests.push({ path: String(path).split('?')[0].slice(0, 200), method, status, ms: Math.min(ms, 300000), platform, ...(appVersion ? { appVersion } : {}), ...(build ? { build } : {}) });
  if (requests.length >= 20) flushRequests();
});

// ---------- crashes and non-fatal errors ----------
const CRASH_KEY = 'soulink.pendingCrash';
const sentThisSession = new Set();
let crashCount = 0;
const crashText = (err) => {
  const e = err instanceof Error ? err : new Error(String(err?.message || err || 'Unknown error'));
  const stack = String(e.stack || '').split('\n').slice(1, 4).map((l) => l.trim()).join(' | ');
  return `${e.name || 'Error'}: ${e.message || ''}${stack ? `\n${stack}` : ''}`.slice(0, 1500);
};
async function sendCrash(message, { fatal = true, screen = currentScreen } = {}) {
  if (!message || sentThisSession.has(message) || crashCount >= 10) return;
  sentThisSession.add(message); crashCount += 1;
  if (!getToken()) return;
  await api('/telemetry/crash', { method: 'POST', body: { message, fatal, ...(screen ? { screen: String(screen).slice(0, 60) } : {}), ...diagnostics() } });
}
/** A handled error worth knowing about (the app kept working). */
export function reportError(err, screen) { sendCrash(crashText(err), { fatal: false, screen: screen || currentScreen }).catch(() => {}); }

/** Once, at app start: catch crashes. A crash that closes the app is saved and sent the next time it opens. */
let installed = false;
export function installCrashReporting() {
  if (installed) return; installed = true;
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    window.addEventListener('error', (e) => { sendCrash(crashText(e.error || e.message), { fatal: false }).catch(() => {}); });
    window.addEventListener('unhandledrejection', (e) => {
      // a video's play() cut short by pause() or a new clip is normal browser behaviour, not a crash
      const r = e.reason; if (r && (r.name === 'AbortError' || /play\(\) request was interrupted/.test(String(r.message || '')))) return;
      sendCrash(crashText(r), { fatal: false }).catch(() => {});
    });
    return;
  }
  const EU = global.ErrorUtils;
  if (!EU?.setGlobalHandler) return;
  const previous = EU.getGlobalHandler?.();
  EU.setGlobalHandler((err, isFatal) => {
    const message = crashText(err);
    if (isFatal) AsyncStorage.setItem(CRASH_KEY, JSON.stringify({ message, screen: currentScreen })).catch(() => {});
    sendCrash(message, { fatal: !!isFatal }).catch(() => {});
    previous?.(err, isFatal);
  });
}
/** After sign-in: send a crash saved from the last time the app closed unexpectedly. */
export async function sendPendingCrash() {
  try {
    const raw = await AsyncStorage.getItem(CRASH_KEY);
    if (!raw || !getToken()) return;
    await AsyncStorage.removeItem(CRASH_KEY);
    let saved; try { saved = JSON.parse(raw); } catch { saved = { message: raw }; } // older app versions saved plain text
    if (saved?.message) await sendCrash(saved.message, { fatal: true, screen: saved.screen });
  } catch { /* next time */ }
}

// ---------- Report a problem (Settings) ----------
/**
 * Sends a report. details is required; the rest is optional. With includeDiagnostics=false only the platform and
 * app version go with it (the person turned the extra details off). Returns { ref }.
 */
export async function reportProblem(details, opts = {}) {
  const o = typeof opts === 'string' ? { screen: opts } : opts; // older callers passed the area as a string
  const extra = o.includeDiagnostics === false ? { platform, ...(appVersion ? { appVersion } : {}) } : diagnostics();
  const fields = { details, ...(o.category ? { category: o.category } : {}), ...(o.comments ? { comments: o.comments } : {}), ...(o.screen ? { screen: String(o.screen).slice(0, 60) } : {}), ...extra };
  if (o.screenshotUri) {
    const u = o.screenshotUri;
    const ext = (u.startsWith('data:') ? u.slice(u.indexOf('/') + 1, u.indexOf(';')) : (u.split('?')[0].split('.').pop() || 'jpg')).toLowerCase().replace('jpeg', 'jpg');
    const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'heic' ? 'image/heic' : 'image/jpeg';
    return uploadFile('/telemetry/problem', { uri: u, name: `screenshot.${['png', 'webp', 'heic'].includes(ext) ? ext : 'jpg'}`, type }, 'screenshot', fields);
  }
  return api('/telemetry/problem', { method: 'POST', body: fields });
}
