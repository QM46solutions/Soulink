// Add a Stage Spot: a real open mic (venue, city, date and time, what kind, a link).
import { useLayoutEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { notice } from '../../../lib/confirm';
import { Input, s as ui } from '../../../components/ui';
import { GradButton } from '../../../components/SparkHub';
import { colors, fonts, space } from '../../../lib/theme';

const KINDS = [['any', '🎤 Open to all'], ['comedy', '😂 Comedy'], ['music', '🎶 Music'], ['poetry', '📝 Poetry'], ['acting', '🎭 Acting'], ['dance', '💃 Dance']];
const pad = (n) => String(n).padStart(2, '0');

export default function NewSpot() {
  const navigation = useNavigation();
  const { user } = useAuth();
  useLayoutEffect(() => { navigation.setOptions({ title: 'Add an open mic' }); }, [navigation]);
  const d0 = new Date(Date.now() + 3 * 86400000);
  const [title, setTitle] = useState('');
  const [venue, setVenue] = useState('');
  const [city, setCity] = useState((user.city || '').split(',')[0]);
  const [date, setDate] = useState(`${d0.getFullYear()}-${pad(d0.getMonth() + 1)}-${pad(d0.getDate())}`);
  const [time, setTime] = useState('19:00');
  const [kind, setKind] = useState('any');
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const at = new Date(`${date}T${time || '19:00'}:00`);
    if (Number.isNaN(at.getTime())) { notice('Date', 'Use the date as YYYY-MM-DD and the time as HH:MM.'); return; }
    setBusy(true);
    try {
      const l = link.trim();
      await api('/sparks/stage/spots', { method: 'POST', body: { title: title.trim(), venue: venue.trim(), city: city.trim(), startsAt: at.toISOString(), kind,
        ...(l ? { link: /^https?:\/\//i.test(l) ? l : `https://${l}` } : {}), ...(note.trim() ? { note: note.trim() } : {}) } });
      router.back();
    } catch (e) { notice('Not added', e.message); } finally { setBusy(false); }
  };
  const webInput = (type, value, onChange) => (Platform.OS === 'web'
    ? <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={{ flex: 1, height: 46, borderRadius: 14, border: `1px solid ${colors.border}`, background: 'rgba(8,7,13,0.6)', color: colors.text, padding: '0 12px', fontSize: 15, colorScheme: 'dark' }} />
    : <TextInput value={value} onChangeText={onChange} style={[ui.input, { flex: 1 }]} />);
  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
      <Input label="Name" value={title} onChangeText={setTitle} maxLength={100} placeholder="e.g. Friday Night Open Mic" />
      <Input label="Venue" value={venue} onChangeText={setVenue} maxLength={150} placeholder="e.g. Lamakaan, Banjara Hills" />
      <Input label="City" value={city} onChangeText={setCity} maxLength={80} placeholder="Hyderabad" />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, marginBottom: 8 }}>When</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: space.lg }}>{webInput('date', date, setDate)}{webInput('time', time, setTime)}</View>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, marginBottom: 8 }}>What kind</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.lg }}>
        {KINDS.map(([k, label]) => (
          <Pressable key={k} onPress={() => setKind(k)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, margin: 3, borderColor: kind === k ? colors.spark : colors.border, backgroundColor: kind === k ? 'rgba(255,107,157,0.18)' : 'transparent' }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: kind === k ? colors.text : colors.muted }}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <Input label="Sign-up or ticket link (optional)" value={link} onChangeText={setLink} maxLength={300} autoCapitalize="none" placeholder="https://…" />
      <Input label="Anything else? (optional)" value={note} onChangeText={setNote} maxLength={300} multiline placeholder="e.g. 5-minute slots, register by 6:30" />
      <GradButton title="Add open mic" icon="microphone-plus" onPress={send} disabled={busy || title.trim().length < 3 || venue.trim().length < 2 || city.trim().length < 2} style={{ marginTop: space.md }} />
    </ScrollView>
  );
}
