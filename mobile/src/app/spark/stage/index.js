// Open Mic: anyone speaks their mind (a story, an incident, society, politics, raising a voice...) on video or
// with just their voice; filter by topic, newest or most heard. Below: Stage Spots, real open mics in your city.
import { useCallback, useLayoutEffect, useState } from 'react';
import { Linking, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { confirm, notice } from '../../../lib/confirm';
import SparkCard from '../../../components/SparkCard';
import { Loading } from '../../../components/ui';
import { MIC_TOPICS } from '../../../lib/sparks';
import { GradBadge, GradButton, H, when } from '../../../components/SparkHub';
import { colors, fonts, space } from '../../../lib/theme';

const KIND = { any: '🎤 Open to all', comedy: '😂 Comedy', music: '🎶 Music', poetry: '📝 Poetry', acting: '🎭 Acting', dance: '💃 Dance' };
const openUrl = (u) => { if (Platform.OS === 'web') window.open(u, '_blank', 'noopener'); else Linking.openURL(u); };

function Spot({ s, onChange }) {
  const rsvp = async (kind) => { try { onChange((await api(`/sparks/stage/spots/${s.id}/rsvp`, { method: 'POST', body: { kind } })).spot); } catch (e) { notice('Oops', e.message); } };
  const del = async () => { if (await confirm('Remove this open mic?', undefined, { confirmText: 'Remove', destructive: true })) { await api(`/sparks/stage/spots/${s.id}`, { method: 'DELETE' }).catch(() => {}); onChange(null); } };
  const Btn = ({ k, label, n }) => {
    const on = s.myRsvp === k;
    return (
      <Pressable onPress={() => rsvp(k)} style={{ flex: 1, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
        borderColor: on ? colors.spark : 'rgba(176,143,255,0.3)', backgroundColor: on ? 'rgba(255,107,157,0.18)' : 'transparent' }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.text }}>{on ? '✓ ' : ''}{label} · {n}</Text>
      </Pressable>
    );
  };
  return (
    <View style={{ marginBottom: space.md, padding: space.lg, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(176,143,255,0.22)', backgroundColor: 'rgba(26,24,40,0.78)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 16, color: colors.text }}>{s.title}</Text>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.gold, marginTop: 2 }}>{when(s.startsAt)}</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 }}>📍 {s.venue}, {s.city} · {KIND[s.kind] || KIND.any}</Text>
          {s.note ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.text, marginTop: 6, lineHeight: 19 }}>{s.note}</Text> : null}
        </View>
        {s.mine ? <Pressable onPress={del} hitSlop={10}><Ionicons name="trash-outline" size={18} color={colors.muted} /></Pressable> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: space.md }}>
        <Btn k="going" label="I'm going" n={s.going} />
        <Btn k="perform" label="I'll perform" n={s.performing} />
        <Pressable onPress={() => openUrl(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.venue}, ${s.city}`)}`)} style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: 'rgba(176,143,255,0.3)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="navigate" size={16} color={colors.aura} />
        </Pressable>
        {s.link ? (
          <Pressable onPress={() => openUrl(s.link)} style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: 'rgba(176,143,255,0.3)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="open-outline" size={16} color={colors.aura} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function Chips({ items, value, onChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg, gap: 8 }}>
      {items.map(([k, label]) => {
        const on = value === k;
        return (
          <Pressable key={k || 'all'} onPress={() => onChange(k)} accessibilityRole="button" accessibilityState={{ selected: on }}
            style={({ hovered }) => ({ paddingHorizontal: 14, height: 34, borderRadius: 17, justifyContent: 'center', borderWidth: 1.5,
              borderColor: on ? colors.gold : hovered ? colors.aura : 'rgba(176,143,255,0.3)', backgroundColor: on ? 'rgba(245,200,66,0.14)' : 'transparent' })}>
            <Text style={{ fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 13, color: on ? colors.text : colors.muted }}>{label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function Stage() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [city, setCity] = useState((user.city || '').split(',')[0]);
  const [topic, setTopic] = useState(null);
  const [sort, setSort] = useState('latest');
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  useLayoutEffect(() => { navigation.setOptions({ title: 'Open Mic' }); }, [navigation]);
  const load = useCallback(async (o = {}) => {
    const t = o.topic !== undefined ? o.topic : topic; const so = o.sort || sort; const c = o.city !== undefined ? o.city : city;
    const qs = [t ? `topic=${t}` : null, `sort=${so}`, c.trim() ? `city=${encodeURIComponent(c.trim())}` : null].filter(Boolean).join('&');
    try { setData(await api(`/sparks/mic?${qs}`)); } catch { setData((d) => d || { posts: [], spots: [] }); }
  }, [topic, sort, city]);
  useFocusEffect(useCallback(() => { load(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return <Loading />;
  const setSpot = (id, s) => setData((d) => ({ ...d, spots: s ? d.spots.map((x) => (x.id === id ? s : x)) : d.spots.filter((x) => x.id !== id) }));
  const pickTopic = (t) => { setTopic(t); load({ topic: t }); };
  const pickSort = (so) => { setSort(so); load({ sort: so }); };
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 60 }} refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.aura} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <View style={{ margin: space.lg, padding: space.xl, borderRadius: 24, overflow: 'hidden' }}>
        <LinearGradient colors={['rgba(245,200,66,0.32)', 'rgba(255,107,157,0.3)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <GradBadge icon="microphone-variant" size={46} colors={['#f5c842', '#ff6b9d']} />
          <Text style={{ marginLeft: space.md, fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.2, color: colors.gold }}>OPEN MIC</Text>
        </View>
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 24, color: colors.text, marginTop: space.md }}>Speak your mind</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted, marginTop: 4 }}>Something you went through, something you saw, or something you want to raise your voice about. On video, or with just your voice.</Text>
        <GradButton title="Take the mic" icon="microphone" onPress={() => router.push('/spark/speak')} style={{ marginTop: space.lg }} />
      </View>

      <Chips items={[[null, 'All'], ...MIC_TOPICS.map((t) => [t.key, `${t.emoji} ${t.label}`])]} value={topic} onChange={pickTopic} />
      <View style={{ flexDirection: 'row', paddingHorizontal: space.lg, marginTop: space.md, gap: 8 }}>
        {[['latest', 'Newest'], ['top', 'Most heard this month']].map(([k, label]) => (
          <Text key={k} onPress={() => pickSort(k)} style={{ fontFamily: sort === k ? fonts.semibold : fonts.medium, fontSize: 13, color: sort === k ? colors.text : colors.dim,
            paddingVertical: 4, borderBottomWidth: 2, borderBottomColor: sort === k ? colors.gold : 'transparent' }}>{label}</Text>
        ))}
      </View>
      <View style={{ height: space.md }} />
      {data.posts.length ? data.posts.map((s) => <SparkCard key={s.id} spark={s} onDeleted={() => load()} />) : (
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, textAlign: 'center', padding: space.xl }}>
          {topic ? 'Nobody has spoken about this yet.' : 'Nobody has taken the mic yet.'} Be the first.
        </Text>
      )}

      <View style={{ paddingHorizontal: space.lg }}>
        <H>Stage Spots · open mics near you</H>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.md }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: 42, borderRadius: 21, paddingHorizontal: 14, backgroundColor: 'rgba(38,35,56,0.96)' }}>
            <Ionicons name="location-outline" size={16} color={colors.aura} />
            <TextInput value={city} onChangeText={setCity} onSubmitEditing={() => load({ city })} onBlur={() => load({ city })} placeholder="Any city" placeholderTextColor={colors.dim}
              style={{ flex: 1, marginLeft: 6, color: colors.text, fontFamily: fonts.body, fontSize: 14, outlineStyle: 'none' }} />
          </View>
          <Pressable onPress={() => router.push('/spark/stage/new')} style={{ marginLeft: 8, height: 42, paddingHorizontal: 14, borderRadius: 21, borderWidth: 1.5, borderColor: colors.aura, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="add" size={18} color={colors.aura} /><Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 13 }}>Add one</Text>
          </Pressable>
        </View>
        {data.spots.length ? data.spots.map((s) => <Spot key={s.id} s={s} onChange={(x) => setSpot(s.id, x)} />) : (
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: space.lg }}>No open mics listed{city.trim() ? ` in ${city.trim()}` : ''} yet. Know one? Add it.</Text>
        )}
      </View>
    </ScrollView>
  );
}
