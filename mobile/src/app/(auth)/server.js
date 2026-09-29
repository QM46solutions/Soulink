import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { api, getServer, setServer } from '../../lib/api';
import { Button, ErrorText, Input, s } from '../../components/ui';
import { colors, space, fonts } from '../../lib/theme';

// Lets you point the app at the server running on your laptop (local testing).
export default function ServerSettings() {
  const [url, setUrl] = useState(getServer());
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true); setError(null); setStatus(null);
    const saved = await setServer(url);
    setUrl(saved);
    try {
      await api('/health', { timeoutMs: 5000 });
      setStatus('Connected ✓');
      setTimeout(() => router.back(), 600);
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  return (
    <View style={[s.screen, { padding: space.xl, paddingTop: 110 }]}>
      <Text style={[s.subtitle, { marginTop: 0, marginBottom: space.xl }]}>
        Enter the address shown in the server window on your laptop, e.g. http://192.168.1.5:4000. Your phone and laptop must be on the same Wi-Fi.
      </Text>
      <Input label="Server address" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
      <ErrorText>{error}</ErrorText>
      {status ? <Text style={{ fontFamily: fonts.body, color: colors.mint, marginBottom: space.md }}>{status}</Text> : null}
      <Button title="Save & test connection" onPress={save} loading={busy} />
    </View>
  );
}
