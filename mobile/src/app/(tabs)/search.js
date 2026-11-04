import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { Empty, ErrorText, Input, UserRow, s } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, gradients, space } from '../../lib/theme';
import { RadarIcon } from '../../components/LiveIcons';

// Big, self-explaining entry to Discover: what it does + what you can filter by + a clear action
function DiscoverCard() {
  const tags = [['heart-circle', 'Intent'], ['people', 'Age'], ['location', 'Nearby'], ['sparkles', 'Interests'], ['planet', 'Soul Score']];
  return (
    <Pressable onPress={() => router.push('/discover')} accessibilityRole="button" accessibilityLabel="Find suggestions with Soul Filters"
      style={({ hovered, pressed }) => ({ marginTop: space.sm, marginBottom: space.md, borderRadius: 24, transform: [{ scale: pressed ? 0.98 : hovered ? 1.01 : 1 }] })}>
      <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 1.5 }}>
        <View style={{ borderRadius: 23, padding: space.lg, backgroundColor: 'rgba(14,12,22,0.94)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(245,200,66,0.4)', backgroundColor: 'rgba(245,200,66,0.06)', alignItems: 'center', justifyContent: 'center', marginRight: space.md }}>
              <RadarIcon size={52} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.displayBold, fontSize: 18, color: colors.text }}>Find suggestions</Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 2 }}>Don't know their name? Find new souls who match your vibe.</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space.md }}>
            {tags.map(([icon, label]) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: colors.border, marginRight: 6, marginBottom: 6 }}>
                <Ionicons name={icon} size={11} color={colors.aura} style={{ marginRight: 4 }} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted }}>{label}</Text>
              </View>
            ))}
          </View>
          <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ marginTop: space.sm, height: 46, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="options" size={17} color="#fff" style={{ marginRight: 8 }} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>Find suggestions with Soul Filters</Text>
            <Ionicons name="arrow-forward" size={17} color="#fff" style={{ marginLeft: 8 }} />
          </LinearGradient>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

/** A strong match (Soul Score 75%+), shown without typing anything. */
function MatchRow({ p }) {
  const bits = [p.matchAs ? `${p.matchAs.emoji} ${p.matchAs.label}` : null, p.km != null ? `${p.km < 1 ? '<1' : Math.round(p.km)} km away` : p.city || null].filter(Boolean);
  return (
    <UserRow user={p} subtitle={bits.join(' · ') || p.displayName} onPress={() => router.push(`/user/${p.username}`)}
      right={(
        <View style={{ paddingHorizontal: 10, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(66,232,192,0.14)', borderWidth: 1, borderColor: 'rgba(66,232,192,0.45)' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.mint }}>{p.soulScore}%</Text>
        </View>
      )} />
  );
}

export default function Search() {
  const { user } = useAuth();
  // people who match your Soul Score (75%+) and you're not connected with yet: best first, then nearest
  const [matches, setMatches] = useState(null);
  useFocusEffect(useCallback(() => {
    if (!user?.soulReady) { setMatches([]); return; }
    api('/discover/search', { method: 'POST', body: { sort: 'match' } }).then((r) => setMatches((r.people || []).slice(0, 20))).catch(() => setMatches((m) => m || []));
  }, [user?.soulReady]));
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const t = useRef(null);

  useEffect(() => {
    clearTimeout(t.current);
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    t.current = setTimeout(async () => {
      try {
        const r = await api(`/search/users?q=${encodeURIComponent(q.trim())}`);
        setResults(r.users); setError(null); setSearched(true);
      } catch (e) { setError(e.message); }
    }, 300);
    return () => clearTimeout(t.current);
  }, [q]);

  return (
    <View style={s.screen}>
      <View style={{ padding: space.lg, paddingBottom: 0 }}>
        <Input
          placeholder="Search by name or username"
          value={q}
          onChangeText={setQ}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ marginBottom: space.sm }}
          right={<Ionicons name="search" size={18} color={colors.muted} />}
        />
        <ErrorText>{error}</ErrorText>
        {!q.trim() ? <DiscoverCard /> : null}
      </View>
      <FlatList
        data={q.trim() ? results : matches || []}
        keyExtractor={(u) => u.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={!q.trim() && matches?.length ? (
          <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.xs }}>
            <Text style={{ fontFamily: fonts.displayBold, fontSize: 17, color: colors.text }}>Your matches</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 2 }}>People with a Soul Score of 75% or more with you, best first</Text>
          </View>
        ) : null}
        renderItem={({ item }) => (q.trim() ? (
          <UserRow user={item} subtitle={item.youFollow ? `${item.displayName} · Following` : item.displayName} onPress={() => router.push(`/user/${item.username}`)} />
        ) : <MatchRow p={item} />)}
        ListEmptyComponent={
          q.trim() ? (searched ? <Empty icon="person-outline" title="No one found" text="Try a different name or username." /> : null)
            : !user?.soulReady ? <Empty icon="planet-outline" title="See who matches you" text="Create your Soul DNA and your 75%+ matches show up here." />
              : matches ? <Empty icon="planet-outline" title="No 75%+ matches yet" text="New people join every day. Check back soon, or type a name above to find someone." /> : null
        }
      />
    </View>
  );
}
