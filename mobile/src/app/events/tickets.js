// My Soul Events tickets: upcoming first, then past ones.
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { Empty } from '../../components/ui';
import { dayText, kindOf, timeText } from '../../components/events';
import { colors, fonts, space } from '../../lib/theme';

export default function Tickets() {
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  useFocusEffect(useCallback(() => { api('/events/tickets').then((r) => { setList(r.tickets); setError(null); }).catch((e) => setError(e.message)); }, []));
  if (!list) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl }}>{error ? <Text style={{ fontFamily: fonts.body, color: colors.muted }}>{error}</Text> : <ActivityIndicator color={colors.aura} />}</View>;
  const now = Date.now();
  const sorted = [...list].sort((a, b) => {
    const fa = new Date(a.event.startsAt) > now - 6 * 3600_000; const fb = new Date(b.event.startsAt) > now - 6 * 3600_000;
    return fa !== fb ? (fa ? -1 : 1) : (fa ? 1 : -1) * (new Date(a.event.startsAt) - new Date(b.event.startsAt));
  });
  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: 80 }}>
      <Stack.Screen options={{ title: 'My tickets' }} />
      {!sorted.length ? <Empty icon="ticket-outline" title="No tickets yet" text="Register for a Soul Event and your QR ticket shows up here." /> : null}
      {sorted.map((t) => {
        const k = kindOf(t.event.kind); const past = new Date(t.event.startsAt) < now - 6 * 3600_000;
        return (
          <Pressable key={t.id} onPress={() => router.push(`/events/ticket/${t.id}`)}
            style={{ flexDirection: 'row', alignItems: 'center', padding: space.md, marginBottom: space.sm, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.glass, opacity: past ? 0.6 : 1 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: `${k.color}22` }}><Ionicons name={k.icon} size={20} color={k.color} /></View>
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.text }}>{t.event.title}</Text>
              <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 2 }}>{dayText(t.event.startsAt)} · {timeText(t.event.startsAt)} · {t.event.venue}</Text>
            </View>
            {t.checkedInAt ? <Ionicons name="checkmark-circle" size={20} color={colors.mint} /> : <Ionicons name="qr-code" size={20} color={colors.aura} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
