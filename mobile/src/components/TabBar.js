// The bottom navigation bar: icons shared by the real tab bar (Home, Search, Sparks, Profile) and the
// copy of it shown under every other screen (chats, profiles, settings…), so the bar is always there.
// The icon of the place you're in turns solid and white ("bold").
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../lib/auth';
import { useRealtime } from '../lib/realtime';
import { mediaUrl } from '../lib/api';
import ClapperIcon, { clap } from './ClapperIcon';
import MaskedView from '@react-native-masked-view/masked-view';
import { colors, fonts, gradients } from '../lib/theme';

// Soulink palette: the icon you're on is solid and filled with the purple → pink gradient; the others are soft lilac outlines
export const TAB_ACTIVE = colors.aura;
export const TAB_INACTIVE = 'rgba(176,143,255,0.62)';
const ACTIVE_GRADIENT = [colors.aura, colors.soul, colors.spark];

/** An Ionicons glyph filled with the brand gradient */
export function GradientIcon({ name, size }) {
  if (Platform.OS === 'web') {
    const css = { backgroundImage: `linear-gradient(135deg, ${ACTIVE_GRADIENT.join(', ')})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent' };
    return <Ionicons name={name} size={size} style={css} />;
  }
  return (
    <MaskedView style={{ width: size, height: size }} maskElement={<Ionicons name={name} size={size} color="#000" />}>
      <LinearGradient colors={ACTIVE_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size }} />
    </MaskedView>
  );
}
// Like Instagram: the bar's background runs to the very bottom edge, and the icons sit just above the iPhone home bar
// Floating bar: a slim rounded pill hovering just above the bottom edge, with the background showing around it
export const BAR_HEIGHT = 52;
export const barBottom = (insets) => Math.max(8, (insets?.bottom || 0) - 16);   // sits a little into the home-bar area
export const barSpace = (insets) => barBottom(insets) + BAR_HEIGHT + 8;            // room screens keep free under their content
export const TAB_BAR_STYLE = {
  position: 'absolute', left: 14, right: 14, height: BAR_HEIGHT, borderRadius: BAR_HEIGHT / 2, paddingTop: 0, paddingBottom: 0,
  backgroundColor: 'rgba(20,18,32,0.9)', borderTopWidth: 1, borderWidth: 1, borderColor: 'rgba(176,143,255,0.2)', borderTopColor: 'rgba(176,143,255,0.2)',
  elevation: 12, shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
  ...(Platform.OS === 'web' ? { boxShadow: '0 10px 30px rgba(0,0,0,0.55), 0 0 0 1px rgba(176,143,255,0.08)', backdropFilter: 'blur(14px)' } : {}),
};
export const tabBarStyleFor = (insets) => ({ ...TAB_BAR_STYLE, bottom: barBottom(insets) });

/** Ionicons tab icon: outline normally, solid + white + a touch bigger when it's where you are */
export const TabIcon = ({ name, focused }) => (
  <View style={{ alignItems: 'center', justifyContent: 'center', height: 30 }}>
    {focused ? <GradientIcon name={name} size={26} /> : <Ionicons name={`${name}-outline`} size={24} color={TAB_INACTIVE} />}
  </View>
);

// Every tab icon grows a little and glows on hover (laptop / web) and dips when pressed
export function HoverTab({ children, style, onPress, onLongPress, accessibilityState, accessibilityLabel, testID }) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} accessibilityRole="button" accessibilityState={accessibilityState} accessibilityLabel={accessibilityLabel} testID={testID}
      style={({ hovered, pressed }) => [style, { flex: 1, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.9 : hovered ? 1.18 : 1 }] },
        Platform.OS === 'web' ? { outlineStyle: 'none', cursor: 'pointer' } : null,
        hovered && Platform.OS === 'web' ? { filter: 'drop-shadow(0 0 6px rgba(176,143,255,0.8))' } : null]}>
      {children}
    </Pressable>
  );
}

// Profile: your photo in a small ring (gradient + thicker ring when you're on it)
export function ProfileTabIcon({ focused }) {
  const { user } = useAuth();
  const ring = focused ? gradients.button : ['rgba(176,143,255,0.45)', 'rgba(176,143,255,0.45)'];
  return (
    <View style={{ alignItems: 'center' }}>
      <LinearGradient colors={ring} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 30, height: 30, borderRadius: 15, padding: focused ? 2 : 1.5 }}>
        <View style={{ flex: 1, borderRadius: 14, padding: 1, backgroundColor: colors.void }}>
          {user?.avatarUrl
            ? <Image source={{ uri: mediaUrl(user.avatarUrl) }} style={{ flex: 1, borderRadius: 13 }} contentFit="cover" />
            : <View style={{ flex: 1, borderRadius: 13, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="person" size={14} color={colors.muted} /></View>}
        </View>
      </LinearGradient>
    </View>
  );
}

// Messages: Snapchat-style chat bubble with the unread badge
export function MessagesIcon({ focused }) {
  const { unread } = useRealtime();
  const count = (unread?.chats || 0) + (unread?.requests || 0) + (unread?.anon || 0);
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', height: 30 }}>
      {focused ? <GradientIcon name="chatbubble" size={26} /> : <Ionicons name="chatbubble-outline" size={25} color={TAB_INACTIVE} />}
      {count ? (
        <View style={{ position: 'absolute', top: -5, right: -12, minWidth: 18, height: 18, borderRadius: 9, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.void }}>
          <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 10, paddingHorizontal: 4 }}>{count > 99 ? '99+' : count}</Text>
        </View>
      ) : null}
    </View>
  );
}

export const SparksIcon = ({ focused }) => <View style={{ alignItems: 'center', justifyContent: 'center' }}><ClapperIcon focused={focused} /></View>;

/** The tab button for Messages (the inbox is its own screen with its own stack of chats). */
export function MessagesTabButton() {
  const { unread } = useRealtime();
  const count = (unread?.chats || 0) + (unread?.requests || 0) + (unread?.anon || 0);
  return (
    <HoverTab onPress={() => router.push('/messages')} accessibilityLabel={count ? `Messages, ${count} unread` : 'Messages'}>
      <MessagesIcon focused={false} />
    </HoverTab>
  );
}

/**
 * The same bar, drawn under screens that live outside the tabs (chats, other profiles, settings…).
 * active: 'home' | 'search' | 'sparks' | 'messages' | 'profile' | null
 */
export function BottomBar({ active }) {
  const go = (path) => router.navigate(path);
  const items = [
    ['home', 'Home', () => go('/'), (f) => <TabIcon name="home" focused={f} />],
    ['search', 'Search', () => go('/search'), (f) => <TabIcon name="search" focused={f} />],
    ['sparks', 'Sparks', () => { clap(); go('/sparks'); }, (f) => <SparksIcon focused={f} />],
    ['messages', 'Messages', () => (active === 'messages' ? go('/messages') : router.push('/messages')), (f) => <MessagesIcon focused={f} />],
    ['profile', 'Profile', () => go('/profile'), (f) => <ProfileTabIcon focused={f} />],
  ];
  const insets = useSafeAreaInsets();
  return (
    <View style={[tabBarStyleFor(insets), { flexDirection: 'row' }]}>
      {items.map(([k, label, onPress, render]) => (
        <HoverTab key={k} onPress={onPress} accessibilityLabel={label} accessibilityState={{ selected: active === k }}>{render(active === k)}</HoverTab>
      ))}
    </View>
  );
}
