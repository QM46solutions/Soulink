// Face ID scan used at registration. Same code for phone cameras (Android/iPhone) and laptop webcams.
// The camera checks a frame about once a second and coaches the person live ("too dark", "move closer",
// "hold still"...). Each pose is captured only when the picture is clear AND the head is in position:
//   1 look straight  →  2 turn your head one way  →  3 turn the other way   (proves a live person)
// The server turns the scan into a face fingerprint and blocks faces that already have an account.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Switch, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { colors, fonts, gradients, space } from '../lib/theme';
import { Button } from './ui';

const SIZE = 250;
const POSES = [
  { say: 'Look straight at the camera', icon: 'face-recognition' },
  { say: 'Slowly turn your head left', icon: 'arrow-left-bold-circle-outline' },
  { say: 'Now turn your head the other way', icon: 'arrow-right-bold-circle-outline' },
];
const STRAIGHT = 0.15;   // |yaw| at most this = looking straight
const TURNED = 0.25;     // |yaw| at least this = head turned
const GIVE_UP_MS = 60000;
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

function Ring({ spin, children, color }) {
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={{ width: SIZE + 16, height: SIZE + 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: SIZE + 16, height: SIZE + 16, borderRadius: (SIZE + 16) / 2, overflow: 'hidden', transform: [{ rotate }] }}>
        <LinearGradient colors={color ? [color, color] : [...gradients.button, 'rgba(124,92,252,0.1)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
      </Animated.View>
      <View style={{ width: SIZE, height: SIZE, borderRadius: SIZE / 2, overflow: 'hidden', backgroundColor: colors.void }}>{children}</View>
    </View>
  );
}

function CoachPill({ text, good }) {
  const c = good ? colors.mint : colors.gold;
  return (
    <View style={{
      alignSelf: 'center', flexDirection: 'row', alignItems: 'center', marginTop: space.sm, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1,
      borderColor: good ? 'rgba(66,232,192,0.4)' : 'rgba(245,200,66,0.5)', backgroundColor: good ? 'rgba(66,232,192,0.08)' : 'rgba(245,200,66,0.10)',
    }}>
      <Ionicons name={good ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={16} color={c} style={{ marginRight: 6 }} />
      <Text style={{ color: c, fontFamily: fonts.semibold, fontSize: 14 }}>{text}</Text>
    </View>
  );
}

export default function FaceScan({ onVerified, alreadyVerified }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState(alreadyVerified ? 'done' : 'intro'); // intro | scanning | checking | done | failed
  const [pose, setPose] = useState(0);
  const [shots, setShots] = useState(0);
  const [error, setError] = useState(null);
  const [useAsAvatar, setUseAsAvatar] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [coach, setCoach] = useState(null); // { text, good }
  const cam = useRef(null);
  const running = useRef(false);
  const alive = useRef(true);
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const snap = async () => {
    const pic = await cam.current.takePictureAsync({ quality: 0.6, shutterSound: false });
    const small = await manipulateAsync(pic.uri, [{ resize: { width: 480 } }], { compress: 0.8, format: SaveFormat.JPEG, base64: true });
    return small.base64;
  };

  // Live loop: check a frame, coach, and keep it when it's clear and the head is in the right position
  useEffect(() => {
    if (phase !== 'scanning' || !cameraReady || running.current) return;
    running.current = true;
    (async () => {
      try {
        const frames = [];
        let firstTurn = 0;
        let lastHint = null;
        const started = Date.now();
        await sleep(500); // let the camera settle its exposure
        while (frames.length < POSES.length) {
          if (!alive.current) return;
          if (Date.now() - started > GIVE_UP_MS) {
            throw new Error(lastHint ? `We couldn't finish the scan. ${lastHint}` : "We couldn't finish the scan. Try again in better light.");
          }
          const i = frames.length;
          const shot = await snap();
          const c = await api('/face/check', { method: 'POST', body: { frame: shot }, timeoutMs: 20000 });
          if (!alive.current) return;
          if (!c.ok) { lastHint = c.hint; setCoach({ text: c.hint, good: false }); continue; }
          const yaw = c.yaw || 0;
          const turned = Math.abs(yaw) >= TURNED;
          const inPose = i === 0 ? Math.abs(yaw) <= STRAIGHT : i === 1 ? turned : turned && Math.sign(yaw) !== firstTurn;
          if (inPose) {
            if (i === 1) firstTurn = Math.sign(yaw);
            frames.push(shot);
            setShots(frames.length);
            setPose(Math.min(frames.length, POSES.length - 1));
            setCoach({ text: 'Got it', good: true });
          } else if (i === 0) {
            setCoach({ text: 'Look straight at the camera', good: true });
          } else if (i === 2 && turned) {
            setCoach({ text: 'Now turn the other way', good: true });
          } else {
            setCoach({ text: Math.abs(yaw) > 0.1 ? 'A little more…' : POSES[i].say, good: true });
          }
        }
        setPhase('checking');
        const r = await api('/face/enroll', { method: 'POST', body: { frames, useAsAvatar }, timeoutMs: 90000 });
        if (!alive.current) return;
        setPhase('done');
        onVerified?.(r.user);
      } catch (e) {
        if (!alive.current) return;
        setError(e.message || 'Something went wrong. Please try again.');
        setPhase('failed');
      } finally { running.current = false; }
    })();
  }, [phase, cameraReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    setError(null); setShots(0); setPose(0); setCameraReady(false); setCoach(null);
    const p = permission?.granted ? permission : await requestPermission();
    if (!p.granted) { setError('Soulink needs your camera for the face scan. Allow camera access and try again.'); setPhase('failed'); return; }
    setPhase('scanning');
  };

  if (phase === 'intro' || phase === 'failed') {
    const failed = phase === 'failed';
    return (
      <View>
        <Ring spin={spin} color={failed ? colors.danger : null}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="face-recognition" size={110} color={failed ? colors.danger : colors.aura} />
          </View>
        </Ring>
        {failed ? (
          <Text style={{ color: colors.danger, fontFamily: fonts.medium, fontSize: 14, textAlign: 'center', marginTop: space.lg, lineHeight: 20 }}>{error}</Text>
        ) : (
          <View style={{ marginTop: space.xl }}>
            {[
              ['shield-check-outline', 'Blocks fake and duplicate accounts'],
              ['gesture-tap-hold', "Hands-free: we guide you and capture when it's clear"],
              ['lock-outline', 'We keep only a face fingerprint, never your scan photos'],
            ].map(([icon, text]) => (
              <View key={text} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm, paddingHorizontal: space.sm }}>
                <MaterialCommunityIcons name={icon} size={18} color={colors.mint} style={{ marginRight: space.md }} />
                <Text style={{ color: colors.text, fontFamily: fonts.body, fontSize: 14, flex: 1 }}>{text}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: space.lg }}>
          <Switch value={useAsAvatar} onValueChange={setUseAsAvatar} trackColor={{ true: colors.soul, false: colors.border }} thumbColor="#fff" />
          <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 13, marginLeft: space.sm }}>Use my scan as profile photo</Text>
        </View>
        <Button title={failed ? 'Try again' : 'Start face scan'} onPress={start} style={{ marginTop: space.xl }} />
      </View>
    );
  }

  if (phase === 'done') {
    return (
      <View style={{ alignItems: 'center' }}>
        <Ring spin={spin} color={colors.mint}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(66,232,192,0.08)' }}>
            <Ionicons name="checkmark-circle" size={110} color={colors.mint} />
          </View>
        </Ring>
        <Text style={{ color: colors.mint, fontFamily: fonts.displayBold, fontSize: 20, marginTop: space.lg }}>Face verified</Text>
        <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 14, marginTop: 4 }}>You're a real soul. Welcome in.</Text>
      </View>
    );
  }

  // scanning / checking
  const p = POSES[pose];
  const problem = phase === 'scanning' && coach && !coach.good;
  return (
    <View>
      <Ring spin={spin} color={problem ? colors.gold : null}>
        <CameraView ref={cam} facing="front" style={{ flex: 1 }} onCameraReady={() => setCameraReady(true)} />
        {phase === 'checking' ? (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,7,13,0.65)', alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.aura} size="large" />
          </View>
        ) : null}
      </Ring>
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: space.lg }}>
        {POSES.map((_, i) => (
          <View key={i} style={{ width: i < shots ? 26 : 10, height: 10, borderRadius: 5, marginHorizontal: 4, backgroundColor: i < shots ? colors.mint : i === pose && phase === 'scanning' ? colors.aura : colors.border }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: space.lg, minHeight: 28 }}>
        {phase === 'checking' ? (
          <Text style={{ color: colors.text, fontFamily: fonts.displayBold, fontSize: 18 }}>Checking it's really you…</Text>
        ) : (
          <>
            <MaterialCommunityIcons name={p.icon} size={24} color={colors.aura} style={{ marginRight: 8 }} />
            <Text style={{ color: colors.text, fontFamily: fonts.displayBold, fontSize: 18 }}>{cameraReady ? p.say : 'Starting camera…'}</Text>
          </>
        )}
      </View>
      {phase === 'scanning' && coach ? <CoachPill text={coach.text} good={coach.good} /> : (
        <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', marginTop: 6 }}>
          Good light, face inside the circle, only you in view.
        </Text>
      )}
    </View>
  );
}
