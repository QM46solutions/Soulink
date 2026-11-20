// Text that fits the phone it's on (phone apps only; the browser is unchanged).
// Soulink was designed on a 440-pt-wide iPhone. Most Android phones are 360–412 dp wide, so the same font sizes
// took a bigger share of the screen and captions / buttons looked oversized. Here every Text and TextInput gets:
//   - its font size (and line height) scaled to the screen's own width: full size from REF_WIDTH up, never below
//     MIN_K, so it fits any phone without per-model sizes, and
//   - a cap on how much the phone's "large text" setting can grow it (MAX_GROWTH), so layouts don't break apart.
// Icons (allowFontScaling={false}) and anything else that opts out of font scaling keep their exact size.
// Runs once at startup (imported first in app/_layout.js), by swapping in a scaled Text / TextInput.
import { createElement } from 'react';
import { Dimensions, Platform, StyleSheet } from 'react-native';

const REF_WIDTH = 430;
const MIN_K = 0.86;
const MAX_GROWTH = 1.1;

let k = 1;
const update = () => {
  const { width, height } = Dimensions.get('window');
  k = Math.max(MIN_K, Math.min(1, Math.min(width, height) / REF_WIDTH));
};

function scaled(style) {
  if (k >= 0.999 || style == null) return style;
  const flat = StyleSheet.flatten(style);
  if (!flat || (flat.fontSize == null && flat.lineHeight == null)) return style;
  const out = { ...flat };
  if (out.fontSize != null) out.fontSize = Math.round(out.fontSize * k * 2) / 2;
  if (out.lineHeight != null) out.lineHeight = Math.round(out.lineHeight * k);
  return out;
}

function wrap(Orig, name) {
  function Scaled(props) {
    if (props.allowFontScaling === false) return createElement(Orig, props);
    return createElement(Orig, { maxFontSizeMultiplier: MAX_GROWTH, ...props, style: scaled(props.style) });
  }
  // keep the original's statics (TextInput.State, displayName, …)
  for (const key of Object.getOwnPropertyNames(Orig)) {
    if (['length', 'name', 'prototype', 'caller', 'arguments'].includes(key)) continue;
    try { Object.defineProperty(Scaled, key, Object.getOwnPropertyDescriptor(Orig, key)); } catch { /* read-only */ }
  }
  Scaled.displayName = name;
  return Scaled;
}

export function installTextScale() {
  if (Platform.OS === 'web') return;
  try {
    update();
    Dimensions.addEventListener?.('change', update);
    const RN = require('react-native'); // eslint-disable-line global-require
    const Text = wrap(RN.Text, 'Text'); const TextInput = wrap(RN.TextInput, 'TextInput');
    Object.defineProperty(RN, 'Text', { configurable: true, enumerable: true, get: () => Text });
    Object.defineProperty(RN, 'TextInput', { configurable: true, enumerable: true, get: () => TextInput });
  } catch { /* leave text as it is */ }
}
export const textScale = () => k;
