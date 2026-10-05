import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, gradients, space } from '../lib/theme';
import { Avatar } from './ui';

// Instagram-style stat: bold number over a small label, sitting to the right of the photo
function Stat({ n, label, onPress }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ hovered }) => ({ alignItems: 'center', flex: 1, opacity: hovered ? 0.8 : 1 })}>
      <Text style={{ color: colors.text, fontSize: 18, fontFamily: fonts.bold }}>{n ?? 0}</Text>
      <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontFamily: fonts.body, marginTop: 1 }}>{label}</Text>
    </Pressable>
  );
}

/** Compact Instagram-size profile button (34 pt tall, rounded corners). primary = Soulink gradient. */
export function ProfileAction({ title, onPress, primary, icon, disabled, loading, style }) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} accessibilityRole="button"
      style={({ hovered, pressed }) => [{ flex: 1, height: 34, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
        backgroundColor: primary ? colors.soul : hovered ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.1)', opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        transform: [{ scale: hovered && !disabled ? 1.02 : 1 }] }, style]}>
      {primary ? <LinearGradient colors={gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} /> : null}
      {icon ? <Ionicons name={icon} size={15} color={colors.text} style={{ marginRight: title ? 5 : 0 }} /> : null}
      {title ? <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 14, color: primary ? '#fff' : colors.text }}>{loading ? '…' : title}</Text> : null}
    </Pressable>
  );
}

/** Avatar inside a purple→pink gradient ring (the Soulink "aura"). */
export function AuraAvatar({ user, size = 84 }) {
  return (
    <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 2.5, borderRadius: size }}>
      <View style={{ padding: 2.5, borderRadius: size, backgroundColor: colors.void }}>
        <Avatar uri={user.avatarUrl} size={size - 10} name={user.displayName || user.username} />
      </View>
    </LinearGradient>
  );
}

function Pill({ icon, text, color, border, bg }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: border, backgroundColor: bg, margin: 3 }}>
      {icon ? <Ionicons name={icon} size={12} color={color} style={{ marginRight: 5 }} /> : null}
      <Text style={{ color, fontFamily: fonts.semibold, fontSize: 11.5 }}>{text}</Text>
    </View>
  );
}

/**
 * Profile top section, Instagram layout: photo on the left with Posts / Soul Connections beside it,
 * then name, badges, city, bio and interests (left-aligned), then compact action buttons.
 */
export default function ProfileHeader({ user, counts, canViewLists, actions, onAvatarPress, isMe }) {
  // Your own page stays clean: area and interests are shown to visitors, and you edit them in Edit profile
  const openList = (type) => (canViewLists ? () => router.push({ pathname: '/follows/[id]', params: { id: user.id, type, username: user.username } }) : undefined);
  return (
    <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={onAvatarPress} disabled={!onAvatarPress} accessibilityLabel={onAvatarPress ? 'Change profile photo' : undefined}>
          <AuraAvatar user={user} size={90} />
          {onAvatarPress ? (
            <View style={{ position: 'absolute', right: 0, bottom: 0, backgroundColor: colors.spark, borderRadius: 13, padding: 5, borderWidth: 2, borderColor: colors.void }}>
              <Ionicons name="add" size={13} color="#fff" />
            </View>
          ) : null}
        </Pressable>
        <View style={{ flex: 1, flexDirection: 'row', marginLeft: space.lg }}>
          {isMe
            ? <Stat n={counts?.requests} label="Soul Requests" onPress={() => router.push('/connections/requests')} />
            : <Stat n={counts?.posts} label="Posts" />}
          <Stat n={counts?.connections} label="Soul Connections" onPress={openList('connections')} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.md }}>
        <Text style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 15 }}>{user.displayName || user.username}</Text>
        {user.isPremium ? <Ionicons name="diamond" size={13} color={colors.gold} style={{ marginLeft: 5 }} /> : null}
      </View>

      {user.verified || user.soulType ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, marginLeft: -3 }}>
          {user.verified ? <Pill icon="shield-checkmark" text="Verified Real Soul" color={colors.mint} border="rgba(66,232,192,0.45)" bg="rgba(66,232,192,0.08)" /> : null}
          {user.soulType ? <Pill icon="sparkles" text={user.soulType} color={colors.aura} border="rgba(176,143,255,0.45)" bg="rgba(124,92,252,0.10)" /> : null}
        </View>
      ) : null}
      {user.bio ? <Text style={{ color: colors.text, fontSize: 14, lineHeight: 19, fontFamily: fonts.body, marginTop: 4 }}>{user.bio}</Text> : null}
      {!isMe && (user.city || user.college || user.company) ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <Ionicons name="location-outline" size={13} color={colors.muted} style={{ marginRight: 3 }} />
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 13, fontFamily: fonts.body, flexShrink: 1 }}>{[user.city, user.college, user.company].filter(Boolean).join('  ·  ')}</Text>
        </View>
      ) : null}
      {!isMe && user.interests?.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, marginLeft: -3 }}>
          {user.interests.map((i) => <Pill key={i} text={i} color={colors.aura} border="rgba(124,92,252,0.4)" bg="rgba(124,92,252,0.08)" />)}
        </View>
      ) : null}

      {actions ? <View style={{ flexDirection: 'row', gap: 6, marginTop: space.md }}>{actions}</View> : null}
    </View>
  );
}
