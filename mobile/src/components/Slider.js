// Small sliders for the Spark studio: a single value, or a start–end range (trim). Drag or tap the track.
import { useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import { colors } from '../lib/theme';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function Slider({ value, min = 0, max = 1, onChange, onDone, color = colors.aura, height = 36 }) {
  const [w, setW] = useState(1);
  const left = useRef(0);
  const box = useRef(null);
  const toVal = (px) => min + clamp(px / w, 0, 1) * (max - min);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => onChange?.(toValRef.current(e.nativeEvent.locationX)),
    onPanResponderMove: (e, g) => onChange?.(toValRef.current(g.moveX - left.current)),
    onPanResponderRelease: () => onDone?.(), onPanResponderTerminationRequest: () => false,
  })).current;
  const toValRef = useRef(toVal); toValRef.current = toVal;
  const pct = ((clamp(value, min, max) - min) / (max - min || 1)) * 100;
  return (
    <View ref={box} {...pan.panHandlers} onLayout={(e) => { setW(e.nativeEvent.layout.width); box.current?.measure?.((x, y, ww, hh, px) => { left.current = px || 0; }); }}
      style={{ height, justifyContent: 'center' }}>
      <View pointerEvents="none" style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)' }}>
        <View style={{ width: `${pct}%`, height: 4, borderRadius: 2, backgroundColor: color }} />
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', left: `${pct}%`, marginLeft: -11, width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', borderWidth: 3, borderColor: color }} />
    </View>
  );
}

/** Two handles (start, end). minGap/maxGap in the same units as the value (seconds). */
export function RangeSlider({ start, end, min = 0, max = 1, minGap = 1, maxGap, onChange, onDone, height = 56, children }) {
  const [w, setW] = useState(1);
  const left = useRef(0);
  const box = useRef(null);
  const which = useRef(null);
  const st = useRef({ start, end }); st.current = { start, end };
  const cfg = useRef({}); cfg.current = { w, min, max, minGap, maxGap, onChange };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const { w: ww, min: mn, max: mx } = cfg.current;
      const v = mn + clamp(e.nativeEvent.locationX / ww, 0, 1) * (mx - mn);
      which.current = Math.abs(v - st.current.start) <= Math.abs(v - st.current.end) ? 'start' : 'end';
    },
    onPanResponderMove: (e, g) => {
      const { w: ww, min: mn, max: mx, minGap: lo, maxGap: hi, onChange: ch } = cfg.current;
      const v = mn + clamp((g.moveX - left.current) / ww, 0, 1) * (mx - mn);
      let { start: s, end: en } = st.current;
      if (which.current === 'start') { s = clamp(v, mn, en - lo); if (hi && en - s > hi) en = s + hi; }
      else { en = clamp(v, s + lo, mx); if (hi && en - s > hi) s = en - hi; }
      ch?.(s, en, which.current);
    },
    onPanResponderRelease: () => onDone?.(), onPanResponderTerminationRequest: () => false,
  })).current;
  const pS = ((start - min) / (max - min || 1)) * 100;
  const pE = ((end - min) / (max - min || 1)) * 100;
  return (
    <View ref={box} {...pan.panHandlers} onLayout={(e) => { setW(e.nativeEvent.layout.width); box.current?.measure?.((x, y, ww, hh, px) => { left.current = px || 0; }); }}
      style={{ height, justifyContent: 'center', borderRadius: 10, overflow: 'hidden' }}>
      {children /* frame thumbnails */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${pS}%`, backgroundColor: 'rgba(0,0,0,0.6)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: `${pE}%`, right: 0, backgroundColor: 'rgba(0,0,0,0.6)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: `${pS}%`, width: `${pE - pS}%`, borderWidth: 3, borderColor: colors.spark, borderRadius: 10 }} />
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: `${pS}%`, width: 14, backgroundColor: colors.spark, borderTopLeftRadius: 10, borderBottomLeftRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 3, height: 18, borderRadius: 2, backgroundColor: '#fff' }} />
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: `${pE}%`, marginLeft: -14, width: 14, backgroundColor: colors.spark, borderTopRightRadius: 10, borderBottomRightRadius: 10, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 3, height: 18, borderRadius: 2, backgroundColor: '#fff' }} />
      </View>
    </View>
  );
}
