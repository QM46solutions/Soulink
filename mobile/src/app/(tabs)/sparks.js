// Sparks 🎬 tab: everyone's short videos, newest first. Filter by category; the + posts your own Spark.
import { useCallback, useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { ALL_CAT, CATEGORIES } from '../../lib/sparks';
import SparkCatBadge from '../../components/SparkCatBadge';
import { GradBadge } from '../../components/SparkHub';
import SparkCard from '../../components/SparkCard';
import { SparkAd } from '../../components/AdCards';
import { useAds, withAds } from '../../lib/ads';
import { GradientText } from '../../components/brand';
import { Button, Empty, Loading } from '../../components/ui';
import { colors, fonts, gradients, space } from '../../lib/theme';

export default function Sparks() {
  const navigation = useNavigation();
  const [cat, setCat] = useState(null); // null = all
  const [list, setList] = useState(null);
  const ads = useAds('sparks', 4);
  const [more, setMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => <GradientText style={{ fontFamily: fonts.display, fontSize: 22, letterSpacing: -0.5 }}>Sparks</GradientText>,
      // no back arrow here: the + to post sits where the back arrow was
      headerRight: () => null,
      headerLeft: () => (
        <Pressable onPress={() => router.push('/spark/new')} hitSlop={10} style={{ marginLeft: 16 }} accessibilityLabel="Post a Spark">
          <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add" size={22} color="#fff" />
          </LinearGradient>
        </Pressable>
      ),
    });
  }, [navigation]);

  const load = useCallback(async (category = cat) => {
    try { const r = await api(`/sparks${category ? `?category=${category}` : ''}`); setList(r.sparks); setMore(r.hasMore); } catch { setList((l) => l || []); }
  }, [cat]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const loadMore = async () => {
    if (!more || !list?.length) return;
    const last = list[list.length - 1].createdAt;
    try { const r = await api(`/sparks?${cat ? `category=${cat}&` : ''}before=${encodeURIComponent(last)}`); setList((l) => [...l, ...r.sparks]); setMore(r.hasMore); } catch { /* try later */ }
  };
  const choose = (k) => { setCat(k); setList(null); load(k); };

  // Casting Board and Open Mic Stage, right above the categories
  const Feature = ({ icon, title, text, c, to }) => (
    <Pressable onPress={() => router.push(to)} style={({ hovered, pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 18, borderWidth: 1,
      borderColor: hovered ? colors.aura : 'rgba(176,143,255,0.25)', backgroundColor: 'rgba(26,24,40,0.8)', transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <GradBadge icon={icon} size={40} colors={c} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.text }}>{title}</Text>
        <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 11.5, color: colors.muted }}>{text}</Text>
      </View>
    </Pressable>
  );
  const features = (
    <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: space.md, paddingTop: space.sm }}>
      <Feature icon="drama-masks" title="Casting Board" text="Audition for roles" c={['#7c5cfc', '#ff6b9d']} to="/spark/casting" />
      <Feature icon="microphone-variant" title="Open Mic" text="This week's stage" c={['#f5c842', '#ff6b9d']} to="/spark/stage" />
    </View>
  );

  const chips = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.md, paddingVertical: space.sm, gap: 8 }}>
      {[ALL_CAT, ...CATEGORIES].map((c) => {
        const on = cat === c.key;
        return (
          <Pressable key={c.label} onPress={() => choose(c.key)} style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', paddingLeft: 4, paddingRight: 14, height: 38, borderRadius: 999, borderWidth: 1.5,
            borderColor: on ? c.colors[0] : hovered ? colors.aura : colors.border, backgroundColor: on ? `${c.colors[0]}2e` : 'rgba(26,24,40,0.6)' })}>
            <SparkCatBadge cat={c} size={28} glow={on} />
            <Text style={{ marginLeft: 8, fontFamily: on ? fonts.bold : fonts.semibold, fontSize: 13, color: on ? colors.text : colors.muted }}>{c.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  return (
    <FlatList
      data={list?.length ? withAds(list, ads, 5, 3) : list && ads[0] ? [{ __ad: ads[0], key: 'ad-0' }] : []}
      keyExtractor={(s) => s.key || s.id}
      ListHeaderComponent={<>{features}{chips}</>}
      renderItem={({ item }) => item.__ad ? <SparkAd ad={item.__ad} /> : <SparkCard spark={item} onDeleted={(id) => setList((l) => l.filter((x) => x.id !== id))} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.6}
      contentContainerStyle={{ paddingBottom: space.xxl, flexGrow: 1 }}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.aura} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      ListEmptyComponent={list ? (
        <Empty icon="film-outline" title={cat ? 'No Sparks here yet' : 'No Sparks yet'} text="Travel, cooking, acting, fitness and news: short videos from the people around you.">
          <Button title="Post the first Spark 🎬" onPress={() => router.push('/spark/new')} style={{ marginTop: space.lg }} />
        </Empty>
      ) : <Loading />}
    />
  );
}
