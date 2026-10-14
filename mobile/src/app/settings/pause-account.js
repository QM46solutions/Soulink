// Settings › Pause my account: hidden everywhere, nothing deleted. Logging in again brings it all back.
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { confirm, notice } from '../../lib/confirm';
import { Button, ErrorText, s } from '../../components/ui';
import { Note } from '../../components/SettingsUI';
import { colors, fonts, space } from '../../lib/theme';

export default function PauseAccount() {
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const pause = async () => {
    if (!(await confirm('Pause your account?', 'You will be logged out everywhere. Log in any time to come back.', { confirmText: 'Pause' }))) return;
    setBusy(true); setError(null);
    try {
      const r = await api('/users/me/pause', { method: 'POST' });
      await signOut({ remote: false });
      notice('Account paused', r.message);
    } catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.text }}>Take a break</Text>
      <Note>While your account is paused, nobody can see your profile, posts, Sparks or Moments, find you in Discover or send you requests, and you get no notifications. Nothing is deleted.</Note>
      <Note>To come back, just log in with your phone number or email. Everything is exactly as you left it.</Note>
      <View style={{ marginTop: space.lg }}>
        <ErrorText>{error}</ErrorText>
        <Button title="Pause my account" onPress={pause} loading={busy} />
      </View>
    </ScrollView>
  );
}
