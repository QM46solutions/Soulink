// Step 2 of sign-in: the 6-digit code. It checks itself as soon as the 6th digit is typed (no button to press).
// New people then go to "Create your soul profile"; returning people go straight to Home.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { MonoTag } from '../../components/brand';
import { BrandHeader, BrandScreen } from '../../components/BrandScreen';
import OtpInput from '../../components/OtpInput';
import { colors, fonts, radius, space } from '../../lib/theme';

const RESEND_AFTER = 30;
const pretty = (p) => (/^\+91\d{10}$/.test(p) ? `+91 ${p.slice(3, 8)} ${p.slice(8)}` : p);

export default function Verify() {
  const params = useLocalSearchParams();
  const target = String(params.target || '');
  const isPhone = params.channel !== 'email';
  const returning = params.exists === '1';
  const { signIn } = useAuth();
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState(params.dev ? String(params.dev) : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [cooldown, setCooldown] = useState(RESEND_AFTER);
  const timer = useRef(null);

  const startCooldown = () => {
    setCooldown(RESEND_AFTER);
    clearInterval(timer.current);
    timer.current = setInterval(() => setCooldown((c) => { if (c <= 1) { clearInterval(timer.current); return 0; } return c - 1; }), 1000);
  };
  useEffect(() => { if (!target) router.replace('/'); else startCooldown(); return () => clearInterval(timer.current); }, [target]);

  const verify = async (c) => {
    if (c.length !== 6 || busy) return;
    setError(null); setBusy(true);
    try {
      const r = await api('/auth/otp/verify', { method: 'POST', body: { ...(isPhone ? { phone: target } : { email: target }), code: c } });
      await signIn(r.token, r.user); // app switches to Home or profile setup by itself
    } catch (e) { setError(e.message); setCode(''); setBusy(false); }
  };

  const resend = async () => {
    setError(null); setNotice(null);
    try {
      const r = await api('/auth/otp/request', { method: 'POST', body: isPhone ? { phone: target } : { email: target } });
      setDevCode(r.devCode || null); setCode(''); setNotice('New code sent'); startCooldown();
    } catch (e) { setError(e.message); }
  };

  return (
    <BrandScreen back>
      <BrandHeader title={returning ? 'Welcome back' : "Let's verify it's you"} subtitle="Enter the 6-digit code sent to">
        <Pressable onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }} accessibilityLabel="Change number">
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.text }}>{isPhone ? pretty(target) : target}</Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.aura, marginLeft: 8 }}>Edit</Text>
        </Pressable>
      </BrandHeader>

      <OtpInput value={code} onChange={(c) => { setCode(c); setError(null); }} onComplete={verify} error={!!error} />

      <View style={{ minHeight: 28, alignItems: 'center', justifyContent: 'center', marginTop: space.md }}>
        {busy ? <ActivityIndicator color={colors.aura} />
          : error ? <Text style={{ color: colors.danger, fontFamily: fonts.medium, fontSize: 13 }}>{error}</Text>
          : notice ? <Text style={{ color: colors.mint, fontFamily: fonts.medium, fontSize: 13 }}>{notice}</Text> : null}
      </View>

      {devCode ? (
        <Pressable onPress={() => { setCode(devCode); verify(devCode); }} style={{ marginTop: space.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: radius.md, padding: space.md }}>
          <MonoTag style={{ textAlign: 'center' }}>{`// test mode · code ${devCode} · tap to fill`}</MonoTag>
        </Pressable>
      ) : null}

      <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: space.xl }}>
        {cooldown ? `Didn't get it? Resend in 0:${String(cooldown).padStart(2, '0')}` : "Didn't get it? "}
        {cooldown ? null : <Text onPress={resend} style={{ color: colors.aura, fontFamily: fonts.semibold }}>Resend code</Text>}
      </Text>
    </BrandScreen>
  );
}
