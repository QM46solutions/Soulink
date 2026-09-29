import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { Empty, ErrorText, Input, UserRow, s } from '../../components/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, gradients, space } from '../../lib/theme';

// Big, self-explaining entry to Discover: what it does + what you can filter by + a clear action
function DiscoverCard() {
  const tags = [['heart-circle', 'Intent'], ['people', 'Age'], ['location', 'Nearby'], ['sparkles', 'Interests'], ['planet', 'Soul Score']];
  return (
    <Pressable onPress={() => router.push('/discover')} accessibilityRole="button" accessibilityLabel="Discover new people with Soul Filters"
      style={({ hovered, pressed }) => ({ marginTop: space.sm, marginBottom: space.md, borderRadius: 24, transform: [{ scale: pressed ? 0.98 : hovered ? 1.01 : 1 }] })}>
      <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 1.5 }}>
        <View style={{ borderRadius: 23, padding: space.lg, backgroundColor: 'rgba(14,12,22,0.94)' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginRight: space.md }}>
              <Ionicons name="planet" size={24} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.displayBold, fontSize: 18, color: colors.text }}>Discover new people</Text>
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
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>Find people with Soul Filters</Text>
            <Ionicons name="arrow-forward" size={17} color="#fff" style={{ marginLeft: 8 }} />
          </LinearGradient>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export default function Search() {
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
        data={results}
        keyExtractor={(u) => u.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <UserRow user={item} subtitle={item.youFollow ? `${item.displayName} · Following` : item.displayName} onPress={() => router.push(`/user/${item.username}`)} />
        )}
        ListEmptyComponent={
          searched ? <Empty icon="person-outline" title="No one found" text="Try a different name or username." />
            : (
              <Empty icon="search-outline" title="Know someone?" text="Type their name or @username above to find them." />
            )
        }
      />
    </View>
  );
}
