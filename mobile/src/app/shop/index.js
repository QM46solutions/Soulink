// Soul Shop: Soulink Originals. Three drops for now, each shown as a turning 3D product on a glowing stage.
// Payments aren't set up yet, so items are "Coming soon"; the heart saves one to your wishlist on this device.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Spin3D from '../../components/Spin3D';
import { GradientText } from '../../components/brand';
import { useAuth } from '../../lib/auth';
import { colors, fonts, gradients, space } from '../../lib/theme';

const web = Platform.OS === 'web';
const ND = !web;

const SHOP_ITEMS = [
  {
    key: 'jacket', name: 'Soul Jackets', product: 'Soul Puffer', sheet: require('../../../assets/shop-jacket.webp'),
    tagline: 'A quilted puffer in Soul Violet, with a little gold heart worn over yours.',
    glow: ['#7c5cfc', '#3a2a9c'], accent: colors.aura, colourway: 'Soul Violet · Spark ribbing',
    features: [['weather-windy', 'Light, warm quilting'], ['cards-heart', 'Gold heart emblem'], ['shimmer', 'Gold front zip']],
  },
  {
    key: 'shoe', name: 'Soul Shoes', product: 'Soul Runner', sheet: require('../../../assets/shop-shoe.webp'),
    tagline: 'Cloud-soft sneakers with a heartbeat running down each side.',
    glow: ['#b08fff', '#ff6b9d'], accent: colors.spark, colourway: 'Aura Lilac · Spark sole',
    features: [['shoe-sneaker', 'Cushioned everyday sole'], ['heart-pulse', 'Heartbeat side line'], ['feather', 'Light and breathable']],
  },
  {
    key: 'band', name: 'Soul Wearables', product: 'Soul Band', sheet: require('../../../assets/shop-band.webp'),
    tagline: 'A fitness band that keeps your pulse, your steps and your Soulink Pulse in one place.',
    glow: ['#ff6b9d', '#7c5cfc'], accent: colors.mint, colourway: 'Spark to Soul fade · Gold pod',
    features: [['heart-pulse', 'Heart rate tracking'], ['run-fast', 'Steps, sleep and workouts'], ['link-variant', 'Syncs with your Pulse']],
  },
];

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

// soft blurred light behind the product
function Glow({ c, size }) {
  const st = { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: c, opacity: 0.38 };
  return <View pointerEvents="none" style={[st, web ? { filter: `blur(${Math.round(size / 5)}px)` } : { opacity: 0.18 }]} />;
}

function Stage({ item, wished, onWish }) {
  const float = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
      Animated.timing(float, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [float]);
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: ND }).start();
  }, [item.key, fade]);
  const y = float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const shadow = float.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] });
  const idx = SHOP_ITEMS.indexOf(item) + 1;
  return (
    <View style={{ height: 380, borderRadius: 30, overflow: 'hidden', marginHorizontal: space.lg, borderWidth: 1, borderColor: 'rgba(176,143,255,0.22)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(14,12,22,0.78)' }}>
      <LinearGradient colors={['rgba(124,92,252,0.20)', 'rgba(8,7,13,0)', 'rgba(255,107,157,0.10)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={FILL} />
      <View style={{ position: 'absolute', top: 60, alignItems: 'center', justifyContent: 'center' }}><Glow c={item.glow[0]} size={260} /></View>
      <View style={{ position: 'absolute', bottom: 40, right: 20 }}><Glow c={item.glow[1]} size={160} /></View>

      {/* pedestal: a glowing disc the product floats over */}
      <Animated.View style={{ position: 'absolute', bottom: 48, width: 220, height: 30, borderRadius: 110, transform: [{ scaleX: shadow }], opacity: shadow }}>
        <LinearGradient colors={[item.glow[0], item.glow[1]]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[FILL, { borderRadius: 110, opacity: 0.4 }]} />
        <View style={[FILL, { borderRadius: 110, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }, web ? { boxShadow: `0 0 40px ${item.glow[0]}` } : null]} />
      </Animated.View>
      <View style={{ position: 'absolute', bottom: 57, width: 130, height: 12, borderRadius: 65, backgroundColor: 'rgba(8,7,13,0.4)', ...(web ? { filter: 'blur(6px)' } : {}) }} />

      <Animated.View style={{ opacity: fade, transform: [{ translateY: y }, { scale: fade.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }], marginTop: -20 }}>
        <Spin3D key={item.key} sheet={item.sheet} size={290} />
      </Animated.View>

      <View style={{ position: 'absolute', top: 16, left: 18, flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={{ fontFamily: fonts.monoBold, fontSize: 14, color: colors.text }}>{String(idx).padStart(2, '0')}</Text>
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted }}> / 03</Text>
      </View>
      <View style={{ position: 'absolute', top: 14, right: 14, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ paddingHorizontal: 10, height: 26, borderRadius: 13, justifyContent: 'center', backgroundColor: 'rgba(245,200,66,0.14)', borderWidth: 1, borderColor: 'rgba(245,200,66,0.45)', marginRight: 8 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.gold }}>Coming soon</Text>
        </View>
        <Pressable onPress={onWish} hitSlop={8} accessibilityLabel={wished ? 'Remove from wishlist' : 'Add to wishlist'}
          style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,7,13,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
          <MaterialCommunityIcons name={wished ? 'heart' : 'heart-outline'} size={18} color={wished ? colors.spark : colors.text} />
        </Pressable>
      </View>
      <View style={{ position: 'absolute', bottom: 14, flexDirection: 'row', alignItems: 'center' }}>
        <MaterialCommunityIcons name="rotate-3d-variant" size={14} color={colors.muted} />
        <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, color: colors.muted, marginLeft: 6 }}>360° VIEW</Text>
      </View>
    </View>
  );
}

function Picker({ active, onPick }) {
  return (
    <View style={{ flexDirection: 'row', marginHorizontal: space.lg, marginTop: space.lg }}>
      {SHOP_ITEMS.map((it, i) => {
        const on = it.key === active;
        return (
          <Pressable key={it.key} onPress={() => onPick(it.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={({ hovered, pressed }) => ({ flex: 1, marginLeft: i ? 10 : 0, borderRadius: 20, padding: 1.2, transform: [{ scale: pressed ? 0.96 : 1 }], ...(web ? { cursor: 'pointer', outlineStyle: 'none' } : {}), opacity: on || hovered ? 1 : 0.78 })}>
            {on ? <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[FILL, { borderRadius: 20 }]} /> : <View style={[FILL, { borderRadius: 20, backgroundColor: 'rgba(176,143,255,0.18)' }]} />}
            <View style={{ borderRadius: 19, backgroundColor: on ? 'rgba(20,16,36,0.94)' : 'rgba(14,12,22,0.9)', alignItems: 'center', paddingTop: 6, paddingBottom: 10 }}>
              <Spin3D sheet={it.sheet} size={74} frame={4} />
              <Text numberOfLines={1} style={{ fontFamily: on ? fonts.bold : fonts.semibold, fontSize: 12, color: on ? colors.text : colors.muted, marginTop: 2 }}>{it.name}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const KEY = 'soulink.shopWishlist';

export default function Shop() {
  const { user } = useAuth();
  const [active, setActive] = useState('jacket');
  const [wish, setWish] = useState({});
  const item = SHOP_ITEMS.find((x) => x.key === active);
  const storeKey = `${KEY}.${user?.id || 'me'}`;

  useEffect(() => { AsyncStorage.getItem(storeKey).then((v) => { if (v) setWish(JSON.parse(v)); }).catch(() => {}); }, [storeKey]);
  const toggle = (k) => setWish((w) => {
    const next = { ...w, [k]: !w[k] };
    AsyncStorage.setItem(storeKey, JSON.stringify(next)).catch(() => {});
    return next;
  });
  const wished = !!wish[item.key];

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={{ alignItems: 'center', paddingTop: space.md, paddingBottom: space.lg, paddingHorizontal: space.xl }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2.4, color: colors.aura }}>SOULINK ORIGINALS</Text>
        <GradientText style={{ fontFamily: fonts.display, fontSize: 36, lineHeight: 44, marginTop: 4 }}>Soul Shop</GradientText>
        <Text style={{ fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.muted, textAlign: 'center', marginTop: 4 }}>Wear your vibe. Made for the Soulink family.</Text>
      </View>

      <Stage item={item} wished={wished} onWish={() => toggle(item.key)} />
      <Picker active={active} onPick={setActive} />

      <View style={{ marginHorizontal: space.lg, marginTop: space.lg, borderRadius: 24, padding: space.lg, backgroundColor: colors.glass, borderWidth: 1, borderColor: 'rgba(176,143,255,0.16)' }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.4, color: item.accent }}>{item.name.toUpperCase()}</Text>
        <GradientText style={{ fontFamily: fonts.display, fontSize: 26, lineHeight: 32, marginTop: 2 }}>{item.product}</GradientText>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.text, marginTop: 6 }}>{item.tagline}</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.md }}>
          {item.glow.concat(colors.gold).map((c, i) => (
            <View key={i} style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: c, marginRight: 6, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' }} />
          ))}
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.muted, marginLeft: 4, flex: 1 }} numberOfLines={1}>{item.colourway}</Text>
        </View>

        <View style={{ marginTop: space.md }}>
          {item.features.map(([icon, text]) => (
            <View key={text} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(124,92,252,0.16)', marginRight: 12 }}>
                <MaterialCommunityIcons name={icon} size={17} color={item.accent} />
              </View>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.text }}>{text}</Text>
            </View>
          ))}
        </View>

        <Pressable onPress={() => toggle(item.key)} accessibilityRole="button"
          style={({ pressed }) => ({ marginTop: space.xl, height: 52, borderRadius: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', transform: [{ scale: pressed ? 0.97 : 1 }], borderWidth: wished ? 1 : 0, borderColor: 'rgba(255,107,157,0.6)' })}>
          {wished ? null : <LinearGradient colors={gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={FILL} />}
          <MaterialCommunityIcons name={wished ? 'heart' : 'heart-plus-outline'} size={20} color={wished ? colors.spark : '#fff'} style={{ marginRight: 8 }} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: wished ? colors.spark : '#fff' }}>{wished ? 'In your wishlist' : 'Add to wishlist'}</Text>
        </Pressable>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.dim, textAlign: 'center', marginTop: 10 }}>Dropping soon on Soulink. Prices and sizes at launch.</Text>
      </View>
    </ScrollView>
  );
}
