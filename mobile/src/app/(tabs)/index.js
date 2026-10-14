// Home. Step 1 for every new person: create your Soul DNA (connecting is locked until then).
// After that: posts from your connections, newest first, or a clear "no connections yet" state.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, FlatList, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import NotificationBell from '../../components/NotificationBell';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import PostCard from '../../components/PostCard';
import { FeedAd } from '../../components/AdCards';
import { useAds, withAds } from '../../lib/ads';
import MomentsBar from '../../components/MomentsBar';
import { AuraAvatar } from '../../components/ProfileHeader';
import { useAuth } from '../../lib/auth';
import { Button } from '../../components/ui';
import { GlassCard } from '../../components/brand';
import { colors, fonts, gradients, space } from '../../lib/theme';
import { LiveFrame, RadarIcon, SoulDnaIcon } from '../../components/LiveIcons';

function CenterCard({ icon, live, title, text, children }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: space.xl }}>
      <GlassCard style={{ alignItems: 'center', padding: space.xl }}>
        {live ? <LiveFrame size={170}>{live}</LiveFrame> : (
          <View style={{ width: 88, height: 88, borderRadius: 44, borderWidth: 1.5, borderColor: 'rgba(176,143,255,0.5)', backgroundColor: 'rgba(124,92,252,0.12)', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name={icon} size={44} color={colors.aura} />
          </View>
        )}
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 28, color: colors.text, textAlign: 'center', marginTop: space.lg }}>{title}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.muted, textAlign: 'center', marginTop: space.sm }}>{text}</Text>
        <View style={{ alignSelf: 'stretch', marginTop: space.xl }}>{children}</View>
      </GlassCard>
    </View>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [feed, setFeed] = useState(null);
  const ads = useAds('feed', 4);
  const [refreshing, setRefreshing] = useState(false);
  const first = user.displayName?.split(' ')[0] || user.username;
  const [moments, setMoments] = useState(null);
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({
      // no "+" here: new Moments start from the + on your own circle in the Moments row
      headerRight: () => <NotificationBell />, // notifications live here, only on Home
    });
  }, [navigation, user.soulReady]);
  // Moments row (stories) on top; friends' profile posts below
  const composer = <MomentsBar me={user} groups={moments} />;

  const load = useCallback(async () => {
    api('/moments/feed').then((m) => setMoments(m.groups)).catch(() => {});
    try { setFeed(await api('/feed')); } catch { setFeed((f) => f || { connections: 0, posts: [] }); }
  }, []);
  useFocusEffect(useCallback(() => { if (user.soulReady) load(); }, [user.soulReady, load]));

  if (!user.soulReady) {
    return (
      <CenterCard icon="dna" live={<SoulDnaIcon size={140} />} title={`Welcome, ${first}! One last step`} text={user.soulType ? "Soul DNA got a big upgrade: it now understands your values, nature, thinking and loyalty. Retake it to see your matches again." : "Create your Soul DNA to unlock connections. One quiz in short sections, about 10 minutes. It's how Soulink finds people who truly match you."}>
        <Button title={user.soulType ? 'Retake Soul DNA' : 'Create my Soul DNA'} onPress={() => router.push('/soul')} />
      </CenterCard>
    );
  }

  if (!feed) return null;

  if (!feed.posts.length) {
    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: space.md }} refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.aura} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        {composer}
        {feed.connections === 0 ? (
      <CenterCard icon="account-heart-outline" live={<RadarIcon size={140} />} title="No connections yet" text={`You're ${user.soulType ? `${user.soulType}. ` : ''}Now find your people: friends you know, or new souls who match your vibe.`}>
        <Button title="Make connections" onPress={() => router.push('/discover')} />
        <Button title="Search people you know" variant="secondary" style={{ marginTop: space.md }} onPress={() => router.push('/search')} />
      </CenterCard>
    ) : (
      <CenterCard icon="image-multiple-outline" title="No posts yet" text="Share a Moment with your people, or add a post on your profile.">
        <Button title="Share a Moment" icon="sparkles" onPress={() => router.push('/moment/new')} />
        <Button title="Find more people" variant="secondary" style={{ marginTop: space.md }} onPress={() => router.push('/discover')} />
      </CenterCard>
        )}
      </ScrollView>
    );
  }

  return (
    <FlatList
      data={withAds(feed.posts, ads, 4)}
      keyExtractor={(p) => p.key || p.id}
      renderItem={({ item }) => item.__ad ? <FeedAd ad={item.__ad} /> : <PostCard post={item} onDeleted={(pid) => setFeed((f) => ({ ...f, posts: f.posts.filter((x) => x.id !== pid) }))} />}
      ListHeaderComponent={composer}
      contentContainerStyle={{ paddingTop: space.md, paddingBottom: space.xxl }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.aura} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    />
  );
}
