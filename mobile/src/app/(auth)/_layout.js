import { Stack } from 'expo-router';
import { colors, fonts } from '../../lib/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerStyle: { backgroundColor: 'transparent' },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitle: '',
        headerTitleStyle: { fontFamily: fonts.displayBold },
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
      <Stack.Screen name="verify" options={{ headerShown: false }} />
      <Stack.Screen name="server" options={{ headerTitle: 'Server address' }} />
    </Stack>
  );
}
