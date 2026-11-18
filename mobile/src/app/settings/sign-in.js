// Settings › Sign-in & security
// · Your email: how you sign in (and get back in on a new phone). Add or change it with a code sent to that address.
//   Every account needs one; older accounts made with a phone number add it here (they're reminded on Home).
// · Fingerprint / face unlock: sign in on this phone with the phone's own check. Soulink never sees or stores the
//   fingerprint or face, and this is not Soulink's face verification (that's the one-time check at sign-up).
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';
import { notice } from '../../lib/confirm';
import { canUseQuickSignIn, disableQuickSignIn, enableQuickSignIn, quickSignInLabel, savedQuickSignIn } from '../../lib/biometric';
import { Note, Section, Toggle } from '../../components/SettingsUI';
import AddEmail from '../../components/AddEmail';
import { colors, fonts, space } from '../../lib/theme';

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
      <AddEmail />
      <Section>This phone</Section>
      <QuickSignInToggle />
    </ScrollView>
  );
}
