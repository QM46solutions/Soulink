import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, gradients, space } from '../lib/theme';
import { Avatar } from './ui';
import PulseMeter, { PulseInfo } from './PulseMeter';

// Phones set to a large text size: profile text grows a little, never enough to push the page apart
const MAX_FS = 1.15;

// Count under the name: big number with a small label
function Stat({ n, label, onPress }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ hovered }) => ({ flex: 1, alignItems: 'center', opacity: hovered ? 0.8 : 1 })}>
      <Text maxFontSizeMultiplier={MAX_FS} style={{ color: colors.text, fontSize: 18, lineHeight: 22, fontFamily: fonts.bold, textAlign: 'center' }}>{n ?? 0}</Text>
      <Text maxFontSizeMultiplier={MAX_FS} numberOfLines={1} style={{ color: colors.muted, fontSize: 12, lineHeight: 16, fontFamily: fonts.medium, textAlign: 'center', marginTop: 1 }}>{label}</Text>
    </Pressable>
  );
}

/** Profile button: primary = Soulink gradient; otherwise frosted glass with a thin lilac edge and a lilac icon. */
export function ProfileAction({ title, onPress, primary, icon, disabled, loading, style }) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} accessibilityRole="button" accessibilityLabel={title || undefined}
      style={({ hovered, pressed }) => [{ flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0, height: 46, paddingHorizontal: 10, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
        borderWidth: primary ? 0 : 1, borderColor: hovered ? 'rgba(176,143,255,0.75)' : 'rgba(176,143,255,0.32)',
        backgroundColor: primary ? colors.soul : hovered ? 'rgba(124,92,252,0.16)' : 'rgba(255,255,255,0.06)', opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}>
      {primary ? <LinearGradient colors={gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} /> : null}
      {icon ? <Ionicons name={icon} size={18} color={primary ? '#fff' : colors.aura} style={{ marginRight: title ? 6 : 0 }} /> : null}
      {title ? <Text maxFontSizeMultiplier={MAX_FS} numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15, letterSpacing: 0.1, color: primary ? '#fff' : colors.text, flexShrink: 1 }}>{loading ? '…' : title}</Text> : null}
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
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 26, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: border, backgroundColor: bg, marginRight: 6 }}>
      {icon ? <Ionicons name={icon} size={12} color={color} style={{ marginRight: 5 }} /> : null}
      <Text maxFontSizeMultiplier={MAX_FS} numberOfLines={1} style={{ color, fontFamily: fonts.semibold, fontSize: 12 }}>{text}</Text>
    </View>
  );
}

/** One line of small facts with their own icons (city · college · company); slides sideways if it's long. */
function InfoLine({ items }) {
  if (!items.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8, flexGrow: 0 }} contentContainerStyle={{ alignItems: 'center' }}>
      {items.map(([icon, text], k) => (
        <View key={icon + text} style={{ flexDirection: 'row', alignItems: 'center', marginRight: k < items.length - 1 ? 14 : 0 }}>
          <Ionicons name={icon} size={14} color={colors.muted} style={{ marginRight: 4 }} />
          <Text maxFontSizeMultiplier={MAX_FS} numberOfLines={1} style={{ color: colors.muted, fontSize: 13, fontFamily: fonts.medium }}>{text}</Text>
        </View>
      ))}
    </ScrollView>
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
      {/* soft cover glow behind the top row */}
      <LinearGradient pointerEvents="none" colors={['rgba(124,92,252,0.22)', 'rgba(255,107,157,0.07)', 'rgba(8,7,13,0)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 170 }} />
      {/* one line: photo · name · Pulse meter, all centred on the same middle line */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.lg }}>
        <Pressable onPress={onAvatarPress} disabled={!onAvatarPress} accessibilityLabel={onAvatarPress ? 'Change profile photo' : undefined}>
          <AuraAvatar user={user} size={80} />
          {onAvatarPress ? (
            <View style={{ position: 'absolute', right: 0, bottom: 0, borderRadius: 13, overflow: 'hidden', padding: 4, borderWidth: 2, borderColor: colors.void }}>
              <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <Ionicons name="add" size={14} color="#fff" />
            </View>
          ) : null}
        </Pressable>
        <View style={{ flex: 1, marginHorizontal: space.md, minWidth: 0, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text maxFontSizeMultiplier={MAX_FS} numberOfLines={2} style={{ color: colors.text, fontFamily: fonts.displayBold, fontSize: 20, lineHeight: 25, flexShrink: 1 }}>{user.displayName || user.username}</Text>
            {user.isPremium ? <Ionicons name="diamond" size={13} color={colors.gold} style={{ marginLeft: 5 }} /> : null}
          </View>
          <Text maxFontSizeMultiplier={MAX_FS} numberOfLines={1} style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, marginTop: 2 }}>@{user.username}</Text>
        </View>
        {pulse ? <PulseMeter pulse={pulse} size={78} onPress={() => setPulseOpen((o) => !o)} /> : null}
      </View>

      {pulse && pulseOpen ? <View style={{ paddingHorizontal: space.lg }}><PulseInfo pulse={pulse} isMe={isMe} name={(user.displayName || user.username || '').split(' ')[0]} onClose={() => setPulseOpen(false)} /></View> : null}
      <View style={{ paddingHorizontal: space.lg }}>
        {user.profession || user.isCreator ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: space.md }}>
            {user.profession ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8, marginBottom: 4, flexShrink: 1 }}>
                <Ionicons name="briefcase" size={15} color={colors.aura} style={{ marginRight: 6 }} />
                <Text maxFontSizeMultiplier={MAX_FS} numberOfLines={1} style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 15, flexShrink: 1 }}>{user.profession}</Text>
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

        {user.bio ? <Text maxFontSizeMultiplier={MAX_FS} numberOfLines={4} style={{ color: colors.text, fontSize: 14, lineHeight: 19, fontFamily: fonts.body, marginTop: user.profession || user.isCreator ? 2 : space.md }}>{user.bio}</Text> : null}
        {/* visitors only (your own page stays clean): where they are, then Soul type + interests on ONE line that slides sideways */}
        {!isMe ? <InfoLine items={[['location-outline', user.city], ['school-outline', user.college], ['briefcase-outline', user.company]].filter(([, t]) => t)} /> : null}
        {user.soulType || (!isMe && user.interests?.length) ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, flexGrow: 0 }}>
            {user.soulType ? (
              <Pressable disabled={!isMe} onPress={() => router.push('/soul')} accessibilityLabel={isMe ? 'Open my Soul DNA' : undefined}>
                <Pill icon="sparkles" text={user.soulType} color={colors.aura} border="rgba(176,143,255,0.55)" bg="rgba(124,92,252,0.16)" />
              </Pressable>
            ) : null}
            {!isMe ? (user.interests || []).map((i) => <Pill key={i} text={i} color={colors.text} border="rgba(176,143,255,0.22)" bg="rgba(255,255,255,0.05)" />) : null}
          </ScrollView>
        ) : null}

        {/* counts: three equal columns, number centred over its label, thin dividers between */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.md, paddingVertical: 10, borderRadius: 16,
          backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(176,143,255,0.14)' }}>
          {/* Connections: both connected. Requests: waiting for their answer (only you open the list). Followers: everyone connected to them */}
          <Stat n={counts?.connections} label="Connections" onPress={openList('connections')} />
          <View style={{ width: 1, height: 28, backgroundColor: 'rgba(176,143,255,0.18)' }} />
          <Stat n={counts?.requests} label="Requests" onPress={isMe ? () => router.push('/activity') : undefined} />
          <View style={{ width: 1, height: 28, backgroundColor: 'rgba(176,143,255,0.18)' }} />
          <Stat n={counts?.followers} label="Followers" onPress={openList('followers')} />
        </View>

        {actions ? <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>{actions}</View> : null}
      </View>
    </View>
  );
}

/** Posts | Moments tabs under the profile header (someone else's profile adds a Soul Score tab) */
const DEFAULT_TABS = [['posts', 'Posts'], ['moments', 'Moments']];
export function ProfileTabs({ tab, onChange, items = DEFAULT_TABS }) {
  return (
    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, marginTop: space.xs }}>
      {items.map(([k, label]) => {
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
