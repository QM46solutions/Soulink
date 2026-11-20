// Small pieces shared by Settings › Account Data & Backup and Restore My Data.
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, space } from '../lib/theme';

export const mb = (n) => (n == null ? '' : n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(n < 10 * 1048576 ? 1 : 0)} MB`);
export const day = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

export function Card({ children, style }) {
  return (
    <View style={[{ marginHorizontal: space.lg, marginTop: space.md, padding: space.lg, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(26,24,40,0.7)' }, style]}>
      {children}
    </View>
  );
}

export function CardTitle({ icon, color = colors.aura, children }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
      {icon ? <Ionicons name={icon} size={20} color={color} style={{ marginRight: 10 }} /> : null}
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 16, color: colors.text, flex: 1 }}>{children}</Text>
    </View>
  );
}

export const Body = ({ children, style }) => <Text style={[{ fontFamily: fonts.body, fontSize: 13.5, color: colors.muted, lineHeight: 20 }, style]}>{children}</Text>;

/** A progress bar; `value` 0-1, or null for "working, size unknown". */
export function Progress({ value, label }) {
  const pct = value == null ? null : Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <View style={{ marginTop: space.md }}>
      <View accessibilityRole="progressbar" accessibilityValue={pct == null ? undefined : { min: 0, max: 100, now: pct }}
        style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <View style={{ height: 8, width: pct == null ? '35%' : `${Math.max(3, pct)}%`, borderRadius: 4, backgroundColor: colors.soul }} />
      </View>
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.text }}>{label}</Text>
        {pct != null ? <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted }}>{pct}%</Text> : null}
      </View>
    </View>
  );
}

/** "12 posts · 30 photos" style line from counts. */
export function Stat({ icon, label, value, color = colors.text }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7 }}>
      <Ionicons name={icon} size={17} color={colors.aura} style={{ marginRight: 10, width: 20 }} />
      <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.text }}>{label}</Text>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color }}>{value}</Text>
    </View>
  );
}
