// Discover: find new people with Soul Filters. Sort chips on top, active filters as removable chips,
// then people cards (photo, age, area, distance, Soul type, Soul Score, shared interests, what they're open to).
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { AuraAvatar } from '../../components/ProfileHeader';
import { ScorePill } from '../../components/Choice';
import { Button, Empty, Loading, VerifiedBadge, s } from '../../components/ui';
import { colors, fonts, gradients, space } from '../../lib/theme';
import { SORTS, clean, summary, without } from '../../lib/filters';
import { LiveFrame, RadarIcon } from '../../components/LiveIcons';

function Pill({ label, active, icon, onPress, premium }) {
  return (
    <Pressable onPress={onPress} style={({ hovered }) => ({
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 34, borderRadius: 999, marginRight: 8, borderWidth: 1,
      borderColor: active ? colors.soul : hovered ? colors.aura : colors.border, backgroundColor: active ? 'rgba(124,92,252,0.22)' : colors.glass,
    })}>
      {icon ? <Ionicons name={icon} size={13} color={active ? colors.text : colors.muted} style={{ marginRight: 5 }} /> : null}
      <Text numberOfLines={1} style={{ maxWidth: 180, fontFamily: fonts.semibold, fontSize: 12.5, color: active ? colors.text : colors.muted }}>{label}</Text>
      {premium ? <Ionicons name="diamond" size={10} color={colors.gold} style={{ marginLeft: 5 }} /> : null}
    </Pressable>
  );
}

function PersonCard({ p }) {
  return (
    <Pressable onPress={() => router.push(`/user/${p.username}`)} style={({ hovered, pressed }) => ({
      marginHorizontal: space.lg, marginBottom: space.md, padding: space.lg, borderRadius: 22, borderWidth: 1,
      borderColor: hovered ? colors.aura : colors.border, backgroundColor: colors.glass, opacity: pressed ? 0.85 : 1,
    })}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <AuraAvatar user={p} size={64} />
        <View style={{ flex: 1, marginLeft: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.displayBold, fontSize: 17, color: colors.text }}>{p.displayName || p.username}{p.age ? `, ${p.age}` : ''}</Text>
            {p.verified ? <View style={{ marginLeft: 5 }}><VerifiedBadge /></View> : null}
            {p.activeRecently ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.mint, marginLeft: 6 }} /> : null}
          </View>
          {p.soulType ? <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.aura, marginTop: 1 }}>{p.soulType}</Text> : null}
          <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 2 }}>
            {[p.city?.split(',')[0], p.km != null ? `${p.km < 1 ? '<1' : Math.round(p.km)} km away` : null, p.college || p.company].filter(Boolean).join('  ·  ')}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: space.md }}>
        {p.soulScore ? <ScorePill score={p.soulScore} style={{ alignSelf: 'flex-start', marginRight: 6, marginBottom: 6 }} /> : null}
        {p.matchAs ? (
          <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(124,92,252,0.14)', borderWidth: 1, borderColor: 'rgba(176,143,255,0.4)', marginRight: 6, marginBottom: 6 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: colors.aura }}>{p.matchAs.emoji} Best as {p.matchAs.label}</Text>
          </View>
        ) : null}
        {p.sharedInterests?.slice(0, 3).map((i) => (
          <View key={i} style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(66,232,192,0.1)', borderWidth: 1, borderColor: 'rgba(66,232,192,0.35)', marginRight: 6, marginBottom: 6 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.mint }}>{i}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

export default function Discover() {
  const { user } = useAuth();
  const [filters, setFilters] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const search = useCallback(async (f) => {
    try { setData(await api('/discover/search', { method: 'POST', body: clean(f) })); setError(null); } catch (e) { setError(e.message); }
  }, []);

  // Coming back from the filter screen: read the saved filters and search again
  useFocusEffect(useCallback(() => {
    let live = true;
    api('/discover/options').then((o) => { if (live) { setFilters(o.saved || {}); search(o.saved || {}); } }).catch((e) => setError(e.message));
    return () => { live = false; };
  }, [search]));

  const change = (f) => {
    setFilters(f);
    api('/discover/filters', { method: 'PUT', body: clean(f) }).catch(() => {});
    search(f);
  };

  if (!filters) return error ? <View style={s.screen}><Empty icon="cloud-offline-outline" title={error} /></View> : <Loading />;
  const chips = summary(filters);
  const sort = filters.sort || data?.sort || 'match';

  const header = (
    <View style={{ paddingTop: space.md, paddingBottom: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, marginBottom: space.md }}>
        <Pressable onPress={() => router.push('/soul-filters')} style={{ flex: 1 }}>
          <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 50, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="options" size={18} color="#fff" style={{ marginRight: 8 }} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>Soul Filters</Text>
            {chips.length ? (
              <View style={{ marginLeft: 8, minWidth: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.soul }}>{chips.length}</Text>
              </View>
            ) : null}
          </LinearGradient>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg }}>
        {SORTS.map((x) => <Pill key={x.v} label={x.l} icon={x.icon} active={sort === x.v} onPress={() => change({ ...filters, sort: x.v })} />)}
      </ScrollView>
      {chips.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.sm, alignItems: 'center' }}>
          {chips.map((c) => (
            <Pressable key={c.key} onPress={() => change(without(filters, c.key))} style={{ flexDirection: 'row', alignItems: 'center', height: 30, paddingHorizontal: 10, borderRadius: 999, marginRight: 6, backgroundColor: 'rgba(124,92,252,0.14)', borderWidth: 1, borderColor: 'rgba(176,143,255,0.4)' }}>
              <Text numberOfLines={1} style={{ maxWidth: 170, fontFamily: fonts.medium, fontSize: 12, color: colors.text }}>{c.label}</Text>
              {c.premium ? <Ionicons name="diamond" size={9} color={colors.gold} style={{ marginLeft: 4 }} /> : null}
              <Ionicons name="close" size={13} color={colors.muted} style={{ marginLeft: 4 }} />
            </Pressable>
          ))}
          <Text onPress={() => change({ sort: filters.sort })} style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.spark, marginLeft: 4 }}>Clear all</Text>
        </ScrollView>
      ) : null}
      {data ? (
        <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1.5, color: colors.dim, paddingHorizontal: space.lg, marginTop: space.md }}>
          {`${data.total || 0} ${data.total === 1 ? 'SOUL' : 'SOULS'} FOUND`}
        </Text>
      ) : null}
      {!user.soulReady ? (
        <Text onPress={() => router.push('/soul')} style={{ fontFamily: fonts.semibold, color: colors.aura, fontSize: 13, paddingHorizontal: space.lg, marginTop: space.sm }}>Create your Soul DNA to see Soul Scores and best matches →</Text>
      ) : null}
    </View>
  );

  return (
    <FlatList
      style={s.screen}
      data={data?.people || []}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => <PersonCard p={item} />}
      ListHeaderComponent={header}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.aura} onRefresh={async () => { setRefreshing(true); await search(filters); setRefreshing(false); }} />}
      ListEmptyComponent={data ? (
        <View>
          <View style={{ marginTop: space.lg }}><LiveFrame size={170} label="VISUAL_SEARCH.LOCK"><RadarIcon size={140} /></LiveFrame></View>
          <Empty icon="planet-outline" title={data.note ? 'One more step' : user.soulReady ? 'No 75%+ matches yet' : 'Create your Soul DNA'} text={data.note || (user.soulReady ? 'Discover only shows people who match you above 75%. New souls join every day, check back soon.' : 'Discover shows people who match you above 75%. Take the Soul DNA quiz to see your matches.')}>
            {chips.length ? <Button title="Clear filters" variant="secondary" onPress={() => change({ sort: filters.sort })} /> : null}
          </Empty>
        </View>
      ) : (
        <View style={{ marginTop: space.xl }}><LiveFrame size={170} label="SCANNING…"><RadarIcon size={140} /></LiveFrame></View>
      )}
    />
  );
}
