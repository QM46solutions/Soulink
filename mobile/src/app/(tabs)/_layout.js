import { Platform, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useRealtime } from '../../lib/realtime';
import { useAuth } from '../../lib/auth';
import { mediaUrl } from '../../lib/api';
import { Image } from 'expo-image';
import { Tabs } from 'expo-router/js-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientText, HeaderBackground } from '../../components/brand';
import { colors, fonts, gradients } from '../../lib/theme';
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

// Messages: a normal tab icon now (the raised highlighter belongs to Soulink Events). Opens the inbox; unread badge on top.
function MessagesTabButton() {
  const { unread } = useRealtime();
  const count = (unread?.chats || 0) + (unread?.requests || 0) + (unread?.anon || 0);
  return (
    <HoverTab onPress={() => router.push('/messages')} accessibilityLabel={count ? `Messages, ${count} unread` : 'Messages'}>
      <View style={{ alignItems: 'center' }}>
        <Ionicons name="paper-plane-outline" size={24} color={colors.dim} />
        {count ? (
          <View style={{ position: 'absolute', top: -7, right: -12, minWidth: 18, height: 18, borderRadius: 9, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.void }}>
            <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 10, paddingHorizontal: 4 }}>{count > 99 ? '99+' : count}</Text>
          </View>
        ) : null}
        <View style={{ width: 4, height: 4, borderRadius: 2, marginTop: 3, backgroundColor: 'transparent' }} />
      </View>
    </HoverTab>
  );
}

// Soulink Events: the raised gradient highlighter in the centre of the bar, with the Soulink "S" mark
function EventsTabButton({ accessibilityState }) {
  const selected = accessibilityState?.selected;
  return (
    <Pressable onPress={() => router.navigate('/events')} accessibilityRole="button" accessibilityLabel="Soulink Events"
      style={({ hovered, pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pressed ? 0.92 : hovered ? 1.1 : 1 }], ...(Platform.OS === 'web' ? { outlineStyle: 'none', cursor: 'pointer' } : {}) })}>
      <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: selected ? colors.text : 'transparent',
          shadowColor: colors.soul, shadowOpacity: 0.55, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 6 }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 27, lineHeight: 32, color: '#fff', marginTop: -1 }}>S</Text>
        <Ionicons name="sparkles" size={11} color="#fff" style={{ position: 'absolute', top: 9, right: 10 }} />
      </LinearGradient>
    </Pressable>
  );
}

export default function TabsLayout() {
  const { refreshUnread } = useRealtime();
  return (
    <Tabs
      screenListeners={{ focus: () => refreshUnread() }}
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
      {/* Soulink Events: raised gradient button in the centre */}
      <Tabs.Screen name="events" options={{ title: 'Soulink Events', tabBarButton: (props) => <EventsTabButton {...props} /> }} />
      {/* Messages: normal icon with unread badge, opens the inbox */}
      <Tabs.Screen name="inbox" options={{ tabBarButton: (props) => <MessagesTabButton {...props} /> }} />
      {/* Argue opens from the scales icon at the top of Home; Discover from Home and Search; Notifications from the bell */}
      <Tabs.Screen name="argue" options={{ headerShown: false, href: null }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover new souls', href: null }} />
      <Tabs.Screen name="activity" options={{ title: 'Notifications', href: null }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ focused }) => <ProfileTabIcon focused={focused} /> }} />
    </Tabs>
  );
}
