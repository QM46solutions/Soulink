// A short sound + a light vibration when you Connect, Like, Comment or Share.
// Settings › Sounds & vibration turns either off (remembered on this phone).
// Vibration uses expo-haptics, a native module: phones get it from app version 4 on. Older installs that receive this
// code as an over-the-air update don't have the module, so it is loaded carefully and simply skipped there.
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer } from 'expo-audio';
import { Asset } from 'expo-asset';

let Haptics = null;
try { Haptics = require('expo-haptics'); } catch { Haptics = null; }

const SOUNDS = {
  like: require('../../assets/sounds/like.wav'),
  connect: require('../../assets/sounds/connect.wav'),
  tap: require('../../assets/sounds/tap.wav'),
};
// what each action plays and how strong the buzz is
const KIND = {
  like: ['like', 'light'],
  unlike: [null, 'light'],
  comment: ['tap', 'light'],
  share: ['tap', 'light'],
  connect: ['connect', 'success'],
};

const KEY = 'soulink.feedback';
let prefs = { sound: true, vibrate: true };
AsyncStorage.getItem(KEY).then((v) => { if (v) prefs = { ...prefs, ...JSON.parse(v) }; }).catch(() => {});
export const feedbackPrefs = () => prefs;
export async function setFeedbackPrefs(next) {
  prefs = { ...prefs, ...next };
  try { await AsyncStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* still applies until the app restarts */ }
}

const players = {};
function play(name) {
  try {
    if (Platform.OS === 'web') {
      const a = new window.Audio(Asset.fromModule(SOUNDS[name]).uri);
      a.volume = 0.6; a.play().catch(() => {});
      return;
    }
    if (!players[name]) players[name] = createAudioPlayer(SOUNDS[name]);
    const p = players[name];
    p.volume = 0.6;
    try { p.seekTo(0); } catch { /* first play */ }
    p.play();
  } catch { /* sound is a nice-to-have */ }
}

function buzz(kind) {
  try {
    if (Platform.OS === 'web') { if (navigator.vibrate) navigator.vibrate(kind === 'success' ? [12, 40, 18] : 10); return; }
    if (!Haptics) return;
    if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  } catch { /* no vibration motor, or no module in this install */ }
}

/** A light buzz only (no sound), e.g. when a swipe reaches the point where letting go does something. */
export function tick() {
  if (prefs.vibrate) buzz('light');
}

/** feedback('like' | 'unlike' | 'comment' | 'share' | 'connect') */
export function feedback(action) {
  const [sound, vib] = KIND[action] || [];
  if (sound && prefs.sound) play(sound);
  if (vib && prefs.vibrate) buzz(vib);
}
