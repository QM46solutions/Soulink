// Anonymous messages (between Connections, shown in Chats): the masked avatar, inbox row and "reveals in" countdown.
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from './ui';
import { colors, fonts, gradients, space } from '../lib/theme';

/** "6d 23h", "5h 10m", "a moment" until the sender's name is shown. */
export function revealIn(iso, now = Date.now()) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 60_000) return 'a moment';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

/** The hidden person: a masked face in the Soulink gradient ring. */
export function MaskAvatar({ size = 52 }) {
  return (
    <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size / 2, padding: 2 }}>
      <View style={{ flex: 1, borderRadius: size / 2, backgroundColor: '#1d1830', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="eye-off" size={size * 0.42} color={colors.aura} />
      </View>
    </LinearGradient>
  );
}

const ago = (iso) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

/** Title shown for a thread: the hidden alias, or the real person once revealed / for the sender. */
export function threadTitle(t) {
  if (t.role === 'sender') return t.other?.displayName || t.other?.username || 'Someone';
  return t.revealed ? t.other?.displayName || t.other?.username : t.alias;
}

export const AnonRow = memo(function AnonRow({ thread: t, onPress }) {
  const showReal = t.role === 'sender' || t.revealed;
  const lm = t.lastMessage;
  const status = t.role === 'sender'
    ? (t.revealed ? 'They can see it was you' : `You're anonymous · shown in ${revealIn(t.revealAt)}`)
    : (t.revealed ? `Was "${t.alias}"` : `Name shows in ${revealIn(t.revealAt)}`);
  return (
    <Pressable onPress={onPress} style={({ pressed, hovered }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, paddingVertical: space.md, backgroundColor: pressed || hovered ? 'rgba(124,92,252,0.08)' : 'transparent' })}>
      {showReal && t.other ? <Avatar uri={t.other.avatarUrl} size={52} name={t.other.displayName || t.other.username} /> : <MaskAvatar />}
      <View style={{ flex: 1, marginLeft: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: t.unread ? fonts.bold : fonts.semibold, color: t.unread ? '#fff' : colors.text, fontSize: 15 }}>{threadTitle(t)}</Text>
          {t.role === 'sender' ? <Ionicons name="eye-off-outline" size={13} color={colors.aura} style={{ marginLeft: 6 }} /> : null}
        </View>
        <Text numberOfLines={1} style={{ fontFamily: t.unread ? fonts.semibold : fonts.body, color: t.unread ? colors.text : colors.muted, fontSize: 13, marginTop: 2 }}>
          {lm ? `${lm.mine ? 'You: ' : ''}${lm.body}` : ''}
          {lm ? <Text style={{ color: colors.dim }}>{`  ·  ${ago(lm.createdAt)}`}</Text> : null}
        </Text>
        <Text numberOfLines={1} style={{ fontFamily: fonts.medium, color: t.revealed ? colors.mint : colors.aura, fontSize: 11, marginTop: 3 }}>{status}</Text>
      </View>
      {t.unread ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.spark, marginLeft: space.sm }} /> : null}
    </Pressable>
  );
});
