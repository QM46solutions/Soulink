// Spread around 📣: show your Spark to more people for 1, 3 or 7 days, picked by city and age.
// Spread Sparks appear between other people's Sparks with a small "Spread" label. (Real payments open once a payment gateway is set up.)
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { BottomSheet } from './PostSheets';
import { colors, fonts, gradients, space } from '../lib/theme';

const AGES = [[18, 24], [18, 34], [25, 44], [18, 60]];
const daysLeft = (iso) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));

function Choice({ on, onPress, title, sub, wide }) {
  return (
    <Pressable onPress={onPress} style={{ flex: wide ? undefined : 1, minWidth: wide ? '47%' : undefined, margin: 4, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1.5,
      borderColor: on ? colors.spark : colors.border, backgroundColor: on ? 'rgba(255,107,157,0.14)' : 'rgba(255,255,255,0.04)', alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.bold, color: colors.text, fontSize: 15 }}>{title}</Text>
      {sub ? <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 11.5, marginTop: 2, textAlign: 'center' }}>{sub}</Text> : null}
    </Pressable>
  );
}
const Head = ({ children }) => <Text style={{ fontFamily: fonts.semibold, color: colors.muted, fontSize: 12.5, marginTop: space.lg, marginBottom: 4, marginLeft: 4 }}>{children}</Text>;

export default function SpreadSheet({ visible, onClose, spark, onChanged }) {
  const [info, setInfo] = useState(null);
  const [status, setStatus] = useState(undefined);
  const [days, setDays] = useState(3);
  const [city, setCity] = useState('all');
  const [ages, setAges] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!visible) return;
    setError(null); setStatus(undefined);
    api('/sparks/spread/plans').then(setInfo).catch(() => setInfo({ plans: [{ days: 1, priceInr: 49 }, { days: 3, priceInr: 129 }, { days: 7, priceInr: 249 }], available: false }));
    api(`/sparks/${spark.id}/spread`).then(setStatus).catch(() => setStatus({ spread: null }));
  }, [visible, spark.id]);
  const plan = info?.plans?.find((p) => p.days === days);
  const start = async () => {
    setBusy(true); setError(null);
    try {
      const [ageMin, ageMax] = AGES[ages];
      const r = await api(`/sparks/${spark.id}/spread`, { method: 'POST', body: { days, city, ageMin, ageMax } });
      setStatus((s) => ({ ...(s || {}), spread: r.spread })); onChanged?.(r.spread);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const stop = async () => {
    setBusy(true);
    try { await api(`/sparks/${spark.id}/spread/stop`, { method: 'POST' }); setStatus((s) => ({ ...(s || {}), spread: null })); onChanged?.(null); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const sp = status?.spread;
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Spread around">
      <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ padding: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            <LinearGradient colors={['#ff6b9d', '#f5c842']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <MaterialCommunityIcons name="bullhorn-variant" size={22} color="#fff" />
          </View>
          <Text style={{ flex: 1, marginLeft: space.md, fontFamily: fonts.body, color: colors.muted, fontSize: 13, lineHeight: 18 }}>
            Show this Spark to more people who don't follow you yet. It appears between their Sparks with a small "Spread" label.
          </Text>
        </View>

        {status === undefined ? <ActivityIndicator color={colors.aura} style={{ marginTop: space.xl }} /> : sp ? (
          <View style={{ marginTop: space.lg, padding: space.lg, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(66,232,192,0.4)', backgroundColor: 'rgba(66,232,192,0.08)' }}>
            <Text style={{ fontFamily: fonts.bold, color: colors.mint, fontSize: 16 }}>Spreading · {daysLeft(sp.endsAt)} {daysLeft(sp.endsAt) === 1 ? 'day' : 'days'} left</Text>
            <Text style={{ fontFamily: fonts.body, color: colors.text, fontSize: 13.5, marginTop: 6 }}>
              {sp.city ? `In ${sp.city}` : 'All of India'} · ages {sp.ageMin}–{sp.ageMax} · {sp.days}-day plan{sp.test ? ' (test, free)' : ` · ₹${sp.priceInr}`}
            </Text>
            <View style={{ flexDirection: 'row', marginTop: space.md }}>
              <View style={{ flex: 1 }}><Text style={{ fontFamily: fonts.displayBold, color: colors.text, fontSize: 22 }}>{sp.impressions}</Text><Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12 }}>times shown</Text></View>
              <View style={{ flex: 1 }}><Text style={{ fontFamily: fonts.displayBold, color: colors.text, fontSize: 22 }}>{status.views ?? 0}</Text><Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12 }}>views in all</Text></View>
            </View>
            <Pressable onPress={stop} disabled={busy} style={{ marginTop: space.md, alignSelf: 'flex-start' }}><Text style={{ fontFamily: fonts.semibold, color: colors.danger, fontSize: 13.5 }}>Stop spreading</Text></Pressable>
          </View>
        ) : (
          <>
            <Head>How long</Head>
            <View style={{ flexDirection: 'row', marginHorizontal: -4 }}>
              {(info?.plans || []).map((p) => <Choice key={p.days} on={days === p.days} onPress={() => setDays(p.days)} title={`₹${p.priceInr}`} sub={`${p.days} ${p.days === 1 ? 'day' : 'days'}${p.reach ? ` · ${p.reach}` : ''}`} />)}
            </View>
            <Head>Where</Head>
            <View style={{ flexDirection: 'row', marginHorizontal: -4 }}>
              <Choice on={city === 'all'} onPress={() => setCity('all')} title="All of India" />
              <Choice on={city === 'mine'} onPress={() => setCity('mine')} title={info?.myCity ? `In ${info.myCity}` : 'My city'} sub={info?.myCity ? null : 'Add your city in your profile'} />
            </View>
            <Head>Ages</Head>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
              {AGES.map(([a, b], i) => <Choice key={i} wide on={ages === i} onPress={() => setAges(i)} title={`${a}–${b}`} />)}
            </View>
            {info && !info.available ? <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.gold, marginTop: space.md, textAlign: 'center' }}>Spread around is coming soon: payments aren't switched on yet.</Text> : null}
            {info?.test ? <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.dim, marginTop: space.md, textAlign: 'center' }}>Test mode on this laptop: no money is taken.</Text> : null}
            {error ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.danger, marginTop: space.sm, textAlign: 'center' }}>{error}</Text> : null}
            <Pressable onPress={start} disabled={busy || !info?.available}
              style={{ marginTop: space.lg, height: 52, borderRadius: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', opacity: busy || !info?.available ? 0.5 : 1 }}>
              <LinearGradient colors={gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              {busy ? <ActivityIndicator color="#fff" /> : (<>
                <Ionicons name="megaphone" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: 15 }}>{info?.test ? 'Spread it (test, free)' : `Pay ₹${plan?.priceInr ?? ''} & spread`}</Text>
              </>)}
            </Pressable>
            <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: colors.dim, marginTop: space.md, textAlign: 'center', lineHeight: 16 }}>
              Reach is an estimate. Private accounts' Sparks still show only to their Connections and Followers.
            </Text>
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}
