import { useCallback, useLayoutEffect, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
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
        // one icon: your groups (with search) and New group. 1:1 chats open from a connection's profile.
        <Pressable onPress={() => router.push('/messages/groups')} hitSlop={10} accessibilityLabel="Groups">
          <Ionicons name="people-outline" size={25} color={colors.text} />
        </Pressable>
      ),
    });
  }, [navigation, user.username]);

  const [anonUnread, setAnonUnread] = useState(0);
  const load = useCallback(async (which = box) => {
    try {
      api('/anon').then((a) => { setAnonUnread(a.unread); if (which === 'anon') setData(a.threads); }).catch(() => {});
      if (which === 'anon') { setError(null); return; }
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
  useLiveEvent('anon:update', () => load());

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
        <Tab label="Anonymous" count={anonUnread} active={box === 'anon'} onPress={() => switchBox('anon')} />
      </View>
      {box === 'anon' && data?.length ? (
        <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', padding: space.md, lineHeight: 17 }}>
          Names stay hidden for 7 days, or until you two Soul Connect.
        </Text>
      ) : null}
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
          renderItem={({ item }) => (box === 'anon' ? <AnonRow thread={item} onPress={() => router.push(`/anon/${item.id}`)} /> : (
            <ConversationRow
              conversation={item}
              onPress={() => router.push(`/chat/${item.id}`)}
              onLongPress={!item.isGroup ? () => setMenuFor(item) : undefined}
            />
          ))}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.aura} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          contentContainerStyle={{ paddingTop: space.sm, paddingBottom: 130, flexGrow: 1 }}
          ListEmptyComponent={box === 'inbox' ? (
            <Empty icon="paper-plane-outline" title="No messages yet" text="Start a chat with someone you know, or create a group.">
              <Pressable onPress={() => router.push('/messages/new')} style={{ marginTop: space.lg, borderWidth: 1, borderColor: colors.soul, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 10 }}>
                <Text style={{ color: colors.aura, fontFamily: fonts.semibold }}>Send a message</Text>
              </Pressable>
            </Empty>
          ) : box === 'anon' ? (
            <Empty icon="eye-off-outline" title="No anonymous messages" text="Send someone an anonymous message from their profile (the eye button). Your name is shown to them after 7 days, or as soon as you Soul Connect." />
          ) : <Empty icon="mail-unread-outline" title="No message requests" text="When someone you don't follow messages you, it shows up here." />}
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
