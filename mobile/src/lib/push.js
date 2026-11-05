// Phone notifications (phone app): Expo push → Apple (APNs) and Google (Firebase) deliver them, also when the
// app is closed. The server keeps this phone's push token (POST /push/expo). Tapping a notification opens the
// right screen. Same functions as the web version (push.web.js), so the screens don't care which one runs.
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { api } from './api';

const TOKEN = 'soulink.expoPushToken';
const WANT = 'soulink.pushWanted';
const projectId = () => Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId || null;

// notifications that arrive while the app is open still show as a banner
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
});

/** 'ready' | 'unsupported' (the app isn't linked to Expo's push service yet: no project id) */
export function pushSupport() {
  return projectId() ? 'ready' : 'unsupported';
}

async function token() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Soulink', importance: Notifications.AndroidImportance.HIGH, vibrationPattern: [0, 200, 120, 200], lightColor: '#7c5cfc' });
  }
  return (await Notifications.getExpoPushTokenAsync({ projectId: projectId() })).data;
}
const save = async (t) => {
  await api('/push/expo', { method: 'POST', body: { token: t, platform: Platform.OS } });
  await AsyncStorage.multiSet([[TOKEN, t], [WANT, '1']]);
};

/** Is this phone currently getting notifications? */
export async function pushEnabled() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted' && !!(await AsyncStorage.getItem(TOKEN));
  } catch { return false; }
}

/** Asks permission (the phone's own question), gets this phone's push token and tells the server. */
export async function enablePush() {
  if (!projectId()) throw new Error('Notifications will work in the installed Soulink app (TestFlight or the Play Store version).');
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') throw new Error('Notifications are off for Soulink. Allow them in your phone’s Settings › Notifications › Soulink, then try again.');
  try { await save(await token()); return true; }
  catch (e) {
    const m = String(e?.message || '');
    if (/firebase|fcm|google/i.test(m)) throw new Error('Android notifications aren’t set up in this version of the app yet. They will work after the next app update from the Play Store / test link.');
    throw new Error(`Couldn't connect this phone to notifications. ${m}`.trim());
  }
}

/** Switching notifications off (Settings, or logging out): this phone stops getting them. */
export async function disablePush() {
  try {
    const t = await AsyncStorage.getItem(TOKEN);
    await AsyncStorage.multiRemove([TOKEN, WANT]);
    if (t) await api('/push/expo', { method: 'DELETE', body: { token: t } }).catch(() => {});
  } catch { /* nothing to undo */ }
}

export const sendTestPush = () => api('/push/test', { method: 'POST' });

/** Every time the app opens (and after logging in): if notifications were switched on here, re-send this phone's token. */
export async function resyncPush() {
  try {
    if (!projectId() || (await AsyncStorage.getItem(WANT)) !== '1') return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await save(await token());
  } catch { /* offline: try next time */ }
}

/** Tapping a notification opens its screen (also when the tap is what opened the app). Use once, in the root layout. */
export function usePushTaps() {
  useEffect(() => {
    const open = (r) => { const url = r?.notification?.request?.content?.data?.url; if (typeof url === 'string' && url.startsWith('/')) setTimeout(() => router.push(url), 50); };
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}
