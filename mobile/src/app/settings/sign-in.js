// Settings › Sign-in & security
// · Your email: how you sign in (and get back in on a new phone). Add or change it with a code sent to that address.
//   Every account needs one; older accounts made with a phone number add it here (they're reminded on Home).
import { ScrollView } from 'react-native';
import { Note, Section } from '../../components/SettingsUI';
import AddEmail from '../../components/AddEmail';
import { space } from '../../lib/theme';

export default function SignInSettings() {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
      <Note>How you get into Soulink. We never show anyone your email.</Note>
      <Section>Your email</Section>
      <AddEmail />
    </ScrollView>
  );
}
