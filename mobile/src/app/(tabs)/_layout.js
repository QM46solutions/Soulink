import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useRealtime } from '../../lib/realtime';
import { Tabs } from 'expo-router/js-tabs';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientText } from '../../components/brand';
import { colors, fonts, gradients } from '../../lib/theme';

const icon = (name) => ({ color, focused, size }) => (
  <View style={{ alignItems: 'center' }}>
    <Ionicons name={focused ? name : `${name}-outline`} size={size} color={color} />
    {/* small glowing dot under the active tab */}
    <View style={{ width: 4, height: 4, borderRadius: 2, marginTop: 3, backgroundColor: focused ? colors.spark : 'transparent' }} />
  </View>
);

function MessagesButton() {
  const { unread } = useRealtime();
  const count = (unread?.chats || 0) + (unread?.requests || 0);
  return (
    <Pressable onPress={() => router.push('/messages')} hitSlop={10} accessibilityLabel={count ? `Messages, ${count} unread` : 'Messages'} style={{ marginRight: 16 }}>
      <Ionicons name="paper-plane-outline" size={24} color={colors.text} />
      {count ? (
        <View style={{ position: 'absolute', top: -6, right: -8, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.spark, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: colors.void }}>
          <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 10 }}>{count > 9 ? '9+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function ArgueButton({ onPress, accessibilityState }) {
  const on = accessibilityState?.selected;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Argue Referee"
      style={({ hovered }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', transform: [{ scale: hovered ? 1.06 : 1 }] })}>
      {/* Sits fully inside the tab bar (no part sticks up over the screen above) */}
      <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: on ? colors.text : 'transparent',
          shadowColor: colors.soul, shadowOpacity: 0.55, shadowRadius: 10, shadowOffset: { width: 0, height: 2 }, elevation: 6 }}>
        <MaterialCommunityIcons name="scale-balance" size={24} color="#fff" />
      </LinearGradient>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      // Browsers (laptop preview + iPhone Safari) keep inactive tabs underneath the active one. Our backgrounds
      // are see-through (starfield), so hide every tab that isn't the one you're on: its screen AND its header.
      screenOptions={({ navigation }) => {
        const focused = navigation.isFocused();
        return {
          headerStyle: { backgroundColor: 'transparent' },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerTitleAlign: 'center',
          headerTitleStyle: { fontFamily: fonts.displayBold, fontSize: 18 },
          tabBarStyle: { backgroundColor: 'rgba(14,12,22,0.82)', borderTopColor: 'rgba(42,39,64,0.6)', height: 66, paddingTop: 8, paddingBottom: 8 },
          tabBarActiveTintColor: colors.aura,
          tabBarInactiveTintColor: colors.dim,
          tabBarShowLabel: false,
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
          headerRight: () => <MessagesButton />,
        }}
      />
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: icon('search') }} />
      {/* Centre: the Argue Referee, a raised gradient button */}
      <Tabs.Screen name="argue" options={{ headerShown: false, tabBarButton: (props) => <ArgueButton {...props} /> }} />
      {/* Discover stays reachable from Home ("Make connections") and Search, not in the tab bar */}
      <Tabs.Screen name="discover" options={{ title: 'Discover new souls', href: null }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity', tabBarIcon: icon('heart') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-circle') }} />
    </Tabs>
  );
}
