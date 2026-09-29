// Create account: phone or email → 6-digit code → "Create your soul profile" (3 short steps).
import { router, useLocalSearchParams } from 'expo-router';
import ContactEntry from '../../components/ContactEntry';
import { BrandHeader, BrandScreen, LinkLine } from '../../components/BrandScreen';

export default function Signup() {
  const { method, value } = useLocalSearchParams();
  return (
    <BrandScreen back>
      <BrandHeader title="Create your account" subtitle="One real person, one profile. We'll send a code to check it's you." />
      <ContactEntry mode="signup" initialMethod={method === 'email' ? 'email' : 'phone'} initialValue={value ? String(value) : ''} />
      <LinkLine text="Already on Soulink?" link="Log in" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </BrandScreen>
  );
}
