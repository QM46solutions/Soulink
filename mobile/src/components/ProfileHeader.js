import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, gradients, space } from '../lib/theme';
import { Avatar } from './ui';

function Stat({ n, label, onPress }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color: colors.text, fontSize: 20, fontFamily: fonts.display }}>{n ?? 0}</Text>
      <Text style={{ color: colors.muted, fontSize: 10, fontFamily: fonts.medium, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 2 }}>{label}</Text>
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
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: border, backgroundColor: bg, margin: 3 }}>
      {icon ? <Ionicons name={icon} size={12} color={color} style={{ marginRight: 5 }} /> : null}
      <Text style={{ color, fontFamily: fonts.semibold, fontSize: 12 }}>{text}</Text>
    </View>
  );
}

/**
 * Profile top section, centred like the welcome screen: aura photo, name, badges, city, bio, interests,
 * then a glass row of Posts / Followers / Following, then the action buttons (full width, rounded).
 */
export default function ProfileHeader({ user, counts, canViewLists, actions, onAvatarPress }) {
  const openList = (type) => (canViewLists ? () => router.push({ pathname: '/follows/[id]', params: { id: user.id, type, username: user.username } }) : undefined);
  return (
    <View style={{ paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.lg, alignItems: 'center' }}>
      <Pressable onPress={onAvatarPress} disabled={!onAvatarPress} accessibilityLabel={onAvatarPress ? 'Change profile photo' : undefined}>
        <AuraAvatar user={user} size={112} />
        {onAvatarPress ? (
          <View style={{ position: 'absolute', right: 2, bottom: 2, backgroundColor: colors.spark, borderRadius: 16, padding: 7, borderWidth: 2, borderColor: colors.void }}>
            <Ionicons name="camera" size={15} color="#fff" />
          </View>
        ) : null}
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.md }}>
        <Text style={{ color: colors.text, fontFamily: fonts.displayBold, fontSize: 22, textAlign: 'center' }}>{user.displayName || user.username}</Text>
        {user.isPremium ? <Ionicons name="diamond" size={15} color={colors.gold} style={{ marginLeft: 6 }} /> : null}
      </View>
      <Text style={{ color: colors.muted, fontFamily: fonts.medium, fontSize: 14, marginTop: 2 }}>@{user.username}</Text>

      {user.verified || user.soulType ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: space.sm }}>
          {user.verified ? <Pill icon="shield-checkmark" text="Verified Real Soul" color={colors.mint} border="rgba(66,232,192,0.45)" bg="rgba(66,232,192,0.08)" /> : null}
          {user.soulType ? <Pill icon="sparkles" text={user.soulType} color={colors.aura} border="rgba(176,143,255,0.45)" bg="rgba(124,92,252,0.10)" /> : null}
        </View>
      ) : null}

      {user.city ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.sm }}>
          <Ionicons name="location-outline" size={13} color={colors.muted} style={{ marginRight: 4 }} />
          <Text style={{ color: colors.muted, fontSize: 13, fontFamily: fonts.body }}>{user.city}</Text>
        </View>
      ) : null}
      {user.bio ? <Text style={{ color: colors.text, fontSize: 15, lineHeight: 21, fontFamily: fonts.body, textAlign: 'center', marginTop: space.sm }}>{user.bio}</Text> : null}

      {user.interests?.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: space.sm }}>
          {user.interests.map((i) => <Pill key={i} text={i} color={colors.aura} border="rgba(124,92,252,0.4)" bg="rgba(124,92,252,0.08)" />)}
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', alignSelf: 'stretch', marginTop: space.lg, paddingVertical: space.md, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.glass }}>
        <Stat n={counts?.posts} label="Posts" />
        <View style={{ width: 1, backgroundColor: colors.border }} />
        <Stat n={counts?.followers} label="Followers" onPress={openList('followers')} />
        <View style={{ width: 1, backgroundColor: colors.border }} />
        <Stat n={counts?.following} label="Following" onPress={openList('following')} />
      </View>

      {actions ? <View style={{ flexDirection: 'row', alignSelf: 'stretch', gap: space.md, marginTop: space.lg }}>{actions}</View> : null}
    </View>
  );
}
