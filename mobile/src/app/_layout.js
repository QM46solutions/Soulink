import { useEffect } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { Stack, ThemeProvider, DarkTheme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Syne_600SemiBold, Syne_700Bold, Syne_800ExtraBold } from '@expo-google-fonts/syne';
import { Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { AuthProvider, useAuth } from '../lib/auth';
import { RealtimeProvider } from '../lib/realtime';
import { Starfield } from '../components/brand';
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
  headerTintColor: colors.text,
  headerTitleAlign: 'center',
  headerTitleStyle: { fontFamily: fonts.displayBold, fontSize: 18 },
  headerBackButtonDisplayMode: 'minimal',
  contentStyle: { backgroundColor: 'transparent' },
};

// Browser preview: hide scrollbars everywhere (phones don't show them either)
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('soulink-web-css')) {
  const css = document.createElement('style');
  css.id = 'soulink-web-css';
  css.textContent = '*{scrollbar-width:none}*::-webkit-scrollbar{display:none}';
  document.head.appendChild(css);
}

function RootStack() {
  const { user, ready } = useAuth();

  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  if (!ready) return null;

  const loggedIn = !!user;
  const onboarded = !!user?.onboardingDone;

  return (
    <Stack screenOptions={headerStyle}>
      <Stack.Protected guard={!loggedIn}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={loggedIn && !onboarded}>
        <Stack.Screen name="setup" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={loggedIn && onboarded}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="user/[username]" options={{ title: '' }} />
        <Stack.Screen name="follows/[id]" options={{ title: '' }} />
        <Stack.Screen name="edit-profile" options={{ title: 'Edit profile' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="blocked" options={{ title: 'Blocked accounts' }} />
        <Stack.Screen name="requests" options={{ title: 'Follow requests' }} />
        <Stack.Screen name="messages/index" options={{ title: 'Messages' }} />
        <Stack.Screen name="messages/new" options={{ title: 'New message', presentation: 'modal' }} />
        <Stack.Screen name="chat/[id]" options={{ title: '' }} />
        <Stack.Screen name="chat/info/[id]" options={{ title: 'Details' }} />
      </Stack.Protected>
    </Stack>
  );
}

// In a desktop browser, show the app inside a phone-sized frame (like a real Android screen).
const PHONE = { width: 412, height: 892 };
function PhoneFrame({ children }) {
  const { width, height } = useWindowDimensions();
  if (Platform.OS !== 'web' || width < 520) return <View style={{ flex: 1, backgroundColor: colors.void }}>{children}</View>;
  const h = Math.min(PHONE.height, height - 32);
  return (
    <View style={{ flex: 1, backgroundColor: '#030207', alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: PHONE.width, height: h, borderRadius: 36, borderWidth: 8, borderColor: '#1c1a26', overflow: 'hidden', backgroundColor: colors.void, boxShadow: '0 20px 60px rgba(124,92,252,0.25)' }}>
        {children}
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Syne_600SemiBold, Syne_700Bold, Syne_800ExtraBold,
    Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    SpaceMono_400Regular, SpaceMono_700Bold,
  });
  if (!fontsLoaded && !fontError) return null;

  return (
    <PhoneFrame>
      <Starfield />
      <ThemeProvider value={navTheme}>
        <AuthProvider>
          <RealtimeProvider>
            <StatusBar style="light" />
            <RootStack />
          </RealtimeProvider>
        </AuthProvider>
      </ThemeProvider>
    </PhoneFrame>
  );
}
