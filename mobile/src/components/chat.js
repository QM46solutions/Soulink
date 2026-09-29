// Chat building blocks: group avatar, inbox row, message bubbles (text, photo, voice, system),
// typing dots and the composer (text, photo, voice note).
import { memo, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { mediaUrl } from '../lib/api';
import { colors, fonts, gradients, radius, space } from '../lib/theme';
import { ago, clock, duration } from '../lib/time';
import { Avatar, VerifiedBadge } from './ui';

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

export const MessageBubble = memo(function MessageBubble({ message, mine, showSender, showName, sender, status, onLongPress, onOpenImage }) {
  if (message.kind === 'system') return <SystemMessage text={message.body} />;
  let content;
  if (message.deleted) {
    content = (
      <View style={[st.bubble, st.deleted]}>
        <Text style={st.deletedText}>{mine ? 'You unsent a message' : 'Message unsent'}</Text>
      </View>
    );
  } else if (message.kind === 'image') {
    content = (
      <Pressable onPress={() => onOpenImage?.(message)} onLongPress={onLongPress}>
        <Image source={{ uri: mediaUrl(message.mediaUrl) || message.localUri }} style={st.photo} contentFit="cover" transition={150} />
        {message.body ? <BubbleShell mine={mine} style={{ marginTop: 4 }}><Text style={[st.text, mine && st.textMine]}>{message.body}</Text></BubbleShell> : null}
      </Pressable>
    );
  } else if (message.kind === 'voice') {
    content = (
      <Pressable onLongPress={onLongPress}>
        <BubbleShell mine={mine}><VoiceNote message={message} mine={mine} /></BubbleShell>
      </Pressable>
    );
  } else {
    content = (
      <Pressable onLongPress={onLongPress}>
        <BubbleShell mine={mine}><Text style={[st.text, mine && st.textMine]}>{message.body}</Text></BubbleShell>
      </Pressable>
    );
  }
  return (
    <View style={[st.msgRow, mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
      {!mine && showSender !== undefined ? (
        <View style={{ width: 30, marginRight: 6, alignSelf: 'flex-end' }}>{showSender ? <Avatar uri={sender?.avatarUrl} size={28} name={sender?.displayName || sender?.username} /> : null}</View>
      ) : null}
      <View style={{ maxWidth: '78%', alignItems: mine ? 'flex-end' : 'flex-start' }}>
        {!mine && showName && sender ? <Text style={st.senderName}>{sender.displayName || sender.username}</Text> : null}
        {content}
        {status === 'sending' ? <Text style={st.meta}>Sending…</Text> : null}
        {status === 'failed' ? <Text style={[st.meta, { color: colors.danger }]}>Not sent. Tap and hold to retry.</Text> : null}
      </View>
    </View>
  );
});

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

export function Composer({ onSendText, onSendMedia, onTyping, disabled, disabledText }) {
  const [text, setText] = useState('');
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

  const sendText = () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    onSendText(body);
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
        onSendMedia({ kind: 'voice', uri: recorder.uri, name: `voice-${Date.now()}.${isWeb ? 'webm' : 'm4a'}`, type: isWeb ? 'audio/webm' : 'audio/m4a', durationMs: Math.round(ms) });
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
        <SendButton onPress={() => finishRecording(true)} busy={busy} label="Send voice message" />
      </View>
    );
  }

  const hasText = text.trim().length > 0;
  return (
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
          placeholder="Message…"
          placeholderTextColor={colors.dim}
          multiline
          maxLength={2000}
          style={st.input}
        />
      </View>
      {hasText ? (
        <SendButton onPress={sendText} label="Send" />
      ) : (
        <>
          <Pressable onPress={startRecording} hitSlop={6} accessibilityLabel="Record a voice message" style={st.iconBtn}>
            <Ionicons name="mic-outline" size={22} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => pickPhoto(false)} hitSlop={6} accessibilityLabel="Send a photo from your gallery" style={st.iconBtn}>
            <Ionicons name="image-outline" size={22} color={colors.text} />
          </Pressable>
        </>
      )}
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
