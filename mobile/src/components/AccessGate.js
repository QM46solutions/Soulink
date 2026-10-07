// Private preview (hosted version): asks once for the Soulink access code before anything else loads.
// On the laptop there is no code, so this shows nothing and just passes through.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { checkAccess } from '../lib/api';
import { BrandHeader, BrandScreen } from './BrandScreen';
import { Button, ErrorText, Input } from './ui';
import { colors, fonts, space } from '../lib/theme';

export default function AccessGate({ children }) {
  const [state, setState] = useState('checking'); // checking | open | locked | offline
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const check = async () => {
    setState('checking');
    try { const r = await checkAccess(); setState(!r.required || r.ok ? 'open' : 'locked'); }
    catch { setState('offline'); }
  };
  useEffect(() => { check(); }, []);
  useEffect(() => { if (state === 'locked' || state === 'offline') SplashScreen.hideAsync().catch(() => {}); }, [state]);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const r = await checkAccess(code.trim());
      if (r.ok) setState('open'); else setError("That code isn't right.");
    } catch { setError("Can't reach Soulink right now. Try again in a minute."); }
    finally { setBusy(false); }
  };

  if (state === 'open') return children;
  if (state === 'checking') return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.aura} size="large" /></View>;
  if (state === 'offline') {
    return (
      <BrandScreen>
        <BrandHeader title="Soulink is waking up" subtitle="The server sleeps when nobody is using it. It takes about a minute to wake." />
        <Button title="Try again" onPress={check} />
      </BrandScreen>
    );
  }
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
