// My ads: the dashboard for a customer whose ads the Soulink team runs (and for anyone who paid to Spread a Spark).
// What you paid, what's been spent, what's left; views, people reached, taps; day by day; and plain advice on
// what to do next (top up, extend, change the picture, where ads work best).
import { useCallback, useState } from 'react';
import { Image, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api, mediaUrl } from '../../lib/api';
import { Empty, Loading, s } from '../../components/ui';
import { DailyBars, MoneyBar, StatTile, StatusChip, Tips, inr, num } from '../../components/AdsDash';
import { colors, fonts, space } from '../../lib/theme';

const PLACE = { feed: 'Home feed', sparks: 'Between Sparks', argue: 'Sponsored Argue' };
const H = ({ children }) => <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.2, color: colors.aura, textTransform: 'uppercase', marginTop: space.xl, marginBottom: space.sm }}>{children}</Text>;
const when = (iso) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function AdCard({ a }) {
  const st = a.stats;
  return (
    <View style={{ marginTop: space.md, padding: space.lg, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.glass }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {a.mediaUrl && a.mediaKind === 'image' ? <Image source={{ uri: mediaUrl(a.mediaUrl) }} style={{ width: 48, height: 48, borderRadius: 10, marginRight: 12 }} /> : null}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.text }}>{a.placement === 'argue' ? a.argueTopic : a.headline}</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 2 }}>
            {PLACE[a.placement]} · {a.city || 'All cities'} · {when(a.startsAt)} – {when(a.endsAt)}
          </Text>
        </View>
        <StatusChip status={st.status} />
      </View>
      {st.billed ? <View style={{ marginTop: space.md }}><MoneyBar spent={st.spent} budget={st.budget} /></View> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space.md, rowGap: 6 }}>
        {[
          ['Views', num(st.views)], ['People', num(st.reach)], ['Taps', `${num(st.clicks)} (${st.ctr}%)`],
          ...(st.billed ? [['Per 1,000 views', inr(st.pricePer1000)], ['Per tap', st.costPerClick != null ? `₹${st.costPerClick}` : '–'], ['Views left', st.viewsLeft != null ? num(st.viewsLeft) : '–']] : []),
        ].map(([k, v]) => (
          <View key={k} style={{ width: '33.3%' }}>
            <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.muted }}>{k}</Text>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.text }}>{v}</Text>
          </View>
        ))}
      </View>
      {st.status === 'running' ? (
        <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: space.sm }}>
          About {num(st.viewsPerDay)} views a day{st.billed ? ` · ${inr(st.spendPerDay)} a day` : ''} · {st.daysLeft} day{st.daysLeft === 1 ? '' : 's'} to go
          {st.budgetLastsDays != null ? ` · budget lasts about ${st.budgetLastsDays} day${st.budgetLastsDays === 1 ? '' : 's'}` : ''}
        </Text>
      ) : null}
      <View style={{ marginTop: space.md }}><DailyBars days={a.daily} height={70} /></View>
    </View>
  );
}

export default function MyAds() {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => { try { setD(await api('/ads/mine')); setError(null); } catch (e) { setError(e.message); setD((x) => x || { ads: [], boosts: [], tips: [] }); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  if (!d) return <Loading />;
  const t = d.totals || {};
  const none = !d.ads.length && !d.boosts.length;
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: 80 }}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.aura} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      {error ? <Text style={{ color: colors.danger, fontFamily: fonts.body }}>{error}</Text> : null}
      {none ? <Empty icon="megaphone-outline" title="No ads yet" text="When the Soulink team runs an ad for you, or you Spread a Spark, its numbers show up here." /> : null}

      {d.ads.length ? (
        <>
          <H>Money</H>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <StatTile label="Budget" value={inr(t.budget)} sub={`${t.running} of ${t.ads} ad${t.ads === 1 ? '' : 's'} running`} />
            <StatTile label="Spent" value={inr(t.spent)} sub={t.budget ? `${Math.round((t.spent / t.budget) * 100)}% of the budget` : null} />
            <StatTile label="Left" value={inr(t.left)} tone={t.budget && t.left / t.budget < 0.15 ? colors.spark : colors.mint} sub="still to be shown" />
            <StatTile label={t.balance < 0 ? 'To pay' : 'Paid ahead'} value={inr(Math.abs(t.balance))} tone={t.balance < 0 ? colors.spark : colors.text} sub={`You've paid ${inr(t.paid)}`} />
          </View>
          {t.budget ? <View style={{ marginTop: space.md }}><MoneyBar spent={t.spent} budget={t.budget} height={12} /></View> : null}

          <H>Results</H>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            <StatTile label="Views" value={num(t.views)} sub="times your ads were seen" />
            <StatTile label="People reached" value={num(t.reach)} sub="different people" />
            <StatTile label="Taps" value={num(t.clicks)} sub={`${t.ctr}% of views`} />
            <StatTile label="Cost per tap" value={t.clicks && t.spent ? `₹${(t.spent / t.clicks).toFixed(2)}` : '–'} sub={t.views && t.spent ? `₹${((t.spent / t.views) * 1000).toFixed(0)} per 1,000 views` : null} />
          </View>
          <View style={{ marginTop: space.lg, padding: space.lg, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.glass }}>
            <DailyBars days={d.daily} />
          </View>

          {d.tips.length ? <><H>What to do next</H><Tips tips={d.tips} /></> : null}

          <H>{`Your ads · ${d.ads.length}`}</H>
          {d.ads.map((a) => <AdCard key={a.id} a={a} />)}
        </>
      ) : null}

      {d.boosts.length ? (
        <>
          <H>{`Spark boosts · ${inr(t.boosts)} paid`}</H>
          {d.boosts.map((b) => (
            <Text key={b.id} onPress={() => router.push(`/spark/${b.sparkId}`)} style={{ fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.text, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              {`${b.caption ? `"${b.caption.slice(0, 40)}" · ` : ''}${inr(b.amount)} · ${b.days} day${b.days === 1 ? '' : 's'} · ${b.city || 'all cities'}, ${b.ageMin}-${b.ageMax} · ${num(b.views)} views${new Date(b.endsAt) > new Date() && b.status === 'active' ? ' · running' : ''}`}
            </Text>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}
