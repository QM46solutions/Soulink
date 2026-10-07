// Settings > Time management: time on Soulink (this phone), daily limit and break reminders.
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { readTimePrefs, readUsage, saveTimePrefs, today } from '../../lib/usage';
import { Note, Section } from '../../components/SettingsUI';
import { s } from '../../components/ui';
import { colors, fonts, gradients, space } from '../../lib/theme';

const fmt = (sec) => { const m = Math.round(sec / 60); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`; };
const LIMITS = [0, 15, 30, 60, 90, 120];
const BREAKS = [0, 10, 20, 30, 60];

function Choices({ values, value, onPick, label }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.lg, gap: 8 }}>
      {values.map((v) => (
        <Pressable key={v} onPress={() => onPick(v)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5,
          borderColor: value === v ? colors.soul : colors.border, backgroundColor: value === v ? 'rgba(124,92,252,0.22)' : 'transparent' }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: value === v ? colors.text : colors.muted }}>{v ? label(v) : 'Off'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function TimeManagement() {
  const [usage, setUsage] = useState({});
  const [prefs, setPrefs] = useState({ dailyLimit: 0, breakEvery: 0 });
  useFocusEffect(useCallback(() => { readUsage().then(setUsage); readTimePrefs().then(setPrefs); }, []));
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d; });
  const secs = days.map((d) => usage[today(d)] || 0);
  const max = Math.max(60, ...secs, (prefs.dailyLimit || 0) * 60);
  const avg = secs.reduce((a, b) => a + b, 0) / 7;
  const pick = async (p) => { await saveTimePrefs(p); setPrefs((x) => ({ ...x, ...p })); };

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={{ alignItems: 'center', paddingTop: space.xl }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted, letterSpacing: 1 }}>TODAY</Text>
        <Text style={{ fontFamily: fonts.display, fontSize: 40, color: colors.text, marginTop: 4 }}>{fmt(secs[6])}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted }}>Daily average this week: {fmt(avg)}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 150, marginHorizontal: space.xl, marginTop: space.xl }}>
        {days.map((d, i) => (
          <View key={i} style={{ alignItems: 'center', flex: 1 }}>
            <View style={{ width: 22, height: Math.max(4, (secs[i] / max) * 120), borderRadius: 6, overflow: 'hidden', backgroundColor: colors.border }}>
              {secs[i] ? <LinearGradient colors={i === 6 ? gradients.button : ['#5b46d6', '#7c5cfc']} start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }} style={{ flex: 1 }} /> : null}
            </View>
            <Text style={{ fontFamily: fonts.body, fontSize: 11, color: i === 6 ? colors.text : colors.muted, marginTop: 6 }}>{d.toLocaleDateString(undefined, { weekday: 'narrow' })}</Text>
          </View>
        ))}
      </View>
      <Section>Daily limit</Section>
      <Choices values={LIMITS} value={prefs.dailyLimit || 0} onPick={(v) => pick({ dailyLimit: v, warned: null })} label={(v) => (v < 60 ? `${v} min` : `${v / 60} h`)} />
      <Note>Soulink reminds you once when you reach it.</Note>
      <Section>Break reminders</Section>
      <Choices values={BREAKS} value={prefs.breakEvery || 0} onPick={(v) => pick({ breakEvery: v })} label={(v) => `Every ${v} min`} />
      <Note>Time is counted on this phone only, while Soulink is open on screen.</Note>
    </ScrollView>
  );
}
