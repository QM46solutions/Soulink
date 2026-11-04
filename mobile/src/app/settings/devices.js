// Settings › Where you're logged in: every device your account is logged in on (this one first), when it was last
// used and part of its internet address. Log out one device, or every device except this one.
// Devices logged out in the last 30 days stay listed (greyed), so you can spot a login you don't recognise.
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { confirm, notice } from '../../lib/confirm';
import { Button, Loading } from '../../components/ui';
import { Note } from '../../components/SettingsUI';
import { colors, fonts, space } from '../../lib/theme';

const ICON = { phone: 'phone-portrait-outline', tablet: 'tablet-portrait-outline', computer: 'laptop-outline', unknown: 'help-circle-outline' };
const when = (iso) => {
  if (!iso) return '';
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 2) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24); if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};
const date = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');

function DeviceRow({ d, onLogout, busy }) {
  const dim = !d.active;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, opacity: dim ? 0.55 : 1 }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: d.current ? 'rgba(66,232,192,0.14)' : 'rgba(124,92,252,0.14)' }}>
        <Ionicons name={ICON[d.kind] || ICON.unknown} size={22} color={d.current ? colors.mint : colors.aura} />
      </View>
      <View style={{ flex: 1, marginLeft: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.text }}>{d.device}</Text>
          {d.current ? <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.mint, letterSpacing: 0.5 }}>THIS DEVICE</Text> : null}
        </View>
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 }}>
          {d.current ? 'Active now' : d.active ? `Last active ${when(d.lastActiveAt)}` : d.endedAt ? `Logged out ${when(d.endedAt)}` : `Last active ${when(d.lastActiveAt)} · expired`}
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.dim, marginTop: 2 }}>
          Logged in {date(d.loggedInAt)}{d.ip ? ` · ${d.ip}` : ''}
        </Text>
      </View>
      {d.active && !d.current ? (
        <Pressable onPress={() => onLogout(d)} disabled={busy} accessibilityRole="button" accessibilityLabel={`Log out ${d.device}`}
          style={({ hovered }) => ({ paddingHorizontal: 12, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center', backgroundColor: hovered ? 'rgba(255,92,122,0.12)' : 'transparent' })}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.danger }}>Log out</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function Devices() {
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(() => api('/account/sessions').then((r) => setList(r.sessions)).catch((e) => { setList((l) => l || []); notice('Devices', e.message); }), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const logoutOne = async (d) => {
    if (!(await confirm(`Log out ${d.device}?`, 'That device will need to log in again to use your account.', { confirmText: 'Log out', destructive: true }))) return;
    setBusy(true);
    try { setList((await api(`/account/sessions/${d.id}`, { method: 'DELETE' })).sessions); } catch (e) { notice('Log out', e.message); load(); } finally { setBusy(false); }
  };
  const others = (list || []).filter((d) => d.active && !d.current);
  const logoutOthers = async () => {
    if (!(await confirm('Log out of all other devices?', `${others.length} device${others.length === 1 ? '' : 's'} will need to log in again. You stay logged in here.`, { confirmText: 'Log out all others', destructive: true }))) return;
    setBusy(true);
    try { const r = await api('/account/sessions/end-others', { method: 'POST' }); setList(r.sessions); notice('Done', `Logged out of ${r.ended} other device${r.ended === 1 ? '' : 's'}.`); }
    catch (e) { notice('Log out', e.message); } finally { setBusy(false); }
  };

  if (!list) return <Loading />;
  const active = list.filter((d) => d.active); const ended = list.filter((d) => !d.active);
  const Heading = ({ children }) => <Text style={{ fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: colors.dim, paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm }}>{children}</Text>;
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: space.xxl }}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.aura} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <Note>Every device your account is logged in on. Don’t recognise one? Log it out, then check your phone number and email in your profile.</Note>
      <Heading>Logged in now · {active.length}</Heading>
      {active.map((d) => <DeviceRow key={d.id} d={d} onLogout={logoutOne} busy={busy} />)}
      {others.length ? <Button variant="ghost" title="Log out of all other devices" loading={busy} onPress={logoutOthers} style={{ marginHorizontal: space.lg, marginTop: space.lg }} /> : null}
      {ended.length ? (
        <>
          <Heading>Logged out · last 30 days</Heading>
          {ended.map((d) => <DeviceRow key={d.id} d={d} onLogout={logoutOne} busy={busy} />)}
        </>
      ) : null}
      <Text style={{ fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.dim, paddingHorizontal: space.lg, marginTop: space.lg }}>
        Only part of each internet address is shown. The device name comes from the browser or app that logged in, so it may be approximate.
      </Text>
    </ScrollView>
  );
}
