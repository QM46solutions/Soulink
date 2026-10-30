// Post a casting call: the role and the scene, what you need (age, gender, languages, where, paid or not), the lines
// to perform, and how long auditions stay open. Anyone can post one; people audition with a Spark.
import { useLayoutEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { api } from '../../../lib/api';
import { notice } from '../../../lib/confirm';
import { Input } from '../../../components/ui';
import { GradButton, RequirementChips } from '../../../components/SparkHub';
import { colors, fonts, space } from '../../../lib/theme';

const DAYS = [3, 7, 14, 30];
const GENDERS = [['any', 'Any'], ['female', 'Female'], ['male', 'Male'], ['other', 'Other']];
const PAYS = [[null, 'Not saying'], ['paid', 'Paid'], ['negotiable', 'Negotiable'], ['unpaid', 'Unpaid']];

function Pills({ items, value, onChange }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space.md }}>
      {items.map(([k, label]) => (
        <Text key={String(k)} onPress={() => onChange(k)} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, overflow: 'hidden',
          borderColor: value === k ? colors.spark : colors.border, color: value === k ? colors.text : colors.muted, fontFamily: fonts.semibold, fontSize: 13 }}>{label}</Text>
      ))}
    </View>
  );
}
const Label = ({ children }) => <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, marginBottom: 8 }}>{children}</Text>;

export default function NewCasting() {
  const navigation = useNavigation();
  useLayoutEffect(() => { navigation.setOptions({ title: 'Post a casting call' }); }, [navigation]);
  const [title, setTitle] = useState('');
  const [role, setRole] = useState('');
  const [script, setScript] = useState('');
  const [days, setDays] = useState(7);
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [gender, setGender] = useState('any');
  const [languages, setLanguages] = useState('');
  const [location, setLocation] = useState('');
  const [pay, setPay] = useState(null);
  const [payNote, setPayNote] = useState('');
  const [busy, setBusy] = useState(false);

  const num = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 && n <= 100 ? n : undefined; };
  const requirements = {
    ageMin: num(ageMin), ageMax: num(ageMax), gender,
    languages: languages.split(',').map((x) => x.trim()).filter(Boolean).slice(0, 6),
    location: location.trim() || undefined, pay: pay || undefined, payNote: pay && payNote.trim() ? payNote.trim() : undefined,
  };
  const send = async () => {
    setBusy(true);
    try {
      const r = await api('/sparks/casting', { method: 'POST', body: { title: title.trim(), role: role.trim(), script: script.trim() || undefined, days, requirements } });
      router.replace(`/spark/casting/${r.call.id}`);
    } catch (e) { notice('Not posted', e.message); } finally { setBusy(false); }
  };
  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
      <Input label="Role title" value={title} onChangeText={setTitle} maxLength={100} placeholder="e.g. The angry dad on results day" />
      <Input label="The scene and who you're looking for" value={role} onChangeText={setRole} maxLength={300} multiline placeholder="What happens in the scene, and the character you need" />
      <Input label="Lines to perform (optional)" value={script} onChangeText={setScript} maxLength={1000} multiline placeholder="The dialogue everyone auditions with" hint="Shown on screen while they record" />

      <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.2, color: colors.aura, marginTop: space.md, marginBottom: space.md }}>REQUIREMENTS (ALL OPTIONAL)</Text>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <View style={{ flex: 1 }}><Input label="Age from" value={ageMin} onChangeText={(v) => setAgeMin(v.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" placeholder="18" /></View>
        <View style={{ flex: 1 }}><Input label="Age to" value={ageMax} onChangeText={(v) => setAgeMax(v.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" placeholder="30" /></View>
      </View>
      <Label>Gender</Label>
      <Pills items={GENDERS} value={gender} onChange={setGender} />
      <Input label="Languages" value={languages} onChangeText={setLanguages} maxLength={150} placeholder="Telugu, Hindi" hint="Separate with commas" />
      <Input label="Location" value={location} onChangeText={setLocation} maxLength={80} placeholder="Hyderabad, or Remote" />
      <Label>Paid?</Label>
      <Pills items={PAYS} value={pay} onChange={setPay} />
      {pay ? <Input label="Pay details (optional)" value={payNote} onChangeText={setPayNote} maxLength={80} placeholder="e.g. ₹2,000 per day" /> : null}
      <RequirementChips r={requirements} style={{ marginBottom: space.md }} />

      <Label>Auditions open for</Label>
      <Pills items={DAYS.map((d) => [d, `${d} days`])} value={days} onChange={setDays} />
      <GradButton title="Post casting call" icon="bullhorn" onPress={send} disabled={busy || title.trim().length < 3 || role.trim().length < 5} style={{ marginTop: space.lg }} />
    </ScrollView>
  );
}
