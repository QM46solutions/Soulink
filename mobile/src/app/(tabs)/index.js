import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../lib/auth';
import { Button } from '../../components/ui';
import { GlassCard, GradientText, MonoTag, SectionKicker } from '../../components/brand';
import { colors, fonts, space } from '../../lib/theme';

// Home feed arrives in Milestone 3 (posts, stories). For now: welcome + next steps.
export default function Home() {
  const { user } = useAuth();
  const first = user.displayName?.split(' ')[0] || user.username;
  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: 60 }}>
      <MonoTag>{'// welcome back'}</MonoTag>
      <GradientText style={{ fontFamily: fonts.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.8, marginTop: 6 }}>Hi {first}.</GradientText>
      <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 6 }}>
        Your feed lights up here once posts and stories launch.
      </Text>

      <GlassCard brackets style={{ marginTop: space.xl, padding: space.xl }}>
        <SectionKicker num="01" label="Get started" />
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.text, marginBottom: space.lg }}>Find your people</Text>
        <Button title="Search people you know" icon="search" onPress={() => router.push('/search')} style={{ marginBottom: space.md }} />
        <Button title="Complete your profile" icon="create-outline" variant="secondary" onPress={() => router.push('/edit-profile')} style={{ marginBottom: space.md }} />
        <Button title="Open messages" icon="paper-plane-outline" variant="secondary" onPress={() => router.push('/messages')} />
      </GlassCard>

      <GlassCard style={{ marginTop: space.lg, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(66,232,192,0.08)', borderWidth: 1, borderColor: 'rgba(66,232,192,0.35)', alignItems: 'center', justifyContent: 'center', marginRight: space.md }}>
          <Ionicons name="images-outline" size={20} color={colors.mint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.displayBold, color: colors.text, fontSize: 15 }}>Posts & stories are next</Text>
          <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 13, marginTop: 2, lineHeight: 18 }}>Photo posts, likes, comments and 24-hour stories.</Text>
        </View>
      </GlassCard>
    </ScrollView>
  );
}
