// Soulink Studio helpers for the phone app: a video's length + small preview frames for the timeline,
// and the voiceover recorder. (The web version is studioMedia.web.js.)
import { useRef, useState } from 'react';
import { createVideoPlayer } from 'expo-video';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';

const waitReady = (p, ms = 6000) => new Promise((res) => {
  if (p.status === 'readyToPlay') { res(true); return; }
  const t = setTimeout(() => { sub.remove(); res(p.status === 'readyToPlay'); }, ms);
  const sub = p.addListener('statusChange', ({ status }) => { if (status === 'readyToPlay' || status === 'error') { clearTimeout(t); sub.remove(); res(status === 'readyToPlay'); } });
});

/** { duration, thumbs: [image sources] } for a video; photos are their own thumbnail */
export async function probeClip(uri, kind, n = 6) {
  if (kind === 'photo') return { duration: null, thumbs: [{ uri }] };
  const p = createVideoPlayer({ uri });
  try {
    if (!(await waitReady(p))) return { duration: null, thumbs: [] };
    const d = p.duration && isFinite(p.duration) ? p.duration : null;
    let thumbs = [];
    try { thumbs = d ? await p.generateThumbnailsAsync(Array.from({ length: n }, (_, i) => Math.min(d - 0.05, (d * (i + 0.5)) / n)), { maxWidth: 120, maxHeight: 214 }) : []; } catch { thumbs = []; }
    return { duration: d, thumbs };
  } catch { return { duration: null, thumbs: [] }; } finally { try { p.release(); } catch { /* gone */ } }
}

/** voiceover: start() / stop() -> { uri, type, name } */
export function useVoice() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState(null);
  const on = useRef(false);
  const start = async () => {
    setError(null);
    const perm = await requestRecordingPermissionsAsync().catch(() => ({ granted: false }));
    if (!perm.granted) { setError('Allow the microphone for Soulink in your phone settings to record a voiceover.'); return false; }
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync(); recorder.record(); on.current = true; setRecording(true); return true;
    } catch { setError("Couldn't start the microphone. Try again."); return false; }
  };
  const stop = async () => {
    if (!on.current) return null;
    on.current = false; setRecording(false);
    try { await recorder.stop(); await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {}); return recorder.uri ? { uri: recorder.uri, type: 'audio/m4a', name: 'voice.m4a' } : null; }
    catch { setError('The recording could not be saved. Try again.'); return null; }
  };
  return { recording, error, start, stop };
}
