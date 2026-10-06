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
import { Composer, ConversationAvatar, DaySeparator, MessageBubble, MessageMenu, TypingBubble } from '../../components/chat';
import { SoulmojiPanel } from '../../components/soulmoji';
import ReportModal from '../../components/ReportModal';
import { Button, Empty, Loading, VerifiedBadge } from '../../components/ui';
import { colors, fonts, space } from '../../lib/theme';
import ActionSheet from '../../components/ActionSheet';
import { CHAT_LANGS, detectLanguage, langName } from '../../lib/languages';

let tmpSeq = 0;

export default function Chat() {
  const { id } = useLocalSearchParams();
  const { user: me, setUser } = useAuth();
  const { emit, refreshUnread } = useRealtime();
  const navigation = useNavigation();
  const [conv, setConv] = useState(null);
  const [messages, setMessages] = useState([]); // newest first
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);
  const [typingUntil, setTypingUntil] = useState(0);
  const [menuFor, setMenuFor] = useState(null);
  // ----- chat translator -----
  const [translations, setTranslations] = useState({}); // messageId -> { text, fromName, toName, loading, error }
  const [pickLang, setPickLang] = useState(false);
  const myLang = me.chatLanguage || 'en'; // translate into your chat language (Settings), English by default
  const translateOne = useCallback(async (m, lang = myLang) => {
    if (!m || m.kind !== 'text' || !m.body || !lang) return;
    const from = detectLanguage(m.body);
    if (from === lang) { setTranslations((c) => ({ ...c, [m.id]: { text: null, fromName: langName(from), toName: langName(lang), error: `Already in ${langName(lang)}` } })); return; }
    setTranslations((c) => ({ ...c, [m.id]: { loading: true, fromName: langName(from), toName: langName(lang) } }));
    try {
      const r = await api(`/conversations/${id}/messages/${m.id}/translate`, { method: 'POST', body: { to: lang }, timeoutMs: 120000 });
      setTranslations((c) => ({ ...c, [m.id]: { text: r.text, fromName: langName(r.from), toName: langName(r.to) } }));
    } catch (e) {
      setTranslations((c) => ({ ...c, [m.id]: { error: e.message, fromName: langName(from), toName: langName(lang) } }));
    }
  }, [id, myLang]);
  const chooseLang = async (lang) => {
    setPickLang(false);
    try { const r = await api('/users/me', { method: 'PATCH', body: { chatLanguage: lang } }); setUser(r.user); } catch (e) { notice('Translator', e.message); return; }
    setTranslations({});
  };
  const hideTranslation = (mid) => setTranslations((c) => { const n = { ...c }; delete n[mid]; return n; });
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
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => router.push(`/chat/info/${conv.id}`)} hitSlop={10} accessibilityLabel="Chat details">
            <Ionicons name="information-circle-outline" size={24} color={colors.text} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, conv, me.id, typingUntil]);

  // ----- live updates -----
  useLiveEvent('message:new', ({ conversationId, message }) => {
    if (conversationId !== id) return;
    setMessages((cur) => (cur.some((m) => m.id === message.id) ? cur : [message, ...cur]));
    if (message.senderId !== me.id) { setTypingUntil(0); markRead(); }
  });
  useLiveEvent('message:reactions', ({ conversationId, messageId, reactions }) => {
    if (conversationId !== id) return;
    setMessages((cur) => cur.map((m) => (m.id === messageId ? { ...m, reactions: reactions.map((r) => ({ emoji: r.emoji, count: r.count, mine: r.userIds.includes(me.id) })) } : m)));
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

  const [replyTo, setReplyTo] = useState(null);
  const [soulmojiOpen, setSoulmojiOpen] = useState(false);
  const nameOfSender = (senderId) => (senderId === me.id ? 'yourself' : (conv?.members.find((x) => x.id === senderId)?.displayName || 'them').split(' ')[0]);
  const previewOf = (m) => (m.kind === 'image' ? '📷 Photo' : m.kind === 'voice' ? '🎤 Voice message' : m.kind === 'soulmoji' ? '✨ Soulmoji' : m.kind === 'post' ? '📮 Post' : m.body);

  const sendText = async (body, retryId) => {
    const tmpId = retryId || `tmp-${++tmpSeq}`;
    const reply = retryId ? null : replyTo;
    setReplyTo(null);
    const tmp = { id: tmpId, conversationId: id, senderId: me.id, kind: 'text', body, createdAt: new Date().toISOString(), status: 'sending', replyTo: reply ? { id: reply.id, senderId: reply.senderId, text: previewOf(reply) } : null };
    setMessages((cur) => (retryId ? cur.map((m) => (m.id === retryId ? tmp : m)) : [tmp, ...cur]));
    try {
      const r = await api(`/conversations/${id}/messages`, { method: 'POST', body: { body, ...(reply ? { replyToId: reply.id } : {}) } });
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

  // Translator in the message box: type or speak in your language, send in theirs (text or a voice note)
  const translateText = (text, to, output) => api(`/conversations/${id}/translate-draft`, { method: 'POST', body: { text, to, output }, timeoutMs: 240000 });
  const translateVoice = (file, to, output) => uploadFile(`/conversations/${id}/voice-translate`, file, 'file', { to, output }, 300000);
  const sendTranslated = async (r) => {
    if (!r.voice) { sendText(r.text); return; }
    const reply = replyTo; setReplyTo(null);
    const tmpId = `tmp-${++tmpSeq}`;
    setMessages((cur) => [{ id: tmpId, conversationId: id, senderId: me.id, kind: 'voice', mediaUrl: r.voice.url, durationMs: r.voice.durationMs, body: r.text, createdAt: new Date().toISOString(), status: 'sending' }, ...cur]);
    try {
      const m = await api(`/conversations/${id}/messages`, { method: 'POST', body: { voice: { url: r.voice.url, durationMs: r.voice.durationMs, text: r.text }, ...(reply ? { replyToId: reply.id } : {}) } });
      replaceTmp(tmpId, m.message);
    } catch (e) {
      setMessages((cur) => cur.filter((x) => x.id !== tmpId));
      throw e;
    }
  };

  const sendSoulmoji = async ({ mood, caption, imageUrl }) => {
    setSoulmojiOpen(false);
    const reply = replyTo; setReplyTo(null);
    const tmpId = `tmp-${++tmpSeq}`;
    setMessages((cur) => [{ id: tmpId, conversationId: id, senderId: me.id, kind: 'soulmoji', soulmoji: { mood, caption, imageUrl, faceUrl: me.avatarUrl }, createdAt: new Date().toISOString(), status: 'sending' }, ...cur]);
    try {
      const r = await api(`/conversations/${id}/messages`, { method: 'POST', body: { soulmoji: { mood, caption, imageUrl }, ...(reply ? { replyToId: reply.id } : {}) } });
      replaceTmp(tmpId, r.message);
    } catch (e) {
      setMessages((cur) => cur.map((m) => (m.id === tmpId ? { ...m, status: 'failed' } : m)));
      notice('Soulmoji not sent', e.message);
    }
  };

  // Reactions: tap one to add, tap the same again to remove (one per person, like Instagram)
  const react = async (m, emoji) => {
    setMessages((cur) => cur.map((x) => {
      if (x.id !== m.id) return x;
      const had = (x.reactions || []).find((r) => r.mine);
      let list = (x.reactions || []).map((r) => (r.mine ? { ...r, count: r.count - 1, mine: false } : r)).filter((r) => r.count > 0);
      if (!had || had.emoji !== emoji) {
        const ex = list.find((r) => r.emoji === emoji);
        list = ex ? list.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r)) : [...list, { emoji, count: 1, mine: true }];
      }
      return { ...x, reactions: list };
    }));
    try {
      const r = await api(`/conversations/${id}/messages/${m.id}/react`, { method: 'POST', body: { emoji } });
      setMessages((cur) => cur.map((x) => (x.id === m.id ? { ...x, reactions: r.reactions } : x)));
    } catch { /* keep optimistic state; live event will correct it */ }
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
          onMenu={item.deleted ? undefined : () => setMenuFor(item)}
          onReact={(e) => react(item, e)}
          onReply={() => setReplyTo(item)}
          replyToName={item.replyTo ? nameOfSender(item.replyTo.senderId) : null}
          onOpenImage={(m) => setViewer(mediaUrl(m.mediaUrl) || m.localUri)}
          translation={translations[item.id]}
          canTranslate={!mine && item.kind === 'text' && !!item.body && detectLanguage(item.body) !== myLang}
          onTranslate={() => translateOne(item)}
          onHideTranslation={() => hideTranslation(item.id)}
          translateTo={langName(myLang)}
              onChangeLanguage={() => setPickLang(true)}
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
        <>
        {soulmojiOpen ? <SoulmojiPanel onSend={sendSoulmoji} onClose={() => setSoulmojiOpen(false)} /> : null}
        <Composer
          replyTo={replyTo ? { name: nameOfSender(replyTo.senderId), text: previewOf(replyTo) } : null}
          onCancelReply={() => setReplyTo(null)}
          onSoulmoji={() => setSoulmojiOpen((o) => !o)}
          soulmojiOpen={soulmojiOpen}
          disabled={blocked}
          disabledText="You can't message this account."
          onSendText={(b) => sendText(b)}
          onSendMedia={sendMedia}
          onTranslateText={translateText}
          onTranslateVoice={translateVoice}
          onSendTranslated={sendTranslated}
          defaultTranslateTo={conv?.other?.chatLanguage || (myLang === 'en' ? 'te' : 'en')}
          onTyping={() => emit('typing', { conversationId: id })}
        />
        </>
      )}
      <MessageMenu
        message={menuFor}
        mine={menuFor?.senderId === me.id}
        onClose={() => setMenuFor(null)}
        onReact={(e) => menuFor && react(menuFor, e)}
        onReply={() => setReplyTo(menuFor)}
        onUnsend={() => unsend(menuFor)}
        onReport={() => setReporting(menuFor)}
        onRetry={() => (menuFor.kind === 'text' ? sendText(menuFor.body, menuFor.id) : (setMessages((c) => c.filter((x) => x.id !== menuFor.id)), sendMedia(menuFor.file)))}
        onDiscard={() => setMessages((c) => c.filter((x) => x.id !== menuFor.id))}
        onTranslate={() => translateOne(menuFor)}
      />
      <ActionSheet
        visible={pickLang}
        onClose={() => setPickLang(false)}
        title="Translate messages into"
        options={CHAT_LANGS.map((l) => ({ label: `${l.native}${l.native !== l.label ? `  ·  ${l.label}` : ''}${myLang === l.key ? '  ✓' : ''}`, onPress: () => chooseLang(l.key) }))}
      />
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
