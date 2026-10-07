// Settings > Account privacy
import { ScrollView } from 'react-native';
import { useSettingUpdate } from '../../lib/useSettingUpdate';
import { Note, Section, Toggle } from '../../components/SettingsUI';
import { ErrorText, s } from '../../components/ui';

export default function AccountPrivacy() {
  const { user, update, error } = useSettingUpdate();
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <ErrorText>{error}</ErrorText>
      <Section>Who can see you</Section>
      <Toggle title="Private account" text="Only people you've accepted (your Connections and Followers) see your posts." value={user.settings.isPrivate} onChange={(v) => update({ isPrivate: v })} />
      <Toggle title="Show me in Discover" text="Let Soulink suggest you to people who match you above 75%." value={user.settings.showInDiscover} onChange={(v) => update({ showInDiscover: v })} />
      <Section>Your profile</Section>
      <Toggle title="Show my Pulse meter" text={user.settings.showPulse === false ? 'Off: the Pulse meter is hidden on your profile.' : 'Shows how active and loved your profile is, on your profile.'} value={user.settings.showPulse !== false} onChange={(v) => update({ showPulse: v })} />
      <Note>Your Requests count is always visible on your profile, but nobody else can see who sent them.</Note>
    </ScrollView>
  );
}
