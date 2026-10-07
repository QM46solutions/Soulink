// The "Soulink" wordmark in the header is the button for Soulink Events. It beats like the Pulse meter
// (a lub-dub every 5 seconds, with a soft pink glow) so people notice it's tappable.
import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { GradientText } from './brand';
import { fonts } from '../lib/theme';

const ND = Platform.OS !== 'web';

export default function SoulinkTitleButton({ size = 22 }) {
  const thump = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const beat = Animated.loop(Animated.sequence([
      Animated.delay(900),
      Animated.timing(thump, { toValue: 1, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: ND }),   // lub
      Animated.timing(thump, { toValue: 0.15, duration: 110, easing: Easing.in(Easing.quad), useNativeDriver: ND }),
      Animated.timing(thump, { toValue: 0.6, duration: 100, easing: Easing.out(Easing.quad), useNativeDriver: ND }),  // dub
      Animated.timing(thump, { toValue: 0, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: ND }),
      Animated.delay(3520), // one beat every 5 s
    ]));
    beat.start();
    return () => { beat.stop(); thump.setValue(0); };
  }, [thump]);

  const scale = thump.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  return (
    <Pressable onPress={() => router.navigate('/events')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Soulink Events"
      style={({ hovered, pressed }) => ({ transform: [{ scale: pressed ? 0.95 : hovered ? 1.06 : 1 }],
        ...(Platform.OS === 'web' ? { cursor: 'pointer', outlineStyle: 'none' } : {}) })}>
      <Animated.View style={{ transform: [{ scale }] }}>
        {/* glow that flashes on each beat */}
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: -10, right: -10, top: -2, bottom: -2, borderRadius: 20,
          backgroundColor: 'rgba(255,107,157,0.16)', opacity: thump,
          ...(Platform.OS === 'web' ? { filter: 'blur(8px)' } : { shadowColor: '#ff6b9d', shadowOpacity: 0.9, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }) }} />
        <View><GradientText style={{ fontFamily: fonts.display, fontSize: size, letterSpacing: -0.5 }}>Soulink</GradientText></View>
      </Animated.View>
    </Pressable>
  );
}
