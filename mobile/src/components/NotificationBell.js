// The notifications bell at the top right of Home: Soulink wordmark colours (white -> lilac -> pink),
// with the number of new notifications on top. Tap to open Notifications.
import { Platform, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useRealtime } from '../lib/realtime';
import { colors, fonts, gradients } from '../lib/theme';

export default function NotificationBell({ size = 25 }) {
  const { unread } = useRealtime();
  const count = unread?.notifications || 0;
  const name = count ? 'notifications' : 'notifications-outline';
  const glyph = Platform.OS === 'web'
    ? <Ionicons name={name} size={size} style={{ backgroundImage: `linear-gradient(135deg, ${gradients.wordmark.join(', ')})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent' }} />
    : (
      <MaskedView style={{ width: size, height: size }} maskElement={<Ionicons name={name} size={size} color="#000" />}>
        <LinearGradient colors={gradients.wordmark} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size }} />
      </MaskedView>
    );
  return (
    <Pressable onPress={() => router.push('/activity')} hitSlop={10} accessibilityRole="button" accessibilityLabel={count ? `Notifications, ${count} new` : 'Notifications'}
      style={({ hovered, pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: Platform.OS === 'web' ? 8 : 0,
        backgroundColor: hovered ? 'rgba(124,92,252,0.18)' : 'transparent', transform: [{ scale: pressed ? 0.9 : hovered ? 1.08 : 1 }] })}>
      {glyph}
      {count ? (
        <View style={{ position: 'absolute', top: 2, right: 0, minWidth: 18, height: 18, borderRadius: 9, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.void }}>
          <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 10, paddingHorizontal: 4 }}>{count > 99 ? '99+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
