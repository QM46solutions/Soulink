// Sparks category icon in the Soulink style: a glowing gradient circle with a crisp white icon
// (same family as the Connect intent badges).
import { Platform, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function SparkCatBadge({ cat, size = 40, glow = true }) {
  const c = cat.colors;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
      ...(glow ? (Platform.OS === 'web' ? { boxShadow: `0 4px 14px ${c[0]}66` } : { shadowColor: c[0], shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }) : {}) }}>
      <LinearGradient colors={c} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      {/* soft shine on the top half */}
      <LinearGradient colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <MaterialCommunityIcons name={cat.mci} size={Math.round(size * 0.56)} color="#fff" />
    </View>
  );
}
