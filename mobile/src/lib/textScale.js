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

// REF_WIDTH: the browser version's phone (440 pt), so text takes the same share of the screen as it does there.
// ANDROID: Android draws the same font size a little taller and bolder than the browser (extra font padding, its
// text renderer), so text there gets a further 5% off to look like the browser version. MIN_SIZE: never smaller
// than this (small print stays readable).
const REF_WIDTH = 440;
const MIN_K = 0.82;
const ANDROID = Platform.OS === 'android' ? 0.95 : 1;
const MIN_SIZE = 11;
const MAX_GROWTH = 1.1;

let k = 1;
const update = () => {
  const { width, height } = Dimensions.get('window');
  k = Math.max(MIN_K, Math.min(1, Math.min(width, height) / REF_WIDTH)) * ANDROID;
};

function scaled(style) {
  if (k >= 0.999 || style == null) return style;
  const flat = StyleSheet.flatten(style);
  if (!flat || (flat.fontSize == null && flat.lineHeight == null)) return style;
  const out = { ...flat };
  let f = k;
  if (out.fontSize != null) {
    const size = Math.max(Math.min(out.fontSize, MIN_SIZE), Math.round(out.fontSize * k * 2) / 2);
    f = size / out.fontSize; out.fontSize = size;
  }
  if (out.lineHeight != null) out.lineHeight = Math.round(out.lineHeight * f);
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
