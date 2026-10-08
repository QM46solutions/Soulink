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
import { clap } from '../../components/ClapperIcon';
import { MessagesTabButton, ProfileTabIcon, SparksIcon, TabIcon, HoverTab, TAB_ACTIVE, TAB_INACTIVE, tabBarStyleFor, barSpace } from '../../components/TabBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SoulinkTitleButton from '../../components/SoulinkTitleButton';

const icon = (name) => ({ focused }) => <TabIcon name={name} focused={focused} />;

export default function TabsLayout() {
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
      <Tabs.Screen name="events" options={{ title: 'Soulink Events', href: null }} />
      <Tabs.Screen name="discover" options={{ title: 'Discover new souls', href: null }} />
      <Tabs.Screen name="activity" options={{ title: 'Notifications', href: null }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ focused }) => <ProfileTabIcon focused={focused} /> }} />
    </Tabs>
  );
}
