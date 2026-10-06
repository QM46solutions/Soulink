// Soul Filters screen: every filter on one scrolling page (no swipes), grouped in glass cards.
// "Show people" saves the filters and goes back to Discover, which searches with them.
// Soul match filters are Premium (marked with a diamond; free while testing).
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { notice } from '../lib/confirm';
import { DISTANCES, GENDERS, INTERESTS, LANGUAGES, SCORES, clean } from '../lib/filters';
import CityField from '../components/CityField';
import { Button, Loading, s } from '../components/ui';
import { colors, fonts, space } from '../lib/theme';

function Card({ icon, title, hint, premium, children }) {
  return (
    <View style={{ marginBottom: space.lg, padding: space.lg, borderRadius: 22, borderWidth: 1, borderColor: premium ? 'rgba(245,200,66,0.35)' : colors.border, backgroundColor: colors.glass }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: hint ? 2 : space.md }}>
        <Ionicons name={icon} size={16} color={premium ? colors.gold : colors.aura} style={{ marginRight: 8 }} />
        <Text style={{ flex: 1, fontFamily: fonts.displayBold, fontSize: 16, color: colors.text }}>{title}</Text>
        {premium ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(245,200,66,0.12)' }}>
            <Ionicons name="diamond" size={10} color={colors.gold} style={{ marginRight: 4 }} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.gold }}>{premium}</Text>
          </View>
        ) : null}
      </View>
      {hint ? <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginBottom: space.md }}>{hint}</Text> : null}
      {children}
    </View>
  );
}

function Opt({ label, on, onPress, disabled }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ hovered }) => ({
      paddingHorizontal: 14, height: 36, justifyContent: 'center', borderRadius: 999, borderWidth: 1, marginRight: 8, marginBottom: 8, opacity: disabled ? 0.4 : 1,
      borderColor: on ? colors.soul : hovered ? colors.aura : colors.border, backgroundColor: on ? colors.soul : 'transparent',
    })}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: on ? '#fff' : colors.muted }}>{label}</Text>
    </Pressable>
  );
}
const Row = ({ children }) => <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{children}</View>;
const Sub = ({ children }) => <Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.3, textTransform: 'uppercase', color: colors.dim, marginBottom: 8, marginTop: 4 }}>{children}</Text>;

function Stepper({ label, value, min, max, onChange }) {
  const btn = (icon, d, off) => (
    <Pressable onPress={() => onChange(Math.max(min, Math.min(max, value + d)))} disabled={off} hitSlop={6}
      style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', opacity: off ? 0.35 : 1 }}>
      <Ionicons name={icon} size={16} color={colors.text} />
    </Pressable>
  );
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Sub>{label}</Sub>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {btn('remove', -1, value <= min)}
        <Text numberOfLines={1} style={{ width: 66, textAlign: 'center', fontFamily: fonts.display, fontSize: 22, color: colors.text }}>{value}{value === max && max === 60 ? '+' : ''}</Text>
        {btn('add', 1, value >= max)}
      </View>
    </View>
  );
}

export default function SoulFilters() {
  const [f, setF] = useState(null);
  const [opts, setOpts] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/discover/options').then((o) => { setOpts(o); setF(o.saved || {}); }).catch((e) => notice('Soul Filters', e.message));
  }, []);
  if (!f || !opts) return <Loading />;

  const set = (k, v) => setF((c) => ({ ...c, [k]: v }));
  const toggle = (k, v) => setF((c) => { const a = c[k] || []; return { ...c, [k]: a.includes(v) ? a.filter((x) => x !== v) : [...a, v] }; });
  const pick = (k, v) => setF((c) => ({ ...c, [k]: c[k] === v ? undefined : v }));
  const locked = !opts.premium.unlocked;
  const premium = (fn) => () => (locked ? notice('Soulink Premium', 'Soul match filters are part of Premium.') : fn());
  const premiumTag = opts.premium.freeTrial ? 'Premium · free now' : locked ? 'Premium' : 'Premium';

  const apply = async () => {
    setBusy(true);
    try { await api('/discover/filters', { method: 'PUT', body: clean(f) }); router.back(); } catch (e) { notice('Soul Filters', e.message); setBusy(false); }
  };

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 130 }} keyboardShouldPersistTaps="handled">
        <Card icon="people" title="Who">
          <View style={{ flexDirection: 'row', marginBottom: space.md }}>
            <Stepper label="Age from" value={f.ageMin || 18} min={18} max={f.ageMax || 60} onChange={(v) => set('ageMin', v === 18 ? undefined : v)} />
            <Stepper label="Age to" value={f.ageMax || 60} min={f.ageMin || 18} max={60} onChange={(v) => set('ageMax', v === 60 ? undefined : v)} />
          </View>
          <Sub>Show me</Sub>
          <Row>{GENDERS.map((g) => <Opt key={g.v} label={g.l} on={f.genders?.includes(g.v)} onPress={() => toggle('genders', g.v)} />)}</Row>
          <Sub>Trust</Sub>
          <Row><Opt label="✓ Face-verified only" on={!!f.verifiedOnly} onPress={() => set('verifiedOnly', !f.verifiedOnly || undefined)} /></Row>
        </Card>

        <Card icon="location" title="Where" hint={opts.me.hasLocation ? 'Distance is measured area to area. Your exact location is never shown.' : 'Add your area in Edit profile (or allow location) to use distance.'}>
          <Sub>Distance</Sub>
          <Row>{DISTANCES.map((d) => <Opt key={d} label={`${d} km`} on={f.distanceKm === d} disabled={!opts.me.hasLocation} onPress={() => pick('distanceKm', d)} />)}</Row>
          <Sub>Or a specific area</Sub>
          <CityField value={f.area || ''} onChange={(v) => set('area', v || undefined)} autoLocate={false} />
        </Card>

        <Card icon="pulse" title="Activity">
          <Row>
            <Opt label="Active today" on={f.active === 'today'} onPress={() => pick('active', 'today')} />
            <Opt label="Active this week" on={f.active === 'week'} onPress={() => pick('active', 'week')} />
          </Row>
        </Card>

        <Card icon="sparkles" title="Interests" hint="Show people who like any of these">
          <Row>{INTERESTS.map((i) => <Opt key={i} label={i} on={f.interests?.includes(i)} onPress={() => toggle('interests', i)} />)}</Row>
          <Sub>Shares at least (with me)</Sub>
          <Row>{[1, 2, 3].map((n) => <Opt key={n} label={`${n} interest${n > 1 ? 's' : ''}`} on={f.minShared === n} onPress={() => pick('minShared', n)} />)}</Row>
        </Card>

        <Card icon="school" title="Study, work and language">
          <Row>
            <Opt label={opts.me.college ? `🎓 Same college` : '🎓 Same college (add yours first)'} disabled={!opts.me.college} on={!!f.sameCollege} onPress={() => set('sameCollege', !f.sameCollege || undefined)} />
            <Opt label={opts.me.company ? `💼 Same company` : '💼 Same company (add yours first)'} disabled={!opts.me.company} on={!!f.sameCompany} onPress={() => set('sameCompany', !f.sameCompany || undefined)} />
          </Row>
          {!opts.me.college || !opts.me.company ? <Text onPress={() => router.push('/edit-profile')} style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.aura, marginBottom: 8 }}>Add college / company in Edit profile →</Text> : null}
          <Sub>Speaks</Sub>
          <Row>{LANGUAGES.map((l) => <Opt key={l} label={l} on={f.languages?.includes(l)} onPress={() => toggle('languages', l)} />)}</Row>
        </Card>

        <Card icon="planet" title="Soul match" premium={premiumTag} hint="Only people with Soul DNA are shown when these are on">
          <Sub>Minimum Soul Score</Sub>
          <Row>{SCORES.map((n) => <Opt key={n} label={`${n}%+`} on={f.minScore === n} onPress={premium(() => pick('minScore', n))} />)}</Row>
          <Sub>Personality</Sub>
          <Row>
            <Opt label="🌙 Introvert" on={f.nature === 'introvert'} onPress={premium(() => pick('nature', 'introvert'))} />
            <Opt label="🔥 Extrovert" on={f.nature === 'extrovert'} onPress={premium(() => pick('nature', 'extrovert'))} />
            <Opt label="🧭 Practical" on={f.mentality === 'practical'} onPress={premium(() => pick('mentality', 'practical'))} />
            <Opt label="✨ Dreamer" on={f.mentality === 'dreamer'} onPress={premium(() => pick('mentality', 'dreamer'))} />
          </Row>
          <Sub>Soul type</Sub>
          <Row>{opts.soulTypes.map((t) => <Opt key={t} label={t} on={f.soulTypes?.includes(t)} onPress={premium(() => toggle('soulTypes', t))} />)}</Row>
        </Card>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', padding: space.lg, paddingBottom: space.xl, backgroundColor: 'rgba(8,7,13,0.92)', borderTopWidth: 1, borderTopColor: colors.border }}>
        <Button title="Reset" variant="secondary" style={{ flex: 1, marginRight: space.sm }} onPress={() => setF({ sort: f.sort })} />
        <Button title="Show people" style={{ flex: 2 }} onPress={apply} loading={busy} />
      </View>
    </View>
  );
}
