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

// Adjust: brightness, contrast, saturation, warmth (each -1 … 1), on top of the filter
export const ADJUSTS = [['b', 'Brightness', 'brightness-6'], ['c', 'Contrast', 'contrast-box'], ['s', 'Saturation', 'water-percent'], ['w', 'Warmth', 'thermometer']];
export function adjustCss(a) {
  if (!a) return '';
  const out = [];
  if (a.b) out.push(`brightness(${(1 + a.b * 0.45).toFixed(3)})`);
  if (a.c) out.push(`contrast(${(1 + a.c * 0.45).toFixed(3)})`);
  if (a.s) out.push(`saturate(${(1 + a.s * (a.s > 0 ? 0.9 : 1)).toFixed(3)})`);
  if (a.w > 0) out.push(`sepia(${(a.w * 0.35).toFixed(3)})`);
  if (a.w < 0) out.push(`hue-rotate(${Math.round(a.w * -18)}deg) saturate(${(1 - a.w * 0.08).toFixed(3)})`);
  return out.join(' ');
}
/** the CSS filter for a Spark: its filter + adjustments */
export const videoCss = (e) => [filterCss(e?.filter) === 'none' ? '' : filterCss(e?.filter), adjustCss(e?.adjust)].filter(Boolean).join(' ') || 'none';
/** zoom / crop: scale around a focus point */
export const zoomCss = (z) => (z && z.s > 1.001 ? { transform: `scale(${z.s})`, transformOrigin: `${(z.x * 100).toFixed(1)}% ${(z.y * 100).toFixed(1)}%` } : {});
/** how dark the fade is at time t (seconds of the original video) */
export function fadeAt(fade, t, t0, t1) {
  if (!fade || (!fade.in && !fade.out)) return 0;
  if (fade.in && t - t0 < fade.in) return 1 - Math.max(0, t - t0) / fade.in;
  if (fade.out && t1 && t1 - t < fade.out) return 1 - Math.max(0, t1 - t) / fade.out;
  return 0;
}
/** is this text on screen at time t? (no from / to = the whole Spark) */
export const textShown = (x, t) => t == null || ((x.from == null || t >= x.from - 0.01) && (x.to == null || t <= x.to + 0.01));


/** Text overlay look */
export function textStyleOf(style, color, size) {
  const base = { color, fontSize: size, lineHeight: size * 1.2, textAlign: 'center', fontWeight: '700' };
  if (style === 'neon') return { ...base, color: '#fff', textShadowColor: color === '#ffffff' ? '#ff6b9d' : color, textShadowRadius: 14, textShadowOffset: { width: 0, height: 0 } };
  if (style === 'box') return { ...base, color: color === '#ffffff' || color === '#f5c842' ? '#14121f' : '#fff', backgroundColor: color, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, overflow: 'hidden' };
  if (style === 'bold') return { ...base, fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 2 } };
  return { ...base, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } };
}

export const fmt = (s) => { const t = Math.max(0, s || 0); const m = Math.floor(t / 60); const r = Math.floor(t % 60); return `${m}:${String(r).padStart(2, '0')}`; };
