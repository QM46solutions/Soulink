// What the phone tells the team console (server: routes/telemetry.js), only while someone is signed in:
//  - how long each screen takes to finish loading (screen name pattern only, e.g. "user/[username]": never who or what)
//  - crashes (the error message, no personal data), so the team sees them under Issues
//  - "Report a problem" from Settings
// Everything is sent in small batches and never slows the app down; if sending fails it is dropped.
import { useEffect, useRef } from 'react';
import { AppState, InteractionManager, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { api, getToken, netState } from './api';

export const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
export const appVersion = String(Constants.expoConfig?.version || '').slice(0, 20) || undefined;

// ---------- screen load times ----------
const MAX_MS = 20000; // slower than this = the person probably left the app; not counted
let queue = [];
let flushTimer = null;

function flush() {
  if (!queue.length || !getToken()) return;
  const items = queue.splice(0, 30);
  api('/telemetry/screens', { method: 'POST', body: { items } }).catch(() => {});
}
function record(screen, ms) {
  if (!screen || ms < 1 || ms > MAX_MS) return;
  queue.push({ screen: screen.slice(0, 60), ms: Math.round(ms), platform, ...(appVersion ? { appVersion } : {}) });
  if (queue.length > 200) queue = queue.slice(-200);
  if (queue.length >= 20) flush();
}

/** Root layout: times every screen change, from navigation until the screen's data requests have finished
 *  (no request for 300 ms) and its animations are done. `where` = route pattern, e.g. "(tabs)/index". */
export function useScreenTimings(where, enabled) {
  const run = useRef(0);
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

// ---------- crashes ----------
const CRASH_KEY = 'soulink.pendingCrash';
const sentThisSession = new Set();
let crashCount = 0;
const crashText = (err) => {
  const e = err instanceof Error ? err : new Error(String(err?.message || err || 'Unknown error'));
  const stack = String(e.stack || '').split('\n').slice(1, 4).map((l) => l.trim()).join(' | ');
  return `${e.name || 'Error'}: ${e.message || ''}${stack ? `\n${stack}` : ''}`.slice(0, 1500);
};
async function sendCrash(message) {
  if (!message || sentThisSession.has(message) || crashCount >= 10) return;
  sentThisSession.add(message); crashCount += 1;
  if (!getToken()) return;
  await api('/telemetry/crash', { method: 'POST', body: { message, platform, ...(appVersion ? { appVersion } : {}) } });
}

/** Once, at app start: catch crashes. A crash that closes the app is saved and sent the next time it opens. */
let installed = false;
export function installCrashReporting() {
  if (installed) return; installed = true;
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    window.addEventListener('error', (e) => { sendCrash(crashText(e.error || e.message)).catch(() => {}); });
    window.addEventListener('unhandledrejection', (e) => {
      // a video's play() cut short by pause() or a new clip is normal browser behaviour, not a crash
      const r = e.reason; if (r && (r.name === 'AbortError' || /play\(\) request was interrupted/.test(String(r.message || '')))) return;
      sendCrash(crashText(r)).catch(() => {});
    });
    return;
  }
  const EU = global.ErrorUtils;
  if (!EU?.setGlobalHandler) return;
  const previous = EU.getGlobalHandler?.();
  EU.setGlobalHandler((err, isFatal) => {
    const message = crashText(err);
    if (isFatal) AsyncStorage.setItem(CRASH_KEY, message).catch(() => {});
    sendCrash(message).catch(() => {});
    previous?.(err, isFatal);
  });
}
/** After sign-in: send a crash saved from the last time the app closed unexpectedly. */
export async function sendPendingCrash() {
  try {
    const message = await AsyncStorage.getItem(CRASH_KEY);
    if (!message || !getToken()) return;
    await AsyncStorage.removeItem(CRASH_KEY);
    await sendCrash(message);
  } catch { /* next time */ }
}

// ---------- Report a problem (Settings) ----------
export async function reportProblem(details, screen) {
  return api('/telemetry/problem', { method: 'POST', body: { details, ...(screen ? { screen: screen.slice(0, 60) } : {}), platform, ...(appVersion ? { appVersion } : {}) } });
}
