// Home. Step 1 for every new person: create your Soul DNA (connecting is locked until then).
// After that: posts from your connections, newest first, or a clear "no connections yet" state.
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api, mediaUrl } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Avatar, Button, VerifiedBadge } from '../../components/ui';
import { GlassCard } from '../../components/brand';
import { colors, fonts, space } from '../../lib/theme';

function CenterCard({ icon, title, text, children }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: space.xl }}>
      <GlassCard style={{ alignItems: 'center', padding: space.xl }}>
        <View style={{ width: 88, height: 88, borderRadius: 44, borderWidth: 1.5, borderColor: 'rgba(176,143,255,0.5)', backgroundColor: 'rgba(124,92,252,0.12)', alignItems: 'center', justifyContent: 'center' }}>
          <MaterialCommunityIcons name={icon} size={44} color={colors.aura} />
        </View>
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 28, color: colors.text, textAlign: 'center', marginTop: space.lg }}>{title}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.muted, textAlign: 'center', marginTop: space.sm }}>{text}</Text>
        <View style={{ alignSelf: 'stretch', marginTop: space.xl }}>{children}</View>
      </GlassCard>
    </View>
  );
}

function PostCard({ post }) {
  const img = post.media?.[0];
  return (
    <View style={{ marginBottom: space.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, marginBottom: space.sm }}>
        <Avatar uri={post.author.avatarUrl} name={post.author.displayName} size={36} />
        <Text style={{ fontFamily: fonts.semibold, color: colors.text, marginLeft: space.sm }}>{post.author.username}</Text>
        {post.author.verified ? <VerifiedBadge /> : null}
      </View>
      {img ? <Image source={{ uri: mediaUrl(img) }} style={{ width: '100%', aspectRatio: 1, backgroundColor: colors.card }} contentFit="cover" /> : null}
      {post.caption ? <Text style={{ fontFamily: fonts.body, color: colors.text, paddingHorizontal: space.xl, marginTop: space.sm }}>{post.caption}</Text> : null}
    </View>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [feed, setFeed] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const first = user.displayName?.split(' ')[0] || user.username;

  const load = useCallback(async () => {
    try { setFeed(await api('/feed')); } catch { setFeed((f) => f || { connections: 0, posts: [] }); }
  }, []);
  useFocusEffect(useCallback(() => { if (user.soulReady) load(); }, [user.soulReady, load]));

  if (!user.soulReady) {
    return (
      <CenterCard icon="dna" title={`Welcome, ${first}! One last step`} text="Create your Soul DNA to unlock connections. 10 quick, fun questions and about 2 minutes. It's how Soulink finds people who match your vibe.">
        <Button title="Create my Soul DNA" onPress={() => router.push('/soul')} />
      </CenterCard>
    );
  }

  if (!feed) return null;

  if (!feed.posts.length) {
    return feed.connections === 0 ? (
      <CenterCard icon="account-heart-outline" title="No connections yet" text={`You're ${user.soulType ? `${user.soulType}. ` : ''}Now find your people: friends you know, or new souls who match your vibe.`}>
        <Button title="Make connections" onPress={() => router.push('/discover')} />
        <Button title="Search people you know" variant="secondary" style={{ marginTop: space.md }} onPress={() => router.push('/search')} />
      </CenterCard>
    ) : (
      <CenterCard icon="image-multiple-outline" title="No posts yet" text="Your connections haven't posted anything yet. New posts will show up here.">
        <Button title="Find more people" variant="secondary" onPress={() => router.push('/discover')} />
      </CenterCard>
    );
  }

  return (
    <FlatList
      data={feed.posts}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => <PostCard post={item} />}
      contentContainerStyle={{ paddingTop: space.md, paddingBottom: space.xxl }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.aura} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    />
  );
}
