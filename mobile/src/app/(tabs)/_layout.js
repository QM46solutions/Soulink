import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useRealtime } from '../../lib/realtime';
import { Tabs } from 'expo-router/js-tabs';
import { Ionicons } from '@expo/vector-icons';
import { GradientText } from '../../components/brand';
import { colors, fonts } from '../../lib/theme';

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

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: 'transparent' },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleAlign: 'center',
        headerTitleStyle: { fontFamily: fonts.displayBold, fontSize: 18 },
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarStyle: { backgroundColor: 'rgba(8,7,13,0.96)', borderTopColor: colors.border, height: 64, paddingTop: 8 },
        tabBarActiveTintColor: colors.aura,
        tabBarInactiveTintColor: colors.dim,
        tabBarShowLabel: false,
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
      <Tabs.Screen name="discover" options={{ title: 'Discover', tabBarIcon: icon('sparkles') }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity', tabBarIcon: icon('heart') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-circle') }} />
    </Tabs>
  );
}
