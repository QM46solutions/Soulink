import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, gradients, space } from '../lib/theme';
import { Avatar, VerifiedBadge } from './ui';

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

export default function ProfileHeader({ user, counts, canViewLists, actions }) {
  const openList = (type) => (canViewLists ? () => router.push({ pathname: '/follows/[id]', params: { id: user.id, type, username: user.username } }) : undefined);
  return (
    <View style={{ padding: space.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <AuraAvatar user={user} />
        <View style={{ flex: 1, flexDirection: 'row', marginLeft: space.md }}>
          <Stat n={counts?.posts} label="Posts" />
          <Stat n={counts?.followers} label="Followers" onPress={openList('followers')} />
          <Stat n={counts?.following} label="Following" onPress={openList('following')} />
        </View>
      </View>
      <View style={{ marginTop: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: colors.text, fontFamily: fonts.displayBold, fontSize: 18 }}>{user.displayName}</Text>
          {user.verified ? <VerifiedBadge size={16} /> : null}
          {user.isPremium ? <Ionicons name="diamond" size={14} color={colors.gold} style={{ marginLeft: 6 }} /> : null}
        </View>
        {user.verified || user.soulType ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
            {user.verified ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(66,232,192,0.45)', backgroundColor: 'rgba(66,232,192,0.08)', marginRight: 6, marginBottom: 4 }}>
                <Ionicons name="shield-checkmark" size={12} color={colors.mint} style={{ marginRight: 4 }} />
                <Text style={{ color: colors.mint, fontFamily: fonts.semibold, fontSize: 11 }}>Verified Real Soul</Text>
              </View>
            ) : null}
            {user.soulType ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(176,143,255,0.45)', backgroundColor: 'rgba(124,92,252,0.10)', marginBottom: 4 }}>
                <Ionicons name="sparkles" size={12} color={colors.aura} style={{ marginRight: 4 }} />
                <Text style={{ color: colors.aura, fontFamily: fonts.semibold, fontSize: 11 }}>{user.soulType}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {user.city ? (
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2, fontFamily: fonts.body }}>
            <Ionicons name="location-outline" size={12} /> {user.city}
          </Text>
        ) : null}
        {user.bio ? <Text style={{ color: colors.text, fontSize: 14, marginTop: space.sm, lineHeight: 20, fontFamily: fonts.body }}>{user.bio}</Text> : null}
        {user.interests?.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm }}>
            {user.interests.map((i) => (
              <View key={i} style={{ borderWidth: 1, borderColor: 'rgba(124,92,252,0.4)', backgroundColor: 'rgba(124,92,252,0.1)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6, marginBottom: 6 }}>
                <Text style={{ color: colors.aura, fontSize: 12, fontFamily: fonts.medium }}>{i}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {actions ? <View style={{ flexDirection: 'row', marginTop: space.lg, gap: space.sm }}>{actions}</View> : null}
    </View>
  );
}
