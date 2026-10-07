import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, gradients, space } from '../lib/theme';
import { Avatar } from './ui';
import PulseMeter, { PulseInfo } from './PulseMeter';

// Count under the name: big number with a small label
function Stat({ n, label, onPress }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ hovered }) => ({ alignItems: 'flex-start', flexShrink: 0, marginRight: 16, opacity: hovered ? 0.8 : 1 })}>
      <Text style={{ color: colors.text, fontSize: 20, lineHeight: 24, fontFamily: fonts.bold }}>{n ?? 0}</Text>
      <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12.5, lineHeight: 16, fontFamily: fonts.medium }}>{label}</Text>
    </Pressable>
  );
}

/** Rounded profile button (42 pt pill). primary = Soulink gradient, outline = white ring. */
export function ProfileAction({ title, onPress, primary, outline, icon, disabled, loading, style }) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} accessibilityRole="button"
      style={({ hovered, pressed }) => [{ flex: 1, height: 42, borderRadius: 21, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
        borderWidth: outline ? 2 : 0, borderColor: hovered ? colors.aura : colors.text,
        backgroundColor: primary ? colors.soul : outline ? 'rgba(255,255,255,0.04)' : hovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.13)', opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        transform: [{ scale: hovered && !disabled ? 1.02 : 1 }] }, style]}>
      {primary ? <LinearGradient colors={gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} /> : null}
      {icon ? <Ionicons name={icon} size={17} color={colors.text} style={{ marginRight: title ? 6 : 0 }} /> : null}
      {title ? <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15, color: primary ? '#fff' : colors.text }}>{loading ? '…' : title}</Text> : null}
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
 * Profile top section (Snapchat-style): a soft gradient band with the Pulse meter, the photo on the left with the
 * name (big), @username and the counts beside it; profession + content creator under the photo; then bio and
 * the two rounded buttons. The Posts / Moments tabs come after this (ProfileTabs).
 */
export default function ProfileHeader({ user, counts, canViewLists, actions, onAvatarPress, isMe, pulse }) {
  const [pulseOpen, setPulseOpen] = useState(false);
  // Your own page stays clean: area and interests are shown to visitors, and you edit them in Edit profile
  const openList = (type) => (canViewLists ? () => router.push({ pathname: '/follows/[id]', params: { id: user.id, type, username: user.username } }) : undefined);
  return (
    <View style={{ paddingBottom: space.md }}>
      {/* the band at the top: dark gradient like a cover, Pulse meter on the right */}
      <View style={{ height: pulse ? 142 : 64, justifyContent: 'flex-start', alignItems: 'flex-end', paddingRight: space.lg, paddingTop: 8 }}>
        <LinearGradient colors={['rgba(124,92,252,0.30)', 'rgba(255,107,157,0.10)', 'rgba(8,7,13,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        {pulse ? <PulseMeter pulse={pulse} size={104} onPress={() => setPulseOpen((o) => !o)} /> : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, marginTop: pulse ? -42 : -28 }}>
        <Pressable onPress={onAvatarPress} disabled={!onAvatarPress} accessibilityLabel={onAvatarPress ? 'Change profile photo' : undefined}>
          <AuraAvatar user={user} size={104} />
          {onAvatarPress ? (
            <View style={{ position: 'absolute', right: 2, bottom: 2, borderRadius: 15, overflow: 'hidden', padding: 5, borderWidth: 2, borderColor: colors.void }}>
              <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <Ionicons name="add" size={16} color="#fff" />
            </View>
          ) : null}
        </Pressable>
        <View style={{ flex: 1, marginLeft: space.md, paddingTop: 34 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text numberOfLines={1} style={{ color: colors.text, fontFamily: fonts.displayBold, fontSize: 23, lineHeight: 28, flexShrink: 1 }}>{user.displayName || user.username}</Text>
            {user.isPremium ? <Ionicons name="diamond" size={15} color={colors.gold} style={{ marginLeft: 6 }} /> : null}
          </View>
          <Text numberOfLines={1} style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 13, marginTop: 1 }}>@{user.username}</Text>
          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            {/* Connections: both connected. Requests: waiting for their answer (only you open the list). Followers: everyone connected to them */}
            <Stat n={counts?.connections} label="Connections" onPress={openList('connections')} />
            <Stat n={counts?.requests} label="Requests" onPress={isMe ? () => router.push('/activity') : undefined} />
            <Stat n={counts?.followers} label="Followers" onPress={openList('followers')} />
          </View>
        </View>
      </View>

      {pulse && pulseOpen ? <View style={{ paddingHorizontal: space.lg }}><PulseInfo pulse={pulse} isMe={isMe} name={(user.displayName || user.username || '').split(' ')[0]} onClose={() => setPulseOpen(false)} /></View> : null}
      <View style={{ paddingHorizontal: space.lg }}>
        {user.profession || user.isCreator ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: space.md }}>
            {user.profession ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8, marginBottom: 4, flexShrink: 1 }}>
                <Ionicons name="briefcase" size={15} color={colors.aura} style={{ marginRight: 6 }} />
                <Text numberOfLines={1} style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 15, flexShrink: 1 }}>{user.profession}</Text>
              </View>
            ) : null}
            {user.isCreator ? (
              <View style={{ borderRadius: 999, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 4, marginBottom: 4, flexDirection: 'row', alignItems: 'center' }}>
                <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                <Ionicons name="videocam" size={12} color="#fff" style={{ marginRight: 5 }} />
                <Text style={{ color: '#fff', fontFamily: fonts.semibold, fontSize: 12 }}>Content creator</Text>
              </View>
            ) : null}
          </View>
        ) : isMe ? (
          <Text onPress={() => router.push('/edit-profile')} style={{ color: colors.aura, fontFamily: fonts.semibold, fontSize: 13.5, marginTop: space.md }}>+ Add your profession</Text>
        ) : null}

        {user.soulType ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, marginLeft: -3 }}>
            <Pressable disabled={!isMe} onPress={() => router.push('/soul')} accessibilityLabel={isMe ? 'Open my Soul DNA' : undefined}>
              <Pill icon="sparkles" text={user.soulType} color={colors.aura} border="rgba(176,143,255,0.45)" bg="rgba(124,92,252,0.10)" />
            </Pressable>
          </View>
        ) : null}
        {user.bio ? <Text style={{ color: colors.text, fontSize: 14, lineHeight: 19, fontFamily: fonts.body, marginTop: 6 }}>{user.bio}</Text> : null}
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

        {actions ? <View style={{ flexDirection: 'row', gap: 10, marginTop: space.md }}>{actions}</View> : null}
      </View>
    </View>
  );
}

/** Posts | Moments tabs under the profile header */
export function ProfileTabs({ tab, onChange }) {
  return (
    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, marginTop: space.xs }}>
      {[['posts', 'Posts'], ['moments', 'Moments']].map(([k, label]) => {
        const on = tab === k;
        return (
          <Pressable key={k} onPress={() => onChange(k)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={({ hovered }) => ({ flex: 1, alignItems: 'center', paddingTop: 12, opacity: hovered && !on ? 0.85 : 1 })}>
            <Text style={{ fontFamily: on ? fonts.bold : fonts.semibold, fontSize: 16, color: on ? colors.text : colors.dim, paddingBottom: 10 }}>{label}</Text>
            <View style={{ height: 3, width: '60%', borderRadius: 2, overflow: 'hidden' }}>
              {on ? <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
