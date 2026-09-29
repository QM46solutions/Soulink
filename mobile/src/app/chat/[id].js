import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { api, mediaUrl, uploadFile } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useLiveEvent, useRealtime } from '../../lib/realtime';
import { confirm, notice } from '../../lib/confirm';
import { dayLabel, sameDay } from '../../lib/time';
import { Composer, ConversationAvatar, DaySeparator, MessageBubble, TypingBubble } from '../../components/chat';
import ActionSheet from '../../components/ActionSheet';
import ReportModal from '../../components/ReportModal';
import { Button, Empty, Loading, VerifiedBadge } from '../../components/ui';
import { colors, fonts, space } from '../../lib/theme';

let tmpSeq = 0;

export default function Chat() {
  const { id } = useLocalSearchParams();
  const { user: me } = useAuth();
  const { emit, refreshUnread } = useRealtime();
  const navigation = useNavigation();
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]); // newest first
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);
  const [typingUntil, setTypingUntil] = useState(0);
  const [menuFor, setMenuFor] = useState(null);
  const [reporting, setReporting] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [blocked, setBlocked] = useState(false);
  const loadingMore = useRef(false);

  const markRead = useCallback((c = conv) => {
    if (!c || c.isRequest) return; // Requests: sender isn't told you've seen it until you accept
    api(`/conversations/${id}/read`, { method: 'POST' }).then(refreshUnread).catch(() => {});
  }, [conv, id, refreshUnread]);

  const load = useCallback(async () => {
    try {
      const [c, m] = await Promise.all([api(`/conversations/${id}`), api(`/conversations/${id}/messages?limit=30`)]);
      setConv(c.conversation);
      setMessages(m.messages);
      setHasMore(m.hasMore);
      setError(null);
      markRead(c.conversation);
    } catch (e) { setError(e); }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // ----- header -----
  useLayoutEffect(() => {
    if (!conv) return;
    navigation.setOptions({
      headerTitle: () => (
        <Pressable
          onPress={() => (conv.isGroup ? router.push(`/chat/info/${conv.id}`) : conv.other && router.push(`/user/${conv.other.username}`))}
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <ConversationAvatar conversation={{ ...conv, meId: me.id }} size={34} />
          <View style={{ marginLeft: 10, maxWidth: 200 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text numberOfLines={1} style={{ color: colors.text, fontFamily: fonts.displayBold, fontSize: 16 }}>{conv.title}</Text>
              {!conv.isGroup && conv.other?.verified ? <VerifiedBadge size={13} /> : null}
            </View>
            <Text numberOfLines={1} style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 12 }}>
              {typingUntil > Date.now() ? 'typing…' : conv.isGroup ? `${conv.members.length} members` : `@${conv.other?.username ?? ''}`}
            </Text>
          </View>
        </Pressable>
      ),
      headerRight: () => (
        <Pressable onPress={() => router.push(`/chat/info/${conv.id}`)} hitSlop={10} accessibilityLabel="Chat details">
          <Ionicons name="information-circle-outline" size={24} color={colors.text} />
        </Pressable>
      ),
    });
  }, [navigation, conv, me.id, typingUntil]);

  // ----- live updates -----
  useLiveEvent('message:new', ({ conversationId, message }) => {
    if (conversationId !== id) return;
    setMessages((cur) => (cur.some((m) => m.id === message.id) ? cur : [message, ...cur]));
    if (message.senderId !== me.id) { setTypingUntil(0); markRead(); }
  });
  useLiveEvent('message:deleted', ({ conversationId, message }) => {
    if (conversationId !== id) return;
    setMessages((cur) => cur.map((m) => (m.id === message.id ? message : m)));
  });
  useLiveEvent('typing', ({ conversationId, userId }) => {
    if (conversationId !== id || userId === me.id) return;
    setTypingUntil(Date.now() + 4000);
  });
  useLiveEvent('read', ({ conversationId, userId, at }) => {
    if (conversationId !== id) return;
    setConv((c) => (c ? { ...c, members: c.members.map((m) => (m.id === userId ? { ...m, lastReadAt: at } : m)) } : c));
  });
  useEffect(() => {
    if (!typingUntil) return undefined;
    const t = setTimeout(() => setTypingUntil(0), Math.max(0, typingUntil - Date.now()));
    return () => clearTimeout(t);
  }, [typingUntil]);

  // ----- sending -----
  const replaceTmp = (tmpId, real) => setMessages((cur) => {
    const withoutDupe = cur.filter((m) => m.id !== real.id);
    return withoutDupe.map((m) => (m.id === tmpId ? real : m));
  });

  const sendText = async (body, retryId) => {
    const tmpId = retryId || `tmp-${++tmpSeq}`;
    const tmp = { id: tmpId, conversationId: id, senderId: me.id, kind: 'text', body, createdAt: new Date().toISOString(), status: 'sending' };
    setMessages((cur) => (retryId ? cur.map((m) => (m.id === retryId ? tmp : m)) : [tmp, ...cur]));
    try {
      const r = await api(`/conversations/${id}/messages`, { method: 'POST', body: { body } });
      replaceTmp(tmpId, r.message);
      if (conv?.isRequest) setConv((c) => ({ ...c, isRequest: false }));
    } catch (e) {
      if (e.code === 'blocked') setBlocked(true);
      setMessages((cur) => cur.map((m) => (m.id === tmpId ? { ...m, status: 'failed' } : m)));
    }
  };

  const sendMedia = async (file) => {
    const tmpId = `tmp-${++tmpSeq}`;
    const tmp = { id: tmpId, conversationId: id, senderId: me.id, kind: file.kind, localUri: file.uri, durationMs: file.durationMs, createdAt: new Date().toISOString(), status: 'sending', file };
    setMessages((cur) => [tmp, ...cur]);
    try {
      const r = await uploadFile(`/conversations/${id}/media`, file, 'file', file.durationMs ? { durationMs: file.durationMs } : {});
      replaceTmp(tmpId, r.message);
    } catch (e) {
      if (e.code === 'blocked') setBlocked(true);
      setMessages((cur) => cur.map((m) => (m.id === tmpId ? { ...m, status: 'failed' } : m)));
    }
  };

  const loadOlder = async () => {
    if (!hasMore || loadingMore.current || !messages.length) return;
    loadingMore.current = true;
    try {
      const oldest = [...messages].reverse().find((m) => !String(m.id).startsWith('tmp-'));
      const r = await api(`/conversations/${id}/messages?limit=30&before=${encodeURIComponent(oldest.createdAt)}`);
      setMessages((cur) => [...cur, ...r.messages.filter((m) => !cur.some((x) => x.id === m.id))]);
      setHasMore(r.hasMore);
    } finally { loadingMore.current = false; }
  };

  // ----- request actions -----
  const accept = async () => {
    const r = await api(`/conversations/${id}/accept`, { method: 'POST' });
    setConv(r.conversation);
    markRead(r.conversation);
  };
  const decline = async () => {
    if (!(await confirm('Delete this request?', "They won't be told. If they message you again, it comes back.", { confirmText: 'Delete', destructive: true }))) return;
    await api(`/conversations/${id}`, { method: 'DELETE' });
    refreshUnread();
    router.back();
  };
  const blockSender = async () => {
    if (!(await confirm(`Block ${conv.other?.username}?`, "They won't be able to message you or find your profile.", { confirmText: 'Block', destructive: true }))) return;
    await api(`/blocks/${conv.other.id}`, { method: 'POST' });
    refreshUnread();
    router.back();
  };

  // ----- long-press menu -----
  const unsend = async (m) => {
    try {
      const r = await api(`/conversations/${id}/messages/${m.id}`, { method: 'DELETE' });
      setMessages((cur) => cur.map((x) => (x.id === m.id ? r.message : x)));
    } catch (e) { notice('Could not unsend', e.message); }
  };
  const menuOptions = useMemo(() => {
    if (!menuFor) return [];
    if (menuFor.status === 'failed') {
      return [
        { label: 'Try again', onPress: () => (menuFor.kind === 'text' ? sendText(menuFor.body, menuFor.id) : (setMessages((c) => c.filter((x) => x.id !== menuFor.id)), sendMedia(menuFor.file))) },
        { label: 'Delete', destructive: true, onPress: () => setMessages((c) => c.filter((x) => x.id !== menuFor.id)) },
      ];
    }
    if (menuFor.senderId === me.id) return [{ label: 'Unsend', destructive: true, onPress: () => unsend(menuFor) }];
    return [{ label: 'Report message', destructive: true, onPress: () => setReporting(menuFor) }];
  }, [menuFor]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- "Seen" under my latest message -----
  const seenLabel = useMemo(() => {
    if (!conv) return null;
    const lastMine = messages.find((m) => m.senderId === me.id && !String(m.id).startsWith('tmp-'));
    if (!lastMine || messages[0]?.id !== lastMine.id) return null;
    const t = new Date(lastMine.createdAt).getTime();
    const seers = conv.members.filter((m) => m.id !== me.id && m.lastReadAt && new Date(m.lastReadAt).getTime() >= t);
    if (!seers.length) return { id: lastMine.id, text: 'Sent' };
    if (!conv.isGroup) return { id: lastMine.id, text: 'Seen' };
    return { id: lastMine.id, text: seers.length === conv.members.length - 1 ? 'Seen by everyone' : `Seen by ${seers.map((s) => s.displayName?.split(' ')[0] || s.username).join(', ')}` };
  }, [conv, messages, me.id]);

  if (error) {
    return <View style={{ flex: 1 }}><Empty icon="chatbubbles-outline" title={error.status === 404 ? 'This chat isn’t available' : 'Something went wrong'} text={error.status === 404 ? undefined : error.message} /></View>;
  }
  if (!conv) return <Loading />;

  const membersById = Object.fromEntries(conv.members.map((m) => [m.id, m]));
  const typing = typingUntil > Date.now();

  const renderItem = ({ item, index }) => {
    const older = messages[index + 1];
    const newer = messages[index - 1];
    const mine = item.senderId === me.id;
    // In groups, show the sender's photo on the last bubble of a run, and their name on the first.
    const lastOfRun = !newer || newer.senderId !== item.senderId || newer.kind === 'system';
    const firstOfRun = !older || older.senderId !== item.senderId || older.kind === 'system' || !sameDay(older.createdAt, item.createdAt);
    return (
      <View>
        {!older || !sameDay(older.createdAt, item.createdAt) ? <DaySeparator label={dayLabel(item.createdAt)} /> : null}
        <MessageBubble
          message={item}
          mine={mine}
          status={item.status}
          sender={membersById[item.senderId]}
          showSender={conv.isGroup && !mine ? lastOfRun : undefined}
          showName={conv.isGroup && !mine && firstOfRun}
          onLongPress={item.deleted ? undefined : () => setMenuFor(item)}
          onOpenImage={(m) => setViewer(mediaUrl(m.mediaUrl) || m.localUri)}
        />
        {seenLabel?.id === item.id ? <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 11, textAlign: 'right', marginRight: space.lg, marginTop: 2 }}>{seenLabel.text}</Text> : null}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        inverted
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        onEndReached={loadOlder}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={typing ? <TypingBubble /> : <View style={{ height: space.sm }} />}
        ListFooterComponent={
          <View style={{ alignItems: 'center', paddingVertical: space.xl }}>
            <ConversationAvatar conversation={{ ...conv, meId: me.id }} size={72} />
            <Text style={{ color: colors.text, fontFamily: fonts.displayBold, fontSize: 18, marginTop: space.sm }}>{conv.title}</Text>
            <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 13, marginTop: 2 }}>
              {conv.isGroup ? `${conv.members.length} members` : `@${conv.other?.username} · Soulink`}
            </Text>
            {!conv.isGroup && conv.other ? (
              <Pressable onPress={() => router.push(`/user/${conv.other.username}`)} style={{ marginTop: space.md, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 }}>
                <Text style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 13 }}>View profile</Text>
              </Pressable>
            ) : null}
          </View>
        }
        contentContainerStyle={{ paddingBottom: space.sm }}
      />
      {conv.isRequest ? (
        <View style={{ padding: space.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: 'rgba(14,12,22,0.96)' }}>
          <Text style={{ color: colors.text, fontFamily: fonts.semibold, textAlign: 'center' }}>
            {conv.isGroup ? 'You were added to this group by someone you don’t follow.' : `${conv.other?.displayName || conv.other?.username} wants to send you a message.`}
          </Text>
          <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: space.md }}>
            They won't know you've seen it until you accept.
          </Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {!conv.isGroup ? <Button title="Block" variant="danger" small style={{ flex: 1 }} onPress={blockSender} /> : null}
            {!conv.isGroup ? <Button title="Delete" variant="secondary" small style={{ flex: 1 }} onPress={decline} /> : null}
            <Button title="Accept" small style={{ flex: 1 }} onPress={accept} />
          </View>
        </View>
      ) : (
        <Composer
          disabled={blocked}
          disabledText="You can't message this account."
          onSendText={(b) => sendText(b)}
          onSendMedia={sendMedia}
          onTyping={() => emit('typing', { conversationId: id })}
        />
      )}
      <ActionSheet visible={!!menuFor} onClose={() => setMenuFor(null)} options={menuOptions} />
      <ReportModal visible={!!reporting} onClose={() => setReporting(null)} targetType="message" targetId={reporting?.id} />
      <Modal visible={!!viewer} transparent animationType="fade" onRequestClose={() => setViewer(null)}>
        <Pressable onPress={() => setViewer(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' }}>
          {viewer ? <Image source={{ uri: viewer }} style={{ width: '100%', height: '80%' }} contentFit="contain" /> : null}
          <Ionicons name="close" size={28} color="#fff" style={{ position: 'absolute', top: 50, right: 20 }} />
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}
