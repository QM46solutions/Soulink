// Chat building blocks: group avatar, inbox row, message bubbles (text, photo, voice, system),
// typing dots and the composer (text, photo, voice note).
import { memo, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { mediaUrl } from '../lib/api';
import { colors, fonts, gradients, radius, space } from '../lib/theme';
import { ago, clock, duration } from '../lib/time';
import { Avatar, VerifiedBadge } from './ui';
import { SoulmojiPhoto, SoulmojiSticker } from './soulmoji';
import { CHAT_LANGS, langName } from '../lib/languages';

// ---------- avatars ----------

export function ConversationAvatar({ conversation, size = 52 }) {
  if (!conversation.isGroup) {
    return <Avatar uri={conversation.avatarUrl} size={size} name={conversation.title} />;
  }
  const others = conversation.members.filter((m) => m.id !== conversation.meId).slice(0, 2);
  const small = size * 0.7;
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', top: 0, right: 0 }}><Avatar uri={others[0]?.avatarUrl} size={small} name={others[0]?.displayName || others[0]?.username} /></View>
      <View style={{ position: 'absolute', bottom: 0, left: 0, borderWidth: 2, borderColor: colors.void, borderRadius: small }}>
        <Avatar uri={others[1]?.avatarUrl} size={small} name={others[1]?.displayName || others[1]?.username} />
      </View>
    </View>
  );
}

// ---------- inbox row ----------

export const ConversationRow = memo(function ConversationRow({ conversation, onPress, onLongPress }) {
  const unread = conversation.unreadCount > 0;
  const lm = conversation.lastMessage;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={({ pressed }) => [st.row, pressed && { backgroundColor: 'rgba(124,92,252,0.08)' }]}>
      <ConversationAvatar conversation={conversation} />
      <View style={{ flex: 1, marginLeft: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text numberOfLines={1} style={[st.rowTitle, unread && { fontFamily: fonts.bold, color: '#fff' }]}>{conversation.title}</Text>
          {!conversation.isGroup && conversation.other?.verified ? <VerifiedBadge size={13} /> : null}
        </View>
        <Text numberOfLines={1} style={[st.rowSub, unread && { color: colors.text, fontFamily: fonts.semibold }]}>
          {lm ? `${lm.text}` : conversation.isGroup ? `${conversation.members.length} members` : 'Say hi 👋'}
          {lm ? <Text style={{ color: colors.dim }}>{`  ·  ${ago(lm.createdAt)}`}</Text> : null}
        </Text>
      </View>
      {unread ? (
        <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.unread}>
          <Text style={st.unreadText}>{conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}</Text>
        </LinearGradient>
      ) : null}
    </Pressable>
  );
});

// ---------- bubbles ----------

export function SystemMessage({ text }) {
  return <Text style={st.system}>{text}</Text>;
}

export function DaySeparator({ label }) {
  return (
    <View style={st.dayWrap}>
      <View style={st.dayLine} />
      <Text style={st.dayText}>{label}</Text>
      <View style={st.dayLine} />
    </View>
  );
}

function BubbleShell({ mine, children, style, flat }) {
  if (mine && !flat) {
    return (
      <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[st.bubble, st.bubbleMine, style]}>
        {children}
      </LinearGradient>
    );
  }
  return <View style={[st.bubble, mine ? st.bubbleMine : st.bubbleTheirs, flat && { padding: 0, backgroundColor: 'transparent', borderWidth: 0 }, style]}>{children}</View>;
}

export const REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍'];

/** The quoted message shown above a reply (Instagram style). */
function ReplyQuote({ replyTo, mine, senderName }) {
  return (
    <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '100%', marginBottom: -6, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 12, borderRadius: 16, backgroundColor: 'rgba(42,39,64,0.7)', borderLeftWidth: 3, borderLeftColor: colors.aura }}>
      <Text style={{ color: colors.muted, fontFamily: fonts.semibold, fontSize: 11 }}>{senderName ? `Replying to ${senderName}` : 'Reply'}</Text>
      <Text style={{ color: colors.text, fontFamily: fonts.body, fontSize: 13, opacity: 0.8 }} numberOfLines={2}>{replyTo.text}</Text>
    </View>
  );
}

function Reactions({ reactions, mine, onReact }) {
  if (!reactions?.length) return null;
  return (
    <View style={{ flexDirection: 'row', alignSelf: mine ? 'flex-end' : 'flex-start', marginTop: -8, marginHorizontal: 8, zIndex: 2 }}>
      {reactions.map((r) => (
        <Pressable key={r.emoji} onPress={() => onReact?.(r.emoji)} accessibilityLabel={`${r.emoji} ${r.count}`}
          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 2, marginLeft: 2, borderRadius: 999, borderWidth: 2, borderColor: colors.void, backgroundColor: r.mine ? 'rgba(124,92,252,0.45)' : colors.card }}>
          <Text style={{ fontSize: 13 }}>{r.emoji}</Text>
          {r.count > 1 ? <Text style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 11, marginLeft: 2 }}>{r.count}</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}

export const MessageBubble = memo(function MessageBubble({ message, mine, showSender, showName, sender, status, onMenu, onReact, onReply, onOpenImage, replyToName, translation, canTranslate, onTranslate, onHideTranslation, onChangeLanguage, translateTo }) {
  const lastTap = useRef(0);
  const [hover, setHover] = useState(false);
  if (message.kind === 'system') return <SystemMessage text={message.body} />;
  const live = !message.deleted && !String(message.id).startsWith('tmp-');
  // Double-tap a message to ❤️ it, like Instagram. Long-press (or the ⋯ on laptop) for more.
  const tap = () => {
    const now = Date.now();
    if (live && now - lastTap.current < 300) { onReact?.('❤️'); lastTap.current = 0; } else lastTap.current = now;
  };
  let content;
  if (message.deleted) {
    content = (
      <View style={[st.bubble, st.deleted]}>
        <Text style={st.deletedText}>{mine ? 'You unsent a message' : 'Message unsent'}</Text>
      </View>
    );
  } else if (message.kind === 'soulmoji' && message.soulmoji) {
    content = (
      <Pressable onPress={tap} onLongPress={onMenu} style={{ paddingVertical: 4 }}>
        {message.soulmoji.imageUrl
          ? <SoulmojiPhoto imageUrl={message.soulmoji.imageUrl} mood={message.soulmoji.mood} caption={message.soulmoji.caption} size={176} />
          : <SoulmojiSticker faceUrl={message.soulmoji.faceUrl} mood={message.soulmoji.mood} caption={message.soulmoji.caption} size={120} />}
      </Pressable>
    );
  } else if (message.kind === 'post' && message.post) {
    // a post someone shared into the chat: tap to open it
    const p = message.post;
    content = (
      <Pressable onPress={() => { tap(); router.push(`/post/${p.postId}`); }} onLongPress={onMenu}
        style={({ hovered }) => ({ width: 210, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: hovered ? colors.aura : colors.border, backgroundColor: colors.card })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 8 }}>
          <Avatar uri={p.author?.avatarUrl} size={24} name={p.author?.username} />
          <Text numberOfLines={1} style={{ flex: 1, marginLeft: 6, fontFamily: fonts.semibold, color: colors.text, fontSize: 13 }}>{p.author?.username}</Text>
        </View>
        {p.thumb ? <Image source={{ uri: mediaUrl(p.thumb) }} style={{ width: 210, height: 210, backgroundColor: colors.void }} contentFit="cover" /> : null}
        {p.caption ? (
          <Text numberOfLines={p.thumb ? 2 : 5} style={{ padding: 8, fontFamily: p.thumb ? fonts.body : fonts.semibold, color: colors.text, fontSize: p.thumb ? 13 : 15, lineHeight: p.thumb ? 18 : 21 }}>{p.caption}</Text>
        ) : null}
      </Pressable>
    );
  } else if (message.kind === 'image') {
    content = (
      <Pressable onPress={() => { tap(); onOpenImage?.(message); }} onLongPress={onMenu}>
        <Image source={{ uri: mediaUrl(message.mediaUrl) || message.localUri }} style={st.photo} contentFit="cover" transition={150} />
        {message.body ? <BubbleShell mine={mine} style={{ marginTop: 4 }}><Text style={[st.text, mine && st.textMine]}>{message.body}</Text></BubbleShell> : null}
      </Pressable>
    );
  } else if (message.kind === 'voice') {
    content = (
      <Pressable onPress={tap} onLongPress={onMenu}>
        <BubbleShell mine={mine}>
          <VoiceNote message={message} mine={mine} />
          {message.body ? <Text style={{ marginTop: 6, maxWidth: 230, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: mine ? 'rgba(255,255,255,0.9)' : colors.muted }}>{message.body}</Text> : null}
        </BubbleShell>
      </Pressable>
    );
  } else {
    content = (
      <Pressable onPress={tap} onLongPress={onMenu}>
        <BubbleShell mine={mine}>
          <Text selectable={false} style={[st.text, mine && st.textMine, Platform.OS === 'web' && { userSelect: 'none' }]}>{message.body}</Text>
          {translation && !translation.loading ? (
            // Chat translator: the message in your language, under the original
            <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: mine ? 'rgba(255,255,255,0.25)' : colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                <Ionicons name="language" size={12} color={mine ? 'rgba(255,255,255,0.8)' : colors.aura} style={{ marginRight: 4 }} />
                <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: mine ? 'rgba(255,255,255,0.8)' : colors.aura }}>
                  {translation.loading ? 'Translating…' : translation.error ? 'Could not translate' : `${translation.fromName} → ${translation.toName}`}
                </Text>
              </View>
              {translation.text ? <Text selectable={false} style={[st.text, mine && st.textMine, { fontSize: 15 }]}>{translation.text}</Text> : null}
              {translation.error ? <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted }}>{translation.error}</Text> : null}
            </View>
          ) : null}
        </BubbleShell>
        {/* Translate pill: only on messages written in a language other than yours */}
        {canTranslate || translation ? (
          <Pressable onPress={translation && !translation.loading ? onHideTranslation : onTranslate} onLongPress={onChangeLanguage} delayLongPress={450} disabled={translation?.loading}
            style={({ hovered }) => ({ alignSelf: mine ? 'flex-end' : 'flex-start', flexDirection: 'row', alignItems: 'center', marginTop: 4, paddingHorizontal: 10, height: 26, borderRadius: 13,
              borderWidth: 1, borderColor: hovered ? colors.aura : colors.border, backgroundColor: hovered ? 'rgba(124,92,252,0.18)' : 'rgba(26,24,40,0.8)' })}>
            <Ionicons name="language" size={13} color={colors.aura} style={{ marginRight: 5 }} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.text }}>
              {translation?.loading ? 'Translating…' : translation ? 'Show original only' : `Translate to ${translateTo || 'English'}`}
            </Text>
          </Pressable>
        ) : null}
      </Pressable>
    );
  }
  // Laptop: hovering a message shows quick React / Reply / More buttons beside it
  const hoverBar = Platform.OS === 'web' && hover && live ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginHorizontal: 6 }}>
      {[['heart-outline', () => onReact?.('❤️'), 'React'], ['arrow-undo-outline', onReply, 'Reply'], ['ellipsis-horizontal', onMenu, 'More']].map(([icon, fn, label]) => (
        <Pressable key={label} onPress={fn} accessibilityLabel={label} style={({ hovered }) => ({ padding: 5, borderRadius: 14, backgroundColor: hovered ? colors.card : 'transparent' })}>
          <Ionicons name={icon} size={16} color={colors.muted} />
        </Pressable>
      ))}
    </View>
  ) : null;
  return (
    <View onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}
      style={[st.msgRow, mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
      {!mine && showSender !== undefined ? (
        <View style={{ width: 30, marginRight: 6, alignSelf: 'flex-end' }}>{showSender ? <Avatar uri={sender?.avatarUrl} size={28} name={sender?.displayName || sender?.username} /> : null}</View>
      ) : null}
      {mine ? hoverBar : null}
      <View style={{ maxWidth: '75%', alignItems: mine ? 'flex-end' : 'flex-start' }}>
        {!mine && showName && sender ? <Text style={st.senderName}>{sender.displayName || sender.username}</Text> : null}
        {message.replyTo && !message.deleted ? <ReplyQuote replyTo={message.replyTo} mine={mine} senderName={replyToName} /> : null}
        {content}
        <Reactions reactions={message.reactions} mine={mine} onReact={onReact} />
        {status === 'sending' ? <Text style={st.meta}>Sending…</Text> : null}
        {status === 'failed' ? <Text style={[st.meta, { color: colors.danger }]}>Not sent. Tap and hold to retry.</Text> : null}
      </View>
      {!mine ? hoverBar : null}
    </View>
  );
});

/**
 * Long-press menu, drawn inside the phone screen (Instagram style): a reaction bar on top,
 * then Reply / Copy / Unsend or Report.
 */
export function MessageMenu({ message, mine, onClose, onReact, onReply, onUnsend, onReport, onRetry, onDiscard, onTranslate }) {
  if (!message) return null;
  const failed = message.status === 'failed';
  const items = failed
    ? [['refresh', 'Try again', onRetry], ['trash-outline', 'Delete', onDiscard, true]]
    : [['arrow-undo-outline', 'Reply', onReply], ...(message.kind === 'text' && onTranslate ? [['language-outline', 'Translate', onTranslate]] : []), ...(mine ? [['trash-outline', 'Unsend', onUnsend, true]] : [['flag-outline', 'Report', onReport, true]])];
  return (
    <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(8,7,13,0.72)', justifyContent: 'center', padding: space.xl, zIndex: 50 }}>
      <Pressable onPress={() => {}} style={{ alignSelf: 'stretch' }}>
        {!failed ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignSelf: mine ? 'flex-end' : 'flex-start', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginBottom: space.md }}>
            {REACTIONS.map((e) => (
              <Pressable key={e} onPress={() => { onReact(e); onClose(); }} style={({ hovered, pressed }) => ({ paddingHorizontal: 6, transform: [{ scale: hovered || pressed ? 1.35 : 1 }] })}>
                <Text style={{ fontSize: 28 }}>{e}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%', padding: 12, borderRadius: 18, backgroundColor: mine ? 'rgba(124,92,252,0.35)' : colors.card, marginBottom: space.md }}>
          <Text style={{ color: colors.text, fontFamily: fonts.body, fontSize: 15 }} numberOfLines={4}>
            {message.kind === 'text' ? message.body : message.kind === 'soulmoji' ? '✨ Soulmoji' : message.kind === 'image' ? '📷 Photo' : '🎤 Voice message'}
          </Text>
        </View>
        <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', minWidth: 200, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
          {items.map(([icon, label, fn, danger], i) => (
            <Pressable key={label} onPress={() => { onClose(); setTimeout(() => fn?.(), 50); }}
              style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border, backgroundColor: hovered ? 'rgba(124,92,252,0.12)' : 'transparent' })}>
              <Text style={{ color: danger ? colors.danger : colors.text, fontFamily: fonts.semibold, fontSize: 15 }}>{label}</Text>
              <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.text} />
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Pressable>
  );
}

// ---------- voice notes ----------

function VoiceNote({ message, mine }) {
  const source = mediaUrl(message.mediaUrl) || message.localUri;
  const player = useAudioPlayer(source ? { uri: source } : null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const total = (status.duration && status.duration * 1000) || message.durationMs || 0;
  const pos = (status.currentTime || 0) * 1000;
  const progress = total ? Math.min(1, pos / total) : 0;

  useEffect(() => { if (status.didJustFinish) player.seekTo(0); }, [status.didJustFinish, player]);

  const toggle = async () => {
    if (status.playing) player.pause();
    else {
      try { await setAudioModeAsync({ playsInSilentMode: true }); } catch { /* ignore */ }
      player.play();
    }
  };
  const fg = mine ? '#fff' : colors.aura;
  // Fixed pseudo-waveform (stable per message id)
  const bars = Array.from({ length: 22 }, (_, i) => 6 + (((message.id || 'x').charCodeAt(i % (message.id || 'x').length) * (i + 3)) % 16));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minWidth: 190 }}>
      <Pressable onPress={toggle} hitSlop={8} accessibilityLabel={status.playing ? 'Pause voice message' : 'Play voice message'}
        style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: mine ? 'rgba(255,255,255,0.22)' : 'rgba(176,143,255,0.16)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
        <Ionicons name={status.playing ? 'pause' : 'play'} size={16} color={fg} style={{ marginLeft: status.playing ? 0 : 2 }} />
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, height: 24 }}>
        {bars.map((h, i) => (
          <View key={i} style={{ width: 3, height: h, borderRadius: 2, marginRight: 2, backgroundColor: fg, opacity: i / bars.length <= progress ? 1 : 0.35 }} />
        ))}
      </View>
      <Text style={{ color: fg, fontFamily: fonts.medium, fontSize: 12, marginLeft: 8, fontVariant: ['tabular-nums'] }}>
        {duration(status.playing || pos > 0 ? pos : total)}
      </Text>
    </View>
  );
}

// ---------- typing dots ----------

export function TypingBubble() {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [a]);
  const dot = (i) => ({
    width: 7, height: 7, borderRadius: 4, backgroundColor: colors.aura, marginHorizontal: 2,
    opacity: a.interpolate({ inputRange: [0, 0.33 * i, 0.33 * i + 0.2, 1], outputRange: [0.3, 0.3, 1, 0.3], extrapolate: 'clamp' }),
  });
  return (
    <View style={[st.msgRow, { justifyContent: 'flex-start' }]}>
      <View style={[st.bubble, st.bubbleTheirs, { flexDirection: 'row', paddingVertical: 14 }]}>
        {[0, 1, 2].map((i) => <Animated.View key={i} style={dot(i)} />)}
      </View>
    </View>
  );
}

// ---------- composer ----------

// ---------- translator in the message box ----------

const nativeName = (k) => CHAT_LANGS.find((l) => l.key === k)?.native || langName(k);

function OptionChip({ label, sub, active, onPress, icon, half }) {
  return (
    <Pressable onPress={onPress} style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: half ? 'center' : 'flex-start', paddingHorizontal: 14, height: 40, borderRadius: 20, marginRight: half ? 0 : 8, marginBottom: 8, width: half ? '48.5%' : undefined,
      borderWidth: 1, borderColor: active ? colors.aura : hovered ? 'rgba(176,143,255,0.6)' : colors.border, backgroundColor: active ? 'rgba(124,92,252,0.25)' : 'rgba(26,24,40,0.8)' })}>
      {icon ? <Ionicons name={icon} size={15} color={active ? colors.aura : colors.muted} style={{ marginRight: 6 }} /> : null}
      <Text style={{ fontFamily: active ? fonts.semibold : fonts.medium, color: colors.text, fontSize: 14 }}>{label}</Text>
      {sub ? <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12, marginLeft: 6 }}>{sub}</Text> : null}
    </Pressable>
  );
}

/** "Translate my message": which language to send in, and as text or as a voice note. */
export function TranslateSetup({ visible, value, onClose, onStart, onStop }) {
  const [to, setTo] = useState(value?.to || 'en');
  const [output, setOutput] = useState(value?.output || 'text');
  useEffect(() => { if (visible) { setTo(value?.to || 'en'); setOutput(value?.output || 'text'); } }, [visible, value]);
  if (!visible) return null;
  const sheet = (
      <Pressable onPress={onClose} style={Platform.OS === 'web'
        // laptop preview: stay inside the phone frame (a web Modal would cover the whole browser window)
        ? { position: 'absolute', left: 0, right: 0, bottom: 0, top: -1400, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end', cursor: 'default' }
        : { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: '#13111f', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: colors.border, padding: space.xl, paddingBottom: space.xl + 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <Ionicons name="language" size={20} color={colors.aura} style={{ marginRight: 8 }} />
            <Text style={{ fontFamily: fonts.bold, color: colors.text, fontSize: 18 }}>Translate my message</Text>
          </View>
          <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 13, lineHeight: 18, marginBottom: space.lg }}>
            Type or speak in your own language. Soulink sends it in the language you pick, and you see it before it goes.
          </Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, marginBottom: 8 }}>Send in</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: space.md }}>
            {CHAT_LANGS.map((l) => <OptionChip half key={l.key} label={l.native} sub={l.native !== l.label ? l.label : null} active={to === l.key} onPress={() => setTo(l.key)} />)}
          </View>
          <Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.muted, marginBottom: 8 }}>Send as</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.lg }}>
            <OptionChip icon="text-outline" label="Text" active={output === 'text'} onPress={() => setOutput('text')} />
            <OptionChip icon="mic-outline" label="Voice note" active={output === 'voice'} onPress={() => setOutput('voice')} />
          </View>
          <Pressable onPress={() => onStart({ to, output })} style={({ hovered }) => ({ height: 46, borderRadius: 23, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', transform: [{ scale: hovered ? 1.01 : 1 }] })}>
            <LinearGradient colors={gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <Text style={{ fontFamily: fonts.semibold, color: '#fff', fontSize: 15 }}>{`Send in ${langName(to)} as ${output === 'voice' ? 'voice' : 'text'}`}</Text>
          </Pressable>
          {onStop ? (
            <Pressable onPress={onStop} style={{ alignItems: 'center', paddingTop: space.md }}>
              <Text style={{ fontFamily: fonts.semibold, color: colors.muted, fontSize: 14 }}>Turn translator off</Text>
            </Pressable>
          ) : null}
        </Pressable>
      </Pressable>
  );
  if (Platform.OS === 'web') return sheet;
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>{sheet}</Modal>;
}

/** What you wrote / said, and what will be sent. Nothing goes out until you press Send. */
function TranslatePreview({ result, onSend, onEdit, onCancel, sending }) {
  return (
    <View style={{ marginHorizontal: space.md, marginBottom: 6, padding: space.md, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(124,92,252,0.45)', backgroundColor: 'rgba(20,17,34,0.98)' }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.muted }}>{result.fromVoice ? 'You said' : 'You wrote'}</Text>
      <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 2 }}>{result.original}</Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.aura, marginTop: 10 }}>
        {result.same ? `Already in ${langName(result.to)}` : `In ${langName(result.to)}`}{result.voice ? ' · voice note' : ''}
      </Text>
      <Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 15, lineHeight: 22, marginTop: 2 }}>{result.text}</Text>
      {result.voice ? (
        <View style={{ marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
          <VoiceNote message={{ id: result.voice.url, mediaUrl: result.voice.url, durationMs: result.voice.durationMs }} mine={false} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
        <Pressable onPress={onCancel} hitSlop={6} style={{ paddingHorizontal: 12, height: 34, justifyContent: 'center' }}><Text style={{ fontFamily: fonts.semibold, color: colors.muted }}>Discard</Text></Pressable>
        {!result.fromVoice ? <Pressable onPress={onEdit} hitSlop={6} style={{ paddingHorizontal: 12, height: 34, justifyContent: 'center' }}><Text style={{ fontFamily: fonts.semibold, color: colors.text }}>Edit</Text></Pressable> : null}
        <View style={{ flex: 1 }} />
        <Pressable onPress={onSend} disabled={sending} style={({ hovered }) => ({ paddingHorizontal: 18, height: 36, borderRadius: 18, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', transform: [{ scale: hovered ? 1.03 : 1 }] })}>
          <LinearGradient colors={gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          {sending ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="arrow-up" size={16} color="#fff" style={{ marginRight: 4 }} /><Text style={{ fontFamily: fonts.semibold, color: '#fff' }}>Send</Text></>}
        </Pressable>
      </View>
    </View>
  );
}

export function Composer({ onSendText, onSendMedia, onTyping, disabled, disabledText, replyTo, onCancelReply, onSoulmoji, soulmojiOpen, onTranslateText, onTranslateVoice, onSendTranslated, defaultTranslateTo }) {
  const [text, setText] = useState('');
  const [tr, setTr] = useState(null); // { to, output } while the translator is on
  const [trSetup, setTrSetup] = useState(false);
  const [trBusy, setTrBusy] = useState(false);
  const [trResult, setTrResult] = useState(null);
  const [trSending, setTrSending] = useState(false);
  const [trError, setTrError] = useState(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 250);
  const lastTyping = useRef(0);

  if (disabled) {
    return <View style={st.composerDisabled}><Text style={st.meta}>{disabledText}</Text></View>;
  }

  const change = (t) => {
    setText(t);
    const now = Date.now();
    if (t && now - lastTyping.current > 2500) { lastTyping.current = now; onTyping?.(); }
  };

  const runTranslate = async (fn) => {
    setTrBusy(true); setTrError(null); setTrResult(null);
    try { setTrResult(await fn()); } catch (e) { setTrError(e.message || 'Translation failed'); } finally { setTrBusy(false); }
  };

  const sendText = () => {
    const body = text.trim();
    if (!body) return;
    if (tr) {
      setText('');
      runTranslate(async () => ({ ...(await onTranslateText(body, tr.to, tr.output)), fromVoice: false }));
      return;
    }
    setText('');
    onSendText(body);
  };

  const sendTranslated = async () => {
    if (!trResult) return;
    setTrSending(true);
    try { await onSendTranslated(trResult); setTrResult(null); } catch (e) { setTrError(e.message); } finally { setTrSending(false); }
  };

  const pickPhoto = async (camera) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = camera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    const name = a.fileName || `photo-${Date.now()}.jpg`;
    const type = a.mimeType || (name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
    onSendMedia({ kind: 'image', uri: a.uri, name, type });
  };

  const startRecording = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) return;
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
    } catch { setRecording(false); }
  };

  const finishRecording = async (send) => {
    setBusy(true);
    try {
      const ms = recState.durationMillis;
      await recorder.stop();
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      setRecording(false);
      if (send && recorder.uri && ms > 700) {
        const isWeb = Platform.OS === 'web';
        const file = { kind: 'voice', uri: recorder.uri, name: `voice-${Date.now()}.${isWeb ? 'webm' : 'm4a'}`, type: isWeb ? 'audio/webm' : 'audio/m4a', durationMs: Math.round(ms) };
        // Translator on: what you said is written down, translated and shown before sending
        if (tr) runTranslate(async () => ({ ...(await onTranslateVoice(file, tr.to, tr.output)), fromVoice: true }));
        else onSendMedia(file);
      }
    } finally { setBusy(false); }
  };

  if (recording) {
    return (
      <View style={st.composer}>
        <Pressable onPress={() => finishRecording(false)} hitSlop={8} accessibilityLabel="Cancel recording" style={st.iconBtn}>
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
        </Pressable>
        <View style={[st.inputWrap, { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }]}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.spark, marginRight: 8 }} />
          <Text style={{ color: colors.text, fontFamily: fonts.medium, fontVariant: ['tabular-nums'] }}>Recording  {duration(recState.durationMillis)}</Text>
        </View>
        <SendButton onPress={() => finishRecording(true)} busy={busy} label={tr ? 'Translate voice message' : 'Send voice message'} />
      </View>
    );
  }

  const translatorUi = (
    <>
      {tr ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingTop: 8 }}>
          <Pressable onPress={() => setTrSetup(true)} style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 30, borderRadius: 15, borderWidth: 1, borderColor: hovered ? colors.aura : 'rgba(124,92,252,0.5)', backgroundColor: 'rgba(124,92,252,0.16)' })}>
            <Ionicons name="language" size={14} color={colors.aura} style={{ marginRight: 6 }} />
            <Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 12 }}>{`Sending in ${nativeName(tr.to)} · ${tr.output === 'voice' ? 'voice' : 'text'}`}</Text>
            <Ionicons name="chevron-down" size={13} color={colors.muted} style={{ marginLeft: 4 }} />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => { setTr(null); setTrResult(null); setTrError(null); }} hitSlop={10} accessibilityLabel="Turn translator off"><Ionicons name="close-circle" size={20} color={colors.muted} /></Pressable>
        </View>
      ) : null}
      {trBusy ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: space.md, marginTop: 6, padding: space.md, borderRadius: 16, backgroundColor: 'rgba(20,17,34,0.98)', borderWidth: 1, borderColor: colors.border }}>
          <ActivityIndicator color={colors.aura} size="small" />
          <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 13, marginLeft: 10, flex: 1 }}>{`Translating into ${langName(tr?.to)}${tr?.output === 'voice' ? ' and making the voice note' : ''}… this can take up to a minute on the laptop`}</Text>
        </View>
      ) : null}
      {trError ? <Text style={{ fontFamily: fonts.body, color: colors.danger, fontSize: 13, paddingHorizontal: space.lg, paddingTop: 6 }}>{trError}</Text> : null}
      {trResult ? (
        <View style={{ marginTop: 6 }}>
          <TranslatePreview result={trResult} sending={trSending} onSend={sendTranslated}
            onCancel={() => setTrResult(null)} onEdit={() => { setText(trResult.original); setTrResult(null); }} />
        </View>
      ) : null}
      <TranslateSetup visible={trSetup} value={tr || { to: defaultTranslateTo || 'en', output: 'text' }} onClose={() => setTrSetup(false)}
        onStart={(v) => { setTr(v); setTrSetup(false); setTrResult(null); setTrError(null); }}
        onStop={tr ? () => { setTr(null); setTrSetup(false); setTrResult(null); } : null} />
    </>
  );

  const hasText = text.trim().length > 0;
  return (
    <View>
    {replyTo ? (
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: 'rgba(14,12,22,0.96)' }}>
        <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: colors.aura, marginRight: 10 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.aura, fontFamily: fonts.semibold, fontSize: 12 }}>Replying to {replyTo.name}</Text>
          <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 13 }} numberOfLines={1}>{replyTo.text}</Text>
        </View>
        <Pressable onPress={onCancelReply} hitSlop={10} accessibilityLabel="Cancel reply"><Ionicons name="close" size={18} color={colors.muted} /></Pressable>
      </View>
    ) : null}
    {translatorUi}
    <View style={st.composer}>
      <Pressable onPress={() => pickPhoto(true)} hitSlop={6} accessibilityLabel="Take a photo" style={st.cameraBtn}>
        <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.cameraGrad}>
          <Ionicons name="camera" size={18} color="#fff" />
        </LinearGradient>
      </Pressable>
      <View style={st.inputWrap}>
        <TextInput
          value={text}
          onChangeText={change}
          placeholder={tr ? `Type in your language…` : 'Message…'}
          placeholderTextColor={colors.dim}
          multiline
          maxLength={2000}
          style={st.input}
          // Laptop keyboard: Enter sends, Shift+Enter makes a new line (phones keep their normal keyboard)
          onKeyPress={Platform.OS === 'web' ? (e) => {
            if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) { e.preventDefault(); if (text.trim()) sendText(); }
          } : undefined}
        />
      </View>
      {hasText ? (
        <SendButton onPress={sendText} busy={trBusy} label={tr ? 'Translate' : 'Send'} />
      ) : (
        <>
          <Pressable onPress={startRecording} hitSlop={6} accessibilityLabel="Record a voice message" style={st.iconBtn}>
            <Ionicons name="mic-outline" size={22} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => pickPhoto(false)} hitSlop={6} accessibilityLabel="Send a photo from your gallery" style={st.iconBtn}>
            <Ionicons name="image-outline" size={22} color={colors.text} />
          </Pressable>
          {onTranslateText ? (
            <Pressable onPress={() => setTrSetup(true)} hitSlop={6} accessibilityLabel="Translate my message" style={st.iconBtn}>
              <Ionicons name="language" size={22} color={tr ? colors.spark : colors.text} />
            </Pressable>
          ) : null}
          {/* Soulmoji takes the place of Instagram's sticker button */}
          <Pressable onPress={onSoulmoji} hitSlop={6} accessibilityLabel="Send a Soulmoji" style={st.iconBtn}>
            <MaterialCommunityIcons name="emoticon-excited-outline" size={24} color={soulmojiOpen ? colors.spark : colors.aura} />
          </Pressable>
        </>
      )}
    </View>
    </View>
  );
}

function SendButton({ onPress, busy, label }) {
  return (
    <Pressable onPress={onPress} disabled={busy} accessibilityLabel={label} style={{ marginLeft: 8 }}>
      <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.sendBtn}>
        {busy ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="arrow-up" size={20} color="#fff" />}
      </LinearGradient>
    </Pressable>
  );
}

export { clock };

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 10 },
  rowTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15, flexShrink: 1 },
  rowSub: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
  unread: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginLeft: space.sm },
  unreadText: { color: '#fff', fontFamily: fonts.bold, fontSize: 11 },

  msgRow: { flexDirection: 'row', paddingHorizontal: space.md, marginVertical: 2 },
  bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  bubbleMine: { borderBottomRightRadius: 6 },
  bubbleTheirs: { backgroundColor: 'rgba(33,31,48,0.95)', borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 6 },
  text: { color: colors.text, fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  textMine: { color: '#fff' },
  photo: { width: 220, height: 280, borderRadius: 18, backgroundColor: colors.card },
  deleted: { borderWidth: 1, borderColor: colors.border, backgroundColor: 'transparent' },
  deletedText: { color: colors.muted, fontFamily: fonts.body, fontStyle: 'italic', fontSize: 14 },
  senderName: { color: colors.muted, fontFamily: fonts.medium, fontSize: 11, marginBottom: 3, marginLeft: 4 },
  meta: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, marginTop: 3, marginHorizontal: 4 },
  system: { color: colors.muted, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', marginVertical: 10, paddingHorizontal: space.xl },
  dayWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, marginVertical: 12 },
  dayLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dayText: { color: colors.dim, fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', marginHorizontal: 10 },

  composer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: space.md, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: 'rgba(8,7,13,0.96)' },
  composerDisabled: { padding: space.lg, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border },
  cameraBtn: { marginRight: 8, marginBottom: 3 },
  cameraGrad: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  inputWrap: { flex: 1, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, borderRadius: 22, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
  input: { color: colors.text, fontFamily: fonts.body, fontSize: 15, maxHeight: 120, paddingVertical: 10, outlineStyle: 'none' },
  iconBtn: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
});
