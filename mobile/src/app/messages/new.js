import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { Avatar, Button, Empty, ErrorText, Input, UserRow } from '../../components/ui';
import { colors, fonts, space } from '../../lib/theme';

// Pick one person for a chat, or two or more for a group.
export default function NewMessage() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const t = useRef(null);

  useEffect(() => {
    clearTimeout(t.current);
    if (!q.trim()) { setResults([]); return undefined; }
    t.current = setTimeout(async () => {
      try { setResults((await api(`/search/users?q=${encodeURIComponent(q.trim())}`)).users); } catch (e) { setError(e.message); }
    }, 250);
    return () => clearTimeout(t.current);
  }, [q]);

  const toggle = (u) => setSelected((cur) => (cur.some((x) => x.id === u.id) ? cur.filter((x) => x.id !== u.id) : [...cur, u]));
  const isGroup = selected.length >= 2;

  const start = async () => {
    setBusy(true); setError(null);
    try {
      const r = isGroup
        ? await api('/conversations/group', { method: 'POST', body: { title: groupName.trim() || undefined, userIds: selected.map((u) => u.id) } })
        : await api('/conversations/direct', { method: 'POST', body: { userId: selected[0].id } });
      router.dismiss();
      router.push(`/chat/${r.conversation.id}`);
    } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: space.lg, paddingBottom: 0 }}>
        <Input
          placeholder="Search people"
          value={q}
          onChangeText={setQ}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          style={{ marginBottom: space.sm }}
          right={<Ionicons name="search" size={18} color={colors.muted} />}
        />
        {selected.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: space.sm }} contentContainerStyle={{ gap: 8 }}>
            {selected.map((u) => (
              <Pressable key={u.id} onPress={() => toggle(u)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(124,92,252,0.18)', borderColor: 'rgba(124,92,252,0.5)', borderWidth: 1, borderRadius: 999, paddingLeft: 4, paddingRight: 10, paddingVertical: 4 }}>
                <Avatar uri={u.avatarUrl} size={24} name={u.displayName || u.username} />
                <Text style={{ color: colors.text, fontFamily: fonts.medium, fontSize: 13, marginLeft: 6 }}>{u.username}</Text>
                <Ionicons name="close" size={14} color={colors.muted} style={{ marginLeft: 4 }} />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        {isGroup ? <Input label="Group name (optional)" placeholder="e.g. Weekend trek" value={groupName} onChangeText={setGroupName} maxLength={100} /> : null}
        <ErrorText>{error}</ErrorText>
      </View>
      <FlatList
        data={results}
        keyExtractor={(u) => u.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const on = selected.some((x) => x.id === item.id);
          return (
            <UserRow
              user={item}
              onPress={() => toggle(item)}
              right={<Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? colors.soul : colors.dim} />}
            />
          );
        }}
        ListEmptyComponent={!q ? <Empty icon="people-outline" title="Who do you want to message?" text="Search by name or username. Pick two or more people to start a group." /> : null}
      />
      {selected.length ? (
        <View style={{ padding: space.lg, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Button title={isGroup ? `Create group (${selected.length + 1})` : `Chat with ${selected[0].username}`} onPress={start} loading={busy} />
        </View>
      ) : null}
    </View>
  );
}
