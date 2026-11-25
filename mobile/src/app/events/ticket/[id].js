// A Soul Events ticket: the QR the staff scan at the gate (works once), with the code under it in case the
// camera can't read it. It updates by itself once you're checked in.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../lib/api';
import { Button } from '../../../components/ui';
import { GradientText } from '../../../components/brand';
import { QrView, dayText, kindOf, rupees, timeText } from '../../../components/events';
import { colors, fonts, space } from '../../../lib/theme';

export default function Ticket() {
  const { id } = useLocalSearchParams();
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => api(`/events/registrations/${id}`).then((r) => { setD(r); setError(null); }).catch((e) => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);
  // at the gate: show "Checked in" as soon as staff scan it
  useEffect(() => {
    if (!d || d.registration.checkedInAt || d.registration.status !== 'paid' || d.event.ended) return undefined;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [d, load]);

  if (!d) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>{error ? <Text style={{ fontFamily: fonts.body, color: colors.muted }}>{error}</Text> : <ActivityIndicator color={colors.aura} />}</View>;
  const r = d.registration; const e = d.event; const k = kindOf(e.kind);
  if (r.status !== 'paid') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
        <Text style={{ fontFamily: fonts.body, color: colors.muted, textAlign: 'center' }}>This ticket isn't paid yet.</Text>
        <Button title="Finish payment" onPress={() => router.replace(`/events/${r.eventId}`)} style={{ marginTop: space.md }} />
      </View>
    );
  }
  const used = !!r.checkedInAt;
  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: 80, alignItems: 'center' }}>
      <Stack.Screen options={{ title: 'Your ticket' }} />
      <View style={{ maxWidth: 420, width: '100%', alignSelf: 'center', borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: used ? `${colors.mint}88` : colors.border, backgroundColor: colors.glass }}>
        <View style={{ padding: space.lg, alignItems: 'center' }}>
          <GradientText style={{ fontFamily: fonts.display, fontSize: 22 }}>Soulink</GradientText>
          <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1.6, color: k.color, marginTop: 2 }}>SOUL EVENTS · {k.label.toUpperCase()}</Text>
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 27, color: colors.text, textAlign: 'center', marginTop: space.sm }}>{e.title}</Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.muted, marginTop: 4, textAlign: 'center' }}>{dayText(e.startsAt)} · {timeText(e.startsAt)} · {e.venue}, {e.city}</Text>
        </View>
        <View style={{ borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.border }} />
        <View style={{ padding: space.lg, alignItems: 'center' }}>
          {e.status === 'cancelled' ? <Text style={{ fontFamily: fonts.semibold, color: colors.danger, marginBottom: space.md, textAlign: 'center' }}>This event was cancelled. Your money is refunded.</Text> : null}
          <View style={{ opacity: used ? 0.35 : 1 }}><QrView rows={r.qr} size={250} /></View>
          <Text selectable style={{ fontFamily: fonts.mono, fontSize: 17, letterSpacing: 2, color: colors.text, marginTop: space.md }}>{r.ticketCode}</Text>
          {used ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.md, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(66,232,192,0.15)' }}>
              <Ionicons name="checkmark-circle" size={18} color={colors.mint} />
              <Text style={{ fontFamily: fonts.semibold, color: colors.mint, marginLeft: 6 }}>Checked in · {timeText(r.checkedInAt)}</Text>
            </View>
          ) : <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: space.sm, textAlign: 'center' }}>Show this at the gate. It works once, for you only: bring the ID you uploaded.</Text>}
        </View>
        <View style={{ borderTopWidth: 1, borderColor: colors.border, padding: space.lg }}>
          <Line label="Name" value={r.fullName} />
          <Line label="ID" value={r.idTypeLabel} />
          <Line label="Paid" value={r.payMode === 'test' ? `${rupees(r.amount)} (test)` : rupees(r.amount)} />
        </View>
      </View>
      <Button title="Event details" variant="ghost" onPress={() => router.push(`/events/${r.eventId}`)} style={{ marginTop: space.md }} />
    </ScrollView>
  );
}
const Line = ({ label, value }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
    <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: colors.muted }}>{label}</Text>
    <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text, flexShrink: 1, textAlign: 'right', marginLeft: 12 }}>{value}</Text>
  </View>
);
