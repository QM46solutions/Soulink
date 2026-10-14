import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PHONE } from '../lib/device';
import { Stack, ThemeProvider, DarkTheme, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Syne_600SemiBold, Syne_700Bold, Syne_800ExtraBold } from '@expo-google-fonts/syne';
import { Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { AuthProvider, useAuth } from '../lib/auth';
import { RealtimeProvider } from '../lib/realtime';
import { HeaderBackground } from '../components/brand';
import GalaxyBackground from '../components/GalaxyBackground';
import DialogHost from '../components/DialogHost';
import AccessGate from '../components/AccessGate';
import { useUsageTracker } from '../lib/usage';
import BackButton from '../components/BackButton';
import { BottomBar, barSpace } from '../components/TabBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Transparent navigation backgrounds so the starfield shows behind every screen.
const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: 'transparent', card: colors.void, border: colors.border, primary: colors.soul, text: colors.text },
};

// Frozen header look for every in-app screen: see-through over the starfield, centred Syne title
export const headerStyle = {
  headerStyle: { backgroundColor: 'transparent' },
  headerShadowVisible: false,
  headerBackground: () => <HeaderBackground />,
  headerTintColor: colors.text,
  headerTitleAlign: 'center',
  headerTitleStyle: { fontFamily: fonts.displayBold, fontSize: 18 },
  headerBackButtonDisplayMode: 'minimal',
  // every screen gets a back arrow (also after a refresh or when opened from a link, where it goes Home)
  headerLeft: () => <BackButton />,
  contentStyle: { backgroundColor: 'transparent' },
};

// Browser preview: hide scrollbars everywhere (phones don't show them either)
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('soulink-web-css')) {
  const css = document.createElement('style');
  css.id = 'soulink-web-css';
  css.textContent = '*{scrollbar-width:none}*::-webkit-scrollbar{display:none}';
  document.head.appendChild(css);
}

// Screens outside the tabs still show the bottom bar; which icon is "bold" there
// an open conversation (chat / anonymous chat) uses the whole screen, like Instagram
const NO_BAR = new Set(['(tabs)', '(auth)', 'setup', 'moment', 'create-post', 'share-post', 'chat', 'anon']);
const SECTION = {
  spark: 'sparks', messages: 'messages', chat: 'messages', anon: 'messages', argue: 'messages',
  settings: 'profile', 'edit-profile': 'profile', soul: 'profile', 'soul-filters': 'profile', follows: 'profile', blocked: 'profile', requests: 'profile', connections: 'profile', shop: 'profile', ads: 'profile',
};

function RootStack() {
  const { user, ready } = useAuth();
  const segs = useSegments();
  const insets = useSafeAreaInsets();

  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  useUsageTracker(!!user?.onboardingDone); // Settings › Time management (hooks must run before any early return)
  if (!ready) return null;

  const loggedIn = !!user;
  const onboarded = !!user?.onboardingDone;

  const top = segs[0];
  const showBar = loggedIn && onboarded && top && !NO_BAR.has(top) && !(top === 'messages' && segs[1] === 'new') && !(top === 'spark' && segs[1] === 'new');
  const active = SECTION[top] || null;

  return (
    <View style={{ flex: 1, paddingBottom: showBar ? barSpace(insets) : 0 }}>
    <Stack screenOptions={{ ...headerStyle, headerStyle: { backgroundColor: 'transparent', height: insets.top + 46 } }}>
      <Stack.Protected guard={!loggedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={loggedIn && !onboarded}>
        <Stack.Screen name="setup" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={loggedIn && onboarded}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="soul" options={{ headerShown: false }} />
        <Stack.Screen name="connect/[userId]" options={{ headerShown: false }} />
        <Stack.Screen name="argue/index" options={{ headerShown: false }} />
        <Stack.Screen name="argue/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="connections/requests" options={{ title: '' }} />
        <Stack.Screen name="user/[username]" options={{ title: '' }} />
        <Stack.Screen name="follows/[id]" options={{ title: '' }} />
        <Stack.Screen name="edit-profile" options={{ title: 'Edit profile' }} />
        <Stack.Screen name="ads/index" options={{ title: 'Ads Manager' }} />
        <Stack.Screen name="soul-filters" options={{ title: 'Soul Filters' }} />
        <Stack.Screen name="create-post" options={{ title: 'New post', presentation: 'modal' }} />
        <Stack.Screen name="moment/new" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="spark/new" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="spark/casting/index" options={{ title: 'Casting Board' }} />
        <Stack.Screen name="spark/casting/new" options={{ title: 'Post a casting call', presentation: 'modal' }} />
        <Stack.Screen name="spark/casting/[id]" options={{ title: 'Casting call' }} />
        <Stack.Screen name="spark/stage/index" options={{ title: 'Open Mic Stage' }} />
        <Stack.Screen name="spark/[id]" options={{ title: 'Spark' }} />
        <Stack.Screen name="spark/stage/new" options={{ title: 'Add an open mic', presentation: 'modal' }} />
        <Stack.Screen name="moment/[userId]" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="post/[id]" options={{ title: 'Post' }} />
        <Stack.Screen name="share-post" options={{ title: 'Send in a chat', presentation: 'modal' }} />
        <Stack.Screen name="post-likes/[id]" options={{ title: '👌🏻 Likes' }} />
        <Stack.Screen name="settings/index" options={{ title: 'Settings' }} />
        <Stack.Screen name="shop/index" options={{ title: 'Soul Shop' }} />
        <Stack.Screen name="settings/activity" options={{ title: 'Your activity' }} />
        <Stack.Screen name="settings/time" options={{ title: 'Time management' }} />
        <Stack.Screen name="settings/notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="settings/viewers" options={{ title: 'Who viewed my profile' }} />
        <Stack.Screen name="settings/privacy" options={{ title: 'Account privacy' }} />
        <Stack.Screen name="settings/status" options={{ title: 'Account status' }} />
        <Stack.Screen name="settings/app-permissions" options={{ title: 'App permissions' }} />
        <Stack.Screen name="settings/location" options={{ title: 'Location' }} />
        <Stack.Screen name="settings/device-permissions" options={{ title: 'Device permissions' }} />
        <Stack.Screen name="settings/about" options={{ title: 'About' }} />
        <Stack.Screen name="blocked" options={{ title: 'Blocked contacts' }} />
        <Stack.Screen name="requests" options={{ title: 'Follow requests' }} />
        <Stack.Screen name="messages/index" options={{ title: 'Messages' }} />
        <Stack.Screen name="messages/new" options={{ title: 'New message', presentation: 'modal' }} />
        <Stack.Screen name="messages/groups" options={{ title: 'Groups' }} />
        <Stack.Screen name="chat/[id]" options={{ title: '' }} />
        <Stack.Screen name="anon/[id]" options={{ title: '' }} />
        <Stack.Screen name="chat/info/[id]" options={{ title: 'Details' }} />
      </Stack.Protected>
    </Stack>
    {showBar ? <BottomBar active={active} /> : null}
    </View>
  );
}

// In a desktop browser, show the app inside an exact iPhone 17 Pro Max (440 × 956 pt) with its status bar,
// Dynamic Island and home indicator, so what you see here is what the phone shows.
// Size: "Actual" = true 17 Pro Max size (440 px wide; scroll the page to see the bottom on short laptop screens),
// "Fit" = shrink the whole phone so it fits the window height. The choice is remembered in this browser.
const ZOOM_KEY = 'soulink.previewZoom';
function PhoneFrame({ children }) {
  const { width, height } = useWindowDimensions();
  const [mode, setMode] = useState(() => { try { return window.localStorage.getItem(ZOOM_KEY) || 'actual'; } catch { return 'actual'; } });
  if (Platform.OS !== 'web' || width < 520) return <View style={{ flex: 1, backgroundColor: colors.void }}>{children}</View>;
  const BEZEL = 10;
  const fullH = PHONE.height + BEZEL * 2;
  const fit = Math.min(1, (height - 16) / fullH);
  const scale = mode === 'fit' ? fit : 1;
  const pick = (m) => { setMode(m); try { window.localStorage.setItem(ZOOM_KEY, m); } catch { /* private window */ } };
  const Outer = scale * fullH > height ? ScrollView : View;
  const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: false });
  return (
    <View style={{ flex: 1, backgroundColor: '#030207' }}>
    <Outer style={{ flex: 1 }} contentContainerStyle={Outer === ScrollView ? { alignItems: 'center', paddingVertical: 8 } : undefined}>
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: PHONE.width + BEZEL * 2, height: fullH, borderRadius: 64, padding: BEZEL, backgroundColor: '#1c1a26',
        transform: [{ scale }], marginVertical: -(fullH * (1 - scale)) / 2,
        boxShadow: '0 20px 70px rgba(124,92,252,0.28)',
      }}>
        {/* nativeID: menus and sheets are drawn into this screen (lib/portal.web.js) so they stay inside the phone */}
        <View nativeID="phone-screen" style={{ flex: 1, borderRadius: 54, overflow: 'hidden', backgroundColor: colors.void, paddingTop: PHONE.top, paddingBottom: PHONE.bottom }}>
          {/* the app gets 440 × 863 pt; its starry background runs behind the status bar like on the real phone */}
          {children}
          {/* status bar + Dynamic Island (59 pt) */}
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: PHONE.top, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 34, paddingTop: 6 }}>
            <Text style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 16, width: 60 }}>{time}</Text>
            <View style={{ position: 'absolute', top: 11, left: (PHONE.width - 126) / 2, width: 126, height: 37, borderRadius: 19, backgroundColor: '#000' }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', width: 60, justifyContent: 'flex-end' }}>
              <Ionicons name="cellular" size={14} color={colors.text} style={{ marginRight: 4 }} />
              <Ionicons name="wifi" size={14} color={colors.text} style={{ marginRight: 4 }} />
              <Ionicons name="battery-full" size={18} color={colors.text} />
            </View>
          </View>
          {/* home indicator (34 pt) */}
          <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: PHONE.bottom, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 140, height: 5, borderRadius: 3, backgroundColor: 'rgba(233,231,242,0.85)' }} />
          </View>
        </View>
      </View>
    </View>
    </Outer>
      {/* preview size switch (browser only, outside the phone) */}
      <View style={{ position: 'absolute', left: 16, bottom: 16, flexDirection: 'row', borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(14,12,22,0.9)', padding: 3 }}>
        {[['actual', 'Actual size'], ['fit', 'Fit screen']].map(([m, label]) => (
          <Pressable key={m} onPress={() => pick(m)} style={({ hovered }) => ({ paddingHorizontal: 12, height: 30, borderRadius: 999, justifyContent: 'center', backgroundColor: mode === m ? colors.soul : hovered ? 'rgba(124,92,252,0.18)' : 'transparent' })}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: mode === m ? '#fff' : colors.muted }}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// Opening a page straight from its link (refresh, reopened app) still puts the tabs underneath it, so Home and Back work
export const unstable_settings = { initialRouteName: '(tabs)' };

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Syne_600SemiBold, Syne_700Bold, Syne_800ExtraBold,
    Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    SpaceMono_400Regular, SpaceMono_700Bold,
  });
  if (!fontsLoaded && !fontError) return null;

  return (
    <PhoneFrame>
      {/* the whole app sits on a slowly moving galaxy */}
      <GalaxyBackground />
      <ThemeProvider value={navTheme}>
        <StatusBar style="light" />
        <AccessGate>
          <AuthProvider>
            <RealtimeProvider>
              <RootStack />
              <DialogHost />
            </RealtimeProvider>
          </AuthProvider>
        </AccessGate>
      </ThemeProvider>
    </PhoneFrame>
  );
}
