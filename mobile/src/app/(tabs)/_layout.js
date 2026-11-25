import { useEffect } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useRealtime } from '../../lib/realtime';
import { useAuth } from '../../lib/auth';
import { confirm, notice } from '../../lib/confirm';
import { enablePush, pushAfterLogin, setPushChoice } from '../../lib/push';
import { mediaUrl } from '../../lib/api';
import { Image } from 'expo-image';
import { Tabs } from 'expo-router/js-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientText, HeaderBackground } from '../../components/brand';
import { colors, fonts, gradients } from '../../lib/theme';
import BackButton from '../../components/BackButton';
import { clap } from '../../components/ClapperIcon';
import { MessagesTabButton, ProfileTabIcon, SparksIcon, TabIcon, HoverTab, TAB_ACTIVE, TAB_INACTIVE, tabBarStyleFor, barSpace } from '../../components/TabBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SoulinkTitleButton from '../../components/SoulinkTitleButton';

const icon = (name) => ({ focused }) => <TabIcon name={name} focused={focused} />;

// Accounts made before email was mandatory: remind once per app launch to add and confirm an email (it's how they
// sign in on a new phone and recover the account). No code is sent until they enter the address themselves.
let emailReminded = false;
function useEmailReminder(user) {
  useEffect(() => {
    if (emailReminded || !user?.onboardingDone || !user.needsEmail) return undefined;
    const t = setTimeout(async () => {
      emailReminded = true;
      const yes = await confirm('Add your email', "Every Soulink account now needs an email. It's how you sign in on a new phone and get back into your account. It takes a minute: we'll send it a 6-digit code.", { confirmText: 'Add now', cancelText: 'Later' });
      if (yes) router.push('/settings/sign-in');
    }, 1500);
    return () => clearTimeout(t);
  }, [user?.onboardingDone, user?.needsEmail]);
}

// After logging in: explain notifications and ask once on this phone. Only "Allow" shows the phone's own question,
// and notifications are switched on only if the phone then allows them. "Not now" is remembered (no asking at every
// login); Settings › Notifications turns them on later. Someone who said yes before is reconnected quietly.
let pushAsked = false;
function usePushAsk(user) {
  useEffect(() => {
    if (pushAsked || !user?.id || !user.onboardingDone || user.needsEmail) return undefined; // the email reminder goes first
    const t = setTimeout(async () => {
      pushAsked = true;
      const next = await pushAfterLogin();
      if (next === 'reconnect') { enablePush().catch(() => {}); return; }
      if (next !== 'ask') return;
      const yes = await confirm('Turn on notifications?',
        'Soulink can tell you about new messages, Connect requests and replies, even when the app is closed. You choose which kinds in Settings › Notifications, and can switch them off any time.',
        { confirmText: 'Allow', cancelText: 'Not now' });
      if (!yes) { await setPushChoice('later'); return; }
      try {
        await enablePush();
        await setPushChoice('allowed');
      } catch (e) {
        // the phone said no: notifications stay off, and we don't ask again
        if (e.code === 'blocked') {
          const open = await confirm('Notifications are off', e.message, { confirmText: 'Open phone settings', cancelText: 'Not now' });
          // they went to allow it: the next time Soulink opens it connects them (if the phone now allows it)
          await setPushChoice(open ? 'allowed' : 'later');
          if (open) Linking.openSettings().catch(() => {});
        } else {
          await setPushChoice('later');
          if (e.code !== 'declined') notice("Couldn't turn on notifications", e.message || String(e));
        }
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [user?.id, user?.onboardingDone, user?.needsEmail]);
}

export default function TabsLayout() {
  const { user } = useAuth();
  useEmailReminder(user);
  usePushAsk(user);
  const { refreshUnread } = useRealtime();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenListeners={{ focus: () => refreshUnread() }}
      // Browsers (laptop preview + iPhone Safari) keep inactive tabs underneath the active one. Our backgrounds
      // are see-through (starfield), so hide every tab that isn't the one you're on: its screen AND its header.
      screenOptions={({ navigation, route }) => {
        const focused = navigation.isFocused();
        return {
          // tabs other than Home get a back arrow that returns Home
          ...(route.name !== 'index' && route.name !== 'profile' ? { headerLeft: () => <BackButton toHome /> } : {}),
          headerStyle: { backgroundColor: 'transparent', height: insets.top + 46 },
          headerShadowVisible: false,
          headerBackground: () => <HeaderBackground />,
          headerTintColor: colors.text,
          headerTitleAlign: 'center',
          headerTitleStyle: { fontFamily: fonts.displayBold, fontSize: 18 },
          tabBarStyle: tabBarStyleFor(insets),
          tabBarActiveTintColor: TAB_ACTIVE,
          tabBarInactiveTintColor: TAB_INACTIVE,
          tabBarShowLabel: false,
          tabBarButton: (props) => <HoverTab {...props} />,
          // the bar floats: keep the screen's content above it, the background shows around it
          sceneStyle: { backgroundColor: 'transparent', display: focused ? 'flex' : 'none', paddingBottom: barSpace(insets) },
          ...(focused ? {} : { headerShown: false }),
        };
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: icon('home'),
          // the "Soulink" title is the button for Soulink Events (no background, just the wordmark)
          headerTitle: () => <SoulinkTitleButton />,
        }}
      />
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: icon('search') }} />
      {/* Sparks 🎬 (short videos). Argue Referee now lives on the Messages screen (floating button, bottom right) */}
      <Tabs.Screen name="sparks" options={{ title: 'Sparks', tabBarAccessibilityLabel: 'Sparks', tabBarIcon: SparksIcon }} listeners={{ tabPress: () => clap() }} />
      {/* Messages: normal icon with unread badge, opens the inbox */}
      <Tabs.Screen name="inbox" options={{ tabBarButton: (props) => <MessagesTabButton {...props} /> }} />
      {/* Soulink Events opens from the "Soulink" title at the top of Home; Notifications from the bell */}
      <Tabs.Screen name="events" options={{ title: 'Soul Events', href: null }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover new souls', href: null }} />
      <Tabs.Screen name="activity" options={{ title: 'Notifications', href: null }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ focused }) => <ProfileTabIcon focused={focused} /> }} />
    </Tabs>
  );
}
