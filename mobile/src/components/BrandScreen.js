// THE FROZEN SOULINK SCREEN LAYOUT (matches the welcome screen). Use it for every full-page screen.
//   - starfield shows through (transparent background)
//   - top bar: back arrow on the left (optional), extra control on the right (optional)
//   - content centred vertically, 24px side padding, no scrollbar, keyboard-safe
//   - BrandHeader: big gradient "Soulink" wordmark + one-line title + short subtitle, all centred
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GradientText, Divider } from './brand';
import { colors, fonts, space } from '../lib/theme';

export function BrandScreen({ children, back, onBack, right, center = true }) {
  const goBack = onBack || (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg }}>
        {back ? (
          <Pressable onPress={goBack} hitSlop={12} accessibilityLabel="Back"
            style={({ hovered }) => ({ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: hovered ? 'rgba(124,92,252,0.18)' : 'transparent' })}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
        ) : <View style={{ width: 36 }} />}
        {right || <View style={{ width: 36 }} />}
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: center ? 'center' : 'flex-start', paddingHorizontal: space.xl, paddingBottom: space.xl }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function BrandHeader({ title, subtitle, size = 48, children }) {
  return (
    <View style={{ alignItems: 'center', marginBottom: space.xl }}>
      {size ? <GradientText numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: size, lineHeight: size * 1.17, letterSpacing: -size * 0.03, textAlign: 'center' }}>Soulink</GradientText> : null}
      {title ? <Text style={{ fontFamily: fonts.displayBold, fontSize: size ? 20 : 24, lineHeight: size ? 26 : 30, color: colors.text, textAlign: 'center', marginTop: space.md }}>{title}</Text> : null}
      {subtitle ? <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center', marginTop: 6 }}>{subtitle}</Text> : null}
      {children}
      {title || subtitle ? <Divider style={{ marginTop: space.lg, width: '80%', alignSelf: 'center' }} /> : null}
    </View>
  );
}

/** Small centred line with a link, e.g. "New to Soulink? Create account" */
export function LinkLine({ text, link, onPress, style }) {
  return (
    <Text style={[{ fontFamily: fonts.body, color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: space.lg }, style]}>
      {text}{' '}
      <Text onPress={onPress} style={{ color: colors.aura, fontFamily: fonts.semibold }} accessibilityRole="link">{link}</Text>
    </Text>
  );
}
