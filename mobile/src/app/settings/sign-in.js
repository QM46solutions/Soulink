// Settings › Sign-in & security
// · Your email: how you sign in (and get back in on a new phone). Add or change it with a code sent to that address.
//   Every account needs one; older accounts made with a phone number add it here (they're reminded on Home).
// · Your phone number: add or change it. Saved as "waiting to be confirmed" until text-message codes are live, then
//   confirmed with a code. The account's face data stays linked to the account whichever email / number it has.
import { ScrollView } from 'react-native';
import { Note, Section } from '../../components/SettingsUI';
import AddEmail from '../../components/AddEmail';
import AddPhone from '../../components/AddPhone';
import { space } from '../../lib/theme';

export default function SignInSettings() {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
      <Note>How you get into Soulink. We never show anyone your email or phone number.</Note>
      <Section>Your email</Section>
      <AddEmail />
      <Section>Your phone number</Section>
      <AddPhone />
    </ScrollView>
  );
}
