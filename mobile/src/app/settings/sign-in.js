// Settings › Sign-in & security
// · Your email: how you sign in (and get back in on a new phone). Add or change it with a code sent to that address.
//   Accounts made with a phone number add an email here, because phone codes stay off until SMS is live.
// · Fingerprint / face unlock: sign in on this phone with the phone's own check. Soulink never sees or stores the
//   fingerprint or face, and this is not Soulink's face verification (that's the one-time check at sign-up).
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { notice } from '../../lib/confirm';
import { canUseQuickSignIn, disableQuickSignIn, enableQuickSignIn, quickSignInLabel, savedQuickSignIn } from '../../lib/biometric';
import { Button, Input } from '../../components/ui';
import { InfoRow, Note, Section, Toggle } from '../../components/SettingsUI';
import OtpInput from '../../components/OtpInput';
import { colors, fonts, space } from '../../lib/theme';

function EmailBox() {
  const { user, setUser } = useAuth();
  const [editing, setEditing] = useState(!user.email);
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState(null);
  const [devCode, setDevCode] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const valid = /\S+@\S+\.\S+/.test(email.trim());

  const send = async () => {
    if (!valid || busy) return;
    setBusy(true); setError(null);
    try {
      const r = await api('/account/email/request', { method: 'POST', body: { email: email.trim() } });
      setSentTo(r.email); setDevCode(r.devCode || null); setCode('');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const verify = async (c) => {
    if (c.length !== 6 || busy) return;
    setBusy(true); setError(null);
    try {
      const r = await api('/account/email/verify', { method: 'POST', body: { email: sentTo, code: c } });
      setUser(r.user); setEditing(false); setSentTo(null); setEmail(''); setDevCode(null);
      notice('Email saved', `You can now sign in with ${r.user.email}.`);
    } catch (e) { setError(e.message); setCode(''); } finally { setBusy(false); }
  };

  if (!editing) {
    return (
      <>
        <InfoRow icon="mail-outline" title={user.email} value={user.emailVerified ? 'Verified' : 'Not confirmed yet'} color={user.emailVerified ? colors.mint : colors.gold} />
        <Button variant="ghost" small title="Change email" onPress={() => setEditing(true)} style={{ marginHorizontal: space.lg, marginTop: space.md }} />
      </>
    );
  }
  return (
    <View style={{ paddingHorizontal: space.lg }}>
      {!user.email ? (
        <Text style={{ fontFamily: fonts.body, color: colors.gold, fontSize: 13, lineHeight: 19, marginBottom: space.md }}>
          Add an email so you can sign in on any phone. Sign-in codes by text message aren't available yet.
        </Text>
      ) : null}
      {!sentTo ? (
        <>
          <Input label={user.email ? 'New email' : 'Email'} value={email} onChangeText={(t) => { setEmail(t); setError(null); }} placeholder="you@example.com"
            keyboardType="email-address" autoCapitalize="none" autoComplete="email" maxLength={254} returnKeyType="send" onSubmitEditing={send} error={error} />
          <Button title="Send code" onPress={send} loading={busy} disabled={!valid} />
          {user.email ? <Button variant="ghost" small title="Cancel" onPress={() => { setEditing(false); setError(null); }} style={{ marginTop: space.sm }} /> : null}
        </>
      ) : (
        <>
          <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 14, marginBottom: space.md }}>
            Enter the 6-digit code we emailed to <Text style={{ color: colors.text, fontFamily: fonts.semibold }}>{sentTo}</Text>
          </Text>
          <OtpInput value={code} onChange={(c) => { setCode(c); setError(null); }} onComplete={verify} error={!!error} />
          {error ? <Text style={{ color: colors.danger, fontFamily: fonts.medium, fontSize: 13, textAlign: 'center', marginTop: space.sm }}>{error}</Text> : null}
          {devCode ? <Text onPress={() => { setCode(devCode); verify(devCode); }} style={{ fontFamily: fonts.mono, color: colors.dim, fontSize: 12, textAlign: 'center', marginTop: space.md }}>{`// test mode · code ${devCode} · tap to fill`}</Text> : null}
          <Button variant="ghost" small title="Use a different email" onPress={() => { setSentTo(null); setError(null); }} style={{ marginTop: space.md }} />
        </>
      )}
    </View>
  );
}

function QuickSignInToggle() {
  const { user } = useAuth();
  const [on, setOn] = useState(null);
  const [busy, setBusy] = useState(false);
  const supported = canUseQuickSignIn();
  useEffect(() => { savedQuickSignIn().then((k) => setOn(!!k)); }, []);

  const change = useCallback(async (v) => {
    setBusy(true);
    try {
      if (v) { await enableQuickSignIn(user.displayName || user.username); setOn(true); }
      else { await disableQuickSignIn(); setOn(false); }
    } catch (e) { notice('Fingerprint / face unlock', e.message); } finally { setBusy(false); }
  }, [user]);

  if (on === null) return null;
  return (
    <>
      <Toggle title={`Sign in with ${quickSignInLabel()}`} value={on} onChange={change} disabled={busy || (!supported && !on)}
        text={supported ? 'On this phone only. Your phone does the check; Soulink never sees or stores your fingerprint or face.'
          : 'Set up a fingerprint or face unlock in your phone settings to use this.'} />
      <View style={{ flexDirection: 'row', paddingHorizontal: space.lg, paddingTop: space.md }}>
        <Ionicons name="information-circle-outline" size={16} color={colors.dim} style={{ marginRight: 6, marginTop: 1 }} />
        <Text style={{ flex: 1, fontFamily: fonts.body, color: colors.dim, fontSize: 12, lineHeight: 18 }}>
          This only unlocks your login on this phone. It isn't Soulink's face verification and doesn't change your verified badge. New phone, or
          changed your phone's fingerprints / faces? Sign in with an email code and turn it on again. Logging out of other devices also switches it off on them.
        </Text>
      </View>
    </>
  );
}

export default function SignInSettings() {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
      <Note>How you get into Soulink. We never show anyone your email.</Note>
      <Section>Your email</Section>
      <EmailBox />
      <Section>This phone</Section>
      <QuickSignInToggle />
    </ScrollView>
  );
}
