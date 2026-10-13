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
import { HeartFlight, Composer, ConversationAvatar, DaySeparator, MessageBubble, MessageMenu, TypingBubble, bubbleTappedSince, isHeart } from '../../components/chat';
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
      const c = await api(`/conversations/${id}`);
      const m = await api(`/conversations/${id}/messages?limit=30&vanish=${c.conversation.privateMode ? 1 : 0}`);
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

  // ----- private chat: tap 3 times anywhere in the chat to turn it on / off -----
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = (t) => { setToast(t); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 2600); };
  const taps = useRef([]);
  const touchAt = useRef(null);
  const lastTouch = useRef(0);
  // private chat and the regular chat are two separate views: switching loads the other one's messages
  const reloadFor = async (on) => {
    try { const m = await api(`/conversations/${id}/messages?limit=30&vanish=${on ? 1 : 0}`); setMessages(m.messages); setHasMore(m.hasMore); } catch { /* keep what we have */ }
  };
  const togglePrivate = async () => {
    const on = !conv?.privateMode;
    setConv((c) => ({ ...c, privateMode: on }));
    setMessages((cur) => cur.filter((m) => !!m.vanish === on));
    reloadFor(on);
    showToast(on ? '🔒 Private chat on' : 'Private chat off');
    try { await api(`/conversations/${id}/private`, { method: 'POST', body: { on } }); }
    catch (e) { setConv((c) => ({ ...c, privateMode: !on })); notice('Private chat', e.message); }
  };
  // 2 taps = send a big beating heart · 3 taps = private chat on/off (we wait a moment after 2 taps to see if a 3rd comes)
  const heartTimer = useRef(null);
  // the heart flies in the middle first, then lands in the chat (sent when it lands; received ones stay hidden until then)
  const [flight, setFlight] = useState(null); // { key, mine, messageId? }
  const [area, setArea] = useState(null);
  const sendHeart = () => { if (!flight) setFlight({ key: Date.now(), mine: true }); };
  const landed = () => { const f = flight; setFlight(null); if (f?.mine) sendText('❤️'); };
  const countTap = (x, y) => {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t.at < 650), { at: now, x, y }];
    clearTimeout(heartTimer.current);
    const near = (a, c) => Math.abs(a.x - c.x) < 60 && Math.abs(a.y - c.y) < 60;
    if (taps.current.length >= 3) {
      const [a, , c] = taps.current.slice(-3);
      taps.current = [];
      if (near(a, c)) togglePrivate();
    } else if (taps.current.length === 2) {
      const [a, c] = taps.current;
      heartTimer.current = setTimeout(() => {
        if (taps.current.length !== 2) return;
        taps.current = [];
        // double-tap on a message = ❤️ reaction on that message, not a heart message
        if (near(a, c) && !bubbleTappedSince(a.at - 50) && !blocked && !conv?.isRequest) sendHeart();
      }, 330);
    }
  };
  const tapHandlers = {
    onTouchStart: (e) => { const t = e.nativeEvent; touchAt.current = { x: t.pageX, y: t.pageY, at: Date.now() }; },
    onTouchEnd: (e) => {
      const t = e.nativeEvent; const st = touchAt.current; lastTouch.current = Date.now();
      if (st && Date.now() - st.at < 300 && Math.abs(t.pageX - st.x) < 10 && Math.abs(t.pageY - st.y) < 10) countTap(t.pageX, t.pageY);
    },
    ...(Platform.OS === 'web' ? { onClick: (e) => { if (Date.now() - lastTouch.current > 800) countTap(e.nativeEvent.pageX, e.nativeEvent.pageY); } } : {}),
  };
  // leaving the chat: private messages everyone has seen disappear (for both)
  useEffect(() => () => { api(`/conversations/${id}/leave`, { method: 'POST' }).catch(() => {}); }, [id]);

  // only this mode's messages (a message still sending is always shown)
  const shown = useMemo(() => messages.filter((m) => (String(m.id).startsWith('tmp-') || !!m.vanish === !!conv?.privateMode) && m.id !== flight?.messageId), [messages, conv?.privateMode, flight?.messageId]);

  // ----- live updates -----
  useLiveEvent('conversation:private', ({ conversationId, on, by }) => {
    if (conversationId !== id) return;
    setConv((c) => (c ? { ...c, privateMode: on } : c));
    if (by !== me.id) reloadFor(on);
    if (by !== me.id) showToast(on ? '🔒 Private chat turned on' : 'Private chat turned off');
  });
  useLiveEvent('message:vanished', ({ conversationId, ids }) => {
    if (conversationId !== id) return;
    const gone = new Set(ids.map((x) => String(x).toLowerCase()));
    setMessages((cur) => cur.filter((m) => !gone.has(String(m.id).toLowerCase())));
  });
  useLiveEvent('message:new', ({ conversationId, message }) => {
    if (conversationId !== id) return;
    setMessages((cur) => (cur.some((m) => m.id === message.id) ? cur : [message, ...cur]));
    if (message.senderId !== me.id) { setTypingUntil(0); markRead(); if (isHeart(message)) setFlight({ key: Date.now(), mine: false, messageId: message.id }); }
  });
  useLiveEvent('message:reactions', ({ conversationId, messageId, reactions }) => {
    if (conversationId !== id) return;
    setMessages((cur) => cur.map((m) => (m.id === messageId ? { ...m, reactions: reactions.map((r) => ({ emoji: r.emoji, count: r.count, mine: r.userIds.includes(me.id) })) } : m)));
  });
  // a Moment was opened, replayed or saved: update its status chip
  useLiveEvent('message:moment', ({ conversationId, messageId, status }) => {
    if (conversationId !== id) return;
    setMessages((cur) => cur.map((m) => (m.id === messageId && m.moment ? { ...m, moment: { ...m.moment, status: status === 'saved' || m.moment.mine ? status : m.moment.status } } : m)));
  });
  useLiveEvent('message:poll', ({ conversationId, messageId, counts, total, votes }) => {
    if (conversationId !== id) return;
    const mineV = votes?.find((v) => String(v.userId).toLowerCase() === String(me.id).toLowerCase());
    setMessages((cur) => cur.map((m) => (m.id === messageId && m.poll ? { ...m, poll: { ...m.poll, counts, total, myVote: mineV ? mineV.option : null } } : m)));
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
  const previewOf = (m) => (m.kind === 'image' ? '📷 Photo' : m.kind === 'voice' ? '🎤 Voice message' : m.kind === 'soulmoji' ? '✨ Soulmoji' : m.kind === 'post' ? '📮 Post' : m.kind === 'location' ? '📍 Location' : m.kind === 'contact' ? '👤 Contact' : m.kind === 'document' ? '📄 Document' : m.kind === 'poll' ? '📊 Poll' : m.body);

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

  // "+" menu: location / contact / poll go as one message; documents are uploaded
  const sendExtra = async (kind, payload, preview) => {
    const tmpId = `tmp-${++tmpSeq}`;
    setMessages((cur) => [{ id: tmpId, conversationId: id, senderId: me.id, kind, ...preview, createdAt: new Date().toISOString(), status: 'sending' }, ...cur]);
    try {
      const r = await api(`/conversations/${id}/messages`, { method: 'POST', body: payload });
      replaceTmp(tmpId, r.message);
    } catch (e) {
      if (e.code === 'blocked') setBlocked(true);
      setMessages((cur) => cur.filter((m) => m.id !== tmpId));
      notice('Not sent', e.message);
    }
  };
  const sendLocation = (loc) => sendExtra('location', { location: loc }, { location: loc });
  const sendContact = (u) => sendExtra('contact', { contact: { userId: u.id } }, { contact: { userId: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl } });
  const sendPoll = (p) => sendExtra('poll', { poll: p }, { poll: { ...p, counts: p.options.map(() => 0), total: 0, myVote: null } });
  const sendDocument = async (f) => {
    const tmpId = `tmp-${++tmpSeq}`;
    setMessages((cur) => [{ id: tmpId, conversationId: id, senderId: me.id, kind: 'document', document: { name: f.name, size: f.size }, createdAt: new Date().toISOString(), status: 'sending' }, ...cur]);
    try {
      const form = new FormData();
      form.append('name', f.name);
      form.append('file', f, f.name);
      const r = await api(`/conversations/${id}/document`, { method: 'POST', form, timeoutMs: 180000 });
      replaceTmp(tmpId, r.message);
    } catch (e) {
      setMessages((cur) => cur.filter((m) => m.id !== tmpId));
      notice('Document not sent', e.message);
    }
  };
  const vote = async (m, option) => {
    const was = m.poll;
    const counts = [...(was.counts || was.options.map(() => 0))];
    let myVote = option; let total = was.total || 0;
    if (was.myVote === option) { counts[option] -= 1; myVote = null; total -= 1; } else { if (was.myVote != null) counts[was.myVote] -= 1; else total += 1; counts[option] += 1; }
    setMessages((cur) => cur.map((x) => (x.id === m.id ? { ...x, poll: { ...was, counts, total, myVote } } : x)));
    try {
      const r = await api(`/conversations/${id}/messages/${m.id}/vote`, { method: 'POST', body: { option } });
      setMessages((cur) => cur.map((x) => (x.id === m.id ? { ...x, poll: { ...x.poll, counts: r.counts, total: r.total, myVote: r.myVote } } : x)));
    } catch (e) {
      setMessages((cur) => cur.map((x) => (x.id === m.id ? { ...x, poll: was } : x)));
      notice('Vote not saved', e.message);
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
      const r = await api(`/conversations/${id}/messages?limit=30&vanish=${conv?.privateMode ? 1 : 0}&before=${encodeURIComponent(oldest.createdAt)}`);
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
    const older = shown[index + 1];
    const newer = shown[index - 1];
    const mine = item.senderId === me.id;
    // In groups, show the sender's photo on the last bubble of a run, and their name on the first.
    const lastOfRun = !newer || newer.senderId !== item.senderId || newer.kind === 'system';
    const firstOfRun = !older || older.senderId !== item.senderId || older.kind === 'system' || !sameDay(older.createdAt, item.createdAt);
    return (
      <View>
        {!older || !sameDay(older.createdAt, item.createdAt) ? <DaySeparator label={dayLabel(item.createdAt)} /> : null}
        <MessageBubble
          onVote={vote}
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
      {conv.privateMode ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(3,2,8,0.55)' }} /> : null}
      {conv.privateMode ? (
        <View pointerEvents="none" style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', marginTop: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
          backgroundColor: 'rgba(124,92,252,0.22)', borderWidth: 1, borderColor: 'rgba(176,143,255,0.45)' }}>
          <Ionicons name="lock-closed" size={13} color={colors.aura} style={{ marginRight: 6 }} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.text }}>Private chat · seen messages disappear when you leave</Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }} {...tapHandlers} onLayout={(e) => setArea(e.nativeEvent.layout)}>
      <FlatList
        inverted
        data={shown}
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
      </View>
      {flight ? <HeartFlight key={flight.key} mine={flight.mine} area={area} onLanded={landed} /> : null}
      {toast ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: '42%', alignSelf: 'center', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: 'rgba(20,18,32,0.95)', borderWidth: 1, borderColor: 'rgba(176,143,255,0.4)' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.text }}>{toast}</Text>
          {conv.privateMode ? <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: colors.muted, textAlign: 'center', marginTop: 2 }}>Tap 3 times to turn it off</Text> : null}
        </View>
      ) : null}
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
      ) : conv.canMessage === false ? (
        // 1:1 chats only work between Connections (a paid message can arrive, but you reply by connecting)
        <View style={{ padding: space.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: 'rgba(14,12,22,0.96)', alignItems: 'center' }}>
          <Ionicons name="lock-closed" size={20} color={colors.aura} />
          <Text style={{ color: colors.text, fontFamily: fonts.semibold, textAlign: 'center', marginTop: 6 }}>You can chat once you're connected</Text>
          <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', marginTop: 4, marginBottom: space.md }}>
            Send {conv.other?.displayName || conv.other?.username || 'them'} a Connect request. Messages open when it's accepted.
          </Text>
          {conv.other ? <Button title="Open profile to connect" small onPress={() => router.push(`/user/${conv.other.username}`)} /> : null}
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
          onSendLocation={sendLocation}
          onSendContact={sendContact}
          onSendDocument={sendDocument}
          onSendPoll={sendPoll}
          onTranslateText={translateText}
          onTranslateVoice={translateVoice}
          onSendTranslated={sendTranslated}
          defaultTranslateTo={conv?.other?.chatLanguage || (myLang === 'en' ? 'te' : 'en')}
          onTyping={() => emit('typing', { conversationId: id })}
          privateMode={!!conv.privateMode}
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
