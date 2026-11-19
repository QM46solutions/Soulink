// Settings › Sign-in & security › Your phone number: add or change it.
// While SMS codes are off the number is saved as "pending": shown here, never used to sign in. Once SMS is live the
// server answers { verify: true } and a 6-digit code sent by text message confirms it (then it becomes the sign-in number).
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { confirm, notice } from '../lib/confirm';
import { Button, Input } from './ui';
import { InfoRow } from './SettingsUI';
import OtpInput from './OtpInput';
import { colors, fonts, space } from '../lib/theme';

const pretty = (p) => {
  const d = String(p || '').replace(/\D/g, '');
  const n = d.length > 10 ? d.slice(-10) : d;
  return n.length === 10 ? `+91 ${n.slice(0, 5)} ${n.slice(5)}` : p;
};

export default function AddPhone() {
  const { user, setUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState('');
  const [sentTo, setSentTo] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [smsLive, setSmsLive] = useState(false);
  useEffect(() => { api('/auth/options').then((o) => setSmsLive(!!o.phone)).catch(() => {}); }, []);
  const digits = phone.replace(/\D/g, '');
  const valid = digits.length === 10 || (digits.length === 12 && digits.startsWith('91'));

  const save = async (number = phone) => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const r = await api('/account/phone', { method: 'POST', body: { phone: number } });
      if (r.verify) { setSentTo(r.phone); setCode(''); setEditing(true); return; }
      setUser(r.user); setEditing(false); setPhone('');
      notice('Number saved', "We'll ask you to confirm it with a code by text message once that's available. Until then you sign in with your email.");
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const verify = async (c) => {
    if (c.length !== 6 || busy) return;
    setBusy(true); setError(null);
    try {
      const r = await api('/account/phone/verify', { method: 'POST', body: { phone: sentTo, code: c } });
      setUser(r.user); setEditing(false); setSentTo(null); setPhone('');
      notice('Number confirmed', `You can now sign in with ${pretty(r.user.phone)}.`);
    } catch (e) { setError(e.message); setCode(''); } finally { setBusy(false); }
  };
  const removePending = async () => {
    if (!(await confirm('Remove this number?', `${pretty(user.phonePending)} hasn't been confirmed yet. You can add a number again any time.`, { confirmText: 'Remove' }))) return;
    try { const r = await api('/account/phone/pending', { method: 'DELETE' }); setUser(r.user); } catch (e) { notice('Not removed', e.message); }
  };

  if (!editing) {
    return (
      <>
        {user.phone ? (
          <InfoRow icon="call-outline" title={pretty(user.phone)} value={user.phoneVerified ? 'Verified' : 'Not confirmed yet'} color={user.phoneVerified ? colors.mint : colors.gold} />
        ) : null}
        {user.phonePending ? (
          <>
            <InfoRow icon="time-outline" title={pretty(user.phonePending)} value="Waiting to be confirmed" color={colors.gold} />
            <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12.5, lineHeight: 18, marginHorizontal: space.lg, marginTop: space.sm }}>
              Saved. We'll confirm it with a code by text message once that's available{user.phone ? `; until then ${pretty(user.phone)} stays on your account` : ''}.
            </Text>
          </>
        ) : null}
        {!user.phone && !user.phonePending ? (
          <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 13, lineHeight: 19, marginHorizontal: space.lg }}>
            Add your mobile number so we can reach you and, once text-message codes are available, so you can sign in with it too.
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', marginHorizontal: space.lg, marginTop: space.md }}>
          <Button variant="ghost" small title={user.phone || user.phonePending ? 'Change number' : 'Add phone number'} onPress={() => { setEditing(true); setError(null); }} style={{ flex: 1 }} />
          {user.phonePending && smsLive ? <Button small title="Confirm by code" onPress={() => save(user.phonePending)} loading={busy} style={{ flex: 1, marginLeft: space.sm }} /> : null}
          {user.phonePending ? <Button variant="ghost" small title="Remove" onPress={removePending} style={{ flex: 1, marginLeft: space.sm }} /> : null}
        </View>
      </>
    );
  }
  return (
    <View style={{ paddingHorizontal: space.lg }}>
      {!sentTo ? (
        <>
          <Input label="Mobile number" value={phone} onChangeText={(t) => { setPhone(t.replace(/[^\d+ ]/g, '')); setError(null); }} placeholder="10-digit mobile number"
            keyboardType="phone-pad" autoComplete="tel" maxLength={16} returnKeyType="done" onSubmitEditing={() => valid && save()} error={error} />
          <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12.5, lineHeight: 18, marginBottom: space.md }}>
            Indian mobile numbers (+91). It isn't shown on your profile.
          </Text>
          <Button title="Save number" onPress={() => save()} loading={busy} disabled={!valid} />
          <Button variant="ghost" small title="Cancel" onPress={() => { setEditing(false); setError(null); setPhone(''); }} style={{ marginTop: space.sm }} />
        </>
      ) : (
        <>
          <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 14, marginBottom: space.md }}>
            Enter the 6-digit code we sent by text message to <Text style={{ color: colors.text, fontFamily: fonts.semibold }}>{pretty(sentTo)}</Text>
          </Text>
          <OtpInput value={code} onChange={(c) => { setCode(c); setError(null); }} onComplete={verify} error={!!error} />
          {error ? <Text style={{ color: colors.danger, fontFamily: fonts.medium, fontSize: 13, textAlign: 'center', marginTop: space.sm }}>{error}</Text> : null}
          <Button variant="ghost" small title="Use a different number" onPress={() => { setSentTo(null); setError(null); }} style={{ marginTop: space.md }} />
        </>
      )}
    </View>
  );
}
