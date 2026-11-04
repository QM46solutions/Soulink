// Join several video clips into ONE Spark video, in the browser (no upload, no server, free).
// Each clip plays (its trimmed part only) and is painted onto a 9:16 canvas while its sound is mixed in; the
// canvas + sound are recorded into a single file. It runs at normal speed: a 40 s Spark takes about 40 s.
// The recorder is paused while the next clip loads, so there are no frozen frames between clips.
// Transitions between clips: 'cut' (none), 'fade' (through black), 'flash' (through white).
const W = 720; const H = 1280; const FPS = 30; const T = 0.35; // transition length (s), each side of a join

export const TRANSITIONS = [['cut', 'Cut'], ['fade', 'Fade'], ['flash', 'Flash']];

const pickMime = () => {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const t of ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']) if (MediaRecorder.isTypeSupported?.(t)) return t;
  return '';
};
export const canJoin = () => typeof document !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream && pickMime() != null && !!(window.AudioContext || window.webkitAudioContext);

const once = (el, ev, ms = 8000) => new Promise((res, rej) => {
  const done = () => { clearTimeout(t); el.removeEventListener(ev, done); el.removeEventListener('error', fail); res(); };
  const fail = () => { clearTimeout(t); el.removeEventListener(ev, done); rej(new Error('A clip could not be opened')); };
  const t = setTimeout(done, ms);
  el.addEventListener(ev, done); el.addEventListener('error', fail);
});

/** clips: [{ uri, start, end }] · returns { uri, type, name, seconds } */
export async function joinClips(clips, { transition = 'cut', onProgress } = {}) {
  if (!canJoin()) throw new Error('This browser can’t join clips. Try Chrome, Edge or Safari.');
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC(); ac.resume?.(); // started from the tap, so phones allow sound
  const dest = ac.createMediaStreamDestination();
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const stream = new MediaStream([...canvas.captureStream(FPS).getVideoTracks(), ...dest.stream.getAudioTracks()]);
  const mime = pickMime();
  const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 3_500_000, audioBitsPerSecond: 128_000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
  const stopped = new Promise((r) => { rec.onstop = r; });
  const total = clips.reduce((s, c) => s + Math.max(0, c.end - c.start), 0) || 1;
  let done = 0;

  // open a clip, ready at its start (sound routed only into the recording, not the speakers)
  const open = async (c) => {
    const v = document.createElement('video');
    v.src = c.uri; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous'; v.muted = false; v.volume = 1;
    await once(v, 'loadeddata');
    const gain = ac.createGain();
    ac.createMediaElementSource(v).connect(gain).connect(dest);
    v.currentTime = c.start; await once(v, 'seeked', 4000);
    return { v, gain };
  };
  const draw = (v, shade, white) => {
    const vw = v.videoWidth || W; const vh = v.videoHeight || H; const s = Math.max(W / vw, H / vh); // fill the 9:16 frame
    g.drawImage(v, (W - vw * s) / 2, (H - vh * s) / 2, vw * s, vh * s);
    if (shade > 0.001) { g.globalAlpha = Math.min(1, shade); g.fillStyle = white ? '#fff' : '#000'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  };

  try {
    let next = open(clips[0]);
    for (let i = 0; i < clips.length; i += 1) {
      const c = clips[i];
      const { v, gain } = await next;
      if (i + 1 < clips.length) next = open(clips[i + 1]); // get the next clip ready while this one plays
      await v.play();
      if (v.currentTime < c.start - 0.1) { try { v.currentTime = c.start; } catch { /* not seekable: played through below */ } }
      let live = false; // recording only from the clip's start (some recorded videos can't jump straight there)
      await new Promise((res) => {
        let over = false;
        const resolve = () => { if (over) return; over = true; clearTimeout(guard); v.pause(); res(); };
        v.addEventListener('ended', resolve);
        const guard = setTimeout(resolve, ((c.end - c.start) + 6) * 1000); // never hang on a stuck clip
        const tick = () => {
          if (over) return;
          const t = v.currentTime;
          if (t < c.start - 0.05) { if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(tick); else setTimeout(tick, 1000 / FPS); return; }
          if (!live) { live = true; if (rec.state === 'inactive') rec.start(500); else if (rec.state === 'paused') rec.resume(); }
          const into = t - c.start; const left = c.end - t;
          let shade = 0;
          if (transition !== 'cut') {
            if (i > 0 && into < T) shade = 1 - into / T;
            if (i < clips.length - 1 && left < T) shade = Math.max(shade, 1 - left / T);
          }
          draw(v, shade, transition === 'flash');
          gain.gain.value = transition === 'fade' ? 1 - shade : 1;
          onProgress?.(Math.min(1, (done + Math.max(0, into)) / total));
          if (t >= c.end - 0.03 || v.ended) { resolve(); return; }
          if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(tick); else setTimeout(tick, 1000 / FPS);
        };
        tick();
      });
      done += c.end - c.start;
      if (i < clips.length - 1 && rec.state === 'recording') rec.pause(); // no frozen frames while the next one starts
      v.removeAttribute('src'); v.load();
    }
    await new Promise((r) => setTimeout(r, 120));
    rec.stop();
    await stopped;
  } finally {
    stream.getTracks().forEach((t) => t.stop());
    ac.close?.();
  }
  const type = (rec.mimeType || mime || 'video/webm').split(';')[0];
  const blob = new Blob(chunks, { type });
  onProgress?.(1);
  return { uri: URL.createObjectURL(blob), type, name: `spark.${type.includes('mp4') ? 'mp4' : 'webm'}`, seconds: total, size: blob.size };
}
