// Legal pages (Terms, Privacy, Community Guidelines, Refunds, Grievance Officer). Public: open before and after login.
import { ScrollView, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { DOCS, DOC_KEYS, LEGAL } from '../../lib/legal';
import { Chip, s } from '../../components/ui';
import { colors, fonts, space } from '../../lib/theme';

export default function LegalDoc() {
  const { doc } = useLocalSearchParams();
  const key = DOC_KEYS.includes(doc) ? doc : 'terms';
  const d = DOCS[key];
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
      <Stack.Screen options={{ title: d.title }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.md }}>
        {DOC_KEYS.map((k) => <Chip key={k} label={DOCS[k].title.replace(' & Cancellation Policy', 's').replace(' Policy', '')} selected={k === key} onPress={() => router.setParams({ doc: k })} />)}
      </View>
      <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.dim, marginBottom: space.sm }}>Last updated {LEGAL.updated} · {LEGAL.company}</Text>
      <Text style={{ fontFamily: fonts.body, color: colors.text, fontSize: 15, lineHeight: 22 }}>{d.intro}</Text>
      {d.sections.map(([h, paras], i) => (
        <View key={h} style={{ marginTop: space.xl }}>
          <Text style={{ fontFamily: fonts.displayBold, color: colors.aura, fontSize: 17, marginBottom: space.sm }}>{i + 1}. {h}</Text>
          {paras.map((p) => <Text key={p} style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 14, lineHeight: 21, marginBottom: space.sm }}>{p}</Text>)}
        </View>
      ))}
    </ScrollView>
  );
}
