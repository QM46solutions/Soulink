// Home. Step 1 for every new person: create your Soul DNA (connecting is locked until then).
// After that: posts from your connections, newest first, or a clear "no connections yet" state.
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import PostCard from '../../components/PostCard';
import { AuraAvatar } from '../../components/ProfileHeader';
import { useAuth } from '../../lib/auth';
import { Button } from '../../components/ui';
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

// "Share a moment" bar at the top of Home: tap the text to write, or Photo / Camera to start with pictures
function Composer({ user }) {
  const first = user.displayName?.split(' ')[0] || user.username;
  const btn = (icon, label, color, pick) => (
    <Pressable key={label} onPress={() => router.push(pick ? `/create-post?pick=${pick}` : '/create-post')} accessibilityLabel={label}
      style={({ hovered }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 40, borderRadius: 999, marginHorizontal: 3, backgroundColor: hovered ? 'rgba(124,92,252,0.18)' : 'transparent' })}>
      <Ionicons name={icon} size={18} color={color} style={{ marginRight: 6 }} />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ marginHorizontal: space.lg, marginBottom: space.lg, padding: space.md, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.glass }}>
      <Pressable onPress={() => router.push('/create-post')} style={{ flexDirection: 'row', alignItems: 'center' }}>
        <AuraAvatar user={user} size={44} />
        <View style={{ flex: 1, height: 44, marginLeft: space.md, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, justifyContent: 'center', paddingHorizontal: space.lg }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 14.5, color: colors.muted }}>Share a moment, {first}…</Text>
        </View>
      </Pressable>
      <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space.md }} />
      <View style={{ flexDirection: 'row' }}>
        {btn('images', 'Photo', colors.mint, 'gallery')}
        {btn('camera', 'Camera', colors.spark, 'camera')}
        {btn('create', 'Write', colors.aura, null)}
      </View>
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
    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: space.md }} refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.aura} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <Composer user={user} />
        {feed.connections === 0 ? (
      <CenterCard icon="account-heart-outline" title="No connections yet" text={`You're ${user.soulType ? `${user.soulType}. ` : ''}Now find your people: friends you know, or new souls who match your vibe.`}>
        <Button title="Make connections" onPress={() => router.push('/discover')} />
        <Button title="Search people you know" variant="secondary" style={{ marginTop: space.md }} onPress={() => router.push('/search')} />
      </CenterCard>
    ) : (
      <CenterCard icon="image-multiple-outline" title="No posts yet" text="Be the first! Share a photo or a thought with your Soul Connections.">
        <Button title="Share a photo" icon="images" onPress={() => router.push('/create-post?pick=gallery')} />
        <Button title="Find more people" variant="secondary" style={{ marginTop: space.md }} onPress={() => router.push('/discover')} />
      </CenterCard>
        )}
      </ScrollView>
    );
  }

  return (
    <FlatList
      data={feed.posts}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => <PostCard post={item} onDeleted={(pid) => setFeed((f) => ({ ...f, posts: f.posts.filter((x) => x.id !== pid) }))} />}
      ListHeaderComponent={<Composer user={user} />}
      contentContainerStyle={{ paddingTop: space.md, paddingBottom: space.xxl }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.aura} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    />
  );
}
