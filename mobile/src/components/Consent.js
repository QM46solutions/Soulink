// The "I agree" checkbox: 18+, Terms, Privacy Policy, and (on the face scan) consent to the face fingerprint.
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, space } from '../lib/theme';

const L = ({ to, children }) => (
  <Text onPress={() => router.push(`/legal/${to}`)} style={{ color: colors.aura, fontFamily: fonts.semibold, textDecorationLine: 'underline' }}>{children}</Text>
);

export function LegalLinks({ style }) {
  return (
    <Text style={[{ fontFamily: fonts.body, fontSize: 12, color: colors.dim, textAlign: 'center', lineHeight: 18 }, style]}>
      <L to="terms">Terms</L> · <L to="privacy">Privacy</L> · <L to="guidelines">Guidelines</L> · <L to="grievance">Grievance Officer</L>
    </Text>
  );
}

export default function Consent({ value, onChange, face }) {
  return (
    <Pressable onPress={() => onChange(!value)} accessibilityRole="checkbox" accessibilityState={{ checked: value }}
      style={{ flexDirection: 'row', alignItems: 'flex-start', padding: space.md, borderRadius: 16, borderWidth: 1, borderColor: value ? colors.soul : colors.border, backgroundColor: colors.glass, marginTop: space.lg }}>
      <Ionicons name={value ? 'checkbox' : 'square-outline'} size={22} color={value ? colors.soul : colors.muted} style={{ marginRight: space.md, marginTop: 1 }} />
      <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.text, lineHeight: 19 }}>
        I am 18 or older and I agree to the <L to="terms">Terms of Use</L>, <L to="privacy">Privacy Policy</L> and <L to="guidelines">Community Guidelines</L>.
        {face ? ' I consent to Soulink making a face fingerprint from this scan to verify I am a real, single person. I can delete it any time by deleting my account.' : ''}
      </Text>
    </Pressable>
  );
}
