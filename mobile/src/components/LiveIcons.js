// Live animated icons from the Soulink pitch site (soulink-pitch.netlify.app), rebuilt with plain views
// so they run on phone and web without SVG:
//   <FaceScanIcon/>  oval face + teal scan line sweeping up and down      (Real Identity / Face ID)
//   <SoulDnaIcon/>   turning double helix of pink and violet dots          (Soul DNA)
//   <RadarIcon/>     gold radar sweep, blips and a target lock              (Visual Discovery / Discover)
//   <ScalesIcon/>    balance beam tipping side to side, pulsing centre      (Argue Referee)
//   <LiveFrame/>     the glass card with corner brackets and a "// LABEL.LIVE" tag around any of them
// Every icon is drawn at 200×200 and scaled to `size`, so it looks the same at 40 px or 240 px.
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, Text, View } from 'react-native';
import { colors, fonts } from '../lib/theme';

const ND = Platform.OS !== 'web';
const B = 200; // design size
const TEAL = '#42e8c0';
const GOLD = '#f5c842';
const PINK = '#ff6b9d';
const VIOLET = '#9f7bff';

function useLoop(duration, { easing = Easing.linear, reverse = false } = {}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = reverse
      ? Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: ND }),
        Animated.timing(v, { toValue: 0, duration, easing, useNativeDriver: ND }),
      ]))
      : Animated.loop(Animated.timing(v, { toValue: 1, duration, easing, useNativeDriver: ND }));
    a.start();
    return () => a.stop();
  }, [v, duration, easing, reverse]);
  return v;
}

/** Scales the 200×200 drawing to the requested size. */
function Stage({ size, children }) {
  const k = size / B;
  return (
    <View style={{ width: size, height: size, overflow: 'visible' }} pointerEvents="none">
      <View style={{ position: 'absolute', width: B, height: B, left: (size - B) / 2, top: (size - B) / 2, transform: [{ scale: k }] }}>
        {children}
      </View>
    </View>
  );
}

// ---------- Face scan ----------
export function FaceScanIcon({ size = 120, color = TEAL }) {
  const scan = useLoop(1600, { easing: Easing.inOut(Easing.sin), reverse: true });
  const pulse = useLoop(1400, { easing: Easing.inOut(Easing.sin), reverse: true });
  const W = 110; const H = 146; const x0 = (B - W) / 2; const y0 = (B - H) / 2;
  const eye = (left) => (
    <View style={{ position: 'absolute', left: left ? 60 : 108, top: 72, width: 32, height: 18, borderRadius: 16, borderWidth: 1.5, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color }} />
    </View>
  );
  return (
    <Stage size={size}>
      {/* outer pulsing halo */}
      <Animated.View style={{ position: 'absolute', left: x0 - 7, top: y0 - 7, width: W + 14, height: H + 14, borderRadius: (W + 14) / 2, borderWidth: 1, borderColor: color,
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.55] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.03] }) }] }} />
      <View style={{ position: 'absolute', left: x0, top: y0, width: W, height: H, borderRadius: W / 2, borderWidth: 2, borderColor: color }} />
      <View style={{ position: 'absolute', left: x0 + 3, top: y0 + 2, width: W - 6, height: H - 4, borderRadius: (W - 6) / 2, borderWidth: 1, borderColor: color, opacity: 0.35 }} />
      {eye(true)}{eye(false)}
      {/* nose */}
      <View style={{ position: 'absolute', left: 99, top: 92, width: 1.5, height: 20, backgroundColor: color, transform: [{ rotate: '18deg' }] }} />
      <View style={{ position: 'absolute', left: 95, top: 111, width: 10, height: 1.5, backgroundColor: color }} />
      {/* smile */}
      <View style={{ position: 'absolute', left: 76, top: 108, width: 48, height: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, borderWidth: 1.5, borderTopWidth: 0, borderColor: color }} />
      {/* scan line */}
      <Animated.View style={{ position: 'absolute', left: x0 - 22, width: W + 44, top: y0 + 6, height: 4, borderRadius: 2, backgroundColor: color,
        shadowColor: color, shadowOpacity: 1, shadowRadius: 10, ...(Platform.OS === 'web' ? { boxShadow: `0 0 14px ${color}` } : {}),
        transform: [{ translateY: scan.interpolate({ inputRange: [0, 1], outputRange: [0, H - 16] }) }] }}>
        <View style={{ position: 'absolute', left: (W + 44) / 2 - 4, top: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />
      </Animated.View>
    </Stage>
  );
}

// ---------- Soul DNA helix ----------
const RUNGS = 16;
const STEPS = 24;
export function SoulDnaIcon({ size = 120 }) {
  const t = useLoop(3600);
  const input = useMemo(() => Array.from({ length: STEPS + 1 }, (_, k) => k / STEPS), []);
  const rungs = useMemo(() => Array.from({ length: RUNGS }, (_, i) => {
    const phase = i * 0.55;
    const sin = input.map((x) => Math.sin(x * Math.PI * 2 + phase));
    const cos = input.map((x) => Math.cos(x * Math.PI * 2 + phase));
    return { i, sin, cos };
  }), [input]);
  const A = 42; const top = 18; const gap = (B - 2 * top) / (RUNGS - 1);
  return (
    <Stage size={size}>
      {rungs.map(({ i, sin, cos }) => {
        const y = top + i * gap;
        const leftX = t.interpolate({ inputRange: input, outputRange: sin.map((s) => -A * s) });
        const rightX = t.interpolate({ inputRange: input, outputRange: sin.map((s) => A * s) });
        const frontL = t.interpolate({ inputRange: input, outputRange: cos.map((c) => 0.7 + 0.45 * c) });
        const frontR = t.interpolate({ inputRange: input, outputRange: cos.map((c) => 0.7 - 0.45 * c) });
        const opL = t.interpolate({ inputRange: input, outputRange: cos.map((c) => Math.min(1, 0.6 + 0.4 * c)) });
        const opR = t.interpolate({ inputRange: input, outputRange: cos.map((c) => Math.min(1, 0.6 - 0.4 * c)) });
        const width = t.interpolate({ inputRange: input, outputRange: sin.map((s) => Math.max(0.02, Math.abs(s))) });
        const pinkFirst = i % 4 < 2;
        return (
          <View key={i} style={{ position: 'absolute', left: B / 2, top: y }}>
            <Animated.View style={{ position: 'absolute', left: -A, top: -0.75, width: 2 * A, height: 1.5, backgroundColor: 'rgba(176,143,255,0.55)', transform: [{ scaleX: width }] }} />
            <Animated.View style={{ position: 'absolute', left: -6, top: -6, width: 12, height: 12, borderRadius: 6, backgroundColor: pinkFirst ? PINK : VIOLET, opacity: opL, transform: [{ translateX: leftX }, { scale: frontL }] }} />
            <Animated.View style={{ position: 'absolute', left: -6, top: -6, width: 12, height: 12, borderRadius: 6, backgroundColor: pinkFirst ? VIOLET : PINK, opacity: opR, transform: [{ translateX: rightX }, { scale: frontR }] }} />
          </View>
        );
      })}
    </Stage>
  );
}

// ---------- Radar (visual discovery) ----------
const BLIPS = [[58, 70], [128, 52], [150, 118], [74, 140], [110, 96], [44, 110], [138, 158]];
export function RadarIcon({ size = 120, color = GOLD }) {
  const spin = useLoop(3200);
  const blink = useLoop(900, { easing: Easing.inOut(Easing.sin), reverse: true });
  const lock = useLoop(3200);
  const rot = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const R = 88; const c = B / 2;
  const ring = (r, o) => <View key={r} style={{ position: 'absolute', left: c - r, top: c - r, width: 2 * r, height: 2 * r, borderRadius: r, borderWidth: 1, borderColor: color, opacity: o }} />;
  return (
    <Stage size={size}>
      {ring(R, 0.45)}{ring(R * 0.66, 0.35)}{ring(R * 0.33, 0.3)}
      <View style={{ position: 'absolute', left: c - R, top: c - 0.5, width: 2 * R, height: 1, backgroundColor: color, opacity: 0.3 }} />
      <View style={{ position: 'absolute', left: c - 0.5, top: c - R, width: 1, height: 2 * R, backgroundColor: color, opacity: 0.3 }} />
      {BLIPS.map(([x, y], i) => (
        <Animated.View key={i} style={{ position: 'absolute', left: x - 2.5, top: y - 2.5, width: 5, height: 5, borderRadius: 2.5, backgroundColor: color,
          opacity: blink.interpolate({ inputRange: [0, 1], outputRange: i % 2 ? [0.25, 0.9] : [0.9, 0.25] }) }} />
      ))}
      {/* sweep: a bright arm with a fading fan behind it */}
      <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: B, height: B, transform: [{ rotate: rot }] }}>
        {Array.from({ length: 12 }, (_, k) => (
          <View key={k} style={{ position: 'absolute', left: c - 1, top: c - R, width: k ? 2.5 : 2, height: R, backgroundColor: color, opacity: k ? 0.22 - k * 0.017 : 1,
            transform: [{ translateY: R / 2 }, { rotate: `${-k * 3.2}deg` }, { translateY: -R / 2 }] }} />
        ))}
        <View style={{ position: 'absolute', left: c - 4, top: c - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      </Animated.View>
      {/* target lock square blinks in once per sweep */}
      <Animated.View style={{ position: 'absolute', left: 122, top: 40, width: 26, height: 26, borderWidth: 1.5, borderColor: PINK,
        opacity: lock.interpolate({ inputRange: [0, 0.55, 0.6, 0.9, 1], outputRange: [0, 0, 1, 1, 0] }) }}>
        <View style={{ position: 'absolute', left: 12, top: -6, width: 1.5, height: 36, backgroundColor: PINK }} />
        <View style={{ position: 'absolute', top: 12, left: -6, height: 1.5, width: 36, backgroundColor: PINK }} />
      </Animated.View>
    </Stage>
  );
}

// ---------- Scales (argue referee) ----------
export function ScalesIcon({ size = 120, color = GOLD }) {
  const tip = useLoop(1800, { easing: Easing.inOut(Easing.sin), reverse: true });
  const pulse = useLoop(1200, { easing: Easing.inOut(Easing.sin), reverse: true });
  const L = 70; const c = B / 2; const beamY = 62; const deg = 7;
  const rot = tip.interpolate({ inputRange: [0, 1], outputRange: [`-${deg}deg`, `${deg}deg`] });
  const lift = L * Math.sin((deg * Math.PI) / 180);
  const pan = (side, dotColor) => {
    const dy = tip.interpolate({ inputRange: [0, 1], outputRange: side < 0 ? [lift, -lift] : [-lift, lift] });
    return (
      <Animated.View style={{ position: 'absolute', left: c + side * L - 12, top: beamY, width: 24, alignItems: 'center', transform: [{ translateY: dy }] }}>
        <View style={{ width: 1, height: 50, backgroundColor: color, opacity: 0.6 }} />
        <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: dotColor, marginTop: -2, shadowColor: dotColor, shadowOpacity: 0.9, shadowRadius: 8 }} />
        <View style={{ width: 24, height: 12, marginTop: 2, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, borderWidth: 1, borderTopWidth: 0, borderColor: colors.muted, opacity: 0.6 }} />
      </Animated.View>
    );
  };
  return (
    <Stage size={size}>
      {/* pole and base */}
      <View style={{ position: 'absolute', left: c - 1, top: beamY, width: 2, height: 100, backgroundColor: color }} />
      <View style={{ position: 'absolute', left: c - 34, top: beamY + 112, width: 68, height: 2, backgroundColor: color }} />
      {/* beam */}
      <Animated.View style={{ position: 'absolute', left: c - L, top: beamY - 1, width: 2 * L, height: 2, backgroundColor: color, transform: [{ rotate: rot }] }} />
      <View style={{ position: 'absolute', left: c - 4, top: beamY - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      {pan(-1, VIOLET)}{pan(1, PINK)}
      {/* pulsing verdict ring */}
      <Animated.View style={{ position: 'absolute', left: c - 18, top: beamY + 52, width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: PINK,
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.1] }) }] }} />
      <View style={{ position: 'absolute', left: c - 4, top: beamY + 66, width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />
    </Stage>
  );
}

/** Glass card with the pitch-site corner brackets and a mono "// LABEL" tag. */
export function LiveFrame({ children, label, size = 220, style }) {
  const br = (pos) => {
    const t = pos.includes('t'); const l = pos.includes('l');
    return <View key={pos} style={{ position: 'absolute', [t ? 'top' : 'bottom']: 10, [l ? 'left' : 'right']: 10, width: 18, height: 18,
      borderColor: 'rgba(176,143,255,0.7)', [t ? 'borderTopWidth' : 'borderBottomWidth']: 1.5, [l ? 'borderLeftWidth' : 'borderRightWidth']: 1.5 }} />;
  };
  return (
    <View style={[{ width: size, height: size, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(42,39,64,0.9)', backgroundColor: 'rgba(14,12,22,0.72)', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', overflow: 'hidden' }, style]}>
      {['tl', 'tr', 'bl', 'br'].map(br)}
      {children}
      {label ? <Text numberOfLines={1} style={{ position: 'absolute', left: 32, right: 12, bottom: 12, fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1.5, color: colors.muted }}>{`// ${label}`}</Text> : null}
    </View>
  );
}
