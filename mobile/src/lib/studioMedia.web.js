// Soulink Studio helpers for the web app: a video's length + preview frames (drawn on a canvas), and a
// voiceover recorder using the browser's microphone. (The phone version is studioMedia.js.)
import { useRef, useState } from 'react';

export async function probeClip(uri, kind, n = 6) {
  if (kind === 'photo') return { duration: null, thumbs: [{ uri }] };
  try {
    const v = document.createElement('video');
    v.src = uri; v.muted = true; v.playsInline = true; v.crossOrigin = 'anonymous'; v.preload = 'auto';
    await new Promise((r, j) => { v.onloadeddata = r; v.onerror = j; setTimeout(r, 6000); });
    const d = v.duration && isFinite(v.duration) ? v.duration : null;
    const c = document.createElement('canvas'); const w = 90; const h = 160; c.width = w; c.height = h;
    const g = c.getContext('2d'); const thumbs = [];
    for (let i = 0; d && i < n; i += 1) {
      await new Promise((r) => { v.onseeked = r; v.currentTime = Math.min(d - 0.05, (d * (i + 0.5)) / n); setTimeout(r, 1500); });
      const vw = v.videoWidth || w; const vh = v.videoHeight || h; const s = Math.max(w / vw, h / vh);
      g.drawImage(v, (w - vw * s) / 2, (h - vh * s) / 2, vw * s, vh * s);
      try { thumbs.push({ uri: c.toDataURL('image/jpeg', 0.6) }); } catch { break; }
    }
    v.removeAttribute('src'); v.load();
    return { duration: d, thumbs };
  } catch { return { duration: null, thumbs: [] }; }
}

function pickAudioType() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']) if (MediaRecorder.isTypeSupported?.(t)) return t;
  return '';
}

export function useVoice() {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState(null);
  const rec = useRef(null);
  const start = async () => {
    setError(null);
    const type = pickAudioType();
    if (type == null || !navigator.mediaDevices?.getUserMedia) { setError("This browser can't record sound. Try Chrome or Safari."); return false; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { setError('Allow the microphone for Soulink to record a voiceover.'); return false; }
    const chunks = []; const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    r.ondataavailable = (ev) => { if (ev.data?.size) chunks.push(ev.data); };
    r.done = new Promise((res) => {
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const mime = (r.mimeType || type || 'audio/webm').split(';')[0];
        if (!chunks.length) { res(null); return; }
        res({ uri: URL.createObjectURL(new Blob(chunks, { type: mime })), type: mime, name: `voice.${mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm'}` });
      };
    });
    rec.current = r; r.start(250); setRecording(true); return true;
  };
  const stop = async () => {
    const r = rec.current; if (!r) return null;
    rec.current = null; setRecording(false);
    try { r.stop(); } catch { return null; }
    return r.done;
  };
  return { recording, error, start, stop };
}
