import { useCallback, useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useLiveEvent, useRealtime } from '../../lib/realtime';
import { ConversationRow } from '../../components/chat';
import ActionSheet from '../../components/ActionSheet';
import { confirm } from '../../lib/confirm';
import { Empty, ErrorText, Loading } from '../../components/ui';
import { colors, fonts, radius, space } from '../../lib/theme';

function Tab({ label, count, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: active ? colors.aura : 'transparent' }}>
      <Text style={{ color: active ? colors.text : colors.muted, fontFamily: active ? fonts.semibold : fonts.medium, fontSize: 14 }}>
        {label}{count ? ` (${count})` : ''}
      </Text>
    </Pressable>
  );
}

// Inbox: Chats and message Requests (from people who don't follow you)
export default function Messages() {
  const { user } = useAuth();
  const { refreshUnread } = useRealtime();
  const navigation = useNavigation();
  const [box, setBox] = useState('inbox');
  const [data, setData] = useState(null);
  const [requestCount, setRequestCount] = useState(0);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [menuFor, setMenuFor] = useState(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: user.username,
      headerRight: () => (
        <Pressable onPress={() => router.push('/messages/new')} hitSlop={10} accessibilityLabel="New message">
          <Ionicons name="create-outline" size={24} color={colors.text} />
        </Pressable>
      ),
    });
  }, [navigation, user.username]);

  const load = useCallback(async (which = box) => {
    try {
      const r = await api(`/conversations?box=${which}`);
      setData(r.conversations.map((c) => ({ ...c, meId: user.id })));
      if (which === 'inbox') setRequestCount(r.requestCount);
      else setRequestCount(r.conversations.length);
      setError(null);
    } catch (e) { setError(e.message); setData((d) => d || []); }
  }, [box, user.id]);

  useFocusEffect(useCallback(() => { load(); refreshUnread(); }, [load, refreshUnread]));
  useLiveEvent('message:new', () => load());
  useLiveEvent('message:deleted', () => load());

  const switchBox = (b) => { setBox(b); setData(null); load(b); };

  const deleteChat = async (c) => {
    if (!(await confirm(c.isRequest ? 'Delete this request?' : 'Delete this chat?', "It's removed from your inbox. If they message you again, it comes back.", { confirmText: 'Delete', destructive: true }))) return;
    await api(`/conversations/${c.id}`, { method: 'DELETE' });
    load();
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, marginHorizontal: space.lg }}>
        <Tab label="Chats" active={box === 'inbox'} onPress={() => switchBox('inbox')} />
        <Tab label="Requests" count={requestCount} active={box === 'requests'} onPress={() => switchBox('requests')} />
      </View>
      {box === 'requests' && data?.length ? (
        <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', padding: space.md, lineHeight: 17 }}>
          Messages from people you don't follow. They won't know you've seen them until you accept.
        </Text>
      ) : null}
      <ErrorText>{error}</ErrorText>
      {!data ? <Loading /> : (
        <FlatList
          data={data}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <ConversationRow
              conversation={item}
              onPress={() => router.push(`/chat/${item.id}`)}
              onLongPress={!item.isGroup ? () => setMenuFor(item) : undefined}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.aura} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          contentContainerStyle={{ paddingVertical: space.sm, flexGrow: 1 }}
          ListEmptyComponent={box === 'inbox' ? (
            <Empty icon="paper-plane-outline" title="No messages yet" text="Start a chat with someone you know, or create a group.">
              <Pressable onPress={() => router.push('/messages/new')} style={{ marginTop: space.lg, borderWidth: 1, borderColor: colors.soul, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 10 }}>
                <Text style={{ color: colors.aura, fontFamily: fonts.semibold }}>Send a message</Text>
              </Pressable>
            </Empty>
          ) : <Empty icon="mail-unread-outline" title="No message requests" text="When someone you don't follow messages you, it shows up here." />}
        />
      )}
      <ActionSheet
        visible={!!menuFor}
        onClose={() => setMenuFor(null)}
        title={menuFor?.title}
        options={[{ label: menuFor?.isRequest ? 'Delete request' : 'Delete chat', destructive: true, onPress: () => deleteChat(menuFor) }]}
      />
    </View>
  );
}
