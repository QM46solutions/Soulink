// A Spark full screen, YouTube style: the whole video on black with all the controls.
//  - Turning the phone turns the video: while full screen is open the app follows the phone's own rotation
//    (expo-screen-orientation; back to upright when it closes). The phone's "Auto-rotate" setting is respected.
//  - The rotate button stays as an optional control: it turns the picture sideways without turning the phone
//    (useful with Auto-rotate off).
//  - Close: the × button, or swipe down (a clear vertical swipe; taps, the progress bar and side-to-side
//    moves are left to the player).
// It carries on from where the feed was (startAt) and has all the controls: 10 s back / forward, progress, sound.
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, PanResponder, Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SparkVideo from './SparkVideo';
import { mediaUrl } from '../lib/api';
import { toggleSparksMuted, useSparksMuted } from '../lib/sparkSound';

// a native module: app builds from version 5 have it. Older installs that get this code over the air don't, so it
// is loaded carefully and the rotate button is all they get.
let Orientation = null;
if (Platform.OS !== 'web') { try { Orientation = require('expo-screen-orientation'); } catch { Orientation = null; } }
const follow = () => Orientation?.unlockAsync?.().catch(() => {});
const upright = () => Orientation?.lockAsync?.(Orientation.OrientationLock.PORTRAIT_UP).catch(() => {});

const CLOSE_AT = 110; // px pulled down to close

export default function SparkFullscreen({ visible, onClose, spark, onFirstPlay, startAt }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [rot, setRot] = useState(false);
  const muted = useSparksMuted();
  const pull = useRef(new Animated.Value(0)).current;
  const landscape = width > height; // the phone itself turned (auto-rotate)
  const turned = rot && !landscape; // the manual sideways view only makes sense while the screen is upright

  // follow the phone's rotation while open; upright again when closed
  useEffect(() => {
    if (!visible) return undefined;
    follow();
    return () => { upright(); };
  }, [visible]);
  // the phone was turned for real: the manual sideways view switches off (it would turn the picture twice)
  useEffect(() => { if (landscape) setRot(false); }, [landscape]);

  const close = () => { setRot(false); pull.setValue(0); onClose(); };
  const closeRef = useRef(close); closeRef.current = close;
  const turnedRef = useRef(turned); turnedRef.current = turned;
  // "down" as the person sees it: on the sideways view that is the screen's left
  const down = (g) => (turnedRef.current ? -g.dx : g.dy);
  const across = (g) => (turnedRef.current ? g.dy : g.dx);
  const pan = useRef(PanResponder.create({
    // only a clear downward swipe: taps, the progress bar and sideways moves stay with the player
    onMoveShouldSetPanResponder: (_, g) => down(g) > 14 && Math.abs(down(g)) > Math.abs(across(g)) * 2,
    onPanResponderMove: (_, g) => pull.setValue(Math.max(0, down(g))),
    onPanResponderRelease: (_, g) => {
      const v = turnedRef.current ? -g.vx : g.vy;
      if (down(g) > CLOSE_AT || v > 0.9) closeRef.current();
      else Animated.spring(pull, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
    },
    onPanResponderTerminate: () => Animated.spring(pull, { toValue: 0, useNativeDriver: true }).start(),
  })).current;

  if (!visible || !spark) return null;
  // sideways (manual): the player is laid out landscape (height × width) and turned 90°
  const w = turned ? height : width; const h = turned ? width : height;
  const Btn = ({ icon, label, onPress, mci }) => (
    <Pressable onPress={onPress} hitSlop={10} accessibilityLabel={label} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', marginLeft: 8 }}>
      {mci ? <MaterialCommunityIcons name={icon} size={22} color="#fff" /> : <Ionicons name={icon} size={22} color="#fff" />}
    </Pressable>
  );
  const fade = pull.interpolate({ inputRange: [0, 300], outputRange: [1, 0.35], extrapolate: 'clamp' });
  const shift = turned ? { translateX: Animated.multiply(pull, -1) } : { translateY: pull };
  return (
    <Modal visible animationType="fade" onRequestClose={close} supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']} statusBarTranslucent>
      <Animated.View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', opacity: fade }} {...pan.panHandlers}>
        {/* turned sideways (90° clockwise): the player's left edge is the phone's top (status bar, camera) and its right
            edge the phone's bottom (navigation bar), so the picture and its controls keep clear of both */}
        <Animated.View style={{ width: w, height: h, transform: [shift, ...(turned ? [{ rotate: '90deg' }] : [])],
          paddingLeft: turned ? insets.top : landscape ? insets.left : 0, paddingRight: turned ? insets.bottom : landscape ? insets.right : 0 }}>
          <SparkVideo uri={spark.videoUrl} poster={mediaUrl(spark.details?.edit?.poster || spark.details?.poster) || undefined} musicUri={spark.music?.url} edit={spark.details?.edit} height={h} fill autoPlay active controls fullscreen startAt={startAt}
            muted={muted} onToggleMute={toggleSparksMuted} onFullscreen={close} onFirstPlay={onFirstPlay} controlsInset={turned ? 0 : insets.bottom} />
          <View pointerEvents="box-none" style={{ position: 'absolute', top: turned ? 12 : (landscape ? 12 : insets.top + 8), right: turned ? insets.bottom + 12 : (landscape ? insets.right + 12 : 12), flexDirection: 'row' }}>
            {!landscape ? <Btn icon="phone-rotate-landscape" label={turned ? 'Turn back upright' : 'Turn sideways for landscape'} onPress={() => setRot((r) => !r)} mci /> : null}
            <Btn icon="close" label="Close full screen" onPress={close} />
          </View>
          {/* a small handle: swipe down to close */}
          <View pointerEvents="none" style={{ position: 'absolute', top: turned ? 6 : (landscape ? 6 : insets.top + 2), alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' }} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
