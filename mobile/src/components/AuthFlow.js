// Shared by the Log in and Create account screens.
// Step 1: phone or email → Step 2: 6-digit code → signed in.
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors, fonts, radius, space } from '../lib/theme';
import { Button, ErrorText, Input } from './ui';
import { GradientText, MonoTag, Wordmark } from './brand';
import OtpInput from './OtpInput';

const COPY = {
  login: {
    title: 'Welcome back',
    sub: 'Log in with the number or email you signed up with.',
    button: 'Send login code',
    switchText: 'New to Soulink?',
    switchLink: 'Create an account',
    switchTo: '/signup',
  },
  signup: {
    title: 'Create your account',
    sub: "One real person, one profile. We'll send a code to check it's you.",
    button: 'Send code',
    switchText: 'Already have an account?',
    switchLink: 'Log in',
    switchTo: '/login',
  },
};

/** +919848022338 → +91 98480 22338 */
const prettyPhone = (p) => (/^\+91\d{10}$/.test(p) ? `+91 ${p.slice(3, 8)} ${p.slice(8)}` : p);

function MethodSwitch({ method, onChange }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.inputBg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, padding: 4, marginBottom: space.lg }}>
      {[['phone', 'Phone', 'call-outline'], ['email', 'Email', 'mail-outline']].map(([key, label, icon]) => {
        const on = method === key;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: radius.pill, backgroundColor: on ? 'rgba(124,92,252,0.28)' : 'transparent' }}
          >
            <Ionicons name={icon} size={15} color={on ? colors.text : colors.muted} style={{ marginRight: 6 }} />
            <Text style={{ color: on ? colors.text : colors.muted, fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 14 }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function AuthFlow({ mode = 'login', initialMethod = 'phone' }) {
  const copy = COPY[mode];
  const { signIn } = useAuth();
  const [method, setMethod] = useState(initialMethod);
  const [value, setValue] = useState('');
  const [step, setStep] = useState('enter'); // enter | code
  const [code, setCode] = useState('');
  const [target, setTarget] = useState('');
  const [devCode, setDevCode] = useState(null);
  const [accountExists, setAccountExists] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [noAccount, setNoAccount] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef(null);
  const isPhone = method === 'phone';

  useEffect(() => () => clearInterval(timer.current), []);

  const startCooldown = () => {
    setCooldown(30);
    clearInterval(timer.current);
    timer.current = setInterval(() => setCooldown((c) => { if (c <= 1) { clearInterval(timer.current); return 0; } return c - 1; }), 1000);
  };

  const switchMethod = (m) => { setMethod(m); setValue(''); setError(null); setNoAccount(false); };

  const requestCode = async () => {
    setError(null); setNoAccount(false); setBusy(true);
    try {
      const r = await api('/auth/otp/request', { method: 'POST', body: { ...(isPhone ? { phone: value } : { email: value }), intent: mode } });
      setTarget(r.target);
      setAccountExists(r.accountExists);
      setDevCode(r.devCode || null);
      setCode('');
      setStep('code');
      startCooldown();
    } catch (e) {
      if (e.code === 'no_account') setNoAccount(true);
      else setError(e.message);
    } finally { setBusy(false); }
  };

  const verify = async (c = code) => {
    if (c.length !== 6 || busy) return;
    setError(null); setBusy(true);
    try {
      const r = await api('/auth/otp/verify', { method: 'POST', body: { ...(isPhone ? { phone: target } : { email: target }), code: c } });
      await signIn(r.token, r.user); // the app then opens Home, or profile setup for new accounts
    } catch (e) { setError(e.message); setCode(''); setBusy(false); }
  };

  const valid = isPhone ? value.replace(/\D/g, '').length >= 10 : /\S+@\S+\.\S+/.test(value);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: space.xl, paddingTop: 64 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Same layout as the welcome screen: big centered wordmark, then the form (no box around it) */}
        <View style={{ width: '100%' }}>
          <View style={{ alignItems: 'center', marginBottom: space.xl }}><Wordmark size={48} /></View>

          {step === 'enter' ? (
            <View>
              <GradientText style={{ fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 28, textAlign: 'center' }}>{copy.title}</GradientText>
              <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 6, marginBottom: space.xl, lineHeight: 20 }}>{copy.sub}</Text>

              <MethodSwitch method={method} onChange={switchMethod} />
              <Input
                key={method}
                label={isPhone ? 'Mobile number' : 'Email'}
                placeholder={isPhone ? '98765 43210' : 'you@email.com'}
                value={value}
                onChangeText={(t) => { setValue(t); setNoAccount(false); }}
                keyboardType={isPhone ? 'phone-pad' : 'email-address'}
                autoCapitalize="none"
                autoComplete={isPhone ? 'tel' : 'email'}
                autoFocus
                returnKeyType="go"
                onSubmitEditing={() => valid && requestCode()}
                maxLength={isPhone ? 14 : 254}
                right={isPhone ? null : <Ionicons name="at" size={16} color={colors.dim} />}
                left={isPhone ? <Text numberOfLines={1} style={{ flexShrink: 0, color: colors.text, fontFamily: fonts.semibold, fontSize: 15, marginRight: 10, paddingRight: 10, borderRightWidth: 1, borderRightColor: colors.border }}>+91</Text> : null}
              />

              {noAccount ? (
                <View style={{ borderWidth: 1, borderColor: 'rgba(245,200,66,0.45)', backgroundColor: 'rgba(245,200,66,0.08)', borderRadius: radius.md, padding: space.md, marginBottom: space.lg }}>
                  <Text style={{ color: colors.gold, fontFamily: fonts.semibold, fontSize: 14 }}>
                    {isPhone ? 'No Soulink account uses this number yet.' : 'No Soulink account uses this email yet.'}
                  </Text>
                  <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
                    Check for a typo, or create a new account.
                  </Text>
                  <Pressable onPress={() => router.replace({ pathname: '/signup', params: { method } })} style={{ marginTop: space.sm }}>
                    <Text style={{ color: colors.aura, fontFamily: fonts.semibold, fontSize: 14 }}>Create an account →</Text>
                  </Pressable>
                </View>
              ) : null}
              <ErrorText>{error}</ErrorText>

              <Button title={copy.button} onPress={requestCode} loading={busy} disabled={!valid} />

              <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: space.lg }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                <Text style={{ color: colors.dim, marginHorizontal: space.md, fontFamily: fonts.body, fontSize: 12 }}>or</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              </View>
              <Button title="Continue with Google" variant="light" icon="logo-google" disabled onPress={() => {}} />
              <Button title="Continue with Apple" variant="secondary" icon="logo-apple" disabled onPress={() => {}} style={{ marginTop: space.sm }} />
            </View>
          ) : (
            <View>
              <GradientText style={{ fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 28, textAlign: 'center' }}>Enter your code</GradientText>
              <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
                We sent a 6-digit code to
              </Text>
              <Pressable onPress={() => { setStep('enter'); setError(null); }} style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', marginTop: 2, marginBottom: space.xl }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.text }}>{isPhone ? prettyPhone(target) : target}</Text>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.aura, marginLeft: 8 }}>Change</Text>
              </Pressable>

              {mode === 'signup' && accountExists ? (
                <Text style={{ color: colors.mint, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', marginBottom: space.md }}>
                  You already have an account. This code logs you in.
                </Text>
              ) : null}

              <OtpInput value={code} onChange={(c) => { setCode(c); setError(null); }} onComplete={(c) => verify(c)} error={!!error} />
              {error ? <View style={{ marginTop: space.md }}><ErrorText>{error}</ErrorText></View> : null}

              {devCode ? (
                <Pressable onPress={() => { setCode(devCode); verify(devCode); }} style={{ marginTop: space.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: radius.md, padding: space.md }}>
                  <MonoTag style={{ textAlign: 'center' }}>{`// test mode · code ${devCode} · tap to fill`}</MonoTag>
                  <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', marginTop: 4 }}>No real SMS is sent yet. The code is also shown in the server window.</Text>
                </Pressable>
              ) : null}

              <Button title={mode === 'login' ? 'Log in' : 'Verify'} onPress={() => verify()} loading={busy} disabled={code.length !== 6} style={{ marginTop: space.lg }} />
              <Button
                title={cooldown ? `Resend code in 0:${String(cooldown).padStart(2, '0')}` : 'Resend code'}
                variant="ghost"
                disabled={!!cooldown || busy}
                onPress={requestCode}
                style={{ marginTop: space.sm }}
              />
            </View>
          )}
        </View>

        {step === 'enter' ? (
          <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: space.xl }}>
            {copy.switchText}{' '}
            <Text style={{ color: colors.aura, fontFamily: fonts.semibold }} onPress={() => router.replace(copy.switchTo)}>{copy.switchLink}</Text>
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
