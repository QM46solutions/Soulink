// Soulink Studio: the edit "project" behind the Sparks editor. Pure functions only (no React), so every change
// can be undone, saved as a draft and tested.
//
// project = {
//   v: 2,
//   clips:    [{ id, kind: 'video'|'photo', uri, type, src, in, out, speed }]   in/out = seconds of the source
//                                                                               (a photo: in 0, out = how long it shows)
//   overlays: [{ id, kind: 'text'|'sticker', t?, e?, style?, color?, size, x, y, scale, rot, from?, to? }]
//              x / y = 0…1 of the frame, scale = pinch size, rot = degrees, from / to = seconds of the FINISHED Spark
//   music:    null | { uri, name, type, title, ref, duration, start, volume }
//   voice:    null | { uri, type, name, volume }
//   videoVolume, filter, adjust, zoom, fade, cover
// }
// Times on the timeline are always seconds of the finished Spark (after trims and speed).

export const MAX_LEN = 60;          // a Spark is up to 60 seconds
export const MAX_CLIPS = 20;
export const PHOTO_SECONDS = 3;     // a photo shows for 3 s unless changed
export const MIN_CLIP = 0.3;
export const SPEEDS = [0.3, 0.5, 1, 1.5, 2, 3];
const round = (n) => Math.round(n * 100) / 100;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
let seq = 0;
export const newId = (p = 'c') => `${p}${Date.now().toString(36)}${(seq += 1).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const emptyProject = () => ({ v: 2, clips: [], overlays: [], music: null, voice: null, videoVolume: 1, filter: 'none',
  adjust: { b: 0, c: 0, s: 0, w: 0 }, zoom: { s: 1, x: 0.5, y: 0.5 }, fade: { in: 0, out: 0 }, cover: 0 });

// ---------- clips ----------
/** a clip from the gallery / camera. duration = the source's length in seconds (null if not known yet) */
export function makeClip({ uri, type, kind, duration }) {
  const photo = kind === 'photo' || /^image\//.test(type || '');
  const src = photo ? null : (duration && isFinite(duration) ? duration : null);
  return { id: newId('c'), kind: photo ? 'photo' : 'video', uri, type: type || (photo ? 'image/jpeg' : 'video/mp4'), src,
    // a video keeps its whole length: nothing is cut automatically (over 60 s, the editor asks the person to trim it)
    in: 0, out: photo ? PHOTO_SECONDS : (src || MAX_LEN), speed: 1 };
}
/** seconds this clip lasts in the finished Spark */
export const clipLen = (c) => Math.max(0, (c.out - c.in) / (c.kind === 'photo' ? 1 : (c.speed || 1)));
export const totalLen = (p) => p.clips.reduce((s, c) => s + clipLen(c), 0);
/** where each clip starts on the timeline */
export function clipStarts(p) { const out = []; let t = 0; for (const c of p.clips) { out.push(t); t += clipLen(c); } return out; }
/** the clip under time t, and the matching second of its source */
export function locate(p, t) {
  const starts = clipStarts(p);
  for (let i = 0; i < p.clips.length; i += 1) {
    const c = p.clips[i]; const len = clipLen(c);
    if (t < starts[i] + len - 1e-6 || i === p.clips.length - 1) {
      const local = clamp(t - starts[i], 0, len);
      return { index: i, clip: c, start: starts[i], local, source: c.in + local * (c.kind === 'photo' ? 1 : (c.speed || 1)) };
    }
  }
  return null;
}
/** the source-time of a clip after a source length became known (first load) */
export function setSourceLength(p, id, duration) {
  if (!duration || !isFinite(duration)) return p;
  // the length wasn't known when the clip was added: until now `out` was only a placeholder, so the clip becomes the whole video
  return mapClip(p, id, (c) => (c.src ? c : { ...c, src: duration, out: duration, in: Math.min(c.in, Math.max(0, duration - MIN_CLIP)) }));
}
const mapClip = (p, id, fn) => ({ ...p, clips: p.clips.map((c) => (c.id === id ? fn(c) : c)) });

export function addClips(p, clips, at = p.clips.length) {
  const room = MAX_CLIPS - p.clips.length;
  const list = [...p.clips]; list.splice(at, 0, ...clips.slice(0, Math.max(0, room)));
  return { ...p, clips: list };
}
/** cut the clip under time t in two (nothing happens within MIN_CLIP of either end) */
export function splitAt(p, t) {
  const hit = locate(p, t); if (!hit) return p;
  const { clip: c, index, source } = hit;
  if (source - c.in < MIN_CLIP || c.out - source < MIN_CLIP) return p;
  const a = { ...c, out: round(source) }; const b = { ...c, id: newId('c'), in: round(source) };
  const clips = [...p.clips]; clips.splice(index, 1, a, b);
  return { ...p, clips };
}
/** trim a clip (source seconds); photos: `out` is how long it shows */
export function trimClip(p, id, inS, outS) {
  return mapClip(p, id, (c) => {
    if (c.kind === 'photo') return { ...c, in: 0, out: round(clamp(outS - inS, 0.5, 15)) };
    const max = c.src || Math.max(c.out, outS);
    let i = clamp(inS, 0, max - MIN_CLIP); let o = clamp(outS, i + MIN_CLIP, max);
    if (o - i > MAX_LEN * (c.speed || 1)) o = i + MAX_LEN * (c.speed || 1);
    return { ...c, in: round(i), out: round(o) };
  });
}
export const setSpeed = (p, id, speed) => mapClip(p, id, (c) => (c.kind === 'photo' ? c : { ...c, speed: SPEEDS.includes(Number(speed)) ? Number(speed) : 1 }));
export function duplicateClip(p, id) {
  const i = p.clips.findIndex((c) => c.id === id); if (i < 0 || p.clips.length >= MAX_CLIPS) return p;
  const clips = [...p.clips]; clips.splice(i + 1, 0, { ...p.clips[i], id: newId('c') });
  return { ...p, clips };
}
export const removeClip = (p, id) => ({ ...p, clips: p.clips.filter((c) => c.id !== id) });
/** move a clip one place left (-1) or right (+1), or to an index */
export function moveClip(p, id, to) {
  const i = p.clips.findIndex((c) => c.id === id); if (i < 0) return p;
  const j = typeof to === 'number' && Math.abs(to) === 1 ? i + to : to;
  if (j < 0 || j >= p.clips.length || j === i) return p;
  const clips = [...p.clips]; const [c] = clips.splice(i, 1); clips.splice(j, 0, c);
  return { ...p, clips };
}

// ---------- text, stickers ----------
export function addOverlay(p, item) {
  const ov = { id: newId('o'), x: 0.5, y: 0.42, scale: 1, rot: 0, ...item };
  const n = p.overlays.filter((o) => o.kind === ov.kind).length;
  if ((ov.kind === 'text' && n >= 10) || (ov.kind === 'sticker' && n >= 15)) return p;
  return { ...p, overlays: [...p.overlays, ov] };
}
export const updateOverlay = (p, id, patch) => ({ ...p, overlays: p.overlays.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
export const removeOverlay = (p, id) => ({ ...p, overlays: p.overlays.filter((o) => o.id !== id) });
/** on screen at time t? (no from / to = the whole Spark) */
export const overlayShown = (o, t) => t == null || ((o.from == null || t >= o.from - 0.01) && (o.to == null || t <= o.to + 0.01));
/** keep every overlay's timing inside the Spark after clips change */
export function fitOverlays(p) {
  const len = totalLen(p);
  return { ...p, overlays: p.overlays.map((o) => {
    if (o.from == null) return o;
    const from = clamp(o.from, 0, Math.max(0, len - 0.5)); const to = clamp(o.to ?? len, from + 0.5, Math.max(from + 0.5, len));
    return from === o.from && to === o.to ? o : { ...o, from: round(from), to: round(to) };
  }) };
}

// ---------- undo / redo ----------
/** history = { past: [], present, future: [] }. Small changes in a row to the same thing (dragging) merge into one step. */
export const history = (present) => ({ past: [], present, future: [], key: null, at: 0 });
export function commit(h, next, key = null) {
  if (next === h.present) return h;
  const merge = key && key === h.key && Date.now() - h.at < 1200;
  return { past: merge ? h.past : [...h.past, h.present].slice(-60), present: next, future: [], key, at: Date.now() };
}
export const undo = (h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], key: null, at: 0 } : h);
export const redo = (h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), key: null, at: 0 } : h);

// ---------- what the Spark is posted with (until the video builder) ----------
/** One video clip: posted as that video plus the edits the players already understand (details.edit). */
export const isSingleVideo = (p) => p.clips.length === 1 && p.clips[0].kind === 'video';

export function toLegacyEdit(p) {
  const c = p.clips[0]; if (!c) return undefined;
  const sp = c.kind === 'photo' ? 1 : (c.speed || 1);
  const src = (t) => round(c.in + t * sp); // finished-Spark time -> video time (the players time things by the video)
  const out = {};
  if (c.in > 0.05 || (c.src && c.out < c.src - 0.05)) out.trim = [round(c.in), round(c.out)];
  if (sp !== 1) out.speed = String(sp);
  if (p.filter && p.filter !== 'none') out.filter = p.filter;
  const texts = p.overlays.filter((o) => o.kind === 'text');
  const stickers = p.overlays.filter((o) => o.kind === 'sticker');
  if (texts.length) out.texts = texts.map((o) => ({ t: o.t, x: round(clamp(o.x, 0, 1)), y: round(clamp(o.y, 0, 1)), color: o.color, style: o.style,
    size: Math.round(clamp((o.size || 30) * (o.scale || 1), 12, 72)), ...(o.rot ? { rot: Math.round(o.rot) } : {}), ...(o.from != null ? { from: src(o.from), to: src(o.to ?? totalLen(p)) } : {}) }));
  if (stickers.length) out.stickers = stickers.map((o) => ({ e: o.e, x: round(clamp(o.x, 0, 1)), y: round(clamp(o.y, 0, 1)),
    size: Math.round(clamp((o.size || 70) * (o.scale || 1), 20, 160)), ...(o.rot ? { rot: Math.round(o.rot) } : {}), ...(o.from != null ? { from: src(o.from), to: src(o.to ?? totalLen(p)) } : {}) }));
  if (p.music) { if (p.music.start) out.musicStart = round(p.music.start); if (p.music.volume != null && p.music.volume !== 1) out.musicVolume = round(p.music.volume); }
  if (p.videoVolume != null && p.videoVolume !== 1) out.videoVolume = round(p.videoVolume);
  if (p.voice && p.voice.volume != null && p.voice.volume !== 1) out.voiceVolume = round(p.voice.volume);
  if (p.cover) out.cover = src(p.cover);
  const a = p.adjust || {}; if (a.b || a.c || a.s || a.w) out.adjust = Object.fromEntries(Object.entries(a).filter(([, v]) => v).map(([k, v]) => [k, round(v)]));
  if (p.zoom && p.zoom.s > 1.01) out.zoom = { s: round(p.zoom.s), x: round(p.zoom.x), y: round(p.zoom.y) };
  if (p.fade && (p.fade.in || p.fade.out)) out.fade = Object.fromEntries(Object.entries(p.fade).filter(([, v]) => v).map(([k, v]) => [k, round(v)]));
  return Object.keys(out).length ? out : undefined;
}

/** The project as it is saved with a Spark (the video builder reads this; the players ignore it). Local file paths are left out. */
export function toRecipe(p) {
  return { v: 2, len: round(totalLen(p)),
    clips: p.clips.map((c) => ({ kind: c.kind, in: c.in, out: c.out, ...(c.kind === 'video' && c.speed !== 1 ? { speed: c.speed } : {}) })),
    overlays: p.overlays.map(({ id, ...o }) => o),
    ...(p.music ? { music: { start: p.music.start || 0, volume: p.music.volume ?? 1 } } : {}),
    ...(p.voice ? { voice: { volume: p.voice.volume ?? 1 } } : {}),
    videoVolume: p.videoVolume ?? 1, filter: p.filter, adjust: p.adjust, zoom: p.zoom, fade: p.fade, cover: p.cover };
}

/** Problems that stop posting, in plain words (empty = fine) */
export function problems(p) {
  const out = []; const len = totalLen(p);
  if (!p.clips.length) out.push('Add a video or photo first.');
  if (len > MAX_LEN + 0.5) out.push(`Your Spark is ${Math.round(len)} s. Trim it to ${MAX_LEN} s or less.`);
  if (p.clips.length && len < 1) out.push('Your Spark is shorter than a second.');
  return out;
}

export const fmt = (s) => { const t = Math.max(0, s || 0); const m = Math.floor(t / 60); const r = t % 60; return `${m}:${(r < 10 ? '0' : '') + r.toFixed(1)}`; };
