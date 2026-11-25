// Soul Events: real-life events run by the Soulink team (created in the team console). Opened from the raised button
// in the centre of the tab bar. Shows my tickets first, then the events. With no events yet it shows what's coming and
// a "Notify me" switch. Coming back from the payment page (soulink://events?reg=…) opens the new ticket.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Switch, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { notice } from '../../lib/confirm';
import { GradientText, Divider } from '../../components/brand';
import { EventCard, dayText, kindOf, timeText } from '../../components/events';
import { colors, fonts, space } from '../../lib/theme';

const KINDS = [
  { icon: 'beer', color: colors.gold, title: 'Soul Pub nights', text: 'Meet people whose Soul DNA matches yours, over music and drinks.' },
  { icon: 'walk', color: colors.mint, title: 'Runs & marathons', text: 'Run with your city, with a Soulink medal at the finish.' },
  { icon: 'trophy', color: colors.spark, title: 'Tournaments', text: 'Cricket and more: team up with strangers who become friends.' },
];

export default function Events() {
  const { user, setUser } = useAuth();
  const q = useLocalSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [on, setOn] = useState(!!user.eventsNotify);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api('/events')); setError(null); } catch (e) { setError(e.message); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  // back from the payment page: confirm it and open the ticket
  useEffect(() => {
    if (!q.reg) return;
    const id = String(q.reg);
    router.setParams({ reg: undefined });
    api(`/events/registrations/${id}/refresh`, { method: 'POST' })
      .then((r) => { load(); if (r.registration?.status === 'paid') router.push(`/events/ticket/${id}`); else router.push(`/events/${r.registration.eventId}`); })
      .catch(() => {});
  }, [q.reg, load]);

  const toggle = async (v) => {
    setOn(v); setBusy(true);
    try { const r = await api('/users/me/events-notify', { method: 'PUT', body: { on: v } }); setUser(r.user); }
    catch (e) { setOn(!v); notice('Not saved', e.message); } finally { setBusy(false); }
  };
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const events = data?.events || [];
  const tickets = events.filter((e) => e.mine?.status === 'paid' && !e.ended);
  const upcoming = events.filter((e) => !e.ended);
  const past = events.filter((e) => e.ended);

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.aura} />}>
      <View style={{ alignItems: 'center' }}>
        <GradientText style={{ fontFamily: fonts.display, fontSize: 44, lineHeight: 52, letterSpacing: -1.4, marginTop: space.md, textAlign: 'center' }}>Soul Events</GradientText>
        <Text style={{ fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.muted, textAlign: 'center', marginTop: 4 }}>Meet your people in real life.</Text>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: space.md }}>
        <Pill icon="ticket-outline" text="My tickets" onPress={() => router.push('/events/tickets')} />
        {data?.staff ? <Pill icon="scan" text="Gate check-in" onPress={() => router.push('/events/scan')} /> : null}
      </View>

      {!data && !error ? <ActivityIndicator color={colors.aura} style={{ marginTop: space.xl }} /> : null}
      {error && !data ? (
        <Pressable onPress={load} style={{ marginTop: space.xl, alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.body, color: colors.muted, textAlign: 'center' }}>{error}</Text>
          <Text style={{ fontFamily: fonts.semibold, color: colors.aura, marginTop: 6 }}>Try again</Text>
        </Pressable>
      ) : null}

      {tickets.length ? (
        <View style={{ marginTop: space.lg }}>
          <Kicker text="YOUR TICKETS" />
          {tickets.map((e) => {
            const k = kindOf(e.kind);
            return (
              <Pressable key={e.id} onPress={() => router.push(`/events/ticket/${e.mine.id}`)}
                style={{ flexDirection: 'row', alignItems: 'center', padding: space.md, marginBottom: space.sm, borderRadius: 18, borderWidth: 1, borderColor: `${colors.mint}55`, backgroundColor: 'rgba(66,232,192,0.08)' }}>
                <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: `${k.color}22` }}><Ionicons name="qr-code" size={20} color={colors.mint} /></View>
                <View style={{ flex: 1, marginLeft: space.md }}>
                  <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.text }}>{e.title}</Text>
                  <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 2 }}>{dayText(e.startsAt)} · {timeText(e.startsAt)} · Show this at the gate</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {upcoming.length ? (
        <View style={{ marginTop: space.lg }}>
          <Kicker text="UPCOMING" />
          {upcoming.map((e) => <EventCard key={e.id} e={e} onPress={() => router.push(`/events/${e.id}`)} />)}
        </View>
      ) : null}

      {data && !upcoming.length ? (
        <View style={{ marginTop: space.lg }}>
          <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: space.md }}>New events are on the way. Here's what's coming:</Text>
          <Divider style={{ marginBottom: space.lg, width: '80%', alignSelf: 'center' }} />
          {KINDS.map((k) => (
            <View key={k.title} style={{ flexDirection: 'row', alignItems: 'center', padding: space.md, marginBottom: space.sm, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.glass }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: `${k.color}22` }}><Ionicons name={k.icon} size={21} color={k.color} /></View>
              <View style={{ flex: 1, marginLeft: space.md }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.text }}>{k.title}</Text>
                <Text style={{ fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 2 }}>{k.text}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {data ? (
        <Pressable onPress={() => !busy && toggle(!on)} style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.md, padding: space.lg, borderRadius: 18,
          borderWidth: 1, borderColor: on ? colors.aura : colors.border, backgroundColor: on ? 'rgba(124,92,252,0.16)' : colors.glass }}>
          <Ionicons name={on ? 'notifications' : 'notifications-outline'} size={22} color={on ? colors.aura : colors.text} />
          <View style={{ flex: 1, marginLeft: space.md }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.text }}>Tell me about new events</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 2 }}>{on ? "You're on the list. We'll tell you first." : 'Be the first to know about events near you.'}</Text>
          </View>
          <Switch value={on} onValueChange={toggle} disabled={busy} trackColor={{ false: colors.border, true: colors.soul }} thumbColor="#fff" />
        </Pressable>
      ) : null}

      {past.length ? (
        <View style={{ marginTop: space.xl, opacity: 0.75 }}>
          <Kicker text="RECENT" />
          {past.map((e) => <EventCard key={e.id} e={e} onPress={() => router.push(`/events/${e.id}`)} />)}
        </View>
      ) : null}
    </ScrollView>
  );
}

const Kicker = ({ text }) => <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.6, color: colors.aura, marginBottom: space.sm }}>{text}</Text>;
const Pill = ({ icon, text, onPress }) => (
  <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, marginHorizontal: 5, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? 'rgba(124,92,252,0.18)' : colors.glass })}>
    <Ionicons name={icon} size={16} color={colors.aura} />
    <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.text, marginLeft: 6 }}>{text}</Text>
  </Pressable>
);
