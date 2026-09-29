import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, gradients, radius, space } from '../lib/theme';
import { mediaUrl } from '../lib/api';

export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, style, small }) {
  const v = VARIANTS[variant];
  const content = loading ? <ActivityIndicator color={v.fg} /> : (
    <View style={s.row}>
      {icon ? <Ionicons name={icon} size={small ? 15 : 18} color={v.fg} style={{ marginRight: 6 }} /> : null}
      <Text style={[s.btnText, small && { fontSize: 13 }, { color: v.fg }]}>{title}</Text>
    </View>
  );
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed, hovered }) => [
        s.btn, small && s.btnSmall, { backgroundColor: v.bg, borderColor: v.border },
        variant === 'primary' && s.btnGlow, variant === 'primary' && { borderWidth: 0, overflow: 'hidden' },
        Platform.OS === 'web' && { cursor: 'pointer', transitionProperty: 'transform, box-shadow, border-color, opacity', transitionDuration: '180ms' },
        // Mouse hover (browser): lift the button slightly and make it glow
        hovered && !(disabled || loading) && {
          transform: [{ translateY: -2 }, { scale: 1.02 }],
          ...(variant === 'primary' ? { boxShadow: '0 10px 30px rgba(124,92,252,0.55), 0 0 18px rgba(255,107,157,0.35)' } : { borderColor: colors.aura }),
        },
        (disabled || loading) && { opacity: 0.45 }, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }, style,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient colors={gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          {content}
        </LinearGradient>
      ) : content}
    </Pressable>
  );
}

const VARIANTS = {
  primary: { bg: colors.soul, border: colors.soul, fg: '#fff' },
  secondary: { bg: 'rgba(26,24,40,0.8)', border: colors.border, fg: colors.text },
  light: { bg: '#f3f2f7', border: '#f3f2f7', fg: '#141221' },
  ghost: { bg: 'transparent', border: 'transparent', fg: colors.aura },
  danger: { bg: 'transparent', border: colors.danger, fg: colors.danger },
};

export function Input({ label, error, hint, style, inputStyle, left, right, onFocus, onBlur, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[{ marginBottom: space.lg }, style]}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={[s.inputWrap, props.multiline && { borderRadius: 20, alignItems: 'flex-start', paddingVertical: 6 }, focused && s.inputFocus, error && { borderColor: colors.danger }]}>
        {left}
        <TextInput placeholderTextColor={colors.dim} style={[s.input, inputStyle]} onFocus={(e) => { setFocused(true); onFocus?.(e); }} onBlur={(e) => { setFocused(false); onBlur?.(e); }} {...props} />
        {right}
      </View>
      {error ? <Text style={s.error}>{error}</Text> : hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Avatar({ uri, size = 44, name }) {
  const url = mediaUrl(uri);
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.card }} contentFit="cover" />;
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.aura, fontFamily: fonts.display, fontSize: size * 0.4 }}>{initial}</Text>
    </View>
  );
}

export function VerifiedBadge({ size = 14 }) {
  return <Ionicons name="checkmark-circle" size={size} color={colors.mint} style={{ marginLeft: 4 }} />;
}

export function UserRow({ user, onPress, right, subtitle }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.userRow, pressed && { backgroundColor: colors.surface }]}>
      <Avatar uri={user.avatarUrl} name={user.displayName || user.username} />
      <View style={{ flex: 1, marginLeft: space.md }}>
        <View style={s.row}>
          <Text style={s.username} numberOfLines={1}>{user.username}</Text>
          {user.verified ? <VerifiedBadge /> : null}
          {user.isPrivate ? <Ionicons name="lock-closed" size={12} color={colors.muted} style={{ marginLeft: 4 }} /> : null}
        </View>
        <Text style={s.sub} numberOfLines={1}>{subtitle ?? user.displayName}</Text>
      </View>
      {right}
    </Pressable>
  );
}

export function Empty({ icon = 'sparkles-outline', title, text, children }) {
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={40} color={colors.dim} />
      <Text style={s.emptyTitle}>{title}</Text>
      {text ? <Text style={s.emptyText}>{text}</Text> : null}
      {children}
    </View>
  );
}

export function Loading() {
  return <View style={s.center}><ActivityIndicator color={colors.aura} size="large" /></View>;
}

export function ErrorText({ children }) {
  if (!children) return null;
  return <Text style={[s.error, { marginBottom: space.md, marginLeft: 0, textAlign: 'center' }]}>{children}</Text>;
}

export function Chip({ label, selected, onPress }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, selected && { backgroundColor: colors.soul, borderColor: colors.soul }]}>
      <Text style={{ color: selected ? '#fff' : colors.muted, fontSize: 13, fontFamily: fonts.medium }}>{label}</Text>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.void },
  btn: { height: 56, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  btnGlow: { shadowColor: colors.soul, shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  btnSmall: { height: 34, paddingHorizontal: space.md, borderRadius: radius.sm },
  btnText: { fontSize: 15, fontFamily: fonts.bold, letterSpacing: 0.2 },
  label: { color: colors.muted, fontSize: 11, marginBottom: 8, marginLeft: 20, fontFamily: fonts.medium, letterSpacing: 1.5, textTransform: 'uppercase' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', minHeight: 56, backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 20, ...(Platform.OS === 'web' ? { transitionProperty: 'border-color, box-shadow', transitionDuration: '180ms' } : {}) },
  inputFocus: { borderColor: colors.soul, ...(Platform.OS === 'web' ? { boxShadow: '0 0 0 4px rgba(124,92,252,0.18)' } : {}) },
  input: { flex: 1, minHeight: 52, color: colors.text, fontSize: 16, fontFamily: fonts.medium, outlineStyle: 'none' },
  error: { color: colors.danger, fontSize: 13, marginTop: 6, marginLeft: 20, fontFamily: fonts.body },
  hint: { color: colors.muted, fontSize: 12, marginTop: 6, marginLeft: 20, fontFamily: fonts.body, lineHeight: 17 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, paddingVertical: space.md },
  username: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15, flexShrink: 1 },
  sub: { color: colors.muted, fontSize: 13, marginTop: 1, fontFamily: fonts.body },
  empty: { alignItems: 'center', padding: space.xxl, marginTop: space.xxl },
  emptyTitle: { color: colors.text, fontSize: 18, fontFamily: fonts.displayBold, marginTop: space.md, textAlign: 'center' },
  emptyText: { color: colors.muted, fontSize: 14, marginTop: space.sm, textAlign: 'center', lineHeight: 20, fontFamily: fonts.body },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(26,24,40,0.6)', marginRight: 8, marginBottom: 8 },
  screen: { flex: 1, backgroundColor: 'transparent' },
  title: { color: colors.text, fontSize: 30, fontFamily: fonts.display, letterSpacing: -0.6, lineHeight: 34 },
  subtitle: { color: colors.muted, fontSize: 15, marginTop: space.sm, lineHeight: 23, fontFamily: fonts.body },
});
