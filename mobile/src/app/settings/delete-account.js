// Settings › Delete my account. Like Instagram: the account is hidden at once and erased after 30 days;
// logging in before then cancels. "Delete now" skips the 30 days (DPDP right to erasure).
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { confirm, notice } from '../../lib/confirm';
import { downloadMyData } from '../../lib/export-data';
import { Button, ErrorText, Input, s } from '../../components/ui';
import { Note } from '../../components/SettingsUI';
import { colors, fonts, space } from '../../lib/theme';

export default function DeleteAccount() {
  const { signOut } = useAuth();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const ok = text.trim() === 'DELETE';

  const schedule = async () => {
    if (!(await confirm('Delete your account?', 'Your account will be deleted in 30 days. Log in before then to cancel.', { confirmText: 'Delete', destructive: true }))) return;
    setBusy('later'); setError(null);
    try {
      const r = await api('/users/me/schedule-deletion', { method: 'POST', body: { confirm: 'DELETE' } });
      await signOut({ remote: false });
      notice('Account scheduled for deletion', r.message);
    } catch (e) { setError(e.message); setBusy(null); }
  };
  const now = async () => {
    if (!(await confirm('Delete everything now?', 'There are no 30 days to change your mind. This cannot be undone.', { confirmText: 'Delete now', destructive: true }))) return;
    setBusy('now'); setError(null);
    try { await api('/users/me', { method: 'DELETE', body: { confirm: 'DELETE' }, timeoutMs: 60000 }); await signOut({ remote: false }); }
    catch (e) { setError(e.message); setBusy(null); }
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.text }}>Your account will be deleted in 30 days</Text>
      <Note>Your profile is hidden from everyone straight away and you are logged out on every phone and browser. Log in before the 30 days are over to cancel. After that, your profile, photos, face data, Soul DNA, posts, Sparks and chats are erased for good. As Indian law requires, we keep your name, date of birth, city, phone number, email and consent records for 1 year, used only to answer lawful requests.</Note>
      <Note>Just need a break? Pause your account instead: nothing is deleted.</Note>
      <Button title="Download my data first" variant="ghost" icon="download-outline" onPress={downloadMyData} style={{ marginTop: space.sm }} />
      <View style={{ marginTop: space.xl }}>
        <Input label="Type DELETE to confirm" value={text} onChangeText={setText} autoCapitalize="characters" autoCorrect={false} />
        <ErrorText>{error}</ErrorText>
        <Button title="Delete my account" variant="danger" onPress={schedule} loading={busy === 'later'} disabled={!ok || !!busy} />
        <Text onPress={ok && !busy ? now : undefined} style={{ fontFamily: fonts.semibold, fontSize: 13, color: ok ? colors.danger : colors.dim, textAlign: 'center', marginTop: space.lg }}>
          {busy === 'now' ? 'Deleting…' : 'Delete everything now instead (no 30 days)'}
        </Text>
      </View>
    </ScrollView>
  );
}
