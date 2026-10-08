// Open Mic Stage: this week's theme (perform it as a Spark; the most-loved ones top the board) and
// Stage Spots: real open mics in your city — "I'm going" / "I'll perform".
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

export default function Stage() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [city, setCity] = useState((user.city || '').split(',')[0]);
  const [data, setData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  useLayoutEffect(() => { navigation.setOptions({ title: 'Open Mic Stage' }); }, [navigation]);
  const load = useCallback(async (c = city) => {
    try { setData(await api(`/sparks/stage${c.trim() ? `?city=${encodeURIComponent(c.trim())}` : ''}`)); } catch { setData((d) => d || { top: [], spots: [] }); }
  }, [city]);
  useFocusEffect(useCallback(() => { load(); }, [])); // eslint-disable-line react-hooks/exhaustive-deps
  if (!data) return <Loading />;
  const setSpot = (id, s) => setData((d) => ({ ...d, spots: s ? d.spots.map((x) => (x.id === id ? s : x)) : d.spots.filter((x) => x.id !== id) }));
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 60 }} refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.aura} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <View style={{ margin: space.lg, padding: space.xl, borderRadius: 24, overflow: 'hidden' }}>
        <LinearGradient colors={['rgba(124,92,252,0.45)', 'rgba(255,107,157,0.3)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <GradBadge icon="microphone-variant" size={46} colors={['#f5c842', '#ff6b9d']} />
          <Text style={{ marginLeft: space.md, fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.2, color: colors.gold }}>THIS WEEK ON STAGE</Text>
        </View>
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 24, color: colors.text, marginTop: space.md }}>{data.theme?.title}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted, marginTop: 4 }}>{data.theme?.line}. The most-loved performances top the board.</Text>
        <GradButton title="Perform on stage" icon="microphone" onPress={() => router.push({ pathname: '/spark/new', params: { stage: '1' } })} style={{ marginTop: space.lg }} />
      </View>

      <View style={{ paddingHorizontal: space.lg }}>
        <H>Stage Spots · open mics near you</H>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.md }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: 42, borderRadius: 21, paddingHorizontal: 14, backgroundColor: 'rgba(38,35,56,0.96)' }}>
            <Ionicons name="location-outline" size={16} color={colors.aura} />
            <TextInput value={city} onChangeText={setCity} onSubmitEditing={() => load(city)} onBlur={() => load(city)} placeholder="Any city" placeholderTextColor={colors.dim}
              style={{ flex: 1, marginLeft: 6, color: colors.text, fontFamily: fonts.body, fontSize: 14, outlineStyle: 'none' }} />
          </View>
          <Pressable onPress={() => router.push('/spark/stage/new')} style={{ marginLeft: 8, height: 42, paddingHorizontal: 14, borderRadius: 21, borderWidth: 1.5, borderColor: colors.aura, flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="add" size={18} color={colors.aura} /><Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 13 }}>Add one</Text>
          </Pressable>
        </View>
        {data.spots.length ? data.spots.map((s) => <Spot key={s.id} s={s} onChange={(x) => setSpot(s.id, x)} />) : (
          <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: space.lg }}>No open mics listed{city.trim() ? ` in ${city.trim()}` : ''} yet. Know one? Add it.</Text>
        )}
        <H>{`Top performances this week · ${data.top.length}`}</H>
      </View>
      {data.top.length ? data.top.map((s, i) => (
        <View key={s.id}>
          <Text style={{ fontFamily: fonts.bold, color: i === 0 ? colors.gold : colors.muted, fontSize: 13, marginLeft: space.lg, marginBottom: 4 }}>{i === 0 ? '🏆 #1' : `#${i + 1}`}</Text>
          <SparkCard spark={s} onDeleted={() => load()} />
        </View>
      )) : <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, textAlign: 'center', paddingVertical: space.lg }}>No one has performed yet this week. Take the stage first.</Text>}
    </ScrollView>
  );
}
