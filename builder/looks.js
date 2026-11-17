// Soul Looks and adjustments as ffmpeg filters. The same names and the same feel as the app's preview
// (mobile/src/lib/sparkEdit.js, which uses CSS filters), so a Spark looks the same after it's built.
const sepia = (k) => { // CSS sepia(k): a mix between the identity matrix and the sepia matrix
  const S = [[0.393, 0.769, 0.189], [0.349, 0.686, 0.168], [0.272, 0.534, 0.131]];
  const m = S.map((row, i) => row.map((v, j) => (1 - k) * (i === j ? 1 : 0) + k * v));
  const k3 = ['r', 'g', 'b'];
  return `colorchannelmixer=${m.map((r, i) => r.map((v, j) => `${k3[i]}${k3[j]}=${v.toFixed(3)}`).join(':')).join(':')}`;
};
export const LOOKS = {
  none: [],
  dream: ['eq=saturation=1.15:contrast=1.05:brightness=0.02', 'hue=h=-12'],          // "Soul"
  warm: [sepia(0.25), 'eq=saturation=1.3:brightness=0.02'],
  cool: ['hue=h=12', 'eq=saturation=1.1:brightness=0.015:contrast=1.02'],
  vivid: ['eq=saturation=1.6:contrast=1.12'],
  fade: ['eq=contrast=0.88:brightness=0.04:saturation=0.85'],
  vintage: [sepia(0.55), 'eq=contrast=1.05:saturation=0.9'],
  mono: ['hue=s=0', 'eq=contrast=1.1'],
  noir: ['hue=s=0', 'eq=contrast=1.45:brightness=-0.05'],
};
/** Adjust sliders, each -1…1: brightness, contrast, saturation, warmth */
export function adjustFilters(a = {}) {
  const out = [];
  const eq = [];
  if (a.b) eq.push(`brightness=${(a.b * 0.15).toFixed(3)}`);
  if (a.c) eq.push(`contrast=${(1 + a.c * 0.45).toFixed(3)}`);
  if (a.s) eq.push(`saturation=${(1 + a.s * (a.s > 0 ? 0.9 : 1)).toFixed(3)}`);
  if (eq.length) out.push(`eq=${eq.join(':')}`);
  if (a.w) out.push(`colorbalance=rs=${(a.w * 0.12).toFixed(3)}:gs=${(a.w * 0.03).toFixed(3)}:bs=${(-a.w * 0.12).toFixed(3)}`);
  return out;
}
