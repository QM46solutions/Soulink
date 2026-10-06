// Soul DNA match on someone's profile: one score per relation type (Dating · Friendship · Business · Buddy),
// the Soul Score orb, Natural fit + Relationship fit, the compatibility type, and a "Why you match" sheet
// (strong areas, friction, dealbreakers, every dimension). Predicted from Soul DNA only: chats and meetups stay private.
// The breakdown is Premium (free while testing).
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import SoulScoreOrb from './SoulScoreOrb';
import { BottomSheet } from './PostSheets';
import { colors, fonts, gradients, space } from '../lib/theme';

export const RELATIONS = [
  { key: 'dating', label: 'Dating', emoji: '💘', intent: 'dating' },
  { key: 'friendship', label: 'Friendship', emoji: '🤝', intent: 'friendship' },
  { key: 'business', label: 'Business', emoji: '💼', intent: 'networking' },
  { key: 'buddy', label: 'Buddy', emoji: '📚', intent: 'buddy' },
];

function Bar({ value, color }) {
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' }}>
      {color ? <View style={{ width: `${value}%`, height: 6, backgroundColor: color }} />
        : <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${value}%`, height: 6 }} />}
    </View>
  );
}
const tone = (v) => (v >= 78 ? colors.mint : v >= 62 ? colors.aura : '#ffb86b');

function Mini({ label, value, hint }) {
  return (
    <View style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.03)' }}>
      <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, color: colors.muted, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ fontFamily: fonts.display, fontSize: 24, color: value == null ? colors.dim : colors.text, marginTop: 2 }}>{value == null ? '–' : `${value}%`}</Text>
      <Text numberOfLines={1} style={{ fontFamily: fonts.body, fontSize: 11, color: colors.dim }}>{hint}</Text>
    </View>
  );
}

const H = ({ children }) => <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.1, color: colors.aura, textTransform: 'uppercase', marginTop: space.lg, marginBottom: space.sm }}>{children}</Text>;
const Line = ({ children, color = colors.muted }) => <Text style={{ fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color, marginBottom: 4 }}>{children}</Text>;

function WhySheet({ visible, onClose, userId, relation, name }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    if (!visible) return;
    setD(null); setErr(null);
    api(`/soul/compat/${userId}?relation=${relation}`).then(setD).catch((e) => setErr(e.message));
  }, [visible, userId, relation]);
  const rel = RELATIONS.find((r) => r.key === relation);
  return (
    <BottomSheet visible={visible} onClose={onClose} title={`${rel?.emoji} Why you match · ${rel?.label}`} tall>
      {!d ? (
        <View style={{ padding: space.xl, alignItems: 'center' }}>{err ? <Line>{err}</Line> : <ActivityIndicator color={colors.aura} />}</View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl }}>
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 18, color: colors.text, marginTop: space.lg }}>{d.type}</Text>
          <Line>{d.typeLine}</Line>
          <Text style={{ fontFamily: fonts.display, fontSize: 30, color: colors.text, marginTop: space.sm }}>{d.overall}%<Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.dim }}>  predicted from Soul DNA</Text></Text>
          {!d.unlocked ? (
            <View style={{ marginTop: space.xl, alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: space.lg }}>
              <Ionicons name="lock-closed" size={22} color={colors.aura} />
              <Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 15, marginTop: space.sm }}>See the full breakdown</Text>
              <Line>Strong areas, friction points and all 12 dimensions are part of Premium.</Line>
            </View>
          ) : (
            <>
              {d.dealbreakers?.length ? (<><H>Talk about this early</H>{d.dealbreakers.map((x) => <Line key={x} color="#ff8a8a">⚠️  You see {x} very differently</Line>)}</>) : null}
              {d.strengths?.length ? (<><H>Strong areas</H>{d.strengths.map((x) => <Line key={x.key} color={colors.text}>{x.emoji}  {x.label} · {x.score}%</Line>)}</>) : null}
              {d.friction?.length ? (<><H>Possible friction</H>{d.friction.map((x) => <Line key={x.key} color={colors.text}>{x.emoji}  {x.label} · {x.score}%</Line>)}</>) : null}
              <H>Every dimension</H>
              {d.dims.map((x) => (
                <View key={x.key} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.text }}>{x.emoji}  {x.label}</Text>
                    <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.muted }}>{x.score}%</Text>
                  </View>
                  <Bar value={x.score} color={tone(x.score)} />
                </View>
              ))}
              <Line color={colors.dim}>Natural fit ({d.natural ?? '–'}%) is how alike you are: values, goals, nature, lifestyle. Relationship fit ({d.relationship ?? '–'}%) is how well you'd handle feelings, talks, fights and growing together.</Line>
            </>
          )}
          <Line color={colors.dim}>Based only on both Soul DNA quizzes. Your chats and meetups are private and never used.</Line>
        </ScrollView>
      )}
    </BottomSheet>
  );
}

export default function MatchPanel({ match, userId, name }) {
  const [rel, setRel] = useState(match.relation);
  const [why, setWhy] = useState(false);
  useEffect(() => { setRel(match.relation); }, [match.relation]);
  const cur = match.all[rel];
  const meta = RELATIONS.find((r) => r.key === rel);
  return (
    <View style={{ marginBottom: space.md }}>
      <View style={{ flexDirection: 'row', paddingHorizontal: space.lg, gap: 6, marginBottom: space.sm }}>
        {RELATIONS.map((r) => {
          const on = r.key === rel;
          return (
            <Pressable key={r.key} onPress={() => setRel(r.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
              style={({ hovered }) => ({ flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 14, borderWidth: 1,
                borderColor: on ? colors.soul : colors.border, backgroundColor: on ? 'rgba(124,92,252,0.22)' : hovered ? 'rgba(255,255,255,0.05)' : 'transparent' })}>
              <Text style={{ fontSize: 15 }}>{r.emoji}</Text>
              <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 11, color: on ? colors.text : colors.muted, marginTop: 1 }}>{r.label}</Text>
              <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, color: on ? colors.aura : colors.dim }}>{match.all[r.key]?.overall ?? '–'}%</Text>
            </Pressable>
          );
        })}
      </View>
      <SoulScoreOrb key={rel} score={cur.overall} name={name} intent={meta.intent} />
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: space.lg, marginTop: space.md }}>
        <Mini label="Natural fit" value={cur.natural} hint="How alike you are" />
        <Mini label="Relationship fit" value={cur.relationship} hint="How you'd work together" />
      </View>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.text, textAlign: 'center', marginTop: space.md }}>{cur.type}</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: colors.dim, textAlign: 'center', marginTop: 2 }}>
        Predicted from both Soul DNA quizzes
      </Text>
      <Pressable onPress={() => setWhy(true)} style={{ alignSelf: 'center', marginTop: space.sm, paddingVertical: 6, paddingHorizontal: 14 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.aura }}>Why you match →</Text>
      </Pressable>
      <WhySheet visible={why} onClose={() => setWhy(false)} userId={userId} relation={rel} name={name} />
    </View>
  );
}
