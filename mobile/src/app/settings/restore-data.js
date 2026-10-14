// Settings › Restore my data: bring back your profile and Soul DNA from a "Download my data" file
// you saved before deleting your old account. Only a genuine, unchanged Soulink download of your own
// phone number or email is accepted.
import { useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { notice } from '../../lib/confirm';
import { Button, ErrorText, s } from '../../components/ui';
import { Note } from '../../components/SettingsUI';
import { colors, fonts, space } from '../../lib/theme';

const LABELS = { profile: 'profile details', username: 'username', soulDna: 'Soul DNA' };

function pickJson() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'application/json,.json';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      if (f.size > 15 * 1024 * 1024) return reject(new Error('That file is too big to be a Soulink download.'));
      f.text().then((t) => { try { resolve(JSON.parse(t)); } catch { reject(new Error("That file isn't a Soulink download.")); } }, reject);
    };
    input.click();
  });
}

export default function RestoreData() {
  const { setUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const restore = async () => {
    setError(null);
    try {
      const file = await pickJson();
      if (!file) return;
      setBusy(true);
      const r = await api('/users/me/restore', { method: 'POST', body: file, timeoutMs: 60000 });
      setUser(r.user);
      notice('Welcome back', r.restored.length ? `Restored your ${r.restored.map((k) => LABELS[k] || k).join(', ')}.` : 'Nothing in that file needed restoring.');
    } catch (e) { setError(e.message); }
    setBusy(false);
  };
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.text }}>Coming back to Soulink?</Text>
      <Note>If you downloaded your data before deleting your old account, choose that file to bring back your profile details and Soul DNA answers. Photos, posts, Sparks and chats were erased with the old account and can't be restored.</Note>
      <Note>The file must be your own, exactly as Soulink gave it to you: it is checked against your phone number or email.</Note>
      <View style={{ marginTop: space.lg }}>
        <ErrorText>{error}</ErrorText>
        {Platform.OS === 'web'
          ? <Button title="Choose my Soulink download" icon="cloud-upload-outline" onPress={restore} loading={busy} />
          : <Text style={{ fontFamily: fonts.body, color: colors.muted, textAlign: 'center' }}>Open Soulink in a browser to restore from your download file.</Text>}
      </View>
    </ScrollView>
  );
}
