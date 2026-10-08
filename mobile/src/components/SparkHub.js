// Shared bits for the Casting Board and Open Mic Stage screens
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, gradients, space } from '../lib/theme';

export function GradBadge({ icon, colors: c = gradients.button, size = 46 }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      <LinearGradient colors={c} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <LinearGradient colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0)']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <MaterialCommunityIcons name={icon} size={Math.round(size * 0.52)} color="#fff" />
    </View>
  );
}

export function GradButton({ title, onPress, disabled, icon, style }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[{ height: 50, borderRadius: 25, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', opacity: disabled ? 0.5 : 1 }, style]}>
      <LinearGradient colors={gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      {icon ? <MaterialCommunityIcons name={icon} size={20} color="#fff" style={{ marginRight: 8 }} /> : null}
      <Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: 15 }}>{title}</Text>
    </Pressable>
  );
}

export const left = (iso) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'Closed';
  const d = Math.floor(ms / 86400000); if (d >= 1) return `${d} day${d > 1 ? 's' : ''} left`;
  const h = Math.max(1, Math.floor(ms / 3600000)); return `${h} h left`;
};
export const when = (iso) => new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
export const H = ({ children, style }) => <Text style={[{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.2, color: colors.aura, textTransform: 'uppercase', marginTop: space.xl, marginBottom: space.sm }, style]}>{children}</Text>;
