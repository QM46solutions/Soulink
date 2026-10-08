// Spark studio: the edits a Spark can carry (stored in details.edit, applied when it plays).
export const FILTERS = [
  { key: 'none', label: 'Normal', css: 'none' },
  { key: 'dream', label: 'Soul', css: 'saturate(1.15) contrast(1.05) hue-rotate(-12deg) brightness(1.04)' },
  { key: 'warm', label: 'Warm', css: 'sepia(0.25) saturate(1.3) brightness(1.04)' },
  { key: 'cool', label: 'Cool', css: 'hue-rotate(12deg) saturate(1.1) brightness(1.03) contrast(1.02)' },
  { key: 'vivid', label: 'Vivid', css: 'saturate(1.6) contrast(1.12)' },
  { key: 'fade', label: 'Fade', css: 'contrast(0.88) brightness(1.08) saturate(0.85)' },
  { key: 'vintage', label: 'Vintage', css: 'sepia(0.55) contrast(1.05) saturate(0.9)' },
  { key: 'mono', label: 'Mono', css: 'grayscale(1) contrast(1.1)' },
  { key: 'noir', label: 'Noir', css: 'grayscale(1) contrast(1.45) brightness(0.9)' },
];
export const filterCss = (k) => (FILTERS.find((f) => f.key === k) || FILTERS[0]).css;

export const SPEEDS = ['0.5', '1', '1.5', '2'];

export const TEXT_COLORS = ['#ffffff', '#000000', '#b08fff', '#7c5cfc', '#ff6b9d', '#f5c842', '#42e8c0', '#3fa9f5', '#ff5c7a'];
export const TEXT_STYLES = [
  { key: 'classic', label: 'Classic' },
  { key: 'bold', label: 'Bold' },
  { key: 'neon', label: 'Neon' },
  { key: 'box', label: 'Box' },
];
export const STICKERS = ['🔥', '😂', '😍', '💯', '✨', '🎬', '🎭', '🎤', '🎶', '💃', '🍳', '😋', '✈️', '🌍', '💪', '🏆', '📰', '❤️', '👏', '🙌', '😎', '🥹', '🤯', '⭐'];

export const emptyEdit = () => ({ trim: null, speed: '1', filter: 'none', texts: [], stickers: [], musicStart: 0, musicVolume: 1, videoVolume: 1, cover: 0 });

/** Only what changed, ready to save with the Spark */
export function cleanEdit(e, duration) {
  if (!e) return undefined;
  const out = {};
  if (e.trim && (e.trim[0] > 0.05 || (duration && e.trim[1] < duration - 0.05))) out.trim = [round(e.trim[0]), round(e.trim[1])];
  if (e.speed && e.speed !== '1') out.speed = e.speed;
  if (e.filter && e.filter !== 'none') out.filter = e.filter;
  if (e.texts?.length) out.texts = e.texts.map(({ t, x, y, color, style, size }) => ({ t, x: clamp01(x), y: clamp01(y), color, style, size: Math.round(size) }));
  if (e.stickers?.length) out.stickers = e.stickers.map(({ e: em, x, y, size }) => ({ e: em, x: clamp01(x), y: clamp01(y), size: Math.round(size) }));
  if (e.musicStart) out.musicStart = round(e.musicStart);
  if (e.musicVolume != null && e.musicVolume !== 1) out.musicVolume = round(e.musicVolume);
  if (e.videoVolume != null && e.videoVolume !== 1) out.videoVolume = round(e.videoVolume);
  if (e.cover) out.cover = round(e.cover);
  return Object.keys(out).length ? out : undefined;
}
const round = (n) => Math.round(n * 100) / 100;
const clamp01 = (n) => Math.max(0, Math.min(1, n));

/** Text overlay look */
export function textStyleOf(style, color, size) {
  const base = { color, fontSize: size, lineHeight: size * 1.2, textAlign: 'center', fontWeight: '700' };
  if (style === 'neon') return { ...base, color: '#fff', textShadowColor: color === '#ffffff' ? '#ff6b9d' : color, textShadowRadius: 14, textShadowOffset: { width: 0, height: 0 } };
  if (style === 'box') return { ...base, color: color === '#ffffff' || color === '#f5c842' ? '#14121f' : '#fff', backgroundColor: color, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' };
  if (style === 'bold') return { ...base, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 2 } };
  return { ...base, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } };
}

export const fmt = (s) => { const t = Math.max(0, s || 0); const m = Math.floor(t / 60); const r = Math.floor(t % 60); return `${m}:${String(r).padStart(2, '0')}`; };
