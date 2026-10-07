// Settings: one clean menu. Every item opens its own page (nothing expands here).
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../lib/auth';
import { confirm } from '../../lib/confirm';
import { MenuRow, Note, Section } from '../../components/SettingsUI';
import { s } from '../../components/ui';

const go = (p) => () => router.push(p);

export default function Settings() {
  const { user, signOut } = useAuth();
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <Section>You</Section>
      <MenuRow icon="pulse" title="Your activity" text="Likes, comments and requests you sent" onPress={go('/settings/activity')} tint={['#7c5cfc', '#b08fff']} />
      <MenuRow icon="hourglass-outline" title="Time management" text="Daily time on Soulink, limits and breaks" onPress={go('/settings/time')} tint={['#42e8c0', '#3fa9f5']} />
      <MenuRow icon="notifications" title="Notifications" text="Phone alerts and what you hear about" onPress={go('/settings/notifications')} tint={['#ff6b9d', '#ff9a5a']} />
      <MenuRow icon="eye" title="Who viewed my profile" text="People who visited in the last 30 days" onPress={go('/settings/viewers')} tint={['#b08fff', '#ff6b9d']} />

      <Section>Privacy & safety</Section>
      <MenuRow icon="lock-closed" title="Account privacy" text="Private account, Discover, Pulse meter" onPress={go('/settings/privacy')} tint={['#5b46d6', '#7c5cfc']} />
      <MenuRow icon="ban" title="Blocked contacts" text="People you've blocked" onPress={go('/blocked')} tint={['#8b88a0', '#4a4760']} />
      <MenuRow icon="shield-checkmark" title="Account status" text="Verification, warnings and reports" onPress={go('/settings/status')} tint={['#42e8c0', '#2bb673']} />

      <Section>Permissions</Section>
      <MenuRow icon="apps" title="App permissions" text="What Soulink may use: activity, face search, translation" onPress={go('/settings/app-permissions')} tint={['#f5c842', '#ff9a5a']} />
      <MenuRow icon="location" title="Location" text={user.hasLocation ? 'On: used for distance in Discover' : 'Off'} onPress={go('/settings/location')} tint={['#3fa9f5', '#5b46d6']} />
      <MenuRow icon="phone-portrait-outline" title="Device permissions" text="Camera, microphone, photos, location, notifications" onPress={go('/settings/device-permissions')} tint={['#58a0e6', '#42e8c0']} />

      <Section>More</Section>
      <MenuRow icon="information-circle" title="About" text="Soulink version, terms and privacy" onPress={go('/settings/about')} tint={['#b08fff', '#7c5cfc']} />
      <MenuRow icon="log-out-outline" title="Log out" danger
        onPress={async () => { if (await confirm('Log out?', undefined, { confirmText: 'Log out', destructive: true })) signOut(); }} />
      <Note>Signed in as {user.phone || user.email}</Note>
    </ScrollView>
  );
}
