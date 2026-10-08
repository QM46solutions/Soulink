// Post a casting call: the role, a few lines to perform, how long auditions stay open.
import { useLayoutEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { api } from '../../../lib/api';
import { notice } from '../../../lib/confirm';
import { Input } from '../../../components/ui';
import { GradButton } from '../../../components/SparkHub';
import { colors, fonts, space } from '../../../lib/theme';

const DAYS = [3, 7, 14];

export default function NewCasting() {
  const navigation = useNavigation();
  useLayoutEffect(() => { navigation.setOptions({ title: 'Post a casting call' }); }, [navigation]);
  const [title, setTitle] = useState('');
  const [role, setRole] = useState('');
  const [script, setScript] = useState('');
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    try {
      const r = await api('/sparks/casting', { method: 'POST', body: { title: title.trim(), role: role.trim(), script: script.trim() || undefined, days } });
      router.replace(`/spark/casting/${r.call.id}`);
    } catch (e) { notice('Not posted', e.message); } finally { setBusy(false); }
  };
  const Pill = ({ d }) => (
    <Text onPress={() => setDays(d)} style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, marginRight: 8, overflow: 'hidden',
      borderColor: days === d ? colors.spark : colors.border, color: days === d ? colors.text : colors.muted, fontFamily: fonts.semibold, fontSize: 13 }}>{d} days</Text>
  );
  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
      <Input label="Role title" value={title} onChangeText={setTitle} maxLength={100} placeholder="e.g. The angry dad on results day" />
      <Input label="Who are you looking for?" value={role} onChangeText={setRole} maxLength={300} multiline placeholder="Describe the character and the scene" />
      <Input label="Lines to perform (optional)" value={script} onChangeText={setScript} maxLength={1000} multiline placeholder="The dialogue everyone auditions with" hint="Shown on screen while they record" />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, marginBottom: 8 }}>Auditions open for</Text>
      <View style={{ flexDirection: 'row' }}>{DAYS.map((d) => <Pill key={d} d={d} />)}</View>
      <GradButton title="Post casting call" icon="bullhorn" onPress={send} disabled={busy || title.trim().length < 3 || role.trim().length < 5} style={{ marginTop: space.xl }} />
    </ScrollView>
  );
}
