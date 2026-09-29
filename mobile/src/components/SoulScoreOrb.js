// Animated Soul Score shown on another person's profile.
// Opening the profile: a ring of 72 light ticks fills up in brand colours while the number counts up,
// the core glows and breathes, two sparks orbit, and a burst of light fires when the score lands.
// Then the vibe label rises in. Tap the orb to play it again. No SVG needed (works on phone and web).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, space } from '../lib/theme';

const ND = Platform.OS !== 'web';
const SIZE = 216;
const R = 96;          // ring radius
const N = 72;          // number of light ticks
const DURATION = 1900;

export function vibeOf(score) {
  if (score >= 90) return { label: 'Soul twins', line: 'This kind of match is rare. Your souls speak the same language.', icon: 'infinite', color: colors.gold };
  if (score >= 75) return { label: 'Rare connection', line: 'Strong pull. You two think and feel alike.', icon: 'flame', color: colors.spark };
  if (score >= 60) return { label: 'Great vibes', line: 'Plenty in common, and enough different to keep it fun.', icon: 'sparkles', color: colors.aura };
  if (score >= 45) return { label: 'Worth exploring', line: 'Some sparks. Say hi and find out more.', icon: 'compass', color: colors.mint };
  return { label: 'Opposites attract', line: 'Different wavelengths. Sometimes that is the magic.', icon: 'swap-horizontal', color: colors.mint };
}

// purple → pink → gold along the ring
const STOPS = [[124, 92, 252], [255, 107, 157], [245, 200, 66]];
function tickColor(i) {
  const t = i / (N - 1);
  const [a, b, k] = t < 0.6 ? [STOPS[0], STOPS[1], t / 0.6] : [STOPS[1], STOPS[2], (t - 0.6) / 0.4];
  return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * k)).join(',')})`;
}

export default function SoulScoreOrb({ score, name }) {
  const [run, setRun] = useState(0);
  const [shown, setShown] = useState(0);
  const [lit, setLit] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const vibe = vibeOf(score);
  const colorsByTick = useMemo(() => Array.from({ length: N }, (_, i) => tickColor(i)), []);

  // count up + fill the ring, then burst and show the vibe
  useEffect(() => {
    progress.setValue(0); burst.setValue(0); rise.setValue(0); setShown(0); setLit(0);
    const id = progress.addListener(({ value }) => {
      setShown(Math.round(value * score));
      setLit(Math.round(value * (score / 100) * N));
    });
    const anim = Animated.sequence([
      Animated.delay(250),
      Animated.timing(progress, { toValue: 1, duration: DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.parallel([
        Animated.timing(burst, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: ND }),
        Animated.spring(rise, { toValue: 1, friction: 6, tension: 60, useNativeDriver: ND }),
      ]),
    ]);
    anim.start();
    return () => { anim.stop(); progress.removeListener(id); };
  }, [score, run, progress, burst, rise]);

  // endless breathing glow + orbiting sparks
  useEffect(() => {
    const p = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
      Animated.timing(pulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
    ]));
    const o = Animated.loop(Animated.timing(orbit, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: ND }));
    p.start(); o.start();
    return () => { p.stop(); o.stop(); };
  }, [pulse, orbit]);

  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.09] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });
  const spin = orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spinBack = orbit.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });

  return (
    <View style={{ alignItems: 'center', marginBottom: space.lg }}>
      {name ? <Text style={{ fontFamily: fonts.mono, color: colors.muted, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: space.sm }}>You & {name}</Text> : null}
      <Pressable onPress={() => setRun((r) => r + 1)} accessibilityLabel={`Soul Score ${score} percent. Tap to replay`} style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
        {/* breathing halo */}
        <Animated.View style={{ position: 'absolute', width: 170, height: 170, borderRadius: 85, backgroundColor: vibe.color, opacity: glowOpacity, transform: [{ scale: glowScale }], ...(Platform.OS === 'web' ? { filter: 'blur(28px)' } : { shadowColor: vibe.color, shadowOpacity: 0.9, shadowRadius: 30 }) }} />

        {/* ring of light ticks */}
        {colorsByTick.map((c, i) => {
          const on = i < lit;
          return (
            <View key={i} style={{
              position: 'absolute', left: SIZE / 2 - 1.5, top: SIZE / 2 - (on ? 7 : 5), width: 3, height: on ? 14 : 10, borderRadius: 2,
              backgroundColor: on ? c : colors.border, opacity: on ? 1 : 0.7,
              transform: [{ rotate: `${(i / N) * 360}deg` }, { translateY: -R }],
            }} />
          );
        })}

        {/* orbiting sparks */}
        <Animated.View pointerEvents="none" style={{ position: 'absolute', width: SIZE, height: SIZE, transform: [{ rotate: spin }] }}>
          <View style={{ position: 'absolute', top: 2, left: SIZE / 2 - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.spark, shadowColor: colors.spark, shadowOpacity: 1, shadowRadius: 8 }} />
        </Animated.View>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', width: SIZE - 40, height: SIZE - 40, transform: [{ rotate: spinBack }] }}>
          <View style={{ position: 'absolute', bottom: 0, left: (SIZE - 40) / 2 - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.aura, shadowColor: colors.aura, shadowOpacity: 1, shadowRadius: 6 }} />
        </Animated.View>

        {/* burst when the score lands */}
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          return (
            <Animated.View key={`b${i}`} pointerEvents="none" style={{
              position: 'absolute', width: 6, height: 6, borderRadius: 3, backgroundColor: i % 2 ? colors.gold : colors.spark,
              opacity: burst.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
              transform: [
                { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [Math.cos(a) * 60, Math.cos(a) * 125] }) },
                { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [Math.sin(a) * 60, Math.sin(a) * 125] }) },
              ],
            }} />
          );
        })}

        {/* core */}
        <LinearGradient colors={['rgba(124,92,252,0.38)', 'rgba(255,107,157,0.16)', 'rgba(8,7,13,0.9)']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
          style={{ width: 148, height: 148, borderRadius: 74, borderWidth: 1, borderColor: 'rgba(176,143,255,0.45)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Text style={{ fontFamily: fonts.display, color: colors.text, fontSize: 54, lineHeight: 62 }}>{shown}</Text>
            <Text style={{ fontFamily: fonts.displayBold, color: colors.spark, fontSize: 20, marginTop: 8, marginLeft: 2 }}>%</Text>
          </View>
          <Text style={{ fontFamily: fonts.mono, color: colors.aura, fontSize: 10, letterSpacing: 2.5, marginTop: -2 }}>SOUL SCORE</Text>
        </LinearGradient>
      </Pressable>

      {/* vibe label rises in after the count */}
      <Animated.View style={{ alignItems: 'center', opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: vibe.color, backgroundColor: 'rgba(26,24,40,0.72)' }}>
          <Ionicons name={vibe.icon} size={14} color={vibe.color} style={{ marginRight: 6 }} />
          <Text style={{ fontFamily: fonts.semibold, color: vibe.color, fontSize: 14 }}>{vibe.label}</Text>
        </View>
        <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: space.sm, paddingHorizontal: space.xl }}>{vibe.line}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.sm }}>
          <Ionicons name="lock-closed" size={12} color={colors.gold} style={{ marginRight: 5 }} />
          <Text style={{ fontFamily: fonts.medium, color: colors.gold, fontSize: 12 }}>Why you match · Premium</Text>
        </View>
      </Animated.View>
    </View>
  );
}
