// "See your Soul Score" on someone's profile (before you're connected). Tap to open the full match panel.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MatchPanel from './MatchPanel';
import { colors, fonts, gradients, space } from '../lib/theme';

const ND = Platform.OS !== 'web';

export default function ShowScoreButton({ match, userId, name }) {
  const [open, setOpen] = useState(false);
  const shine = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([Animated.timing(shine, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: ND }), Animated.delay(2200), Animated.timing(shine, { toValue: 0, duration: 0, useNativeDriver: ND })]));
    a.start();
    return () => a.stop();
  }, [shine]);
  return (
    <View style={{ marginBottom: space.md }}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityLabel={open ? 'Hide Soul Score' : 'See your Soul Score'}
        style={({ hovered, pressed }) => ({ marginHorizontal: space.lg, borderRadius: 18, padding: 1.5, overflow: 'hidden', transform: [{ scale: pressed ? 0.98 : hovered ? 1.01 : 1 }] })}>
        <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 16.5, paddingVertical: 11, paddingHorizontal: 14, backgroundColor: 'rgba(14,12,22,0.94)', overflow: 'hidden' }}>
          {/* a light sweep every few seconds so it reads as tappable */}
          <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, width: 60, backgroundColor: 'rgba(255,255,255,0.07)',
            transform: [{ translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-80, 420] }) }, { skewX: '-20deg' }] }} />
          <View style={{ width: 36, height: 36, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <MaterialCommunityIcons name="heart-pulse" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.text }}>{open ? 'Your Soul Score' : 'See your Soul Score'}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 1 }}>How you and {name} match, from both Soul DNAs</Text>
          </View>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={colors.aura} />
        </View>
      </Pressable>
      {open ? <View style={{ marginTop: space.md }}><MatchPanel match={match} userId={userId} name={name} /></View> : null}
    </View>
  );
}
