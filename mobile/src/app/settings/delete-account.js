// Settings › Delete my account. The account is hidden at once and erased after a 7-day cooling period (time for
// the team to check everything); logging in before then cancels. After it is erased, the same face, phone number
// or email can't create a new Soulink account for 6 months (kept encrypted until then).
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
    if (!(await confirm('Delete your account?', 'Your account will be deleted in 7 days. Log in before then to cancel. After that you can\'t create a new Soulink account for 6 months.', { confirmText: 'Delete', destructive: true }))) return;
    setBusy('later'); setError(null);
    try {
      const r = await api('/users/me/schedule-deletion', { method: 'POST', body: { confirm: 'DELETE' } });
      await signOut({ remote: false });
      notice('Account scheduled for deletion', r.message);
    } catch (e) { setError(e.message); setBusy(null); }
  };
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.text }}>Your account will be deleted in 7 days</Text>
      <Note>Your profile is hidden from everyone straight away and you are logged out on every phone and browser. We wait 7 days before deleting, to give you time to change your mind and us time to check everything. Log in before then to cancel.</Note>
      <Note>After 7 days your profile, photos, Soul DNA, posts, Sparks and chats are erased for good.</Note>
      <Note>For 6 months after that, the same face, phone number or email can't be used to create a new Soulink account. Until then your face fingerprint and contact details are kept encrypted, used only for this check, and then erased. As Indian law requires, we also keep your name, date of birth, city, phone number, email and consent records for 1 year, used only to answer lawful requests.</Note>
      <Note>Just need a break? Pause your account instead: nothing is deleted.</Note>
      <Button title="Download my data first" variant="ghost" icon="download-outline" onPress={downloadMyData} style={{ marginTop: space.sm }} />
      <View style={{ marginTop: space.xl }}>
        <Input label="Type DELETE to confirm" value={text} onChangeText={setText} autoCapitalize="characters" autoCorrect={false} />
        <ErrorText>{error}</ErrorText>
        <Button title="Delete my account" variant="danger" onPress={schedule} loading={busy === 'later'} disabled={!ok || !!busy} />
      </View>
    </ScrollView>
  );
}
