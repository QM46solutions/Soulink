// Soulink Events (coming soon): real-life meetups in Hyderabad. For now a preview of what's coming and a
// "Notify me" switch (saved to your account), opened from the raised button in the centre of the tab bar.
import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { notice } from '../../lib/confirm';
import { GradientText, Divider } from '../../components/brand';
import { colors, fonts, space } from '../../lib/theme';

const KINDS = [
  { icon: 'cafe', color: colors.aura, title: 'Soul Socials', text: 'Small coffee meetups with people whose Soul DNA matches yours.' },
  { icon: 'rocket', color: colors.spark, title: 'Startup & work nights', text: 'Meet founders, builders and study buddies across the city.' },
  { icon: 'musical-notes', color: colors.mint, title: 'Music, games & more', text: 'Open mics, game nights and weekend trails around Hyderabad.' },
];

export default function Events() {
  const { user, setUser } = useAuth();
  const [on, setOn] = useState(!!user.eventsNotify);
  const [busy, setBusy] = useState(false);

  const toggle = async (v) => {
    setOn(v); setBusy(true);
    try { const r = await api('/users/me/events-notify', { method: 'PUT', body: { on: v } }); setUser(r.user); }
    catch (e) { setOn(!v); notice('Not saved', e.message); } finally { setBusy(false); }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: 120, alignItems: 'center' }}>
      {/* just the wordmark, no badge or background */}
      <GradientText style={{ fontFamily: fonts.display, fontSize: 48, lineHeight: 56, letterSpacing: -1.4, marginTop: space.lg, textAlign: 'center' }}>Soulink</GradientText>
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 22, color: colors.text, marginTop: 2, textAlign: 'center' }}>Events</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.muted, textAlign: 'center', marginTop: 6 }}>
        Meet your people in real life. Coming soon to Hyderabad.
      </Text>
      <View style={{ marginTop: space.sm, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(176,143,255,0.5)', backgroundColor: 'rgba(124,92,252,0.14)' }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1.5, color: colors.aura }}>LAUNCHING SOON</Text>
      </View>
      <Divider style={{ marginTop: space.lg, width: '80%' }} />

      <View style={{ alignSelf: 'stretch', marginTop: space.lg }}>
        {KINDS.map((k) => (
          <View key={k.title} style={{ flexDirection: 'row', alignItems: 'center', padding: space.md, marginBottom: space.sm, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.glass }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: `${k.color}22` }}>
              <Ionicons name={k.icon} size={21} color={k.color} />
            </View>
            <View style={{ flex: 1, marginLeft: space.md }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.text }}>{k.title}</Text>
              <Text style={{ fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 2 }}>{k.text}</Text>
            </View>
          </View>
        ))}
      </View>

      <Pressable onPress={() => !busy && toggle(!on)} style={{ alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', marginTop: space.md, padding: space.lg, borderRadius: 18,
        borderWidth: 1, borderColor: on ? colors.aura : colors.border, backgroundColor: on ? 'rgba(124,92,252,0.16)' : colors.glass }}>
        <Ionicons name={on ? 'notifications' : 'notifications-outline'} size={22} color={on ? colors.aura : colors.text} />
        <View style={{ flex: 1, marginLeft: space.md }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.text }}>Notify me when events launch</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 2 }}>{on ? "You're on the list. We'll tell you first." : 'Be the first to know about events near you.'}</Text>
        </View>
        <Switch value={on} onValueChange={toggle} disabled={busy} trackColor={{ false: colors.border, true: colors.soul }} thumbColor="#fff" />
      </Pressable>
    </ScrollView>
  );
}
