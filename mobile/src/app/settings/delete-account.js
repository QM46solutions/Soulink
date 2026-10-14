// Settings › Delete my account: permanent erasure (DPDP Act right to erasure).
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { confirm } from '../../lib/confirm';
import { Button, ErrorText, Input, s } from '../../components/ui';
import { Note } from '../../components/SettingsUI';
import { colors, fonts, space } from '../../lib/theme';

export default function DeleteAccount() {
  const { signOut } = useAuth();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const go = async () => {
    if (!(await confirm('Delete your account?', 'This cannot be undone.', { confirmText: 'Delete forever', destructive: true }))) return;
    setBusy(true); setError(null);
    try { await api('/users/me', { method: 'DELETE', body: { confirm: 'DELETE' }, timeoutMs: 60000 }); await signOut({ remote: false }); }
    catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.danger }}>This deletes everything</Text>
      <Note>Your profile, photos, face fingerprint, Soul DNA, posts, Sparks, comments, connections and messages are erased now. As Indian law requires, we keep only your username, phone or email and sign-up dates for 180 days, then delete them too. Premium you paid for is not refunded after deletion. You will be logged out on every phone and browser, and we email you a confirmation. Want a copy first? Use Settings › Download my data.</Note>
      <View style={{ marginTop: space.lg }}>
        <Input label='Type DELETE to confirm' value={text} onChangeText={setText} autoCapitalize="characters" autoCorrect={false} />
        <ErrorText>{error}</ErrorText>
        <Button title="Delete my account" variant="danger" onPress={go} loading={busy} disabled={text.trim() !== 'DELETE'} />
      </View>
    </ScrollView>
  );
}
