// Ads Manager (Soulink team only): create and run sponsored cards for paying customers
//   Home feed (between posts) · Between Sparks · Sponsored Argue topic
// Each ad: the customer (their Soulink username: they get "My ads"), budget, price per 1,000 views, paid so far.
// At the top: revenue (booked, earned, received, still to collect, Spark boosts) and views day by day.
// Open to accounts listed in the server's ADMIN_USERNAMES.
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { api, mediaUrl } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { confirm } from '../../lib/confirm';
import { FeedAd, SparkAd, ArgueAd } from '../../components/AdCards';
import { DailyBars, MoneyBar, StatTile, StatusChip, inr, num } from '../../components/AdsDash';
import { Button, Input, s } from '../../components/ui';
import { colors, fonts, space } from '../../lib/theme';

const PLACES = [['feed', 'Home feed', 'Between posts'], ['sparks', 'Sparks', 'Between Sparks'], ['argue', 'Argue', 'Sponsored topic']];
const placeLabel = (k) => PLACES.find(([x]) => x === k)?.[1] || k;
const blank = () => ({ placement: 'feed', brand: '', headline: '', body: '', ctaLabel: '', ctaUrl: '', argueTopic: '', city: '', days: '7', media: null, logo: null, owner: '', budgetInr: '', cpmInr: '100', paidInr: '' });
const digits = (v) => v.replace(/[^\d.]/g, '').slice(0, 9);

async function fileOf(asset, fallback) {
  const type = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
  const name = asset.fileName || `${fallback}.${type.split('/')[1].replace('jpeg', 'jpg').replace('quicktime', 'mov')}`;
  if (Platform.OS === 'web') return new File([await (await fetch(asset.uri)).blob()], name, { type });
  return { uri: asset.uri, name, type };
}

function Pill({ on, title, sub, onPress }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, margin: 4, padding: 10, borderRadius: 14, borderWidth: 1.5, borderColor: on ? colors.aura : colors.border, backgroundColor: on ? 'rgba(124,92,252,0.16)' : 'transparent', alignItems: 'center' }}>
      <Text style={{ fontFamily: fonts.bold, color: colors.text, fontSize: 14 }}>{title}</Text>
      <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 11, marginTop: 2 }}>{sub}</Text>
    </Pressable>
  );
}

export default function AdsManager() {
  const { user } = useAuth();
  const [ads, setAds] = useState(null);
  const [rev, setRev] = useState(null); // revenue + views per day
  const [money, setMoney] = useState(null); // { id, kind: 'budget' | 'paid', value }
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const load = useCallback(() => { api('/ads/manage').then((r) => { setAds(r.ads); setRev({ ...r.revenue, daily: r.daily }); }).catch((e) => { setError(e.message); setAds([]); }); }, []);
  const saveMoney = async () => {
    const v = Number(money.value);
    if (!v) { setMoney(null); return; }
    try { const r = await api(`/ads/${money.id}`, { method: 'PATCH', body: money.kind === 'budget' ? { addBudgetInr: v } : { addPaidInr: v } }); setAds((l) => l.map((x) => (x.id === money.id ? r.ad : x))); setMoney(null); load(); }
    catch (e) { setError(e.message); }
  };
  useFocusEffect(useCallback(() => { if (user.isAdmin) load(); }, [load, user.isAdmin]));
  const f = form || {};
  const set = (patch) => setForm((x) => ({ ...x, ...patch }));

  if (!user.isAdmin) {
    return <View style={[s.screen, { alignItems: 'center', justifyContent: 'center', padding: space.xl }]}><Text style={{ fontFamily: fonts.semibold, color: colors.muted, textAlign: 'center' }}>Ads Manager is for the Soulink team.</Text></View>;
  }

  const pick = async (key) => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: key === 'logo' ? ['images'] : ['images', 'videos'], quality: 0.85, videoMaxDuration: 60 });
    if (!r.canceled && r.assets?.[0]) set({ [key]: r.assets[0] });
  };
  const create = async () => {
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      for (const k of ['placement', 'brand', 'headline', 'body', 'ctaLabel', 'ctaUrl', 'argueTopic', 'city', 'days', 'owner', 'paidInr']) if (String(f[k] || '').trim()) fd.append(k, String(f[k]).trim());
      if (String(f.budgetInr || '').trim()) { fd.append('budgetInr', String(f.budgetInr).trim()); fd.append('cpmInr', String(f.cpmInr || '100').trim()); }
      if (f.placement === 'argue' && !f.headline.trim()) fd.append('headline', f.argueTopic.trim().slice(0, 120));
      if (f.media) fd.append('media', await fileOf(f.media, 'ad'));
      if (f.logo) fd.append('logo', await fileOf(f.logo, 'logo'));
      await api('/ads', { method: 'POST', form: fd, timeoutMs: 300000 });
      setForm(null); load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const toggle = async (a) => { setAds((l) => l.map((x) => (x.id === a.id ? { ...x, active: !a.active } : x))); await api(`/ads/${a.id}`, { method: 'PATCH', body: { active: !a.active } }).catch(() => load()); };
  const extend = async (a) => { const r = await api(`/ads/${a.id}`, { method: 'PATCH', body: { days: 7, active: true } }).catch(() => null); if (r) setAds((l) => l.map((x) => (x.id === a.id ? r.ad : x))); };
  const remove = async (a) => { if (await confirm('Delete this ad?', a.headline, { confirmText: 'Delete', destructive: true })) { await api(`/ads/${a.id}`, { method: 'DELETE' }).catch(() => {}); load(); } };

  // what it will look like, as people see it
  const preview = form && f.brand && (f.headline || f.argueTopic) ? {
    id: 'preview', placement: f.placement, brand: f.brand, headline: f.headline, body: f.body || null, ctaLabel: f.ctaLabel || null, ctaUrl: f.ctaUrl || null,
    argueTopic: f.argueTopic || null, mediaUrl: f.media?.uri || null, mediaKind: f.media?.type === 'video' ? 'video' : 'image', logoUrl: f.logo?.uri || null,
  } : null;

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
      {!form ? (
        <>
          <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 13.5, lineHeight: 19 }}>
            Sponsored cards show between Home posts (every 4th), between Sparks (every 5th) and as a sponsored topic on the Argue page. Each is always labelled Sponsored.
          </Text>
          {rev ? (
            <View style={{ marginTop: space.lg }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                <StatTile label="Earned" value={inr(rev.earned)} sub={`of ${inr(rev.booked)} booked`} />
                <StatTile label="Received" value={inr(rev.received)} sub={rev.toCollect ? `${inr(rev.toCollect)} still to collect` : 'nothing to collect'} tone={rev.toCollect ? colors.gold : colors.text} />
                <StatTile label="Spark boosts" value={inr(rev.boosts)} sub={`${num(rev.boostCount)} paid boost${rev.boostCount === 1 ? '' : 's'}`} />
                <StatTile label="Views" value={num(rev.views)} sub={`${num(rev.clicks)} taps`} />
              </View>
              <View style={{ marginTop: space.md, padding: space.md, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.glass }}><DailyBars days={rev.daily} height={90} /></View>
            </View>
          ) : null}
          <Button title="New ad" icon="add" style={{ marginTop: space.lg }} onPress={() => { setError(null); setForm(blank()); }} />
          {error ? <Text style={{ color: colors.danger, fontFamily: fonts.body, marginTop: space.md }}>{error}</Text> : null}
          {ads === null ? <ActivityIndicator color={colors.aura} style={{ marginTop: space.xl }} /> : ads.length === 0 ? (
            <Text style={{ fontFamily: fonts.body, color: colors.dim, textAlign: 'center', marginTop: space.xl }}>No ads yet.</Text>
          ) : ads.map((a) => {
            const live = a.active && new Date(a.endsAt) > new Date();
            const ctr = a.impressions ? ((a.clicks / a.impressions) * 100).toFixed(1) : '0.0';
            return (
              <View key={a.id} style={{ marginTop: space.md, padding: space.md, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.glass }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {a.mediaUrl && a.mediaKind === 'image' ? <Image source={{ uri: mediaUrl(a.mediaUrl) }} style={{ width: 44, height: 44, borderRadius: 10, marginRight: 10 }} /> : null}
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontFamily: fonts.bold, color: colors.text }}>{a.brand} · {a.placement === 'argue' ? a.argueTopic : a.headline}</Text>
                    <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12, marginTop: 2 }}>
                      {placeLabel(a.placement)}{a.city ? ` · ${a.city}` : ' · All cities'} · {live ? `until ${new Date(a.endsAt).toLocaleDateString()}` : new Date(a.endsAt) <= new Date() ? 'ended' : 'paused'}
                      {a.owner ? ` · for @${a.owner.username}` : ' · no customer'}
                    </Text>
                  </View>
                  <Switch value={!!a.active} onValueChange={() => toggle(a)} trackColor={{ true: colors.aura }} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
                  <StatusChip status={a.stats?.status} />
                  {a.stats?.billed ? <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12 }}>{inr(a.stats.pricePer1000)} per 1,000 views · paid {inr(a.stats.paid)}{a.stats.balance < 0 ? ` · owes ${inr(-a.stats.balance)}` : ''}</Text> : <Text style={{ fontFamily: fonts.body, color: colors.dim, fontSize: 12 }}>No budget set (free)</Text>}
                </View>
                {a.stats?.billed ? <View style={{ marginTop: 8 }}><MoneyBar spent={a.stats.spent} budget={a.stats.budget} /></View> : null}
                {money?.id === a.id ? (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 8 }}>
                    <Input label={money.kind === 'budget' ? 'Add to budget (₹)' : 'Payment received (₹)'} value={money.value} onChangeText={(v) => setMoney({ ...money, value: digits(v) })} keyboardType="decimal-pad" style={{ flex: 1 }} />
                    <Button title="Save" small onPress={saveMoney} />
                    <Button title="Cancel" small variant="secondary" onPress={() => setMoney(null)} />
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                    <Pressable onPress={() => setMoney({ id: a.id, kind: 'budget', value: '' })}><Text style={{ fontFamily: fonts.semibold, color: colors.gold, fontSize: 13 }}>+ Budget</Text></Pressable>
                    <Pressable onPress={() => setMoney({ id: a.id, kind: 'paid', value: '' })}><Text style={{ fontFamily: fonts.semibold, color: colors.mint, fontSize: 13 }}>+ Payment</Text></Pressable>
                  </View>
                )}
                <View style={{ flexDirection: 'row', marginTop: 10, alignItems: 'center' }}>
                  <Text style={{ flex: 1, fontFamily: fonts.semibold, color: colors.text, fontSize: 13 }}>{num(a.impressions)} views · {num(a.stats?.reach)} people · {num(a.clicks)} taps · {ctr}%</Text>
                  <Pressable onPress={() => extend(a)} style={{ marginRight: 14 }}><Text style={{ fontFamily: fonts.semibold, color: colors.aura, fontSize: 13 }}>+7 days</Text></Pressable>
                  <Pressable onPress={() => remove(a)} accessibilityLabel="Delete ad"><Ionicons name="trash-outline" size={18} color={colors.muted} /></Pressable>
                </View>
              </View>
            );
          })}
        </>
      ) : (
        <>
          <Text style={[s.label, { marginLeft: 0 }]}>Where it shows</Text>
          <View style={{ flexDirection: 'row', marginHorizontal: -4 }}>{PLACES.map(([k, t, sub]) => <Pill key={k} on={f.placement === k} title={t} sub={sub} onPress={() => set({ placement: k })} />)}</View>
          <Input label="Brand" value={f.brand} onChangeText={(v) => set({ brand: v })} maxLength={80} placeholder="e.g. Chai Point" style={{ marginTop: space.md }} />
          {f.placement === 'argue' ? <Input label="Argue topic" value={f.argueTopic} onChangeText={(v) => set({ argueTopic: v })} maxLength={150} placeholder="e.g. Filter coffee or masala chai?" style={{ marginTop: space.md }} /> : null}
          <Input label={f.placement === 'argue' ? 'Line under the topic' : 'Headline'} value={f.headline} onChangeText={(v) => set({ headline: v })} maxLength={120} style={{ marginTop: space.md }} />
          <Input label="More text (optional)" value={f.body} onChangeText={(v) => set({ body: v })} maxLength={400} multiline style={{ marginTop: space.md }} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: space.md }}>
            <Input label="Button" value={f.ctaLabel} onChangeText={(v) => set({ ctaLabel: v })} maxLength={30} placeholder="Shop now" style={{ flex: 1 }} />
            <Input label="Days" value={f.days} onChangeText={(v) => set({ days: v.replace(/\D/g, '').slice(0, 2) })} keyboardType="number-pad" style={{ width: 90 }} />
          </View>
          <Input label="Button link" value={f.ctaUrl} onChangeText={(v) => set({ ctaUrl: v })} maxLength={400} autoCapitalize="none" placeholder="https://" style={{ marginTop: space.md }} />
          <Input label="Only in this city (optional)" value={f.city} onChangeText={(v) => set({ city: v })} maxLength={60} placeholder="All cities" style={{ marginTop: space.md }} />
          <Text style={[s.label, { marginLeft: 0, marginTop: space.lg }]}>Customer and money</Text>
          <Input label="Customer's Soulink username (they see the dashboard)" value={f.owner} onChangeText={(v) => set({ owner: v.replace(/\s/g, '') })} maxLength={40} autoCapitalize="none" placeholder="@brandname" style={{ marginTop: space.sm }} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: space.md }}>
            <Input label="Budget (₹)" value={f.budgetInr} onChangeText={(v) => set({ budgetInr: digits(v) })} keyboardType="decimal-pad" placeholder="5000" style={{ flex: 1 }} />
            <Input label="Per 1,000 views (₹)" value={f.cpmInr} onChangeText={(v) => set({ cpmInr: digits(v) })} keyboardType="decimal-pad" placeholder="100" style={{ flex: 1 }} />
          </View>
          <Input label="Paid already (₹)" value={f.paidInr} onChangeText={(v) => set({ paidInr: digits(v) })} keyboardType="decimal-pad" placeholder="0" style={{ marginTop: space.md }} />
          {Number(f.budgetInr) && Number(f.cpmInr) ? (
            <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12.5, marginTop: 6 }}>
              {`${inr(Number(f.budgetInr))} buys about ${num(Math.floor((Number(f.budgetInr) * 1000) / Number(f.cpmInr)))} views. The ad stops when the budget is used up or after ${f.days || 7} days.`}
            </Text>
          ) : <Text style={{ fontFamily: fonts.body, color: colors.dim, fontSize: 12.5, marginTop: 6 }}>No budget = free ad (no charge, no limit).</Text>}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: space.md }}>
            <Button title={f.media ? 'Change picture / video' : 'Picture or video'} variant="secondary" small icon="image-outline" style={{ flex: 1 }} onPress={() => pick('media')} />
            <Button title={f.logo ? 'Change logo' : 'Logo'} variant="secondary" small icon="ribbon-outline" style={{ flex: 1 }} onPress={() => pick('logo')} />
          </View>
          {preview ? (
            <View style={{ marginTop: space.lg, marginHorizontal: -space.md }}>
              <Text style={[s.label, { marginLeft: space.md }]}>Preview</Text>
              {preview.placement === 'feed' ? <FeedAd ad={preview} /> : preview.placement === 'sparks' ? <SparkAd ad={preview} /> : <View style={{ paddingHorizontal: space.md }}><ArgueAd ad={preview} /></View>}
            </View>
          ) : null}
          {error ? <Text style={{ color: colors.danger, fontFamily: fonts.body, marginTop: space.md }}>{error}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: space.lg }}>
            <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setForm(null)} />
            <Button title="Start ad" loading={busy} disabled={!f.brand.trim() || (f.placement === 'argue' ? !f.argueTopic.trim() : !f.headline.trim())} style={{ flex: 1 }} onPress={create} />
          </View>
        </>
      )}
    </ScrollView>
  );
}
