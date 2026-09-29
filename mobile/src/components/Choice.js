// Big selectable card and intent chip, in the frozen Soulink style.
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, space } from '../lib/theme';

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

export function IntentChip({ intent, selected, disabled, onPress }) {
  return (
    <Pressable onPress={disabled ? undefined : onPress} disabled={disabled} accessibilityState={{ selected, disabled }}
      style={({ hovered }) => ({
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1.5, margin: 4,
        borderColor: selected ? colors.soul : hovered && !disabled ? colors.aura : colors.border,
        backgroundColor: selected ? 'rgba(124,92,252,0.25)' : 'rgba(26,24,40,0.6)', opacity: disabled ? 0.35 : 1,
      })}>
      <Text style={{ fontSize: 15, marginRight: 6 }}>{intent.emoji}</Text>
      <Text style={{ color: colors.text, fontFamily: selected ? fonts.semibold : fonts.medium, fontSize: 14 }}>{intent.label}</Text>
    </Pressable>
  );
}

export function ScorePill({ score, style }) {
  if (!score) return null;
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(176,143,255,0.45)', backgroundColor: 'rgba(124,92,252,0.12)' }, style]}>
      <Ionicons name="sparkles" size={14} color={colors.aura} style={{ marginRight: 6 }} />
      <Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 13 }}>Soul Score {score}%</Text>
    </View>
  );
}
