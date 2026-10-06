// Pulse meter: a beating heart-orb with the person's Pulse score (0-100).
// The more people view and interact with the profile, the faster and hotter it beats.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, space } from '../lib/theme';

const ND = Platform.OS !== 'web';

export const PULSE_THEME = {
  quiet: { glow: '#8f84d8', core: '#e4defc', text: 'Quiet' },
  warm: { glow: '#a46bff', core: '#f1e6ff', text: 'Warming up' },
  buzzing: { glow: '#c35cff', core: '#f7e8ff', text: 'Buzzing' },
  hot: { glow: '#ff5fb8', core: '#ffe6f4', text: 'Hot' },
  fire: { glow: '#ff9a3d', core: '#fff1dc', text: 'On fire' },
};

/** Heartbeat speed: about 48 bpm when quiet, up to ~120 bpm when on fire. */
const beatMs = (score) => Math.round(1250 - Math.min(100, Math.max(0, score)) * 7.5);

// Heartbeat (ECG) trace, as points in a 0..1 box
const ECG = [[0, 0.55], [0.22, 0.55], [0.29, 0.42], [0.35, 0.66], [0.43, 0.04], [0.5, 0.98], [0.57, 0.26], [0.63, 0.6], [0.69, 0.48], [0.75, 0.55], [1, 0.55]];
const TICKS = 36;

function EcgLine({ w, h, color, glow, thick }) {
  return ECG.slice(1).map((p, i) => {
    const a = ECG[i];
    const x1 = a[0] * w; const y1 = a[1] * h; const x2 = p[0] * w; const y2 = p[1] * h;
    const len = Math.hypot(x2 - x1, y2 - y1) + thick * 0.6;
    const ang = Math.atan2(y2 - y1, x2 - x1);
    return (
      <View key={i} style={{ position: 'absolute', left: (x1 + x2) / 2 - len / 2, top: (y1 + y2) / 2 - thick / 2, width: len, height: thick, borderRadius: thick,
        backgroundColor: color, transform: [{ rotate: `${ang}rad` }], shadowColor: glow, shadowOpacity: 1, shadowRadius: thick * 2.2, shadowOffset: { width: 0, height: 0 } }} />
    );
  });
}

/**
 * The Pulse meter: dark bezel, neon heartbeat on a grid, glowing arcs and sparkles.
 * On open, the tick ring "loads" up to the score while the number counts up; then the heartbeat keeps sweeping.
 */
export default function PulseMeter({ pulse, size = 76, onPress, showLabel = true }) {
  const score = pulse?.score ?? 0;
  const th = PULSE_THEME[pulse?.level] || PULSE_THEME.quiet;
  const S = size;
  const D = S * 0.7; // inner disc
  const load = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const beat = useRef(new Animated.Value(0)).current;
  const twinkle = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);

  // loading: ticks + number count up to the score
  useEffect(() => {
    load.setValue(0); setShown(0);
    const id = load.addListener(({ value }) => setShown(Math.round(value)));
    const a = Animated.timing(load, { toValue: score, duration: 900 + score * 12, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    a.start();
    return () => { a.stop(); load.removeListener(id); };
  }, [score, load]);

  // heartbeat: the trace sweeps in, glows, fades; arcs flash on each beat
  useEffect(() => {
    const period = beatMs(score);
    const trace = Animated.loop(Animated.sequence([
      Animated.timing(sweep, { toValue: 1, duration: period * 0.55, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      Animated.delay(period * 0.25),
      Animated.timing(sweep, { toValue: 2, duration: period * 0.2, useNativeDriver: false }),
      Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: false }),
    ]));
    const heart = Animated.loop(Animated.sequence([
      Animated.timing(beat, { toValue: 1, duration: period * 0.14, easing: Easing.out(Easing.quad), useNativeDriver: ND }),
      Animated.timing(beat, { toValue: 0, duration: period * 0.5, easing: Easing.in(Easing.quad), useNativeDriver: ND }),
      Animated.delay(period * 0.36),
    ]));
    const tw = Animated.loop(Animated.sequence([
      Animated.timing(twinkle, { toValue: 1, duration: 1600, useNativeDriver: ND }),
      Animated.timing(twinkle, { toValue: 0, duration: 1600, useNativeDriver: ND }),
    ]));
    trace.start(); heart.start(); tw.start();
    return () => { trace.stop(); heart.stop(); tw.stop(); };
  }, [score, sweep, beat, twinkle]);

  const lit = Math.round((shown / 100) * TICKS);
  const ecgW = D * 0.88; const ecgH = D * 0.47;
  const revealW = sweep.interpolate({ inputRange: [0, 1, 2], outputRange: [0, ecgW, ecgW] });
  const traceOpacity = sweep.interpolate({ inputRange: [0, 1, 1.6, 2], outputRange: [1, 1, 0.55, 0.15] });
  const arcOpacity = beat.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });
  const arcScale = beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const thick = Math.max(1.5, S * 0.026);
  const arc = (side, inset, width) => ({
    position: 'absolute', left: inset, top: inset, right: inset, bottom: inset, borderRadius: S, borderWidth: width, borderColor: 'transparent',
    [`border${side}Color`]: th.glow, shadowColor: th.glow, shadowOpacity: 0.9, shadowRadius: width * 2.5, shadowOffset: { width: 0, height: 0 },
  });
  const sparkles = [[0.08, 0.3], [0.9, 0.22], [0.86, 0.78], [0.16, 0.84], [0.5, 0.04], [0.95, 0.52], [0.04, 0.6]];
  const gridStep = D / 7;

  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button" accessibilityLabel={`Pulse ${score}, ${th.text}`}
      style={({ hovered }) => ({ alignItems: 'center', flex: showLabel ? 1 : 0, transform: [{ scale: hovered ? 1.04 : 1 }] })}>
      <View style={{ width: S, height: S }}>
        {/* bezel */}
        <LinearGradient colors={['#3a3550', '#17141f', '#0d0b14']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
          style={{ position: 'absolute', left: 0, top: 0, width: S, height: S, borderRadius: S / 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
            shadowColor: th.glow, shadowOpacity: 0.45, shadowRadius: S * 0.12, shadowOffset: { width: 0, height: 0 } }} />
        {/* loading ring of ticks */}
        {Array.from({ length: TICKS }, (_, i) => {
          const ang = (i / TICKS) * Math.PI * 2 - Math.PI / 2;
          const r = S * 0.43; const tw = Math.max(1.4, S * 0.022); const thh = S * 0.055;
          const on = i < lit;
          return (
            <View key={i} style={{ position: 'absolute', left: S / 2 + Math.cos(ang) * r - tw / 2, top: S / 2 + Math.sin(ang) * r - thh / 2, width: tw, height: thh, borderRadius: tw,
              backgroundColor: on ? th.glow : 'rgba(255,255,255,0.1)', transform: [{ rotate: `${ang + Math.PI / 2}rad` }],
              shadowColor: th.glow, shadowOpacity: on ? 0.9 : 0, shadowRadius: 3, shadowOffset: { width: 0, height: 0 } }} />
          );
        })}
        {/* sparkles */}
        {sparkles.map(([x, y], i) => (
          <Animated.View key={i} style={{ position: 'absolute', left: x * S, top: y * S, width: S * 0.025, height: S * 0.025, borderRadius: S, backgroundColor: th.core,
            opacity: twinkle.interpolate({ inputRange: [0, 1], outputRange: i % 2 ? [0.2, 0.9] : [0.9, 0.2] }), shadowColor: th.glow, shadowOpacity: 1, shadowRadius: 3, shadowOffset: { width: 0, height: 0 } }} />
        ))}
        {/* inner disc */}
        <View style={{ position: 'absolute', left: (S - D) / 2, top: (S - D) / 2, width: D, height: D, borderRadius: D / 2, overflow: 'hidden', backgroundColor: '#130f22',
          borderWidth: 1, borderColor: `${th.glow}55` }}>
          {Array.from({ length: 6 }, (_, i) => (
            <View key={`v${i}`} style={{ position: 'absolute', left: gridStep * (i + 1), top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: `${th.glow}30` }} />
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <View key={`h${i}`} style={{ position: 'absolute', top: gridStep * (i + 1), left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: `${th.glow}30` }} />
          ))}
          {/* heartbeat trace, revealed left to right like a monitor */}
          <Animated.View style={{ position: 'absolute', left: (D - ecgW) / 2, top: D * 0.1, width: revealW, height: ecgH, overflow: 'hidden', opacity: traceOpacity }}>
            <View style={{ width: ecgW, height: ecgH }}>
              <EcgLine w={ecgW} h={ecgH} color={th.core} glow={th.glow} thick={thick} />
            </View>
          </Animated.View>
          {/* score */}
          <Text style={{ position: 'absolute', left: 0, right: 0, bottom: D * 0.1, textAlign: 'center', fontFamily: fonts.bold, color: '#fff', fontSize: D * 0.26,
            fontVariant: ['tabular-nums'], textShadowColor: th.glow, textShadowRadius: D * 0.08, textShadowOffset: { width: 0, height: 0 } }}>{shown}</Text>
        </View>
        {/* glowing arcs, flashing with the beat */}
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: S, height: S, opacity: arcOpacity, transform: [{ scale: arcScale }] }}>
          <View style={arc('Left', S * 0.165, Math.max(2, S * 0.042))} />
          <View style={arc('Right', S * 0.165, Math.max(2, S * 0.042))} />
          <View style={arc('Bottom', S * 0.115, Math.max(1.2, S * 0.022))} />
          <View style={arc('Top', S * 0.115, Math.max(1.2, S * 0.022))} />
        </Animated.View>
      </View>
      {showLabel ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <Text style={{ color: colors.text, fontSize: 12.5, fontFamily: fonts.body }}>Pulse</Text>
          {pulse?.trend === 'up' || pulse?.trend === 'down'
            ? <Ionicons name={pulse.trend === 'up' ? 'trending-up' : 'trending-down'} size={13} color={pulse.trend === 'up' ? colors.mint : colors.spark} style={{ marginLeft: 3 }} />
            : null}
        </View>
      ) : null}
    </Pressable>
  );
}

/** Shown when the meter is tapped: what the score means and what moves it. */
export function PulseInfo({ pulse, isMe, name, onClose }) {
  const th = PULSE_THEME[pulse?.level] || PULSE_THEME.quiet;
  const trend = pulse?.trend === 'up' ? 'Rising this week' : pulse?.trend === 'down' ? 'Cooling down this week' : 'Steady this week';
  return (
    <View style={{ marginTop: space.md, padding: space.md, borderRadius: 16, borderWidth: 1, borderColor: `${th.glow}66`, backgroundColor: 'rgba(26,24,40,0.9)' }}>
      <View style={{ alignItems: 'center', marginBottom: space.md }}><PulseMeter pulse={pulse} size={150} showLabel={false} /></View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="pulse" size={16} color={th.glow} style={{ marginRight: 6 }} />
        <Text style={{ flex: 1, fontFamily: fonts.semibold, color: colors.text, fontSize: 14 }}>{`Pulse ${pulse?.score ?? 0} · ${th.text}`}<Text style={{ fontFamily: fonts.body, color: colors.muted }}>{`  ·  ${trend}`}</Text></Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close"><Ionicons name="close" size={16} color={colors.muted} /></Pressable>
      </View>
      <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
        {isMe
          ? 'Your Pulse rises when people view your profile, like and comment on your posts, follow you, send you Soul Requests or connect with you. When nobody notices you for a while, it slowly falls. It counts the last 30 days, newest the most.'
          : `How much attention ${name || 'they'} got in the last 30 days: profile views, likes, comments, follows, Soul Requests and connections. Newer activity counts more.`}
      </Text>
    </View>
  );
}
