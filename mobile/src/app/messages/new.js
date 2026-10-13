import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { Avatar, Button, Empty, ErrorText, Input, UserRow } from '../../components/ui';
import { colors, fonts, gradients, space } from '../../lib/theme';

// Pick one person for a chat, or two or more for a group. "New group" (or ?group=1) starts straight in group mode.
export default function NewMessage() {
  const params = useLocalSearchParams();
  const navigation = useNavigation();
  const [groupMode, setGroupMode] = useState(params.group === '1');
  useLayoutEffect(() => { navigation.setOptions({ title: groupMode ? 'New group' : 'New message' }); }, [navigation, groupMode]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const t = useRef(null);

  // You can only chat with people you're connected with, so this lists your connections (filtered as you type)
  const [connections, setConnections] = useState(null);
  useEffect(() => { api('/connections').then((r) => setConnections(r.connections)).catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    if (!connections) return;
    const k = q.trim().toLowerCase();
    setResults(k ? connections.filter((c) => c.username.includes(k) || (c.displayName || '').toLowerCase().includes(k)) : connections);
  }, [q, connections]);

  const toggle = (u) => setSelected((cur) => (cur.some((x) => x.id === u.id) ? cur.filter((x) => x.id !== u.id) : [...cur, u]));
  const isGroup = groupMode || selected.length >= 2;

  const start = async () => {
    if (isGroup && selected.length < 2) { setError('Pick at least 2 people for a group'); return; }
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
        {groupMode ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.md }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginRight: space.md }}>
              <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <Ionicons name="people" size={26} color="#fff" />
            </View>
            <View style={{ flex: 1 }}><Input placeholder="Group name (optional)" value={groupName} onChangeText={setGroupName} maxLength={100} /></View>
          </View>
        ) : (
          <Pressable onPress={() => setGroupMode(true)} style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', padding: space.md, marginBottom: space.md, borderRadius: 16, borderWidth: 1, borderColor: hovered ? colors.aura : colors.border, backgroundColor: colors.glass })}>
            <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <Ionicons name="people" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 15 }}>New group</Text>
              <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12 }}>Chat with 2 or more of your connections</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.dim} />
          </Pressable>
        )}
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
        {isGroup && !groupMode ? <Input label="Group name (optional)" placeholder="e.g. Weekend trek" value={groupName} onChangeText={setGroupName} maxLength={100} /> : null}
        {groupMode ? <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.dim, marginBottom: 4 }}>{selected.length < 2 ? 'Pick at least 2 people' : `${selected.length + 1} in the group, with you`}</Text> : null}
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
        ListEmptyComponent={connections && !connections.length ? <Empty icon="people-outline" title="No connections yet" text="You can message people once they accept your Connect request." /> : q ? <Empty icon="search-outline" title="No match" text="Only your connections are listed here." /> : null}
      />
      {selected.length ? (
        <View style={{ padding: space.lg, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Button title={isGroup ? `Create group (${selected.length + 1})` : `Chat with ${selected[0].username}`} onPress={start} loading={busy} disabled={isGroup && selected.length < 2} />
        </View>
      ) : null}
    </View>
  );
}
