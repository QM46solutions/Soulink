// Shown once to people who joined before the current Terms: they must agree to keep using Soulink.
import { useState } from 'react';
import { Modal, Text, View } from 'react-native';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { TERMS_VERSION } from '../lib/legal';
import Consent from './Consent';
import { Button, ErrorText } from './ui';
import { colors, fonts, space } from '../lib/theme';

export default function TermsGate() {
  const { setUser, signOut } = useAuth();
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const agree = async () => {
    setBusy(true); setError(null);
    try { await api('/users/me/accept-terms', { method: 'POST', body: { version: TERMS_VERSION } }); setUser((await api('/users/me')).user); }
    catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,7,13,0.92)', justifyContent: 'center', padding: space.xl, zIndex: 50 }}>
      <View style={{ backgroundColor: colors.void, borderRadius: 24, borderWidth: 1, borderColor: colors.border, padding: space.xl }}>
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 22, color: colors.text }}>We've updated our terms</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted, marginTop: space.sm, lineHeight: 20 }}>
          Soulink now has full Terms of Use, a Privacy Policy under India's data protection law, Community Guidelines and a Grievance Officer. Please read and agree to continue.
        </Text>
        <Consent value={ok} onChange={setOk} />
        <ErrorText>{error}</ErrorText>
        <Button title="Agree and continue" onPress={agree} loading={busy} disabled={!ok} style={{ marginTop: space.lg }} />
        <Text onPress={signOut} style={{ fontFamily: fonts.semibold, color: colors.muted, textAlign: 'center', marginTop: space.lg }}>Log out</Text>
      </View>
    </View>
  );
}
