import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScalesIcon } from '../../components/LiveIcons';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useLiveEvent, useRealtime } from '../../lib/realtime';
import { ConversationRow } from '../../components/chat';
import { AnonRow } from '../../components/anon';
import ActionSheet from '../../components/ActionSheet';
import { confirm } from '../../lib/confirm';
import { Empty, ErrorText, Loading } from '../../components/ui';
import { colors, fonts, gradients, radius, space } from '../../lib/theme';
import { fmtDate } from '../../lib/intents';

function Tab({ label, count, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: active ? colors.aura : 'transparent' }}>
      <Text style={{ color: active ? colors.text : colors.muted, fontFamily: active ? fonts.semibold : fonts.medium, fontSize: 14 }}>
        {label}{count ? ` (${count})` : ''}
      </Text>
    </Pressable>
  );
}

// Argue Referee lives here now: a floating scales button at the bottom right of Messages (like Instagram's Instants)
function ArgueButton() {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', right: space.lg, bottom: 16, alignItems: 'center' }}>
      <Pressable onPress={() => router.push('/argue')} accessibilityRole="button" accessibilityLabel="Argue Referee"
        style={({ hovered, pressed }) => ({ width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(20,18,32,0.92)', borderWidth: StyleSheet.hairlineWidth, borderColor: hovered ? 'rgba(176,143,255,0.7)' : 'rgba(176,143,255,0.3)',
          transform: [{ scale: pressed ? 0.92 : hovered ? 1.06 : 1 }],
          ...(Platform.OS === 'web' ? { cursor: 'pointer', outlineStyle: 'none', boxShadow: '0 8px 26px rgba(124,92,252,0.35)' } : { shadowColor: '#7c5cfc', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 }) })}>
        {/* thin floating bubble (hairline edge + soft glow), the scales fill most of it */}
        {/* the scales drawing sits low in its own box (base at the bottom), so lift it to the exact centre */}
        <View style={{ transform: [{ translateY: -4.5 }] }}><ScalesIcon size={56} bold /></View>
      </Pressable>
      <Text style={{ marginTop: 4, fontFamily: fonts.semibold, fontSize: 11, color: colors.muted }}>Argue</Text>
    </View>
  );
}

// Filters on Chats (like Instagram): everything, only unread, only groups, only anonymous ones
const FILTERS = [['all', 'All'], ['unread', 'Unread'], ['groups', 'Groups'], ['anon', 'Anonymous']];
function FilterChips({ value, onChange, counts }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg, paddingVertical: space.md, gap: 8 }}>
      {FILTERS.map(([k, label]) => {
        const on = value === k;
        return (
          <Pressable key={k} onPress={() => onChange(k)} accessibilityRole="button" accessibilityState={{ selected: on }}
            style={({ hovered }) => ({ paddingHorizontal: 14, height: 32, borderRadius: radius.pill, justifyContent: 'center', borderWidth: 1,
              borderColor: on ? colors.soul : hovered ? colors.aura : colors.border, backgroundColor: on ? 'rgba(124,92,252,0.25)' : 'transparent' })}>
            <Text style={{ fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 13, color: on ? colors.text : colors.muted }}>
              {label}{counts[k] ? ` ${counts[k]}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const timeOf = (item) => new Date(item.kind === 'anon'
  ? item.thread.lastMessage?.createdAt || item.thread.createdAt
  : item.conv.updatedAt || item.conv.createdAt).getTime();
const isUnread = (item) => (item.kind === 'anon' ? !!item.thread.unread : item.conv.unreadCount > 0);

/** What a request is: a chat while their Connect request is on hold, or one paid message. */
function requestTag(c) {
  if (c.held) {
    if (c.held.decideBy) return { text: c.held.iHeld ? 'Hold is over · accept or reject now' : 'Hold is over · waiting for their answer', color: colors.spark };
    return { text: `${c.held.iHeld ? 'You put them on hold' : 'On hold'} · chat until ${fmtDate(c.held.until)}` };
  }
  if (c.paid) return { text: 'Paid message', color: colors.aura };
  return null;
}

// Inbox: Chats (connections, groups, and anonymous messages between connections) and Requests
// (only a paid message, or a chat while a Connect request is on hold).
export default function Messages() {
  const { user } = useAuth();
  const { refreshUnread } = useRealtime();
  const navigation = useNavigation();
  const [box, setBox] = useState('inbox');
  const [filter, setFilter] = useState('all');
  const [chats, setChats] = useState(null);
  const [requests, setRequests] = useState(null);
  const [requestCount, setRequestCount] = useState(0);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [menuFor, setMenuFor] = useState(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: user.username,
      headerRight: () => (
        // one icon: your groups (with search) and New group. 1:1 chats open from a connection's profile.
        <Pressable onPress={() => router.push('/messages/groups')} hitSlop={10} accessibilityLabel="Groups">
          <Ionicons name="people-outline" size={25} color={colors.text} />
        </Pressable>
      ),
    });
  }, [navigation, user.username]);

  const load = useCallback(async (which = box) => {
    try {
      if (which === 'requests') {
        const r = await api('/conversations?box=requests');
        setRequests(r.conversations.map((c) => ({ ...c, meId: user.id })));
        setRequestCount(r.conversations.length);
      } else {
        const [r, a] = await Promise.all([api('/conversations?box=inbox'), api('/anon').catch(() => ({ threads: [] }))]);
        const items = [
          ...r.conversations.map((c) => ({ kind: 'conv', id: `c:${c.id}`, conv: { ...c, meId: user.id } })),
          ...a.threads.map((t) => ({ kind: 'anon', id: `a:${t.id}`, thread: t })),
        ].sort((x, y) => timeOf(y) - timeOf(x));
        setChats(items);
        setRequestCount(r.requestCount);
      }
      setError(null);
    } catch (e) {
      setError(e.message);
      if (which === 'requests') setRequests((d) => d || []); else setChats((d) => d || []);
    }
  }, [box, user.id]);

  useFocusEffect(useCallback(() => { load(); refreshUnread(); }, [load, refreshUnread]));
  useLiveEvent('message:new', () => load());
  useLiveEvent('message:deleted', () => load());
  useLiveEvent('anon:update', () => load());
  useLiveEvent('conversation:hidden', () => load());

  const switchBox = (b) => { setBox(b); load(b); };

  const counts = useMemo(() => {
    const list = chats || [];
    return {
      unread: list.filter(isUnread).length,
      groups: list.filter((i) => i.kind === 'conv' && i.conv.isGroup).length,
      anon: list.filter((i) => i.kind === 'anon').length,
    };
  }, [chats]);
  const shownChats = useMemo(() => (chats || []).filter((i) => (
    filter === 'unread' ? isUnread(i) : filter === 'groups' ? i.kind === 'conv' && i.conv.isGroup : filter === 'anon' ? i.kind === 'anon' : true
  )), [chats, filter]);

  const deleteChat = async (c) => {
    if (!(await confirm(c.isRequest ? 'Delete this request?' : 'Delete this chat?', "It's removed from your inbox. If they message you again, it comes back.", { confirmText: 'Delete', destructive: true }))) return;
    await api(`/conversations/${c.id}`, { method: 'DELETE' });
    load();
  };

  const data = box === 'requests' ? requests : chats ? shownChats : null;
  const emptyChats = filter === 'unread'
    ? <Empty icon="checkmark-done-outline" title="All caught up" text="No unread messages." />
    : filter === 'groups'
      ? <Empty icon="people-outline" title="No groups yet" text="Tap the people icon at the top to start a group with your connections." />
      : filter === 'anon'
        ? <Empty icon="eye-off-outline" title="No anonymous messages" text="You can send an anonymous message to any of your connections from their profile (the eye button). You choose how long you stay hidden; then they see it was you." />
        : (
          <Empty icon="paper-plane-outline" title="No messages yet" text="Chats open with your connections. Send a Connect request from someone's profile to start.">
            <Pressable onPress={() => router.push('/messages/new')} style={{ marginTop: space.lg, borderWidth: 1, borderColor: colors.soul, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 10 }}>
              <Text style={{ color: colors.aura, fontFamily: fonts.semibold }}>Send a message</Text>
            </Pressable>
          </Empty>
        );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, marginHorizontal: space.lg }}>
        <Tab label="Chats" count={counts.unread} active={box === 'inbox'} onPress={() => switchBox('inbox')} />
        <Tab label="Requests" count={requestCount} active={box === 'requests'} onPress={() => switchBox('requests')} />
      </View>
      {box === 'inbox' ? <View><FilterChips value={filter} onChange={setFilter} counts={counts} /></View> : null}
      {box === 'requests' && requests?.length ? (
        <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', padding: space.md, lineHeight: 17 }}>
          A paid message from someone you're not connected with, or a chat while a Connect request is on hold. Once the request is accepted, the chat moves to Chats.
        </Text>
      ) : null}
      <ErrorText>{error}</ErrorText>
      {!data ? <Loading /> : (
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => {
            if (box === 'requests') {
              return <ConversationRow conversation={item} tag={requestTag(item)} onPress={() => router.push(`/chat/${item.id}`)} onLongPress={!item.isGroup && !item.held ? () => setMenuFor(item) : undefined} />;
            }
            if (item.kind === 'anon') return <AnonRow thread={item.thread} onPress={() => router.push(`/anon/${item.thread.id}`)} />;
            return (
              <ConversationRow
                conversation={item.conv}
                onPress={() => router.push(`/chat/${item.conv.id}`)}
                onLongPress={!item.conv.isGroup ? () => setMenuFor(item.conv) : undefined}
              />
            );
          }}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.aura} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          contentContainerStyle={{ paddingTop: space.xs, paddingBottom: 130, flexGrow: 1 }}
          ListEmptyComponent={box === 'inbox' ? emptyChats : (
            <Empty icon="mail-unread-outline" title="No requests" text="Requests are a paid message from someone you're not connected with, or a chat while you've put someone's Connect request on hold (or they put yours)." />
          )}
        />
      )}
      <ActionSheet
        visible={!!menuFor}
        onClose={() => setMenuFor(null)}
        title={menuFor?.title}
        options={[{ label: menuFor?.isRequest ? 'Delete request' : 'Delete chat', destructive: true, onPress: () => deleteChat(menuFor) }]}
      />
      <ArgueButton />
    </View>
  );
}
