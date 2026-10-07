// Shared pieces for the Settings pages: menu row (opens a page), on/off row, section title, info row.
import { Pressable, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { s } from './ui';
import { colors, fonts, space } from '../lib/theme';

export function Toggle({ title, text, value, onChange, disabled }) {
  return (
    <View style={[s.row, { padding: space.lg, borderBottomWidth: 1, borderBottomColor: colors.border, opacity: disabled ? 0.5 : 1 }]}>
      <View style={{ flex: 1, marginRight: space.md }}>
        <Text style={{ fontFamily: fonts.body, color: colors.text, fontSize: 15 }}>{title}</Text>
        {text ? <Text style={s.hint}>{text}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.soul, false: colors.border }} thumbColor="#fff" />
    </View>
  );
}

/** Main menu row: round gradient icon, title, short line, chevron. */
export function MenuRow({ icon, title, text, onPress, danger, tint = [colors.soul, colors.spark], right }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ pressed, hovered }) => [s.row, { paddingHorizontal: space.lg, paddingVertical: 13, backgroundColor: pressed ? colors.surface : hovered ? 'rgba(255,255,255,0.03)' : 'transparent' }]}>
      <View style={{ width: 36, height: 36, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginRight: space.md }}>
        {danger ? <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,92,122,0.15)' }} />
          : <LinearGradient colors={tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.9 }} />}
        <Ionicons name={icon} size={18} color={danger ? colors.danger : '#fff'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.semibold, color: danger ? colors.danger : colors.text, fontSize: 15 }}>{title}</Text>
        {text ? <Text numberOfLines={1} style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12, marginTop: 1 }}>{text}</Text> : null}
      </View>
      {right}
      {!danger ? <Ionicons name="chevron-forward" size={18} color={colors.dim} /> : null}
    </Pressable>
  );
}

export const Section = ({ children }) => (
  <Text style={{ color: colors.dim, fontSize: 12, fontFamily: fonts.semibold, textTransform: 'uppercase', letterSpacing: 1, paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: space.sm }}>{children}</Text>
);

/** Label + value row with an optional status colour (Account status, Device permissions). */
export function InfoRow({ icon, title, value, color = colors.muted, onPress, action }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[s.row, { paddingHorizontal: space.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      {icon ? <Ionicons name={icon} size={20} color={colors.aura} style={{ marginRight: space.md }} /> : null}
      <Text style={{ flex: 1, fontFamily: fonts.body, color: colors.text, fontSize: 15 }}>{title}</Text>
      {value ? <Text style={{ fontFamily: fonts.semibold, color, fontSize: 13, marginLeft: space.sm }}>{value}</Text> : null}
      {action}
    </Pressable>
  );
}

export const Note = ({ children }) => (
  <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 13, lineHeight: 19, paddingHorizontal: space.lg, paddingVertical: space.md }}>{children}</Text>
);
