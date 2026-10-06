import { Platform, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useRealtime } from '../../lib/realtime';
import { useAuth } from '../../lib/auth';
import { mediaUrl } from '../../lib/api';
import { Image } from 'expo-image';
import { Tabs } from 'expo-router/js-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { GradientText, HeaderBackground } from '../../components/brand';
import { colors, fonts, gradients } from '../../lib/theme';
import { ScalesIcon } from '../../components/LiveIcons';
import BackButton from '../../components/BackButton';

const icon = (name) => ({ color, focused, size }) => (
  <View style={{ alignItems: 'center' }}>
    <Ionicons name={focused ? name : `${name}-outline`} size={size} color={color} />
    {/* small glowing dot under the active tab */}
    <View style={{ width: 4, height: 4, borderRadius: 2, marginTop: 3, backgroundColor: focused ? colors.spark : 'transparent' }} />
  </View>
);


// Every tab icon grows a little and glows on hover (laptop / web) and dips when pressed
function HoverTab({ children, style, onPress, onLongPress, accessibilityState, accessibilityLabel, testID }) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} accessibilityRole="button" accessibilityState={accessibilityState} accessibilityLabel={accessibilityLabel} testID={testID}
      style={({ hovered, pressed }) => [style, { flex: 1, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.9 : hovered ? 1.18 : 1 }] },
        Platform.OS === 'web' ? { outlineStyle: 'none', cursor: 'pointer' } : null,
        hovered && Platform.OS === 'web' ? { filter: 'drop-shadow(0 0 6px rgba(176,143,255,0.8))' } : null]}>
      {children}
    </Pressable>
  );
}

// Profile tab: your own profile photo in a small ring (gradient ring when you're on the tab)
function ProfileTabIcon({ focused }) {
  const { user } = useAuth();
  const ring = focused ? gradients.button : [colors.border, colors.border];
  return (
    <View style={{ alignItems: 'center' }}>
      <LinearGradient colors={ring} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 30, height: 30, borderRadius: 15, padding: 1.5 }}>
        <View style={{ flex: 1, borderRadius: 14, padding: 1, backgroundColor: colors.void }}>
          {user?.avatarUrl
            ? <Image source={{ uri: mediaUrl(user.avatarUrl) }} style={{ flex: 1, borderRadius: 13 }} contentFit="cover" />
            : <View style={{ flex: 1, borderRadius: 13, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="person" size={14} color={colors.muted} /></View>}
        </View>
      </LinearGradient>
      <View style={{ width: 4, height: 4, borderRadius: 2, marginTop: 1, backgroundColor: focused ? colors.spark : 'transparent' }} />
    </View>
  );
}

// Argue Referee tab: the live balancing-scales animation from the pitch site
function ArgueIcon({ focused }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <ScalesIcon size={38} bold />
      <View style={{ width: 4, height: 4, borderRadius: 2, marginTop: -1, backgroundColor: focused ? colors.spark : 'transparent' }} />
    </View>
  );
}

// Notifications: a bell in the Soulink wordmark colours (white -> lilac -> pink) with an unread count on top
function BellTabIcon({ focused, size }) {
  const { unread } = useRealtime();
  const count = unread?.notifications || 0;
  const name = focused ? 'notifications' : 'notifications-outline';
  const s = size || 24;
  const glyph = Platform.OS === 'web'
    ? <Ionicons name={name} size={s} style={{ backgroundImage: `linear-gradient(135deg, ${gradients.wordmark.join(', ')})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent' }} />
    : (
      <MaskedView style={{ width: s, height: s }} maskElement={<Ionicons name={name} size={s} color="#000" />}>
        <LinearGradient colors={gradients.wordmark} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: s, height: s }} />
      </MaskedView>
    );
  return (
    <View style={{ alignItems: 'center' }} accessibilityLabel={count ? `Notifications, ${count} new` : 'Notifications'}>
      <View style={{ opacity: focused ? 1 : 0.8 }}>{glyph}</View>
      {count ? (
        <View style={{ position: 'absolute', top: -7, right: -11, minWidth: 18, height: 18, borderRadius: 9, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.void }}>
          <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 10, paddingHorizontal: 4 }}>{count > 99 ? '99+' : count}</Text>
        </View>
      ) : null}
      <View style={{ width: 4, height: 4, borderRadius: 2, marginTop: 3, backgroundColor: focused ? colors.spark : 'transparent' }} />
    </View>
  );
}

// Messages: the raised gradient button (where Argue used to be). Opens the inbox; shows unread count.
function MessagesTabButton({ accessibilityState }) {
  const { unread } = useRealtime();
  const count = (unread?.chats || 0) + (unread?.requests || 0) + (unread?.anon || 0);
  return (
    <Pressable onPress={() => router.push('/messages')} accessibilityRole="button" accessibilityLabel={count ? `Messages, ${count} unread` : 'Messages'}
      style={({ hovered, pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.92 : hovered ? 1.1 : 1 }], ...(Platform.OS === 'web' ? { outlineStyle: 'none', cursor: 'pointer' } : {}) })}>
      <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: accessibilityState?.selected ? colors.text : 'transparent',
          shadowColor: colors.soul, shadowOpacity: 0.55, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 6 }}>
        <Ionicons name="paper-plane" size={22} color="#fff" style={{ marginLeft: -2, marginTop: 1 }} />
      </LinearGradient>
      {count ? (
        <View style={{ position: 'absolute', top: 2, right: '22%', minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.spark, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: colors.void }}>
          <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 10 }}>{count > 9 ? '9+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      // Browsers (laptop preview + iPhone Safari) keep inactive tabs underneath the active one. Our backgrounds
      // are see-through (starfield), so hide every tab that isn't the one you're on: its screen AND its header.
      screenOptions={({ navigation, route }) => {
        const focused = navigation.isFocused();
        return {
          // tabs other than Home get a back arrow that returns Home
          ...(route.name !== 'index' ? { headerLeft: () => <BackButton toHome /> } : {}),
          headerStyle: { backgroundColor: 'transparent' },
          headerShadowVisible: false,
          headerBackground: () => <HeaderBackground />,
          headerTintColor: colors.text,
          headerTitleAlign: 'center',
          headerTitleStyle: { fontFamily: fonts.displayBold, fontSize: 18 },
          tabBarStyle: { backgroundColor: 'rgba(14,12,22,0.82)', borderTopColor: 'rgba(42,39,64,0.6)', height: 66, paddingTop: 8, paddingBottom: 8 },
          tabBarActiveTintColor: colors.aura,
          tabBarInactiveTintColor: colors.dim,
          tabBarShowLabel: false,
          tabBarButton: (props) => <HoverTab {...props} />,
          sceneStyle: { backgroundColor: 'transparent', display: focused ? 'flex' : 'none' },
          ...(focused ? {} : { headerShown: false }),
        };
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: icon('home'),
          headerTitle: () => <GradientText style={{ fontFamily: fonts.display, fontSize: 22, letterSpacing: -0.5 }}>Soulink</GradientText>,
        }}
      />
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: icon('search') }} />
      {/* Argue Referee sits between Search and Messages, with its live scales icon */}
      <Tabs.Screen name="argue" options={{ headerShown: false, tabBarAccessibilityLabel: 'Argue Referee', tabBarIcon: ({ focused }) => <ArgueIcon focused={focused} /> }} />
      {/* Messages: raised gradient button, opens the inbox */}
      <Tabs.Screen name="inbox" options={{ tabBarButton: (props) => <MessagesTabButton {...props} /> }} />
      {/* Discover stays reachable from Home ("Make connections") and Search, not in the tab bar */}
      <Tabs.Screen name="discover" options={{ title: 'Discover new souls', href: null }} />
      <Tabs.Screen name="activity" options={{ title: 'Notifications', tabBarIcon: ({ focused, size }) => <BellTabIcon focused={focused} size={size} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ focused }) => <ProfileTabIcon focused={focused} /> }} />
    </Tabs>
  );
}
