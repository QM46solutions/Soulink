// Private preview (hosted version): asks once for the Soulink access code before anything else loads.
// On the laptop there is no code, so this shows nothing and just passes through.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { checkAccess, wakeServer } from '../lib/api';
import { GradientText } from './brand';
import { BrandHeader, BrandScreen } from './BrandScreen';
import { Button, ErrorText, Input } from './ui';
import { colors, fonts, space } from '../lib/theme';

export default function AccessGate({ children }) {
  const [state, setState] = useState('checking'); // checking | open | locked | offline
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Opening Soulink after a quiet hour: the free cloud database has paused itself and takes about a minute
  // to wake. Wake it first (with a friendly screen), then open the app, instead of showing errors.
  const wake = async () => {
    const t0 = Date.now();
    const slow = setTimeout(() => setState((s) => (s === 'checking' ? 'waking' : s)), 1500);
    for (;;) {
      const db = await wakeServer();
      if (db === 'ready') break;
      setState('waking');
      if (Date.now() - t0 > 3 * 60_000) break; // give up waiting; the app retries by itself
      await new Promise((r) => setTimeout(r, 2500));
    }
    clearTimeout(slow);
  };
  const check = async () => {
    setState((s) => (s === 'waking' ? s : 'checking'));
    try {
      const r = await checkAccess();
      if (r.required && !r.ok) { setState('locked'); return; }
      await wake();
      setState('open');
    } catch { setState('waking'); setTimeout(check, 3000); } // the web server itself is still waking up
  };
  useEffect(() => { check(); }, []);
  useEffect(() => { if (state === 'locked' || state === 'offline' || state === 'waking') SplashScreen.hideAsync().catch(() => {}); }, [state]);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const r = await checkAccess(code.trim());
      if (r.ok) { await wake(); setState('open'); } else setError("That code isn't right.");
    } catch { setError("Can't reach Soulink right now. Try again in a minute."); }
    finally { setBusy(false); }
  };

  if (state === 'open') return children;
  if (state === 'checking') return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.aura} size="large" /></View>;
  if (state === 'waking' || state === 'offline') return <Waking />;
  return (
    <BrandScreen>
      <BrandHeader title="Private preview" subtitle="Soulink is invite-only while we test. Enter the access code you were given." />
      <Input label="Access code" value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} secureTextEntry onSubmitEditing={submit} returnKeyType="go" />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button title="Enter" loading={busy} disabled={!code.trim()} onPress={submit} style={{ marginTop: space.lg }} />
      <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.dim, textAlign: 'center', marginTop: space.lg }}>You only need to do this once on this phone.</Text>
    </BrandScreen>
  );
}

// "Waking up" screen: the Soulink wordmark beating like a heart while the database resumes
function Waking() {
  const beat = useRef(new Animated.Value(0)).current;
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const ND = Platform.OS !== 'web';
    const a = Animated.loop(Animated.sequence([
      Animated.timing(beat, { toValue: 1, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: ND }),
      Animated.timing(beat, { toValue: 0.2, duration: 120, useNativeDriver: ND }),
      Animated.timing(beat, { toValue: 0.7, duration: 110, useNativeDriver: ND }),
      Animated.timing(beat, { toValue: 0, duration: 300, useNativeDriver: ND }),
      Animated.delay(700),
    ]));
    a.start();
    const t = setInterval(() => setSecs((x) => x + 1), 1000);
    return () => { a.stop(); clearInterval(t); };
  }, [beat]);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
      <Animated.View style={{ transform: [{ scale: beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] }}>
        <GradientText style={{ fontFamily: fonts.display, fontSize: 44, letterSpacing: -1 }}>Soulink</GradientText>
      </Animated.View>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.text, marginTop: space.lg }}>Waking up Soulink…</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>
        {secs < 20 ? 'Just a moment.' : 'After a quiet hour it takes about a minute. It opens by itself.'}
      </Text>
    </View>
  );
}
