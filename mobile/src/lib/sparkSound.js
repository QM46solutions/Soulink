// Sound on / off for the Sparks feed (the speaker button on a Spark), shared by every Spark like Instagram Reels:
// turn it off once and the next Sparks stay quiet until you turn it back on. Remembered while the app is open.
import { useEffect, useState } from 'react';

let muted = false;
const listeners = new Set();
export const sparksMuted = () => muted;
export function setSparksMuted(v) {
  if (muted === !!v) return;
  muted = !!v;
  listeners.forEach((fn) => fn(muted));
}
export const toggleSparksMuted = () => setSparksMuted(!muted);
export function useSparksMuted() {
  const [m, setM] = useState(muted);
  useEffect(() => { listeners.add(setM); setM(muted); return () => { listeners.delete(setM); }; }, []);
  return m;
}

// "Duck": while a sound effect plays (the 👌🏻 like), Sparks turn their own sound down for a moment so it's heard.
const duckers = new Set();
export function duckSparks(ms = 900) { duckers.forEach((fn) => fn(ms)); }
export function useSparkDuck(onDuck) {
  useEffect(() => { duckers.add(onDuck); return () => { duckers.delete(onDuck); }; }, [onDuck]);
}
