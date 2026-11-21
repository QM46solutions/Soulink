// Face ID scan used at registration. Same code for phone cameras (Android/iPhone) and laptop webcams.
// The camera checks a frame about once a second and coaches the person live ("too dark", "move closer",
// "hold still"...). Each pose is captured only when the picture is clear AND the head is in position:
//   1 look straight  →  2 turn your head one way  →  3 turn the other way   (proves a live person)
// The server turns the scan into a face fingerprint and blocks faces that already have an account.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Easing, Linking, Platform, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { colors, fonts, gradients, space } from '../lib/theme';
import { Button } from './ui';
import { FaceScanIcon } from './LiveIcons';
import Consent from './Consent';

const SIZE = 250;
const POSES = [
  { say: 'Look straight at the camera', icon: 'face-recognition' },
  { say: 'Slowly turn your head left', icon: 'arrow-left-bold-circle-outline' },
  { say: 'Now turn your head the other way', icon: 'arrow-right-bold-circle-outline' },
];
const STRAIGHT = 0.18;   // |yaw| at most this = looking straight
const TURNED = 0.22;     // |yaw| at least this = head turned
const GIVE_UP_MS = 90000;
const CAMERA_START_MS = 12000; // some Android phones never report "camera ready": we stop waiting after this
const MAX_HICCUPS = 5;         // a dropped request or a missed photo is retried; this many in a row ends the scan
// A slow or dropped connection, a busy server or a camera that missed one photo: worth another try, not a failure
const passing = (e) => !e?.status || e.status === 0 || e.status === 408 || e.status === 429 || e.status >= 500;
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
  const [agreed, setAgreed] = useState(false);
  const [pose, setPose] = useState(0);
  const [shots, setShots] = useState(0);
  const [error, setError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [coach, setCoach] = useState(null); // { text, good }
  const [checkingSince, setCheckingSince] = useState(0);
  const [, tick] = useState(0);
  useEffect(() => {
    if (phase !== 'checking') return undefined;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);
  const [blocked, setBlocked] = useState(false); // camera permission turned off for good: only phone Settings can fix it
  const cam = useRef(null);
  const running = useRef(false);
  const alive = useRef(true);
  const gen = useRef(0); // which scan is current: a scan that was stopped never reports back
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const snap = async () => {
    if (!cam.current) throw new Error('camera not ready');
    // two sizes: a small one for the live check (fast to send and check; the server looks at 320 px anyway)
    // and the 480 px one kept for the final fingerprint when the pose is right
    const pic = await cam.current.takePictureAsync({ quality: 0.5, shutterSound: false });
    const keep = await manipulateAsync(pic.uri, [{ resize: { width: 480 } }], { compress: 0.85, format: SaveFormat.JPEG, base64: true });
    const check = await manipulateAsync(keep.uri, [{ resize: { width: 320 } }], { compress: 0.7, format: SaveFormat.JPEG, base64: true });
    return { keep: keep.base64, check: check.base64 };
  };

  // Some phones (mostly Android) never say the camera is ready: try taking photos anyway after a while
  useEffect(() => {
    if (phase !== 'scanning' || cameraReady) return undefined;
    const t = setTimeout(() => { if (alive.current) setCameraReady(true); }, CAMERA_START_MS);
    return () => clearTimeout(t);
  }, [phase, cameraReady]);

  // Leaving the app mid-scan (a call, the notification shade) stops the camera: pause the scan and start again
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active' && phase === 'scanning' && running.current) {
        gen.current += 1; running.current = false; // the running loop stops at its next step
        setError('The scan stopped because Soulink went to the background. Tap Try again to scan.');
        setPhase('failed');
      }
    });
    return () => sub.remove();
  }, [phase]);

  // Live loop: check a frame, coach, and keep it when it's clear and the head is in the right position
  useEffect(() => {
    if (phase !== 'scanning' || !cameraReady || running.current) return;
    running.current = true;
    const g = gen.current;
    const mine = () => alive.current && gen.current === g; // a cancelled scan stops quietly
    (async () => {
      try {
        const frames = [];
        let firstTurn = 0;
        let lastHint = null;
        let hiccups = 0;
        const started = Date.now();
        await sleep(500); // let the camera settle its exposure
        while (frames.length < POSES.length) {
          if (!mine()) return;
          if (Date.now() - started > GIVE_UP_MS) {
            throw new Error(lastHint ? `We couldn't finish the scan. ${lastHint}` : "We couldn't finish the scan. Try again in better light.");
          }
          const i = frames.length;
          let shot; let c;
          try {
            shot = await snap();
            c = await api('/face/check', { method: 'POST', body: { frame: shot.check }, timeoutMs: 20000 });
            hiccups = 0;
          } catch (e) {
            if (!mine()) return;
            // one missed photo or a dropped request used to end the whole scan: now it tries again
            if (!passing(e) && e.message !== 'camera not ready' && !/camera|capture|picture|image/i.test(e.message || '')) throw e;
            hiccups += 1;
            if (hiccups >= MAX_HICCUPS) {
              throw new Error(e.status === 429 ? 'Too many tries for now. Wait a few minutes, then tap Try again.'
                : e.status != null && e.status !== 0 ? 'Our face check is busy right now. Wait a minute, then tap Try again.'
                  : e.status === 0 ? 'Your internet connection dropped during the scan. Check it, then tap Try again.'
                    : "The camera couldn't take a photo. Close other apps that use the camera, then tap Try again.");
            }
            setCoach({ text: e.status === 0 ? 'Slow connection, still trying…' : 'Hold on, trying again…', good: false });
            await sleep(1000 * hiccups);
            continue;
          }
          if (!mine()) return;
          if (!c.ok) { lastHint = c.hint; setCoach({ text: c.hint, good: false }); continue; }
          const yaw = c.yaw || 0;
          const turned = Math.abs(yaw) >= TURNED;
          const inPose = i === 0 ? Math.abs(yaw) <= STRAIGHT : i === 1 ? turned : turned && Math.sign(yaw) !== firstTurn;
          if (inPose) {
            if (i === 1) firstTurn = Math.sign(yaw);
            frames.push(shot.keep);
            setShots(frames.length);
            setPose(Math.min(frames.length, POSES.length - 1));
            setCoach({ text: 'Got it', good: true });
          } else if (i === 0) {
            setCoach({ text: 'Look straight at the camera', good: true });
          } else if (i === 2 && turned) {
            setCoach({ text: 'Now turn the other way', good: true });
          } else {
            setCoach({ text: Math.abs(yaw) > 0.08 ? 'A little more…' : POSES[i].say, good: true });
          }
        }
        setPhase('checking'); setCheckingSince(Date.now());
        let r;
        try {
          r = await api('/face/enroll', { method: 'POST', body: { frames, useAsAvatar: false }, timeoutMs: 150000 });
        } catch (e) {
          // The server can be slow (or the connection drop) while it checks the scan. It may still have finished:
          // ask once before calling it a failure, so a good scan is never thrown away.
          if (e.status === 0 || e.status >= 500) {
            const me = await api('/users/me', { timeoutMs: 20000 }).catch(() => null);
            if (me?.user?.verified) { r = me; } else {
              throw new Error("The check took too long on our side. Your scan was fine: tap Try again.");
            }
          } else throw e;
        }
        if (!mine()) return;
        setPhase('done');
        onVerified?.(r.user);
      } catch (e) {
        if (!mine()) return;
        setError(e.message || 'Something went wrong. Please try again.');
        setPhase('failed');
      } finally { if (gen.current === g) running.current = false; }
    })();
  }, [phase, cameraReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    if (!agreed) return;
    setError(null); setShots(0); setPose(0); setCameraReady(false); setCoach(null);
    let p = permission;
    if (!p?.granted) {
      try { p = await requestPermission(); } catch { p = null; }
    }
    if (!p?.granted) {
      // asked before and refused for good: the phone won't show the question again, only its Settings can allow it
      const forGood = p && p.canAskAgain === false && Platform.OS !== 'web';
      setBlocked(!!forGood);
      setError(forGood
        ? 'Camera access is turned off for Soulink. Open phone settings, allow Camera, then come back and tap Try again.'
        : 'Soulink needs your camera for the face scan. Allow camera access and try again.');
      setPhase('failed');
      return;
    }
    setBlocked(false);
    setPhase('scanning');
  };

  if (phase === 'intro' || phase === 'failed') {
    const failed = phase === 'failed';
    return (
      <View>
        <Ring spin={spin} color={failed ? colors.danger : null}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <FaceScanIcon size={190} color={failed ? colors.danger : colors.mint} />
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
        <Consent face value={agreed} onChange={setAgreed} />
        {failed && blocked ? <Button variant="ghost" title="Open phone settings" onPress={() => Linking.openSettings().catch(() => {})} style={{ marginTop: space.lg }} /> : null}
        <Button title={failed ? 'Try again' : 'Start face scan'} onPress={start} disabled={!agreed} style={{ marginTop: failed && blocked ? space.sm : space.lg }} />
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
      {phase === 'checking' ? (
        <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 }}>
          {Date.now() - checkingSince < 15000 ? 'Your scan is done. This takes a few seconds.'
            : Date.now() - checkingSince < 45000 ? 'Still checking. Others are signing up too, so this can take up to a minute.'
              : 'Almost there. Please keep Soulink open.'}
        </Text>
      ) : phase === 'scanning' && coach ? <CoachPill text={coach.text} good={coach.good} /> : (
        <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', marginTop: 6 }}>
          Good light, face inside the circle, only you in view.
        </Text>
      )}
    </View>
  );
}
