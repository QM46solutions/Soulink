// Settings > Account status: is your account in good standing? (never shows who reported you)
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { InfoRow, Note, Section } from '../../components/SettingsUI';
import { Loading, s } from '../../components/ui';
import { colors, fonts, space } from '../../lib/theme';
import CopyrightNotices from '../../components/CopyrightNotices';

const LEVEL = {
  good: { icon: 'shield-checkmark', color: colors.mint, title: 'Your account is in good standing', text: "No problems. Thanks for keeping Soulink kind." },
  watch: { icon: 'alert-circle', color: colors.gold, title: 'A few people raised concerns', text: 'Nothing has been restricted. Keep things respectful so it stays that way.' },
  warning: { icon: 'warning', color: colors.danger, title: 'Some of your content was restricted', text: 'A post was suspended or your account was reported many times. More reports can limit your account.' },
};

export default function AccountStatus() {
  const [d, setD] = useState(null);
  useFocusEffect(useCallback(() => { api('/account/status').then(setD).catch(() => setD({ error: true })); }, []));
  if (!d) return <Loading />;
  if (d.error) return <View style={s.screen}><Note>Couldn't load your account status. Try again in a moment.</Note></View>;
  const L = LEVEL[d.level] || LEVEL.good; const c = d.checks;
  const yes = (v) => (v ? ['Done', colors.mint] : ['Not yet', colors.gold]);
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={{ alignItems: 'center', padding: space.xl }}>
        <View style={{ width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: `${L.color}22`, borderWidth: 1.5, borderColor: L.color }}>
          <Ionicons name={L.icon} size={36} color={L.color} />
        </View>
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 18, color: colors.text, marginTop: space.md, textAlign: 'center' }}>{L.title}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: colors.muted, marginTop: 4, textAlign: 'center' }}>{L.text}</Text>
      </View>
      <Section>Your account</Section>
      <InfoRow icon="scan" title="Face verified" value={yes(c.faceVerified)[0]} color={yes(c.faceVerified)[1]} />
      <InfoRow icon="git-network" title="Soul DNA" value={yes(c.soulDna)[0]} color={yes(c.soulDna)[1]} onPress={c.soulDna ? undefined : () => router.push('/soul')} />
      <InfoRow icon="calendar" title="Member since" value={new Date(c.memberSince).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} />
      <Section>Content & reports</Section>
      <InfoRow icon="images" title="Posts" value={String(c.posts)} />
      <InfoRow icon="eye-off" title="Suspended posts" value={String(c.suspendedPosts)} color={c.suspendedPosts ? colors.danger : colors.mint} />
      <InfoRow icon="alert-circle" title="Offense marks on your posts" value={String(c.offenseMarks)} color={c.offenseMarks ? colors.gold : colors.mint} />
      <InfoRow icon="flag" title="Times your account was reported" value={String(c.reports)} color={c.reports ? colors.gold : colors.mint} />
      <Note>Soulink never tells you who reported or marked something, and never tells them you know.</Note>
      <CopyrightNotices />
    </ScrollView>
  );
}
