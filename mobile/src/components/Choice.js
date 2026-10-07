// Big selectable card and intent chip, in the frozen Soulink style.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, space } from '../lib/theme';
import { themeFor } from './SoulScoreOrb';

export function ChoiceCard({ icon, title, text, selected, onPress, style }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}
      style={({ hovered }) => [{
        flex: 1, borderRadius: 20, borderWidth: 1.5, padding: space.lg, alignItems: 'center',
        borderColor: selected ? colors.soul : hovered ? colors.aura : colors.border,
        backgroundColor: selected ? 'rgba(124,92,252,0.2)' : colors.glass,
      }, style]}>
      <Ionicons name={icon} size={26} color={selected ? colors.text : colors.aura} />
      <Text style={{ color: colors.text, fontFamily: fonts.displayBold, fontSize: 15, marginTop: space.sm, textAlign: 'center' }}>{title}</Text>
      {text ? <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2, textAlign: 'center' }}>{text}</Text> : null}
    </Pressable>
  );
}

/** Small pill (accepting a request as another type). */
export function IntentChip({ intent, selected, disabled, onPress }) {
  return (
    <Pressable onPress={disabled ? undefined : onPress} disabled={disabled} accessibilityState={{ selected, disabled }}
      style={({ hovered }) => ({
        flexDirection: 'row', alignItems: 'center', paddingLeft: 5, paddingRight: 14, paddingVertical: 5, borderRadius: 999, borderWidth: 1.5, margin: 4,
        borderColor: selected ? colors.soul : hovered && !disabled ? colors.aura : colors.border,
        backgroundColor: selected ? 'rgba(124,92,252,0.25)' : 'rgba(26,24,40,0.6)', opacity: disabled ? 0.35 : 1,
      })}>
      <IntentBadge intent={intent} size={28} />
      <Text style={{ color: colors.text, fontFamily: selected ? fonts.semibold : fonts.medium, fontSize: 14, marginLeft: 8 }}>{intent.label}</Text>
    </Pressable>
  );
}

/** Round gradient badge with the intent's icon. */
export function IntentBadge({ intent, size = 44, dim }) {
  const c = intent.colors || [colors.soul, colors.spark];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', opacity: dim ? 0.55 : 1,
      boxShadow: `0 4px 14px ${c[0]}55` }}>
      <LinearGradient colors={c} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <MaterialCommunityIcons name={intent.icon || 'star-four-points'} size={Math.round(size * 0.52)} color="#fff" />
    </View>
  );
}

/** Big tappable card for "What are you hoping for?" (two per row). */
export function IntentCard({ intent, selected, onPress }) {
  const c = intent.colors || [colors.soul, colors.spark];
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}
      style={({ hovered, pressed }) => ({
        width: '48%', marginBottom: space.md, borderRadius: 20, borderWidth: 1.5, paddingVertical: 14, paddingHorizontal: 12,
        flexDirection: 'row', alignItems: 'center',
        borderColor: selected ? c[0] : hovered ? colors.aura : colors.border,
        backgroundColor: selected ? `${c[0]}22` : pressed ? 'rgba(124,92,252,0.12)' : colors.glass,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}>
      <IntentBadge intent={intent} size={40} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 13.5 }}>{intent.label}</Text>
        {intent.line ? <Text numberOfLines={2} style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 11, lineHeight: 14, marginTop: 1 }}>{intent.line}</Text> : null}
      </View>
      {selected ? (
        <View style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: c[0], alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="checkmark" size={12} color="#fff" />
        </View>
      ) : null}
    </Pressable>
  );
}

/** Small Soul Score chip (requests, connect screen): number counts up, sparkle turns, vibe word shown. */
export function ScorePill({ score, style, intent }) {
  const [n, setN] = useState(0);
  const v = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!score) return undefined;
    v.setValue(0);
    const id = v.addListener(({ value }) => setN(Math.round(value * score)));
    const a = Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    const s = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }));
    a.start(); s.start();
    return () => { a.stop(); s.stop(); v.removeListener(id); };
  }, [score, v, spin]);
  if (!score) return null;
  const th = themeFor(intent);
  const vibe = th.vibe(score);
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: th.edge, backgroundColor: 'rgba(26,24,40,0.72)' }, style]}>
      <Animated.View style={{ marginRight: 6, transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
        <Ionicons name={th.icon} size={14} color={vibe.color} />
      </Animated.View>
      <Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 13 }}>Soul Score {n}%</Text>
      <Text style={{ fontFamily: fonts.semibold, color: vibe.color, fontSize: 13 }}>{`  ·  ${vibe.label}`}</Text>
    </View>
  );
}
