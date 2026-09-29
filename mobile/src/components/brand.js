// Brand visuals shared by every screen: starfield, glow, gradient text, glass cards, section tags.
import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, gradients, radius, space } from '../lib/theme';

/** Deterministic pseudo-random so stars don't jump around between renders. */
function rng(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

/** Night-sky background: static stars + a few slowly twinkling bright ones + a purple nebula glow. */
export const Starfield = memo(function Starfield({ density = 90, glow = true }) {
  const win = useWindowDimensions();
  // In a desktop browser the app sits in a phone-sized frame, so size the sky to that frame.
  const width = Platform.OS === 'web' && win.width >= 520 ? 412 : win.width;
  const height = Platform.OS === 'web' && win.width >= 520 ? Math.min(892, win.height) : win.height;
  const twinkle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(twinkle, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(twinkle, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [twinkle]);

  const stars = useMemo(() => {
    const r = rng(7);
    return Array.from({ length: density }, (_, i) => ({
      key: i, x: r() * width, y: r() * height, size: r() < 0.9 ? 1 + r() * 1.2 : 2 + r() * 1.5,
      o: 0.25 + r() * 0.6, bright: r() < 0.12,
    }));
  }, [density, width, height]);

  const brightOpacity = twinkle.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.void }]} />
      {glow ? (
        <>
          {/* nebula: soft diagonal purple → pink wash */}
          <LinearGradient
            colors={['rgba(124,92,252,0.18)', 'rgba(8,7,13,0)', 'rgba(255,107,157,0.08)']}
            start={{ x: 0, y: 0.1 }} end={{ x: 1, y: 0.9 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(8,7,13,0)', 'rgba(124,92,252,0.10)', 'rgba(8,7,13,0)']}
            start={{ x: 0.5, y: 0.15 }} end={{ x: 0.5, y: 0.75 }}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : null}
      {stars.map((st) => (
        <Animated.View
          key={st.key}
          style={{
            position: 'absolute', left: st.x, top: st.y, width: st.size, height: st.size, borderRadius: st.size,
            backgroundColor: st.bright ? '#e9e7ff' : '#cfc8ff',
            opacity: st.bright ? brightOpacity : st.o,
          }}
        />
      ))}
    </View>
  );
});

/** Screen wrapper with the starfield behind it. */
export function SpaceScreen({ children, style, glow = true, density }) {
  return (
    <View style={[{ flex: 1, backgroundColor: colors.void }, style]}>
      <Starfield glow={glow} density={density} />
      {children}
    </View>
  );
}

/** Text filled with the brand gradient (white → aura → spark), like the site's headlines. */
export function GradientText({ children, style, colors: c = gradients.wordmark, numberOfLines }) {
  if (Platform.OS === 'web') {
    // Browsers: CSS gradient text (MaskedView isn't supported on web)
    const css = { backgroundImage: `linear-gradient(135deg, ${c.join(', ')})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent' };
    return <Text style={[style, css]} numberOfLines={numberOfLines}>{children}</Text>;
  }
  return (
    <MaskedView maskElement={<Text style={[style, { backgroundColor: 'transparent' }]} numberOfLines={numberOfLines}>{children}</Text>}>
      <LinearGradient colors={c} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={[style, { opacity: 0 }]} numberOfLines={numberOfLines}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

/** The "Soulink" wordmark. */
export function Wordmark({ size = 28 }) {
  return <GradientText style={{ fontFamily: fonts.display, fontSize: size, letterSpacing: -size * 0.03, lineHeight: size * 1.15 }}>Soulink</GradientText>;
}

/** Pill tag like "PRODUCT CONCEPT · 2026" on the site. */
export function PillTag({ children, color = colors.aura, style }) {
  return (
    <View style={[{ alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(124,92,252,0.45)', backgroundColor: 'rgba(124,92,252,0.08)', borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6 }, style]}>
      <Text style={{ color, fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 2.2, textTransform: 'uppercase' }}>{children}</Text>
    </View>
  );
}

/** Small monospace code-style label, e.g. "// BIOMETRIC_SCAN.LIVE" */
export function MonoTag({ children, style }) {
  return <Text style={[{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.5, color: colors.dim, textTransform: 'uppercase' }, style]}>{children}</Text>;
}

/** Glassy card with the site's corner-bracket frame. */
export function GlassCard({ children, style, brackets = false, glowColor }) {
  return (
    <View style={[{
      backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: space.lg,
      ...(glowColor ? { shadowColor: glowColor, shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, elevation: 8 } : {}),
    }, style]}>
      {brackets ? <Brackets /> : null}
      {children}
    </View>
  );
}

function Brackets() {
  const b = { position: 'absolute', width: 18, height: 18, borderColor: 'rgba(176,143,255,0.5)' };
  return (
    <>
      <View style={[b, { top: 10, left: 10, borderTopWidth: 1.5, borderLeftWidth: 1.5 }]} />
      <View style={[b, { top: 10, right: 10, borderTopWidth: 1.5, borderRightWidth: 1.5 }]} />
      <View style={[b, { bottom: 10, left: 10, borderBottomWidth: 1.5, borderLeftWidth: 1.5 }]} />
      <View style={[b, { bottom: 10, right: 10, borderBottomWidth: 1.5, borderRightWidth: 1.5 }]} />
    </>
  );
}

/** Big outlined section number ("01", "02") + uppercase kicker, like the site's feature sections. */
export function SectionKicker({ num, label, color = colors.aura }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm }}>
      {num ? <Text style={{ fontFamily: fonts.display, fontSize: 13, color: colors.dim, marginRight: 8 }}>{num}</Text> : null}
      <Text style={{ fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color }}>{label}</Text>
    </View>
  );
}

/** Large headline in Syne. */
export function Headline({ children, size = 30, gradient = false, style }) {
  const st = [{ fontFamily: fonts.display, fontSize: size, lineHeight: size * 1.1, letterSpacing: -size * 0.02, color: colors.text }, style];
  return gradient ? <GradientText style={st}>{children}</GradientText> : <Text style={st}>{children}</Text>;
}
