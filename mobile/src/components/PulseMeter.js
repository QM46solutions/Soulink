// Pulse meter: a beating heart-orb with the person's Pulse score (0-100).
// The more people view and interact with the profile, the faster and hotter it beats.
import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, space } from '../lib/theme';

const ND = Platform.OS !== 'web';

export const PULSE_THEME = {
  quiet: { colors: ['#3b3f5e', '#5d6590'], glow: '#7d86b8', text: 'Quiet' },
  warm: { colors: ['#7c5cfc', '#b08fff'], glow: '#b08fff', text: 'Warming up' },
  buzzing: { colors: ['#b08fff', '#ff6b9d'], glow: '#ff6b9d', text: 'Buzzing' },
  hot: { colors: ['#ff6b9d', '#ff8a3d'], glow: '#ff8a3d', text: 'Hot' },
  fire: { colors: ['#ff8a3d', '#ffcc4d'], glow: '#ffcc4d', text: 'On fire' },
};

/** Heartbeat speed: about 48 bpm when quiet, up to ~120 bpm when on fire. */
const beatMs = (score) => Math.round(1250 - Math.min(100, Math.max(0, score)) * 7.5);

export default function PulseMeter({ pulse, size = 58, onPress }) {
  const score = pulse?.score ?? 0;
  const th = PULSE_THEME[pulse?.level] || PULSE_THEME.quiet;
  const beat = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const period = beatMs(score);
    // "lub-dub": two quick bumps, then rest; rings ripple out on each beat
    const heart = Animated.loop(Animated.sequence([
      Animated.timing(beat, { toValue: 1, duration: period * 0.12, easing: Easing.out(Easing.quad), useNativeDriver: ND }),
      Animated.timing(beat, { toValue: 0.35, duration: period * 0.1, easing: Easing.in(Easing.quad), useNativeDriver: ND }),
      Animated.timing(beat, { toValue: 0.8, duration: period * 0.1, easing: Easing.out(Easing.quad), useNativeDriver: ND }),
      Animated.timing(beat, { toValue: 0, duration: period * 0.25, easing: Easing.inOut(Easing.quad), useNativeDriver: ND }),
      Animated.delay(period * 0.43),
    ]));
    // each ripple loop lasts exactly one beat, so the rings stay in step with the heart
    const ripple = (v, second) => Animated.loop(Animated.sequence([
      Animated.delay(second ? period * 0.22 : 0),
      Animated.timing(v, { toValue: 1, duration: period * 0.78, easing: Easing.out(Easing.cubic), useNativeDriver: ND }),
      Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: ND }),
      Animated.delay(second ? 0 : period * 0.22),
    ]));
    heart.start();
    const r1 = ripple(ring, false); const r2 = ripple(ring2, true);
    r1.start(); if (score >= 40) r2.start(); // a second ripple once things get busy
    return () => { heart.stop(); r1.stop(); r2.stop(); beat.setValue(0); ring.setValue(0); ring2.setValue(0); };
  }, [score, beat, ring, ring2]);

  const scale = beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const ringStyle = (v) => ({
    position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: th.glow,
    opacity: v.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.55, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] }) }],
  });
  const trendIcon = pulse?.trend === 'up' ? 'trending-up' : pulse?.trend === 'down' ? 'trending-down' : null;

  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="button" accessibilityLabel={`Pulse ${score}, ${th.text}`}
      style={({ hovered }) => ({ alignItems: 'center', flex: 1, opacity: hovered ? 0.9 : 1 })}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={ringStyle(ring)} />
        {score >= 40 ? <Animated.View style={ringStyle(ring2)} /> : null}
        <Animated.View style={{ width: size, height: size, borderRadius: size / 2, transform: [{ scale }],
          shadowColor: th.glow, shadowOpacity: 0.7, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 6 }}>
          <LinearGradient colors={th.colors} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
            style={{ flex: 1, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)' }}>
            <Ionicons name="pulse" size={size * 0.24} color="rgba(255,255,255,0.9)" style={{ marginBottom: -2 }} />
            <Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: size * 0.3, lineHeight: size * 0.36, fontVariant: ['tabular-nums'] }}>{score}</Text>
          </LinearGradient>
        </Animated.View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
        <Text style={{ color: colors.muted, fontSize: 12, fontFamily: fonts.body }}>Pulse</Text>
        {trendIcon ? <Ionicons name={trendIcon} size={13} color={pulse.trend === 'up' ? colors.mint : colors.spark} style={{ marginLeft: 3 }} /> : null}
      </View>
    </Pressable>
  );
}

/** Shown when the meter is tapped: what the score means and what moves it. */
export function PulseInfo({ pulse, isMe, name, onClose }) {
  const th = PULSE_THEME[pulse?.level] || PULSE_THEME.quiet;
  const trend = pulse?.trend === 'up' ? 'Rising this week' : pulse?.trend === 'down' ? 'Cooling down this week' : 'Steady this week';
  return (
    <View style={{ marginTop: space.md, padding: space.md, borderRadius: 16, borderWidth: 1, borderColor: `${th.glow}66`, backgroundColor: 'rgba(26,24,40,0.9)' }}>
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
