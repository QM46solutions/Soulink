// Moments row at the top of Home: your bubble first (tap + to add one), then people you're connected to.
// A gradient ring = new Moments to see; a grey ring = all seen.
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from './ui';
import { colors, fonts, space } from '../lib/theme';

const RING = ['#f5c842', '#ff6b9d', '#7c5cfc'];

function Bubble({ user, label, ring, seen, onPress, plus }) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', width: 74, marginRight: 4 }} accessibilityLabel={label}>
      <View style={{ width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' }}>
        {ring ? (seen
          ? <View style={{ position: 'absolute', width: 68, height: 68, borderRadius: 34, borderWidth: 2, borderColor: colors.dim }} />
          : <LinearGradient colors={RING} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', width: 68, height: 68, borderRadius: 34 }} />) : null}
        <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: colors.void, alignItems: 'center', justifyContent: 'center' }}>
          <Avatar uri={user.avatarUrl} name={user.displayName || user.username} size={56} />
        </View>
        {plus ? (
          <Pressable onPress={plus} hitSlop={6} accessibilityLabel="Add a Moment" style={{ position: 'absolute', right: 0, bottom: 0, width: 24, height: 24, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: colors.void, alignItems: 'center', justifyContent: 'center' }}>
            <LinearGradient colors={[colors.soul, colors.spark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <Ionicons name="add" size={16} color="#fff" />
          </Pressable>
        ) : null}
      </View>
      <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 11.5, color: seen ? colors.muted : colors.text, marginTop: 4, maxWidth: 72 }}>{label}</Text>
    </Pressable>
  );
}

export default function MomentsBar({ me, groups }) {
  const mine = groups?.find((g) => g.mine);
  const others = (groups || []).filter((g) => !g.mine);
  return (
    <View style={{ marginBottom: space.md }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.md, paddingVertical: space.sm }}>
        {/* your bubble: tap to watch your Moments (or add one); the small + always adds a new one */}
        <Bubble user={me} label="Your Moment" ring={!!mine} seen={false} plus={() => router.push('/moment/new')}
          onPress={() => router.push(mine ? '/moment/me' : '/moment/new')} />
        {others.map((g) => (
          <Bubble key={g.user.id} user={g.user} label={g.user.username} ring seen={g.allSeen} onPress={() => router.push(`/moment/${g.user.id}`)} />
        ))}
      </ScrollView>
      <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: space.lg }} />
    </View>
  );
}
