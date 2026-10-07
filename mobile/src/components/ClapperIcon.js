// Sparks tab icon: a real clapperboard (striped clapper on a coloured slate), drawn with Views.
// Tapping the Sparks tab snaps the clapper shut, like on a film set ("clap!").
import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from '../lib/theme';

// tiny event bus: the tab's press listener calls clap(), every mounted icon animates
const listeners = new Set();
export const clap = () => listeners.forEach((f) => f());

const W = 24; // icon width (same visual size as the other tab icons)
const BAR = 6; // striped bar height

/** A white bar with black diagonal stripes (the classic clapper look). */
function Stripes({ width }) {
  const n = Math.ceil(width / 6) + 2;
  return (
    <View style={{ width, height: BAR, backgroundColor: '#fff', borderRadius: 1.5, overflow: 'hidden', flexDirection: 'row' }}>
      {Array.from({ length: n }).map((_, i) => (
        <View key={i} style={{ position: 'absolute', left: i * 6 - 4, top: -3, width: 3, height: BAR + 6, backgroundColor: '#15121f', transform: [{ skewX: '-35deg' }] }} />
      ))}
    </View>
  );
}

export default function ClapperIcon({ focused }) {
  const arm = useRef(new Animated.Value(0)).current; // 0 = resting a little open, 1 = wide open, 2 = shut
  const bump = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const run = () => {
      arm.stopAnimation(); bump.setValue(0);
      Animated.sequence([
        Animated.timing(arm, { toValue: 1, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(arm, { toValue: 2, duration: 70, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.parallel([
          Animated.sequence([
            Animated.timing(bump, { toValue: 1, duration: 70, useNativeDriver: true }),
            Animated.timing(bump, { toValue: 0, duration: 160, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
          ]),
          Animated.sequence([Animated.delay(380), Animated.timing(arm, { toValue: 0, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true })]),
        ]),
      ]).start();
    };
    listeners.add(run);
    return () => { listeners.delete(run); };
  }, [arm, bump]);

  const rotate = arm.interpolate({ inputRange: [0, 1, 2], outputRange: ['-20deg', '-38deg', '0deg'] });
  const scale = bump.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });

  return (
    <Animated.View style={{ width: W, height: 24, justifyContent: 'flex-end', opacity: focused ? 1 : 0.72, transform: [{ scale: focused ? Animated.multiply(scale, 1.1) : scale }] }}>
      {/* the clapper arm, hinged on the left */}
      <Animated.View style={{ position: 'absolute', left: 0, top: 0, transformOrigin: 'left bottom', transform: [{ rotate }] }}>
        <Stripes width={W} />
      </Animated.View>
      {/* the slate: striped top + coloured board with two "write here" lines */}
      <Stripes width={W} />
      <View style={{ width: W, height: 11, marginTop: 1, borderRadius: 2.5, overflow: 'hidden', justifyContent: 'center', paddingHorizontal: 3.5 }}>
        <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ height: 1.5, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.85)', marginBottom: 2.5 }} />
        <View style={{ height: 1.5, width: '60%', borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.85)' }} />
      </View>
    </Animated.View>
  );
}
