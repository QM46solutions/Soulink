// The back arrow used in every screen's header. Goes back if there is somewhere to go back to,
// otherwise (e.g. a page opened from a link or after a refresh) it goes Home.
import { Platform, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';

export default function BackButton({ onPress, toHome }) {
  const go = onPress || (() => {
    if (!toHome && router.canGoBack()) router.back();
    else router.navigate('/');
  });
  return (
    <Pressable onPress={go} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back"
      style={({ hovered, pressed }) => ({ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginLeft: Platform.OS === 'web' ? 8 : 0,
        backgroundColor: hovered ? 'rgba(124,92,252,0.18)' : 'transparent', transform: [{ scale: pressed ? 0.9 : 1 }] })}>
      <Ionicons name="arrow-back" size={22} color={colors.text} />
    </Pressable>
  );
}
