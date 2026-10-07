// Settings > About
import { ScrollView, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { GradientText } from '../../components/brand';
import { getServer } from '../../lib/api';
import { InfoRow, Note, Section } from '../../components/SettingsUI';
import { s } from '../../components/ui';
import { colors, fonts, space } from '../../lib/theme';

export default function About() {
  const version = Constants.expoConfig?.version || '0.1.0';
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={{ alignItems: 'center', paddingVertical: space.xl }}>
        <GradientText style={{ fontFamily: fonts.display, fontSize: 40, lineHeight: 48 }}>Soulink</GradientText>
        <Text style={{ fontFamily: fonts.body, color: colors.muted, marginTop: 4 }}>Real souls. Real connections.</Text>
      </View>
      <InfoRow icon="information-circle" title="Version" value={`${version} · private preview`} />
      <InfoRow icon="location" title="Made in" value="Hyderabad, India" />
      <InfoRow icon="server" title="Server" value={getServer().replace(/^https?:\/\//, '')} />
      <Section>Terms</Section>
      <Note>Soulink is for people 18 and older. One person, one account, verified by Face ID. Be kind: content that many people find offensive is suspended, and accounts that keep breaking the rules are limited.</Note>
      <Section>Privacy</Section>
      <Note>Your face data is used only to keep accounts real and is never shown to anyone. Your exact location is never stored. Chats are private between the people in them. You can turn notifications, Discover, face search and activity-based matching on or off any time in Settings.</Note>
    </ScrollView>
  );
}
