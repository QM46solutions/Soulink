// "Add your email" / "Change email": a code is sent to the new address and must be entered here. Used at sign-up
// (email is mandatory), in Settings › Sign-in & security, and when an existing account without email is reminded.
import { useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { notice } from '../lib/confirm';
import { Button, Input } from './ui';
import { InfoRow } from './SettingsUI';
import OtpInput from './OtpInput';
import { colors, fonts, space } from '../lib/theme';

export default function AddEmail({ onDone, compact = false }) {
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
      if (onDone) onDone(r.user); else notice('Email saved', `You can now sign in with ${r.user.email}.`);
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
      {!user.email && !compact ? (
        <Text style={{ fontFamily: fonts.body, color: colors.gold, fontSize: 13, lineHeight: 19, marginBottom: space.md }}>
          Add your email: it's how you sign in on a new phone and get back into your account.
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

