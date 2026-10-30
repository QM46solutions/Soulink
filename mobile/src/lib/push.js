// Phone notifications (Web Push). Works in Chrome / Android, and on iPhone (iOS 16.4+) only when Soulink
// is opened from the Home Screen icon (Safari > Share > Add to Home Screen).
import { Platform } from 'react-native';
import { api } from './api';

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
const isIOS = () => isWeb && /iPhone|iPad|iPod/.test(navigator.userAgent);
const standalone = () => isWeb && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);

/** 'ready' | 'needs_home_screen' | 'unsupported' | 'blocked' */
export function pushSupport() {
  if (!isWeb) return 'unsupported';
  if (isIOS() && !standalone()) return 'needs_home_screen';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  return 'ready';
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration('/')) || navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

/** Is this phone currently getting notifications? */
export async function pushEnabled() {
  if (pushSupport() !== 'ready' || Notification.permission !== 'granted') return false;
  try { const reg = await navigator.serviceWorker.getRegistration('/'); return !!(reg && (await reg.pushManager.getSubscription())); } catch { return false; }
}

const b64ToBytes = (s) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

// "This person switched notifications on here": remembered on the phone, so the app can quietly re-connect them
// whenever the phone's push address went missing (an update, a browser clean-up). Only switching them off clears it.
const WANT = 'soulink.pushWanted';
const want = (v) => { try { if (v) localStorage.setItem(WANT, '1'); else localStorage.removeItem(WANT); } catch { /* private mode */ } };
const wanted = () => { try { return localStorage.getItem(WANT) === '1'; } catch { return false; } };

/** Asks permission (must run from a tap), subscribes this phone and tells the server. Throws a friendly message. */
export async function enablePush() {
  const support = pushSupport();
  if (support === 'needs_home_screen') throw new Error('On iPhone, open Soulink from its Home Screen icon first (Safari › Share › Add to Home Screen).');
  if (support === 'blocked') throw new Error('Notifications are blocked for Soulink. Allow them in your phone/browser settings, then try again.');
  if (support !== 'ready') throw new Error("This browser can't show notifications.");
  // the permission question must be the first thing after the tap (iPhone is strict about this)
  const permission = await Notification.requestPermission();
  if (permission === 'denied') throw new Error('Notifications are blocked. iPhone: Settings › Notifications › Soulink › Allow Notifications. Then try again.');
  if (permission !== 'granted') throw new Error('You chose not to allow notifications.');
  let step = 'server key';
  try {
    const { publicKey } = await api('/push/key');
    if (!publicKey) throw new Error("Notifications aren't set up on the server yet.");
    step = 'service worker';
    await registration();
    const reg = await navigator.serviceWorker.ready;
    step = 'subscribe';
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
    step = 'save';
    const json = sub.toJSON();
    await api('/push/subscribe', { method: 'POST', body: { endpoint: json.endpoint, keys: json.keys } });
    want(true);
    return true;
  } catch (e) {
    throw new Error(`${e.message || e} (step: ${step})`);
  }
}

/** Switching notifications off (Settings, or logging out): this phone stops getting them. */
export async function disablePush() {
  want(false);
  try {
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = reg && (await reg.pushManager.getSubscription());
    if (sub) {
      await api('/push/subscribe', { method: 'DELETE', body: { endpoint: sub.endpoint } }).catch(() => {});
      await sub.unsubscribe();
    }
  } catch { /* nothing to undo */ }
}

export const sendTestPush = () => api('/push/test', { method: 'POST' });

/**
 * Every time the app opens (and after logging in): keep notifications on. If this phone has them, re-send its
 * address (the server may have dropped it); if they were switched on here but the phone's address went missing,
 * make a new one quietly (permission is already given, so no question is asked).
 */
export async function resyncPush() {
  try {
    if (pushSupport() !== 'ready' || Notification.permission !== 'granted') return;
    const reg = (await navigator.serviceWorker.getRegistration('/')) || (wanted() ? await registration() : null);
    if (!reg) return;
    let sub = await reg.pushManager.getSubscription();
    if (!sub && wanted()) {
      const { publicKey } = await api('/push/key');
      if (!publicKey) return;
      await navigator.serviceWorker.ready;
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
    }
    if (!sub) return;
    want(true);
    const json = sub.toJSON();
    await api('/push/subscribe', { method: 'POST', body: { endpoint: json.endpoint, keys: json.keys } });
  } catch { /* offline: try next time */ }
}
