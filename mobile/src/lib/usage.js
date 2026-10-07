// Time on Soulink, counted on this phone while the app is open and on screen (kept for 14 days).
// Settings > Time management shows it and lets you set a daily limit and break reminders.
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { notice } from './confirm';

const KEY = 'soulink.usage';      // { 'YYYY-MM-DD': seconds }
const PREFS = 'soulink.timePrefs'; // { dailyLimit: minutes|0, breakEvery: minutes|0, warned: 'YYYY-MM-DD' }
const TICK = 15;
export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function readUsage() {
  try { return JSON.parse((await AsyncStorage.getItem(KEY)) || '{}'); } catch { return {}; }
}
export async function readTimePrefs() {
  try { return { dailyLimit: 0, breakEvery: 0, ...JSON.parse((await AsyncStorage.getItem(PREFS)) || '{}') }; } catch { return { dailyLimit: 0, breakEvery: 0 }; }
}
export async function saveTimePrefs(p) {
  const cur = await readTimePrefs();
  await AsyncStorage.setItem(PREFS, JSON.stringify({ ...cur, ...p }));
}

const visible = () => (Platform.OS === 'web' ? typeof document === 'undefined' || document.visibilityState === 'visible' : AppState.currentState === 'active');

/** Runs once in the app (signed in): adds time every 15 s while Soulink is on screen, and reminds you. */
export function useUsageTracker(enabled) {
  useEffect(() => {
    if (!enabled) return undefined;
    let session = 0; // seconds in this sitting (for break reminders)
    const id = setInterval(async () => {
      if (!visible()) { session = 0; return; }
      session += TICK;
      const u = await readUsage();
      const d = today();
      u[d] = (u[d] || 0) + TICK;
      const keep = Object.keys(u).sort().slice(-14);
      await AsyncStorage.setItem(KEY, JSON.stringify(Object.fromEntries(keep.map((k) => [k, u[k]])))).catch(() => {});
      const p = await readTimePrefs();
      if (p.dailyLimit && u[d] >= p.dailyLimit * 60 && p.warned !== d) {
        await saveTimePrefs({ warned: d });
        notice("You've reached your daily limit", `You've spent ${Math.round(u[d] / 60)} minutes on Soulink today. Time for something else? You can change the limit in Settings › Time management.`);
      }
      if (p.breakEvery && session >= p.breakEvery * 60) {
        session = 0;
        notice('Time for a break? 🌿', `You've been on Soulink for ${p.breakEvery} minutes. Stretch, drink some water, look away from the screen.`);
      }
    }, TICK * 1000);
    return () => clearInterval(id);
  }, [enabled]);
}
