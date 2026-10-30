// Casting Board: people post a role (with lines), others audition with a Spark, the caster picks one.
import { useCallback, useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../lib/api';
import { Avatar, Empty, Loading } from '../../../components/ui';
import { GradBadge, GradButton, RequirementChips, left } from '../../../components/SparkHub';
import { colors, fonts, space } from '../../../lib/theme';

function CallCard({ c }) {
  return (
    <Pressable onPress={() => router.push(`/spark/casting/${c.id}`)} style={({ hovered }) => ({ marginHorizontal: space.lg, marginBottom: space.md, padding: space.lg, borderRadius: 20, borderWidth: 1,
      borderColor: hovered ? colors.aura : 'rgba(176,143,255,0.22)', backgroundColor: 'rgba(26,24,40,0.78)', opacity: c.open ? 1 : 0.7 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <GradBadge icon="drama-masks" size={40} colors={['#7c5cfc', '#ff6b9d']} />
        <View style={{ flex: 1, marginLeft: space.md }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.displayBold, fontSize: 16, color: colors.text }}>{c.title}</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: c.open ? colors.mint : colors.muted, marginTop: 1 }}>
            {c.pickedSparkId ? '🌟 Role filled' : left(c.endsAt)} · {c.auditions} {c.auditions === 1 ? 'audition' : 'auditions'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.dim} />
      </View>
      <Text numberOfLines={2} style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: space.sm }}>{c.role}</Text>
      <RequirementChips r={c.requirements} style={{ marginTop: space.sm }} />
      {c.author ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.sm }}>
          <Avatar uri={c.author.avatarUrl} size={20} name={c.author.username} />
          <Text style={{ marginLeft: 6, fontFamily: fonts.medium, fontSize: 12, color: colors.dim }}>Cast by {c.author.displayName || c.author.username}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function CastingBoard() {
  const navigation = useNavigation();
  const [calls, setCalls] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  useLayoutEffect(() => { navigation.setOptions({ title: 'Casting Board' }); }, [navigation]);
  const load = useCallback(async () => { try { setCalls((await api('/sparks/casting')).calls); } catch { setCalls((c) => c || []); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (!calls) return <Loading />;
  return (
    <FlatList
      data={calls}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => <CallCard c={item} />}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.aura} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      ListHeaderComponent={
        <View style={{ padding: space.lg }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center', marginBottom: space.md }}>
            Anyone can post a scene and what they need. People who want the role act it out as a Spark, everyone can watch the auditions, and you pick the one you love.
          </Text>
          <GradButton title="Post a casting call" icon="bullhorn" onPress={() => router.push('/spark/casting/new')} />
        </View>
      }
      ListEmptyComponent={<Empty icon="film-outline" title="No roles yet" text="Be the first to post one." />}
      contentContainerStyle={{ paddingBottom: 40 }}
    />
  );
}
