// Animated Soul Score shown on another person's profile. The look changes with the connection type
// (the accepted connection, or the request between you):
//   dating         → romantic: rose and red, heartbeat glow, hearts orbit, hearts burst and float up
//   situationship  → moonlit: violet and silver, slow breathing, moon orbits, twinkling stars
//   friendship     → platonic fun: sunny teal and yellow, bouncy count, confetti burst, two friends orbit
//   vibing         → chill: neon mint and violet, bouncy count, sparkle burst
//   networking     → formal: navy, steel and gold, precise count, clean lock-in ring, check badge
//   buddy          → formal-lite: blue and mint, precise count, lock-in ring
//   none / unsure  → the default Soulink cosmic look
// Tap the orb to play it again. Built from plain views (no SVG), so it works on phone and web.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, space } from '../lib/theme';

const ND = Platform.OS !== 'web';
const SIZE = 216;
const R = 96;   // ring radius
const N = 72;   // light ticks

const tiers = (score, list) => list.find(([min]) => score >= min)[1];

export const THEMES = {
  cosmic: {
    tag: null, icon: 'sparkles', coreLabel: 'SOUL SCORE',
    stops: [[124, 92, 252], [255, 107, 157], [245, 200, 66]],
    halo: null, core: ['rgba(124,92,252,0.38)', 'rgba(255,107,157,0.16)', 'rgba(8,7,13,0.9)'], edge: 'rgba(176,143,255,0.45)',
    pulse: 'breathe', count: 'smooth', burst: 'spark', orbit: 'spark', ambient: null,
    vibe: (s) => tiers(s, [
      [90, { label: 'Soul twins', line: 'This kind of match is rare. Your souls speak the same language.', icon: 'infinite', color: colors.gold }],
      [75, { label: 'Rare connection', line: 'Strong pull. You two think and feel alike.', icon: 'flame', color: colors.spark }],
      [60, { label: 'Great vibes', line: 'Plenty in common, and enough different to keep it fun.', icon: 'sparkles', color: colors.aura }],
      [45, { label: 'Worth exploring', line: 'Some sparks. Say hi and find out more.', icon: 'compass', color: colors.mint }],
      [0, { label: 'Opposites attract', line: 'Different wavelengths. Sometimes that is the magic.', icon: 'swap-horizontal', color: colors.mint }],
    ]),
  },
  eternal: {
    tag: 'Life partner', icon: 'diamond', coreLabel: 'PARTNER SCORE',
    stops: [[255, 214, 120], [255, 140, 170], [214, 51, 108]],
    halo: '#f5c842', core: ['rgba(245,200,66,0.36)', 'rgba(255,107,157,0.2)', 'rgba(20,8,6,0.93)'], edge: 'rgba(255,214,120,0.55)',
    pulse: 'heartbeat', count: 'smooth', burst: 'heart', orbit: 'heart', ambient: 'hearts',
    vibe: (s) => tiers(s, [
      [90, { label: 'Made for each other', line: 'The same dreams, the same values. A life together fits.', icon: 'diamond', color: '#f5c842' }],
      [75, { label: 'Marriage material', line: 'Strong foundations for a life together.', icon: 'heart', color: '#ff8fae' }],
      [60, { label: 'Promising', line: 'Good roots. Talk about family and future early.', icon: 'home', color: '#ffb36b' }],
      [45, { label: 'Needs real talks', line: 'Some big life choices differ. Discuss them openly.', icon: 'chatbubbles', color: '#ffc9a8' }],
      [0, { label: 'Different paths', line: 'You want different lives right now.', icon: 'git-compare', color: '#ffc9a8' }],
    ]),
  },
  romantic: {
    tag: 'Dating', icon: 'heart', coreLabel: 'LOVE SCORE',
    stops: [[255, 138, 170], [255, 77, 109], [214, 20, 70]],
    halo: '#ff4d6d', core: ['rgba(255,77,109,0.42)', 'rgba(214,20,70,0.18)', 'rgba(20,4,10,0.92)'], edge: 'rgba(255,138,170,0.55)',
    pulse: 'heartbeat', count: 'smooth', burst: 'heart', orbit: 'heart', ambient: 'hearts',
    vibe: (s) => tiers(s, [
      [90, { label: 'Soulmate material', line: 'Hearts in sync. This could be the one.', icon: 'heart', color: '#ff4d6d' }],
      [75, { label: 'Butterflies alert', line: 'Real chemistry. Your hearts beat alike.', icon: 'heart-circle', color: '#ff6b8b' }],
      [60, { label: 'Sparks are flying', line: 'A sweet match with room to grow.', icon: 'rose', color: '#ff8aaa' }],
      [45, { label: 'A slow burn', line: 'Take it slow. The best stories often start this way.', icon: 'cafe', color: '#ffb3c6' }],
      [0, { label: 'Opposites attract', line: 'Different hearts, but love loves a surprise.', icon: 'swap-horizontal', color: '#ffb3c6' }],
    ]),
  },
  moonlit: {
    tag: 'Situationship', icon: 'moon', coreLabel: 'SOUL SCORE',
    stops: [[140, 120, 255], [190, 170, 255], [226, 226, 245]],
    halo: '#8c78ff', core: ['rgba(140,120,255,0.35)', 'rgba(60,50,120,0.25)', 'rgba(6,6,16,0.94)'], edge: 'rgba(200,190,255,0.5)',
    pulse: 'breathe', count: 'smooth', burst: 'star', orbit: 'moon', ambient: 'stars',
    vibe: (s) => tiers(s, [
      [90, { label: 'Written in the stars', line: 'Undefined, but undeniable.', icon: 'moon', color: '#d9d2ff' }],
      [75, { label: 'Complicated, in a good way', line: 'Strong pull, no labels needed yet.', icon: 'partly-sunny', color: '#c3b6ff' }],
      [60, { label: 'Late-night talks energy', line: 'Easy to be around. See where it goes.', icon: 'chatbubbles', color: '#b09cff' }],
      [45, { label: 'Keep it light', line: 'A little mystery, a little fun.', icon: 'cloudy-night', color: '#a594f9' }],
      [0, { label: 'Two different skies', line: 'Different orbits. Sometimes they cross.', icon: 'swap-horizontal', color: '#a594f9' }],
    ]),
  },
  platonic: {
    tag: 'Friendship', icon: 'people', coreLabel: 'FRIEND SCORE',
    stops: [[66, 232, 192], [120, 220, 110], [255, 206, 84]],
    halo: '#42e8c0', core: ['rgba(66,232,192,0.34)', 'rgba(255,206,84,0.16)', 'rgba(4,14,12,0.92)'], edge: 'rgba(66,232,192,0.55)',
    pulse: 'bounce', count: 'bouncy', burst: 'confetti', orbit: 'friends', ambient: null,
    vibe: (s) => tiers(s, [
      [90, { label: 'Best-friend energy', line: 'Same jokes, same plans. Your new favourite person.', icon: 'happy', color: '#ffce54' }],
      [75, { label: 'Squad material', line: 'Easy to hang out with. Plans will happen.', icon: 'people', color: '#42e8c0' }],
      [60, { label: 'Good company', line: 'Enough in common for chai and long chats.', icon: 'cafe', color: '#78dc6e' }],
      [45, { label: 'Could click', line: 'Find the one thing you both love.', icon: 'hand-left', color: '#8be0cf' }],
      [0, { label: 'Different worlds', line: 'Different lives make the best stories.', icon: 'earth', color: '#8be0cf' }],
    ]),
  },
  chill: {
    tag: 'Just vibing', icon: 'musical-notes', coreLabel: 'VIBE SCORE',
    stops: [[66, 232, 192], [124, 200, 255], [176, 143, 255]],
    halo: '#6fd6ff', core: ['rgba(111,214,255,0.3)', 'rgba(176,143,255,0.18)', 'rgba(4,10,16,0.92)'], edge: 'rgba(111,214,255,0.5)',
    pulse: 'bounce', count: 'bouncy', burst: 'spark', orbit: 'spark', ambient: null,
    vibe: (s) => tiers(s, [
      [90, { label: 'Same frequency', line: 'Your vibes are basically a duet.', icon: 'radio', color: '#6fd6ff' }],
      [75, { label: 'Good vibes only', line: 'Easy energy. Zero effort needed.', icon: 'musical-notes', color: '#8ec5ff' }],
      [60, { label: 'Chill match', line: 'Relaxed and fun to be around.', icon: 'sunny', color: '#b08fff' }],
      [45, { label: 'Worth a hello', line: 'Say hi and see if it clicks.', icon: 'hand-left', color: '#42e8c0' }],
      [0, { label: 'Different playlists', line: 'Maybe you can swap songs.', icon: 'shuffle', color: '#42e8c0' }],
    ]),
  },
  formal: {
    tag: 'Networking', icon: 'briefcase', coreLabel: 'COMPATIBILITY',
    stops: [[88, 130, 200], [140, 170, 220], [212, 175, 90]],
    halo: '#5882c8', core: ['rgba(88,130,200,0.28)', 'rgba(30,40,70,0.4)', 'rgba(6,8,16,0.95)'], edge: 'rgba(140,170,220,0.5)',
    pulse: 'steady', count: 'precise', burst: 'lockin', orbit: 'dot', ambient: null,
    vibe: (s) => tiers(s, [
      [90, { label: 'Ideal collaborators', line: 'Highly aligned values and ways of working.', icon: 'ribbon', color: '#d4af5a' }],
      [75, { label: 'Strong alignment', line: 'Complementary strengths. Worth a proper meeting.', icon: 'trending-up', color: '#8caadc' }],
      [60, { label: 'Good professional fit', line: 'Common ground to build on.', icon: 'checkmark-done', color: '#8caadc' }],
      [45, { label: 'Worth a conversation', line: 'A quick call could open doors.', icon: 'call', color: '#9fb3d1' }],
      [0, { label: 'Complementary perspectives', line: 'Different thinking can be an advantage.', icon: 'git-compare', color: '#9fb3d1' }],
    ]),
  },
  buddy: {
    tag: 'Study / Work buddy', icon: 'book', coreLabel: 'BUDDY SCORE',
    stops: [[88, 150, 230], [66, 200, 200], [66, 232, 192]],
    halo: '#58a0e6', core: ['rgba(88,150,230,0.3)', 'rgba(66,232,192,0.14)', 'rgba(4,10,18,0.94)'], edge: 'rgba(120,180,240,0.5)',
    pulse: 'steady', count: 'precise', burst: 'lockin', orbit: 'dot', ambient: null,
    vibe: (s) => tiers(s, [
      [90, { label: 'Perfect study partner', line: 'Same focus, same pace. Productivity unlocked.', icon: 'rocket', color: '#42e8c0' }],
      [75, { label: 'Great teammate', line: 'You would keep each other on track.', icon: 'people-circle', color: '#6fc3e6' }],
      [60, { label: 'Solid buddy', line: 'Good balance of focus and fun.', icon: 'checkmark-done', color: '#8ab4e8' }],
      [45, { label: 'Try one session', line: 'One study sprint will tell you.', icon: 'timer', color: '#9fc0e0' }],
      [0, { label: 'Different styles', line: 'You might learn a new way of working.', icon: 'git-compare', color: '#9fc0e0' }],
    ]),
  },
};

const THEME_OF = { life_partner: 'eternal', dating: 'romantic', situationship: 'moonlit', friendship: 'platonic', vibing: 'chill', networking: 'formal', buddy: 'buddy' };
export const themeFor = (intent) => THEMES[THEME_OF[intent]] || THEMES.cosmic;
export const vibeOf = (score, intent) => themeFor(intent).vibe(score);

function ringColor(stops, i) {
  const t = i / (N - 1);
  const [a, b, k] = t < 0.6 ? [stops[0], stops[1], t / 0.6] : [stops[1], stops[2], (t - 0.6) / 0.4];
  return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * k)).join(',')})`;
}

const CONFETTI = ['#ffce54', '#42e8c0', '#ff6b9d', '#6fd6ff', '#b08fff', '#78dc6e'];

export default function SoulScoreOrb({ score, name, intent }) {
  const th = themeFor(intent);
  const vibe = th.vibe(score);
  const [run, setRun] = useState(0);
  const [shown, setShown] = useState(0);
  const [lit, setLit] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const ambient = useRef(new Animated.Value(0)).current;
  const ticks = useMemo(() => Array.from({ length: N }, (_, i) => ringColor(th.stops, i)), [th]);
  const halo = th.halo || vibe.color;

  // count up + fill the ring, then the landing effect and the vibe label
  useEffect(() => {
    progress.setValue(0); burst.setValue(0); rise.setValue(0); setShown(0); setLit(0);
    const id = progress.addListener(({ value }) => {
      setShown(Math.min(100, Math.max(0, Math.round(value * score))));
      setLit(Math.min(N, Math.max(0, Math.round(value * (score / 100) * N))));
    });
    const easing = th.count === 'bouncy' ? Easing.out(Easing.back(1.6)) : th.count === 'precise' ? Easing.inOut(Easing.cubic) : Easing.out(Easing.cubic);
    const anim = Animated.sequence([
      Animated.delay(250),
      Animated.timing(progress, { toValue: 1, duration: th.count === 'precise' ? 1500 : 1900, easing, useNativeDriver: false }),
      Animated.parallel([
        Animated.timing(burst, { toValue: 1, duration: th.burst === 'lockin' ? 700 : 1100, easing: Easing.out(Easing.quad), useNativeDriver: ND }),
        th.count === 'precise'
          ? Animated.timing(rise, { toValue: 1, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: ND })
          : Animated.spring(rise, { toValue: 1, friction: 6, tension: 60, useNativeDriver: ND }),
      ]),
    ]);
    anim.start();
    return () => { anim.stop(); progress.removeListener(id); };
  }, [score, run, th, progress, burst, rise]);

  // endless: glow rhythm, orbit, ambient particles
  useEffect(() => {
    const t = (v, d, e = Easing.inOut(Easing.sin)) => Animated.timing(pulse, { toValue: v, duration: d, easing: e, useNativeDriver: ND });
    const rhythm = {
      heartbeat: Animated.sequence([t(1, 140), t(0.35, 120), t(0.85, 150), t(0, 320), Animated.delay(650)]),
      bounce: Animated.sequence([t(1, 380, Easing.out(Easing.quad)), t(0, 520, Easing.bounce), Animated.delay(500)]),
      steady: Animated.sequence([t(1, 2600), t(0, 2600)]),
      breathe: Animated.sequence([t(1, 1600), t(0, 1600)]),
    }[th.pulse];
    pulse.setValue(0); orbit.setValue(0); ambient.setValue(0);
    const p = Animated.loop(rhythm);
    const o = Animated.loop(Animated.timing(orbit, { toValue: 1, duration: th.pulse === 'steady' ? 14000 : 9000, easing: Easing.linear, useNativeDriver: ND }));
    const a = Animated.loop(Animated.timing(ambient, { toValue: 1, duration: 4200, easing: Easing.linear, useNativeDriver: ND }));
    p.start(); o.start(); a.start();
    return () => { p.stop(); o.stop(); a.stop(); };
  }, [th, pulse, orbit, ambient]);

  const bigPulse = th.pulse === 'heartbeat' ? 1.13 : th.pulse === 'bounce' ? 1.1 : th.pulse === 'steady' ? 1.03 : 1.08;
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, bigPulse] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: th.pulse === 'steady' ? [0.22, 0.34] : [0.35, 0.72] });
  const coreScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, th.pulse === 'heartbeat' ? 1.04 : th.pulse === 'bounce' ? 1.03 : 1] });
  const spin = orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const spinBack = orbit.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const rgb = (c) => `rgb(${c.join(',')})`;

  const orbiter = (big) => {
    const col = rgb(big ? th.stops[1] : th.stops[0]);
    if (th.orbit === 'heart') return <Ionicons name="heart" size={big ? 16 : 12} color={col} />;
    if (th.orbit === 'moon') return big ? <Ionicons name="moon" size={15} color="#e2e2f5" /> : <Ionicons name="star" size={9} color="#c3b6ff" />;
    if (th.orbit === 'friends') return <Ionicons name={big ? 'happy' : 'happy-outline'} size={big ? 16 : 14} color={big ? '#ffce54' : '#42e8c0'} />;
    if (th.orbit === 'dot') return big ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#d4af5a' }} /> : null;
    return <View style={{ width: big ? 8 : 6, height: big ? 8 : 6, borderRadius: 4, backgroundColor: col, shadowColor: col, shadowOpacity: 1, shadowRadius: 8 }} />;
  };

  const burstPiece = (i, count) => {
    const a = (i / count) * Math.PI * 2;
    const far = th.burst === 'heart' ? 118 : 128;
    const lift = th.burst === 'heart' ? -30 : 0; // hearts drift upward
    const style = {
      position: 'absolute',
      opacity: burst.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
      transform: [
        { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [Math.cos(a) * 58, Math.cos(a) * far] }) },
        { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [Math.sin(a) * 58, Math.sin(a) * far + lift] }) },
        ...(th.burst === 'confetti' ? [{ rotate: burst.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(i % 2 ? 1 : -1) * 320}deg`] }) }] : []),
        { scale: burst.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.1, 0.8] }) },
      ],
    };
    if (th.burst === 'heart') return <Animated.View key={`b${i}`} pointerEvents="none" style={style}><Ionicons name="heart" size={i % 3 ? 12 : 16} color={i % 2 ? '#ff4d6d' : '#ff8aaa'} /></Animated.View>;
    if (th.burst === 'star') return <Animated.View key={`b${i}`} pointerEvents="none" style={style}><Ionicons name="star" size={i % 2 ? 9 : 12} color={i % 2 ? '#e2e2f5' : '#b09cff'} /></Animated.View>;
    if (th.burst === 'confetti') return <Animated.View key={`b${i}`} pointerEvents="none" style={[style, { width: i % 3 ? 7 : 5, height: i % 3 ? 4 : 9, borderRadius: 1, backgroundColor: CONFETTI[i % CONFETTI.length] }]} />;
    return <Animated.View key={`b${i}`} pointerEvents="none" style={[style, { width: 6, height: 6, borderRadius: 3, backgroundColor: i % 2 ? colors.gold : colors.spark }]} />;
  };

  // ambient particles that keep going after the reveal (dating: rising hearts, situationship: twinkling stars)
  let ambientLayer = null;
  if (th.ambient === 'hearts') {
    ambientLayer = [0, 1, 2, 3, 4].map((i) => {
      const v = Animated.modulo(Animated.add(ambient, i / 5), 1);
      return (
        <Animated.View key={`a${i}`} pointerEvents="none" style={{
          position: 'absolute', left: SIZE / 2 - 70 + i * 32, bottom: 18,
          opacity: v.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.8, 0.5, 0] }),
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -150] }) }, { translateX: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, i % 2 ? 8 : -8, 0] }) }],
        }}><Ionicons name="heart" size={i % 2 ? 10 : 13} color={i % 2 ? '#ff8aaa' : '#ff4d6d'} /></Animated.View>
      );
    });
  } else if (th.ambient === 'stars') {
    ambientLayer = [[20, 30], [180, 24], [196, 150], [14, 170], [100, 6], [110, 204]].map(([x, y], i) => {
      const v = Animated.modulo(Animated.add(ambient, i / 6), 1);
      return (
        <Animated.View key={`a${i}`} pointerEvents="none" style={{ position: 'absolute', left: x, top: y, opacity: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.1, 1, 0.1] }) }}>
          <Ionicons name="star" size={i % 2 ? 7 : 10} color="#e2e2f5" />
        </Animated.View>
      );
    });
  }

  const precise = th.count === 'precise';
  const BURST_N = th.burst === 'confetti' ? 18 : 12;
  return (
    <View style={{ alignItems: 'center', marginBottom: space.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm }}>
        {th.tag ? <Ionicons name={th.icon} size={12} color={vibe.color} style={{ marginRight: 6 }} /> : null}
        <Text style={{ fontFamily: fonts.mono, color: th.tag ? vibe.color : colors.muted, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}>
          {name ? `You & ${name}` : ''}{th.tag ? `${name ? '  ·  ' : ''}${th.tag}` : ''}
        </Text>
      </View>
      <Pressable onPress={() => setRun((r) => r + 1)} accessibilityLabel={`${th.coreLabel.toLowerCase()} ${score} percent. Tap to replay`} style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ position: 'absolute', width: 170, height: 170, borderRadius: 85, backgroundColor: halo, opacity: glowOpacity, transform: [{ scale: glowScale }], ...(Platform.OS === 'web' ? { filter: 'blur(28px)' } : { shadowColor: halo, shadowOpacity: 0.9, shadowRadius: 30 }) }} />
        {ambientLayer}

        {ticks.map((c, i) => {
          const on = i < lit;
          return (
            <View key={i} style={{
              position: 'absolute', left: SIZE / 2 - (precise ? 1 : 1.5), top: SIZE / 2 - (on ? 7 : 5), width: precise ? 2 : 3, height: on ? 14 : 10, borderRadius: 2,
              backgroundColor: on ? c : colors.border, opacity: on ? 1 : 0.7,
              transform: [{ rotate: `${(i / N) * 360}deg` }, { translateY: -R }],
            }} />
          );
        })}

        {th.burst === 'lockin' ? (
          // formal themes: a clean outer ring locks in when the score lands
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', width: 2 * R + 26, height: 2 * R + 26, borderRadius: R + 13, borderWidth: 1.5, borderColor: rgb(th.stops[2]),
            opacity: burst.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 0.55] }),
            transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
          }} />
        ) : Array.from({ length: BURST_N }, (_, i) => burstPiece(i, BURST_N))}

        <Animated.View pointerEvents="none" style={{ position: 'absolute', width: SIZE, height: SIZE, alignItems: 'center', transform: [{ rotate: spin }] }}>
          <View style={{ marginTop: -2 }}>{orbiter(true)}</View>
        </Animated.View>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', width: SIZE - 40, height: SIZE - 40, alignItems: 'center', justifyContent: 'flex-end', transform: [{ rotate: th.orbit === 'friends' ? spin : spinBack }] }}>
          <View style={{ marginBottom: -2 }}>{orbiter(false)}</View>
        </Animated.View>

        <Animated.View style={{ transform: [{ scale: coreScale }] }}>
          <LinearGradient colors={th.core} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
            style={{ width: 148, height: 148, borderRadius: 74, borderWidth: 1, borderColor: th.edge, alignItems: 'center', justifyContent: 'center' }}>
            {th.tag ? <Ionicons name={th.icon} size={14} color={vibe.color} style={{ marginBottom: -2 }} /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Text style={{ fontFamily: precise ? fonts.displayBold : fonts.display, color: colors.text, fontSize: 52, lineHeight: 60 }}>{shown}</Text>
              <Text style={{ fontFamily: fonts.displayBold, color: vibe.color, fontSize: 20, marginTop: 8, marginLeft: 2 }}>%</Text>
            </View>
            <Text style={{ fontFamily: fonts.mono, color: vibe.color, fontSize: 9.5, letterSpacing: 2.2, marginTop: -2 }}>{th.coreLabel}</Text>
          </LinearGradient>
          {th.burst === 'lockin' ? (
            <Animated.View style={{ position: 'absolute', right: 4, bottom: 8, opacity: burst, transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }}>
              <View style={{ backgroundColor: rgb(th.stops[2]), borderRadius: 12, padding: 3, borderWidth: 2, borderColor: colors.void }}>
                <Ionicons name="checkmark" size={14} color={colors.void} />
              </View>
            </Animated.View>
          ) : null}
        </Animated.View>
      </Pressable>

      <Animated.View style={{ alignItems: 'center', opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6, borderRadius: precise ? 10 : 999, borderWidth: 1, borderColor: vibe.color, backgroundColor: 'rgba(26,24,40,0.72)' }}>
          <Ionicons name={vibe.icon} size={14} color={vibe.color} style={{ marginRight: 6 }} />
          <Text style={{ fontFamily: fonts.semibold, color: vibe.color, fontSize: 14 }}>{vibe.label}</Text>
        </View>
        <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: space.sm, paddingHorizontal: space.xl }}>{vibe.line}</Text>
      </Animated.View>
    </View>
  );
}
