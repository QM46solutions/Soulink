import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard, Headline, MonoTag, SectionKicker } from '../../components/brand';
import { colors, fonts, space } from '../../lib/theme';

// Soul DNA matching, face search and the Referee arrive in Milestones 4–6.
const SOON = [
  { n: '02', label: 'Soul Matching', color: colors.aura, icon: 'git-network', title: 'Your personality, decoded.', text: 'Daily Soul questions build your DNA across 8 traits. People are ranked by Match %.', tag: 'soul_dna.v1' },
  { n: '03', label: 'Visual Discovery', color: colors.spark, icon: 'scan', title: 'See someone? Find them.', text: 'Point your camera to find a profile, but only people who switched on "Discoverable by face" can be found.', tag: 'face_search.optin' },
  { n: '04', label: 'Argument Referee', color: colors.gold, icon: 'scale', title: 'Every conflict gets a fair verdict.', text: 'Open a case, both sides share their version, and the AI referee gives a structured verdict.', tag: 'referee.verdict' },
];

export default function Discover() {
  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: 60 }}>
      <Headline size={32} gradient>Discover</Headline>
      <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 15, marginTop: 6, marginBottom: space.xl }}>Unlocking in the next milestones.</Text>
      {SOON.map((x) => (
        <GlassCard key={x.n} brackets style={{ padding: space.xl, marginBottom: space.lg }}>
          <SectionKicker num={x.n} label={x.label} color={x.color} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Text style={{ flex: 1, fontFamily: fonts.display, fontSize: 21, lineHeight: 26, color: colors.text }}>{x.title}</Text>
            <Ionicons name={x.icon} size={26} color={x.color} style={{ marginLeft: space.md }} />
          </View>
          <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: space.sm }}>{x.text}</Text>
          <MonoTag style={{ marginTop: space.lg }}>{`// ${x.tag} · coming soon`}</MonoTag>
        </GlassCard>
      ))}
    </ScrollView>
  );
}
