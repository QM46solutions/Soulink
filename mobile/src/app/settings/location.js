// Settings > Location: Soulink uses an area-level location (about 1 km) for distance in Discover. Never shown to anyone.
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { InfoRow, MenuRow, Note, Section } from '../../components/SettingsUI';
import { ErrorText, s } from '../../components/ui';
import { colors } from '../../lib/theme';
import { currentPosition } from '../../lib/location';

export default function LocationSettings() {
  const { user, setUser } = useAuth();
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const update = async () => {
    setBusy(true); setError(null);
    try { const c = await currentPosition(); setUser((await api('/users/me/location', { method: 'PUT', body: { lat: c.latitude, lon: c.longitude } })).user); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const stop = async () => {
    setBusy(true); setError(null);
    try { setUser((await api('/account/location', { method: 'DELETE' })).user); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <ErrorText>{error}</ErrorText>
      <Section>Status</Section>
      <InfoRow icon="location" title="Using my location" value={user.hasLocation ? 'On' : 'Off'} color={user.hasLocation ? colors.mint : colors.muted} />
      <InfoRow icon="business" title="My area (on profile)" value={user.city || 'Not set'} onPress={() => router.push('/edit-profile')} />
      <Section>Change</Section>
      <MenuRow icon="navigate" title={user.hasLocation ? 'Update to where I am now' : 'Use my current location'} text={busy ? 'Working…' : 'Your phone will ask for permission'} onPress={busy ? undefined : update} tint={['#3fa9f5', '#5b46d6']} />
      {user.hasLocation ? <MenuRow icon="close-circle" title="Stop using my location" text="Distance in Discover will use your area instead" onPress={busy ? undefined : stop} tint={['#8b88a0', '#4a4760']} /> : null}
      <Note>Soulink keeps only a rough location (about 1 km) to show how far people are in Discover. Your exact location is never stored or shown to anyone.</Note>
    </ScrollView>
  );
}
