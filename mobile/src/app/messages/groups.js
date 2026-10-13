// Groups: every group chat you're in, with search, and "New group" to start one.
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { ConversationRow } from '../../components/chat';
import { Empty, ErrorText, Loading } from '../../components/ui';
import { colors, fonts, gradients, space } from '../../lib/theme';

export default function Groups() {
  const [groups, setGroups] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      // groups you were added to by someone you don't follow wait in Requests: show those too
      const [inbox, reqs] = await Promise.all([api('/conversations?box=inbox'), api('/conversations?box=requests').catch(() => ({ conversations: [] }))]);
      const all = [...inbox.conversations, ...reqs.conversations].filter((c) => c.isGroup);
      all.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      setGroups(all); setError(null);
    } catch (e) { setError(e.message); setGroups([]); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const k = q.trim().toLowerCase();
  const shown = (groups || []).filter((g) => !k || (g.title || '').toLowerCase().includes(k) || g.members.some((m) => (m.username || '').includes(k) || (m.displayName || '').toLowerCase().includes(k)));

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: space.lg, paddingBottom: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 44, borderRadius: 22, paddingHorizontal: 14, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border }}>
          <Ionicons name="search" size={17} color={colors.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search groups or people in them" placeholderTextColor={colors.dim} autoCapitalize="none" autoCorrect={false}
            style={{ flex: 1, marginLeft: 8, color: colors.text, fontFamily: fonts.body, fontSize: 15, outlineStyle: 'none' }} />
          {q ? <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityLabel="Clear search"><Ionicons name="close-circle" size={17} color={colors.dim} /></Pressable> : null}
        </View>
        <Pressable onPress={() => router.push('/messages/new?group=1')} accessibilityRole="button"
          style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', padding: space.md, marginTop: space.md, borderRadius: 16, borderWidth: 1, borderColor: hovered ? colors.aura : colors.border, backgroundColor: colors.glass })}>
          <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <Ionicons name="add" size={26} color="#fff" />
          </View>
          <View style={{ flex: 1, marginLeft: space.md }}>
            <Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 15 }}>New group</Text>
            <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12 }}>Pick 2 or more of your connections</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.dim} />
        </Pressable>
        <ErrorText>{error}</ErrorText>
      </View>
      {!groups ? <Loading /> : (
        <FlatList data={shown} keyExtractor={(c) => c.id}
          renderItem={({ item }) => <ConversationRow conversation={item} onPress={() => router.push(`/chat/${item.id}`)} />}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.aura} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          contentContainerStyle={{ paddingBottom: 130, flexGrow: 1 }}
          ListEmptyComponent={k ? <Empty icon="search-outline" title="No group found" text="Try another name." />
            : <Empty icon="people-outline" title="No groups yet" text="Start one with New group above." />} />
      )}
    </View>
  );
}
