// Anonymous chat, only between Connections. "new" = writing anonymously to a connection (from their profile).
// First you choose how long you stay hidden; the person who receives it sees only an alias until then.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { useLiveEvent, useRealtime } from '../../lib/realtime';
import { confirm, notice } from '../../lib/confirm';
import ActionSheet from '../../components/ActionSheet';
import { Avatar, Empty, Loading, VerifiedBadge } from '../../components/ui';
import { MaskAvatar, revealIn, threadTitle } from '../../components/anon';
import { colors, fonts, gradients, space } from '../../lib/theme';

const MAX = 500;
// how long you stay anonymous (hours), the same choices as the server
const REVEAL = [[1, '1 hour'], [6, '6 hours'], [24, '1 day'], [72, '3 days'], [168, '7 days'], [336, '14 days'], [720, '30 days']];
const revealLabel = (h) => (REVEAL.find(([x]) => x === h)?.[1] || `${Math.round(h / 24)} days`);

/** "Till when should I stay anonymous?" — asked before the first anonymous message. */
function RevealPicker({ value, onChange }) {
  return (
    <View style={{ marginHorizontal: space.lg, marginTop: space.md, padding: space.md, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
      <Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 14 }}>How long should you stay anonymous?</Text>
      <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12, marginTop: 2, marginBottom: space.sm }}>After this, they see it was you.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {REVEAL.map(([h, label]) => {
          const on = value === h;
          return (
            <Pressable key={h} onPress={() => onChange(h)} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={({ hovered }) => ({ paddingHorizontal: 12, height: 32, borderRadius: 999, justifyContent: 'center', borderWidth: 1.5,
                borderColor: on ? colors.soul : hovered ? colors.aura : colors.border, backgroundColor: on ? 'rgba(124,92,252,0.25)' : 'transparent' })}>
              <Text style={{ fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 13, color: on ? colors.text : colors.muted }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
const clock = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function Banner({ icon, color = colors.aura, children }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginHorizontal: space.lg, marginTop: space.md, padding: space.md, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(124,92,252,0.4)', backgroundColor: 'rgba(124,92,252,0.1)' }}>
      <Ionicons name={icon} size={18} color={color} style={{ marginRight: 10, marginTop: 1 }} />
      <Text style={{ flex: 1, fontFamily: fonts.body, color: colors.text, fontSize: 13, lineHeight: 19 }}>{children}</Text>
    </View>
  );
}

/** Shown to the receiver once the anonymous time is over: who it really was. */
function RevealCard({ thread }) {
  const u = thread.other;
  if (!u) return null;
  return (
    <View style={{ marginHorizontal: space.lg, marginTop: space.md, padding: space.lg, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(66,232,192,0.45)', backgroundColor: 'rgba(66,232,192,0.08)', alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.medium, color: colors.mint, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' }}>
        {thread.revealReason === 'connected' ? 'Revealed · you Soul Connected' : "Revealed · their anonymous time is up"}
      </Text>
      <View style={{ marginTop: space.md }}><Avatar uri={u.avatarUrl} size={64} name={u.displayName || u.username} /></View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.sm }}>
        <Text style={{ fontFamily: fonts.bold, color: colors.text, fontSize: 17 }}>{u.displayName || u.username}</Text>
        {u.verified ? <VerifiedBadge size={14} /> : null}
      </View>
      <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 13 }}>@{u.username} was "{thread.alias}"</Text>
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
        <Pressable onPress={() => router.push(`/user/${u.username}`)} style={({ hovered }) => ({ paddingHorizontal: 16, height: 34, borderRadius: 10, justifyContent: 'center', backgroundColor: hovered ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.1)' })}>
          <Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 14 }}>View profile</Text>
        </Pressable>
        {thread.connected && thread.conversationId ? (
          <Pressable onPress={() => router.push(`/chat/${thread.conversationId}`)} style={{ paddingHorizontal: 16, height: 34, borderRadius: 10, overflow: 'hidden', justifyContent: 'center' }}>
            <LinearGradient colors={gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <Text style={{ fontFamily: fonts.semibold, color: '#fff', fontSize: 14 }}>Open chat</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Bubble({ m }) {
  return (
    <View style={{ alignSelf: m.mine ? 'flex-end' : 'flex-start', maxWidth: '78%', marginHorizontal: space.lg, marginVertical: 3 }}>
      {m.mine ? (
        <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 20, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 9 }}>
          <Text style={{ fontFamily: fonts.body, color: '#fff', fontSize: 15, lineHeight: 21 }}>{m.body}</Text>
        </LinearGradient>
      ) : (
        <View style={{ borderRadius: 20, borderBottomLeftRadius: 6, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontFamily: fonts.body, color: colors.text, fontSize: 15, lineHeight: 21 }}>{m.body}</Text>
        </View>
      )}
      <Text style={{ fontFamily: fonts.body, color: colors.dim, fontSize: 10, marginTop: 2, alignSelf: m.mine ? 'flex-end' : 'flex-start' }}>{clock(m.createdAt)}</Text>
    </View>
  );
}

export default function AnonChat() {
  const { id, userId, username, name } = useLocalSearchParams();
  const isNew = id === 'new';
  const navigation = useNavigation();
  const { refreshUnread } = useRealtime();
  const [data, setData] = useState(isNew ? { thread: null, messages: [] } : null);
  const [error, setError] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [revealHours, setRevealHours] = useState(168);
  const [menu, setMenu] = useState(false);
  const [, tick] = useState(0);
  const listRef = useRef(null);

  const load = useCallback(async () => {
    if (isNew) return;
    try { setData(await api(`/anon/${id}`)); setError(null); refreshUnread(); } catch (e) { setError(e); }
  }, [id, isNew, refreshUnread]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useLiveEvent('anon:update', () => load());
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(t); }, []); // keep the countdown fresh

  const thread = data?.thread;
  const title = thread ? threadTitle(thread) : name || username || 'Anonymous';

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {thread && (thread.role === 'sender' || thread.revealed) && thread.other ? <Avatar uri={thread.other.avatarUrl} size={32} name={title} /> : <MaskAvatar size={32} />}
          <View style={{ marginLeft: 10 }}>
            <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 16 }}>{title}</Text>
            <Text style={{ fontFamily: fonts.medium, color: thread?.revealed ? colors.mint : colors.aura, fontSize: 11 }}>
              {thread?.revealed ? 'Revealed' : isNew || thread?.role === 'sender' ? 'You are anonymous' : 'Anonymous message'}
            </Text>
          </View>
        </View>
      ),
      headerRight: () => (thread ? (
        <Pressable onPress={() => setMenu(true)} hitSlop={10} accessibilityLabel="More options"><Ionicons name="ellipsis-horizontal" size={22} color={colors.text} /></Pressable>
      ) : null),
    });
  }, [navigation, thread, title, isNew]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      if (isNew) {
        const r = await api('/anon', { method: 'POST', body: { toUserId: userId, body, revealHours } });
        setText('');
        router.replace(`/anon/${r.threadId}`);
        return;
      }
      const r = await api(`/anon/${id}/messages`, { method: 'POST', body: { body } });
      setText('');
      setData((d) => ({ ...d, messages: [...d.messages, r.message] }));
      setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 50);
    } catch (e) { notice("Couldn't send", e.message); } finally { setSending(false); }
  };

  const closeChat = async () => {
    if (!(await confirm('Close this chat?', "They won't be able to send you anything more. You'll still see who it was when their time is up.", { confirmText: 'Close chat', destructive: true }))) return;
    try { await api(`/anon/${id}/close`, { method: 'POST' }); router.back(); } catch (e) { notice('Oops', e.message); }
  };
  const hideChat = async () => {
    try { await api(`/anon/${id}/hide`, { method: 'POST' }); router.back(); } catch (e) { notice('Oops', e.message); }
  };

  if (error) return <View style={{ flex: 1 }}><Empty icon="eye-off-outline" title="This chat isn't available" text={error.message} /></View>;
  if (!data) return <Loading />;

  const isSender = isNew || thread?.role === 'sender';
  const blocked = isSender && thread?.closed;
  let banner = null;
  if (isNew) {
    banner = (
      <>
        <Banner icon="eye-off-outline">{`${name || username} won't see your name: they see a secret name instead. After ${revealLabel(revealHours)} your name and profile are shown to them.`}</Banner>
        <RevealPicker value={revealHours} onChange={setRevealHours} />
      </>
    );
  } else if (!thread.revealed && isSender) {
    banner = <Banner icon="eye-off-outline">{`You're "${thread.alias}". Your name is shown to ${title} in ${revealIn(thread.revealAt)}.`}</Banner>;
  } else if (!thread.revealed) {
    banner = <Banner icon="sparkles-outline">{`One of your connections sent you this anonymously. You'll see who it is in ${revealIn(thread.revealAt)}.`}</Banner>;
  } else if (isSender) {
    banner = <Banner icon="eye-outline" color={colors.mint}>{`${title} can now see it was you.`}</Banner>;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={listRef}
        data={data.messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <Bubble m={item} />}
        ListHeaderComponent={<View style={{ marginBottom: space.md }}>{banner}{thread?.revealed && !isSender ? <RevealCard thread={thread} /> : null}</View>}
        contentContainerStyle={{ paddingBottom: space.md }}
        onContentSizeChange={() => listRef.current?.scrollToEnd?.({ animated: false })}
      />
      {blocked ? (
        <View style={{ padding: space.lg, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text style={{ fontFamily: fonts.body, color: colors.muted, textAlign: 'center', fontSize: 13 }}>They closed this chat. You can't send more messages.</Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: space.md, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
          <TextInput
            value={text}
            onChangeText={(t) => setText(t.slice(0, MAX))}
            placeholder={isSender ? 'Write anonymously…' : 'Reply…'}
            placeholderTextColor={colors.dim}
            multiline
            onKeyPress={(e) => { if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) { e.preventDefault?.(); send(); } }}
            style={{ flex: 1, minHeight: 42, maxHeight: 120, borderRadius: 21, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, color: colors.text, fontFamily: fonts.body, fontSize: 15, outlineStyle: 'none' }}
          />
          <Pressable onPress={send} disabled={!text.trim() || sending} accessibilityLabel="Send"
            style={({ hovered }) => ({ width: 42, height: 42, borderRadius: 21, overflow: 'hidden', marginLeft: space.sm, alignItems: 'center', justifyContent: 'center', opacity: text.trim() ? 1 : 0.45, transform: [{ scale: hovered && text.trim() ? 1.06 : 1 }] })}>
            <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <Ionicons name={sending ? 'hourglass-outline' : 'send'} size={18} color="#fff" />
          </Pressable>
        </View>
      )}
      <ActionSheet
        visible={menu}
        onClose={() => setMenu(false)}
        title={title}
        options={isSender
          ? [{ label: 'Remove from my list', destructive: true, onPress: hideChat }]
          : [
            ...(thread?.revealed && thread.other ? [{ label: 'View profile', onPress: () => router.push(`/user/${thread.other.username}`) }] : []),
            { label: 'Close chat (stop messages)', destructive: true, onPress: closeChat },
          ]}
      />
    </KeyboardAvoidingView>
  );
}
