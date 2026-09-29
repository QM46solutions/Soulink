import { useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import ContactEntry from '../../components/ContactEntry';
import { LinkLine } from '../../components/BrandScreen';
import { GlassCard, GradientText, MonoTag, PillTag } from '../../components/brand';
import { colors, fonts, space } from '../../lib/theme';

// The four pillars, same wording and colours as the pitch site
const PILLARS = [
  { n: '01', icon: 'face-recognition', color: colors.mint, title: 'Real Identity', text: 'Every face is a real human. One person, one profile, for life.' },
  { n: '02', icon: 'hand-heart', color: colors.aura, title: 'Soul Matching', text: 'Your personality, decoded across 8 dimensions. Matches that feel eerily right.' },
  { n: '03', icon: 'account-search', color: colors.spark, title: 'Visual Discovery', text: 'Met someone at a café? Find them, if they chose to be found.' },
  { n: '04', icon: 'scale-balance', color: colors.gold, title: 'Argument Referee', text: 'Both sides heard. A fair, neutral verdict in 60 seconds.' },
];

const SLIDE_EVERY_MS = 3000;

/** Shows one feature at a time and slides to the next every few seconds. Users can also swipe. */
function FeatureCarousel() {
  const scroller = useRef(null);
  const index = useRef(0);
  const pausedUntil = useRef(0);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!width) return undefined;
    const timer = setInterval(() => {
      if (Date.now() < pausedUntil.current) return;
      const next = (index.current + 1) % PILLARS.length;
      index.current = next;
      setActive(next);
      scroller.current?.scrollTo({ x: next * width, animated: true });
    }, SLIDE_EVERY_MS);
    return () => clearInterval(timer);
  }, [width]);

  const onScroll = (e) => {
    if (!width) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index.current && i >= 0 && i < PILLARS.length) { index.current = i; setActive(i); }
  };

  const goTo = (i) => {
    pausedUntil.current = Date.now() + SLIDE_EVERY_MS * 2;
    index.current = i; setActive(i);
    scroller.current?.scrollTo({ x: i * width, animated: true });
  };

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => { pausedUntil.current = Date.now() + SLIDE_EVERY_MS * 2; }}
      >
        {PILLARS.map((p) => (
          <View key={p.n} style={{ width: width || 1 }}>
            <GlassCard style={{ alignItems: 'center', paddingVertical: space.xl, paddingHorizontal: space.xl, minHeight: 175 }}>
              <View style={{ width: 56, height: 56, borderRadius: 16, borderWidth: 1, borderColor: `${p.color}55`, backgroundColor: `${p.color}14`, alignItems: 'center', justifyContent: 'center' }}>
                <MaterialCommunityIcons name={p.icon} size={28} color={p.color} />
              </View>
              <MonoTag style={{ marginTop: space.md }}>{p.n} / 04</MonoTag>
              <Text style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.text, marginTop: space.xs, textAlign: 'center' }}>{p.title}</Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted, marginTop: space.sm, lineHeight: 20, textAlign: 'center' }}>{p.text}</Text>
            </GlassCard>
          </View>
        ))}
      </ScrollView>

      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: space.md }}>
        {PILLARS.map((p, i) => (
          <Pressable key={p.n} onPress={() => goTo(i)} hitSlop={8} accessibilityLabel={`Show ${p.title}`}>
            <View style={{ width: i === active ? 22 : 8, height: 8, borderRadius: 4, marginHorizontal: 4, backgroundColor: i === active ? colors.aura : colors.dim }} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function Welcome() {
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fade, { toValue: 1, duration: 900, useNativeDriver: true }).start(); }, [fade]);
  const rise = fade.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: space.xl, paddingTop: space.sm }}>
        <Pressable onPress={() => router.push('/server')} hitSlop={12} accessibilityLabel="Server settings">
          <Ionicons name="settings-outline" size={20} color={colors.muted} />
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.xl }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }], alignItems: 'center' }}>
            <PillTag style={{ alignSelf: 'center' }}>Real · Soul · Verdict</PillTag>
            <GradientText numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: 60, lineHeight: 70, letterSpacing: -1.8, marginTop: space.lg, textAlign: 'center' }}>Soulink</GradientText>
            <Text style={{ fontFamily: fonts.displayBold, fontSize: 16, color: colors.text, lineHeight: 24, marginTop: space.sm, textAlign: 'center' }}>
              Create your identity to find your <Text style={{ color: colors.aura }}>soul</Text>
            </Text>
          </Animated.View>

          <View style={{ marginTop: space.xxl }}>
            <FeatureCarousel />
          </View>

          {/* Log in right here. New people tap "Create account". */}
          <View style={{ marginTop: space.xxl }}>
            <ContactEntry mode="login" />
            <LinkLine text="New to Soulink?" link="Create account" onPress={() => router.push('/signup')} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
