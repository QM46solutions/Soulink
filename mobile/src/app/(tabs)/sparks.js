// Sparks 🎬 tab: everyone's short videos, newest first, full screen like Reels.
// Swipe up / down for the next Spark; the one on screen plays by itself. Category chips float at the top,
// Casting Board and Open Mic are in the header, and the + posts your own Spark (it then shows first).
// The header switch flips to a List view (YouTube style: scroll freely, each video with its own controls).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FlatList, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { ALL_CAT, CASTING_CAT, CATEGORIES, OPENMIC_CAT } from '../../lib/sparks';
import SparkCatBadge from '../../components/SparkCatBadge';
import SparkCard from '../../components/SparkCard';
import { SparkAd } from '../../components/AdCards';
import { useAds, withAds } from '../../lib/ads';
import { GradientText } from '../../components/brand';
import { Button, Empty, Loading } from '../../components/ui';
import { colors, fonts, gradients, space } from '../../lib/theme';

const web = Platform.OS === 'web';
const MAX_W = 520; // on a laptop the feed stays phone-shaped, centred

export default function Sparks() {
  const navigation = useNavigation();
  const [cat, setCat] = useState(null); // null = all
  const [list, setList] = useState(null);
  const ads = useAds('sparks', 4);
  const [more, setMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pageH, setPageH] = useState(0);
  const [page, setPage] = useState(0); // which full-screen page is showing: that Spark plays
  const listRef = useRef(null);
  const [mode, setMode] = useState('reels'); // 'reels' | 'list' (remembered on this phone)
  useEffect(() => { AsyncStorage.getItem('soulink.sparksView').then((v) => { if (v === 'list' || v === 'reels') setMode(v); }).catch(() => {}); }, []);
  const switchMode = useCallback(() => setMode((m) => { const n = m === 'reels' ? 'list' : 'reels'; AsyncStorage.setItem('soulink.sparksView', n).catch(() => {}); return n; }), []);
  const firstId = useRef(null);

  useLayoutEffect(() => {
    const HeadBtn = ({ icon, label, to, onPress }) => (
      <Pressable onPress={onPress || (() => router.push(to))} hitSlop={8} accessibilityLabel={label} style={({ hovered }) => ({ marginLeft: 6, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: hovered ? 'rgba(124,92,252,0.18)' : 'transparent' })}>
        <MaterialCommunityIcons name={icon} size={21} color={colors.text} />
      </Pressable>
    );
    navigation.setOptions({
      headerTitle: () => <GradientText style={{ fontFamily: fonts.display, fontSize: 22, letterSpacing: -0.5 }}>Sparks</GradientText>,
      headerRight: () => (
        <View style={{ flexDirection: 'row', marginRight: 10 }}>
          <HeadBtn icon={mode === 'reels' ? 'view-agenda-outline' : 'cellphone-play'} label={mode === 'reels' ? 'Switch to list view' : 'Switch to full-screen view'} onPress={switchMode} />
          <HeadBtn icon="drama-masks" label="Casting Board: audition for roles" to="/spark/casting" />
          <HeadBtn icon="microphone-variant" label="Open Mic: speak your mind" to="/spark/stage" />
        </View>
      ),
      // the + to post sits where the back arrow was
      headerLeft: () => (
        <Pressable onPress={() => router.push('/spark/new')} hitSlop={10} style={{ marginLeft: 16 }} accessibilityLabel="Post a Spark">
          <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add" size={22} color="#fff" />
          </LinearGradient>
        </Pressable>
      ),
    });
  }, [navigation, mode, switchMode]);

  // Casting Call (auditions) and Open Mic have their own chips, after the categories
  const query = (k) => (k === 'casting' ? 'section=casting&' : k ? `category=${k}&` : '');
  const load = useCallback(async (category = cat) => {
    try {
      const r = await api(`/sparks?${query(category)}`);
      setList(r.sparks); setMore(r.hasMore);
      // something new at the top (e.g. the Spark you just posted): jump back to it so it plays first
      const top = r.sparks[0]?.id || null;
      if (top && top !== firstId.current) { listRef.current?.scrollToOffset?.({ offset: 0, animated: false }); setPage(0); }
      firstId.current = top;
    } catch { setList((l) => l || []); }
  }, [cat]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const loadMore = async () => {
    if (!more || !list?.length) return;
    const last = list[list.length - 1].createdAt;
    try { const r = await api(`/sparks?${query(cat)}before=${encodeURIComponent(last)}`); setList((l) => [...l, ...r.sparks]); setMore(r.hasMore); } catch { /* try later */ }
  };
  const choose = (k) => { setCat(k); setList(null); setPage(0); firstId.current = null; load(k); };

  const chips = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.md, paddingVertical: 8, gap: 8 }}>
      {[ALL_CAT, ...CATEGORIES, CASTING_CAT, OPENMIC_CAT].map((c) => {
        const on = cat === c.key;
        return (
          <Pressable key={c.label} onPress={() => choose(c.key)} style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', paddingLeft: 3, paddingRight: 12, height: 32, borderRadius: 999, borderWidth: 1.5,
            borderColor: on ? c.colors[0] : hovered ? colors.aura : 'rgba(255,255,255,0.22)', backgroundColor: on ? `${c.colors[0]}55` : 'rgba(8,7,13,0.55)' })}>
            <SparkCatBadge cat={c} size={24} glow={on} />
            <Text style={{ marginLeft: 6, fontFamily: on ? fonts.bold : fonts.semibold, fontSize: 12.5, color: '#fff' }}>{c.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  // the page the feed has settled on (worked out from the scroll position) is the Spark that plays
  const onScroll = (e) => { if (!pageH) return; const p = Math.round(e.nativeEvent.contentOffset.y / pageH); setPage((old) => (old === p ? old : p)); };
  const data = list?.length ? withAds(list, ads, 5, 3) : list && ads[0] ? [{ __ad: ads[0], key: 'ad-0' }] : [];

  // List view (YouTube style): scroll freely; the Spark at least half on screen may play, each has its own controls
  const [listOn, setListOn] = useState(null);
  const listViewable = useRef(({ viewableItems }) => setListOn(viewableItems[0]?.key || null)).current;
  const listViewConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;
  if (mode === 'list') {
    return (
      <View style={{ flex: 1, width: '100%', maxWidth: web ? 640 : undefined, alignSelf: 'center' }}>
        <FlatList
          data={data}
          keyExtractor={(s) => s.key || s.id}
          ListHeaderComponent={chips}
          renderItem={({ item }) => (item.__ad ? <SparkAd ad={item.__ad} />
            : <SparkCard spark={item} active={listOn === item.id} onDeleted={(id) => setList((l) => l.filter((x) => x.id !== id))} />)}
          onViewableItemsChanged={listViewable}
          viewabilityConfig={listViewConfig}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          contentContainerStyle={{ paddingBottom: space.xxl, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.aura} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          ListEmptyComponent={list ? <Empty icon="film-outline" title={cat ? 'No Sparks here yet' : 'No Sparks yet'} text="Travel, cooking, acting, fitness and news: short videos from the people around you." /> : <Loading />}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }} onLayout={(e) => setPageH(Math.round(e.nativeEvent.layout.height))}>
      <View style={{ flex: 1, width: '100%', maxWidth: web ? MAX_W : undefined, alignSelf: 'center' }}>
        {pageH ? (
          <FlatList
            ref={listRef}
            data={data}
            keyExtractor={(s) => s.key || s.id}
            renderItem={({ item, index }) => (item.__ad
              ? <View style={{ height: pageH, justifyContent: 'center' }}><SparkAd ad={item.__ad} /></View>
              : <SparkCard spark={item} variant="reel" height={pageH} active={index === page} onDeleted={(id) => setList((l) => l.filter((x) => x.id !== id))} />)}
            pagingEnabled
            snapToInterval={pageH}
            snapToAlignment="start"
            decelerationRate="fast"
            disableIntervalMomentum
            showsVerticalScrollIndicator={false}
            getItemLayout={(_, i) => ({ length: pageH, offset: pageH * i, index: i })}
            onScroll={onScroll}
            scrollEventThrottle={100}
            extraData={page}
            onEndReached={loadMore}
            onEndReachedThreshold={1.5}
            windowSize={3}
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            removeClippedSubviews={!web}
            contentContainerStyle={{ flexGrow: 1 }}
            refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.aura} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
            ListEmptyComponent={list ? (
              <View style={{ height: pageH, justifyContent: 'center', backgroundColor: colors.bg }}>
                <Empty icon="film-outline" title={cat ? 'No Sparks here yet' : 'No Sparks yet'}
                  text={cat === 'casting' ? 'Auditions for Casting Board roles show here. Pick a role and audition.' : cat === 'openmic' ? 'Open Mic videos and voice notes show here. Say what you want to say.' : 'Travel, cooking, acting, fitness and news: short videos from the people around you.'}>
                  <Button title={cat === 'casting' ? 'See the Casting Board 🎭' : cat === 'openmic' ? 'Go to Open Mic 🎤' : 'Post the first Spark 🎬'} onPress={() => router.push(cat === 'casting' ? '/spark/casting' : cat === 'openmic' ? '/spark/stage' : '/spark/new')} style={{ marginTop: space.lg }} />
                </Empty>
              </View>
            ) : <View style={{ height: pageH, justifyContent: 'center' }}><Loading /></View>}
          />
        ) : null}
        {/* categories float over the top of the videos */}
        <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
          <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 70 }} />
          {chips}
        </View>
      </View>
    </View>
  );
}
