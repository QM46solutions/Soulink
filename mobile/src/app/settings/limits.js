// Settings > Account privacy > Limit interactions: for a while, people who aren't your Connections can't comment
// on your posts and Sparks or send you Connect requests. Useful when you're getting unwanted attention.
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api } from '../../lib/api';
import { MenuRow, Note, Section } from '../../components/SettingsUI';
import { ErrorText, s } from '../../components/ui';
import { colors, fonts, space } from '../../lib/theme';

const until = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function Limits() {
  const [p, setP] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api('/privacy').then((r) => setP(r.privacy)).catch((e) => setError(e.message)); }, []);
  const set = async (limitDays) => {
    setError(null);
    try { setP((await api('/privacy', { method: 'PUT', body: { limitDays } })).privacy); } catch (e) { setError(e.message); }
  };
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <ErrorText>{error}</ErrorText>
      <View style={{ padding: space.lg }}>
        <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 14, lineHeight: 21 }}>
          While this is on, people who aren&apos;t your Connections can&apos;t comment on your posts and Sparks or send you Connect requests. Your Connections aren&apos;t affected.
        </Text>
        {p?.limitUntil ? <Text style={{ fontFamily: fonts.semibold, color: colors.mint, fontSize: 14, marginTop: space.md }}>On until {until(p.limitUntil)}</Text> : null}
      </View>
      <Section>{p?.limitUntil ? 'Change it' : 'Turn on for'}</Section>
      <MenuRow icon="time" title="1 day" onPress={() => set(1)} tint={['#f5c842', '#ff9a5a']} />
      <MenuRow icon="calendar" title="1 week" onPress={() => set(7)} tint={['#ff9a5a', '#ff6b9d']} />
      <MenuRow icon="calendar-number" title="1 month" onPress={() => set(30)} tint={['#ff6b9d', '#7c5cfc']} />
      {p?.limitUntil ? <MenuRow icon="close-circle" title="Turn off now" danger onPress={() => set(0)} /> : null}
      <Note>For someone specific, Restrict or Block them from their profile instead.</Note>
    </ScrollView>
  );
}
