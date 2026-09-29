import { useEffect, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { Button, Empty, ErrorText, Input, UserRow, s } from '../../components/ui';
import { colors, space } from '../../lib/theme';

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
              <Empty icon="search-outline" title="Find your people" text="Search friends by their name or @username, or discover new souls with Soul Filters.">
                <Button title="Discover new souls" icon="options" onPress={() => router.push('/discover')} />
              </Empty>
            )
        }
      />
    </View>
  );
}
