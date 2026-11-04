// Phone-app build: putting several clips together runs in the Soulink web app for now, so this moves straight on
// with the first clip.
import { useEffect } from 'react';
export const MAX_SPARK = 60;
export const newClipId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const clipsLength = (clips) => clips.reduce((s, c) => s + Math.max(0, (c.end ?? 0) - (c.start ?? 0)), 0);
export default function SparkClips({ onNext }) {
  useEffect(() => { onNext(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
