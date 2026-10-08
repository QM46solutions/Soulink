// Animated galaxy behind an open chat: slow-drifting nebula clouds, two layers of stars that glide past
// at different speeds (depth), and a gentle twinkle. Very slow, but you can see it move.
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const ND = Platform.OS !== 'web';
const loop = (v, ms) => Animated.loop(Animated.sequence([
  Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
  Animated.timing(v, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
]));

function seeded(n, seed, w, h) {
  let x = seed;
  const r = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
  return Array.from({ length: n }, () => ({ left: r() * w, top: r() * h, s: 0.8 + r() * 1.8, o: 0.35 + r() * 0.6 }));
}

function Stars({ w, h, n, seed, speed, drift }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(v, { toValue: 1, duration: speed, easing: Easing.linear, useNativeDriver: ND }));
    a.start();
    return () => a.stop();
  }, [v, speed]);
  const stars = useMemo(() => seeded(n, seed, w, h), [n, seed, w, h]);
  // two copies stacked so the glide loops without a jump
  const ty = v.interpolate({ inputRange: [0, 1], outputRange: [0, -h] });
  const tx = v.interpolate({ inputRange: [0, 1], outputRange: [0, drift] });
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: w, height: h * 2, transform: [{ translateY: ty }, { translateX: tx }] }}>
      {[0, h].map((off) => stars.map((st, i) => (
        <View key={`${off}-${i}`} style={{ position: 'absolute', left: st.left, top: st.top + off, width: st.s, height: st.s, borderRadius: st.s, backgroundColor: '#fff', opacity: st.o }} />
      )))}
    </Animated.View>
  );
}

function Nebula({ color, size, x, y, ms, dx, dy }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { const a = loop(v, ms); a.start(); return () => a.stop(); }, [v, ms]);
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: size / 2, overflow: 'hidden',
      opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.85] }),
      transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) }, { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }],
      ...(Platform.OS === 'web' ? { filter: 'blur(38px)' } : {}) }}>
      <LinearGradient colors={[color, 'rgba(8,7,13,0)']} start={{ x: 0.5, y: 0.5 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
    </Animated.View>
  );
}

export default function GalaxyBackground() {
  const { width: w, height: h } = useWindowDimensions();
  const tw = useRef(new Animated.Value(0)).current;
  useEffect(() => { const a = loop(tw, 2600); a.start(); return () => a.stop(); }, [tw]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden', backgroundColor: '#07060c' }]}>
      <Nebula color="rgba(124,92,252,0.55)" size={w * 1.1} x={-w * 0.45} y={h * 0.05} ms={18000} dx={60} dy={40} />
      <Nebula color="rgba(255,107,157,0.42)" size={w * 0.95} x={w * 0.35} y={h * 0.42} ms={22000} dx={-50} dy={-60} />
      <Nebula color="rgba(63,169,245,0.30)" size={w * 0.8} x={w * 0.1} y={h * 0.7} ms={26000} dx={40} dy={-30} />
      <Stars w={w} h={h} n={70} seed={7} speed={140000} drift={-20} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: tw.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) }]}>
        <Stars w={w} h={h} n={28} seed={42} speed={80000} drift={14} />
      </Animated.View>
    </View>
  );
}
