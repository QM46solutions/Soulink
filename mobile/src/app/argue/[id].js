// One argument. Together mode: "pass the phone to X" → X gives their side privately → next person.
// Invite mode: give your side; see who's still thinking. Then the Referee thinks and gives the verdict.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { BrandHeader, BrandScreen } from '../../components/BrandScreen';
import { GlassCard, GradientText, PillTag } from '../../components/brand';
import MicButton from '../../components/MicButton';
import { Avatar, Button, ErrorText, Input, Loading, s } from '../../components/ui';
import { colors, fonts, gradients, space } from '../../lib/theme';
import { LiveFrame, ScalesIcon } from '../../components/LiveIcons';

const initial = (n) => (n || '?').trim().charAt(0).toUpperCase();

function Bubble({ name, size = 72, user, highlight }) {
  if (user?.avatarUrl) return <Avatar uri={user.avatarUrl} name={name} size={size} />;
  return (
    <LinearGradient colors={highlight ? [colors.gold, colors.spark] : gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontFamily: fonts.display, fontSize: size * 0.42 }}>{initial(name)}</Text>
    </LinearGradient>
  );
}

function Thinking() {
  return (
    <BrandScreen back>
      <View style={{ alignItems: 'center' }}>
        <LiveFrame size={220} label="VERDICT.BALANCING"><ScalesIcon size={180} /></LiveFrame>
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 22, color: colors.text, marginTop: space.xl }}>The Referee is thinking…</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted, marginTop: space.sm, textAlign: 'center' }}>Reading every side carefully. This can take up to a minute.</Text>
      </View>
    </BrandScreen>
  );
}

// Close scores, very short sides or the word-based basic judge: the result is a lean, not a clear call
const CLOSE = 5;
const UPSELL = /\s*Turn on the free Soulink AI[^.]*\.?/i; // older verdicts carried this line (it's for the team's laptop setup)
const HOW = {
  basic: 'Scored on the words each side used: calm, specific details and owning a mistake score higher; harsh words and shouting score lower.',
  ai: 'Each side gets a fairness score from 0 to 100 for sticking to the facts given, listening to the other side, respect, and what a reasonable person would do. The higher score is the verdict.',
};

function Verdict({ c }) {
  const v = c.verdict;
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(pop, { toValue: 1, friction: 6, useNativeDriver: true }).start(); }, [pop]);
  const score = (seat) => (v.people.find((q) => q.seat === seat) || {}).fairness ?? 0;
  // the scoreboard: highest score first
  const board = [...c.people].sort((a, b) => score(b.seat) - score(a.seat));
  const top = board[0]; const second = board[1];
  const margin = second ? score(top.seat) - score(second.seat) : 0;
  const split = v.winnerSeats.length !== 1 || margin < CLOSE;
  const short = c.people.filter((p) => String(p.statement || '').split(/\s+/).filter(Boolean).length < 15).map((p) => p.name);
  const basic = c.judge === 'basic';
  const caveats = [
    split ? `The scores are only ${margin} point${margin === 1 ? '' : 's'} apart: treat this as too close to call.` : null,
    short.length ? `${short.join(' and ')} wrote very little, so the Referee had less to go on.` : null,
    basic ? 'This is the quick word-based judge, not a full read of the story.' : null,
  ].filter(Boolean);
  const summary = String(v.summary || '').replace(UPSELL, '').trim();
  const headline = split
    ? `Too close to call: ${board.slice(0, 2).map((p) => `${p.name} ${score(p.seat)}%`).join(' vs ')}`
    : `${top.name} leads with ${score(top.seat)}%${second ? ` vs ${second.name} ${score(second.seat)}%` : ''}`;
  return (
    <BrandScreen back center={false}>
      <Animated.View style={{ opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }}>
        <PillTag style={{ alignSelf: 'center' }}>The verdict</PillTag>
        {/* the result first: who scored higher, and by how much */}
        <GradientText style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 31, textAlign: 'center', marginTop: space.md }}>{headline}</GradientText>
        <GlassCard style={{ marginTop: space.lg, paddingVertical: space.md }}>
          {board.map((p, k) => {
            const pct = score(p.seat); const lead = !split && k === 0;
            return (
              <View key={p.seat} style={{ marginTop: k ? space.md : 0 }} accessible accessibilityLabel={`${p.name}: ${pct} percent${lead ? ', higher score' : ''}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Bubble name={p.name} user={p.user} size={34} highlight={lead} />
                  <Text style={{ flex: 1, marginLeft: space.sm, color: colors.text, fontFamily: fonts.displayBold, fontSize: 16 }} numberOfLines={1}>{p.name}</Text>
                  {lead ? <MaterialCommunityIcons name="crown" size={20} color={colors.gold} style={{ marginRight: 6 }} /> : null}
                  <Text style={{ color: lead ? colors.gold : colors.text, fontFamily: fonts.display, fontSize: 22 }}>{pct}%</Text>
                </View>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, marginTop: 6, overflow: 'hidden' }}>
                  <LinearGradient colors={lead ? [colors.gold, colors.spark] : gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${pct}%`, height: 8 }} />
                </View>
              </View>
            );
          })}
        </GlassCard>
      </Animated.View>

      {/* how the score was reached, and what it can't tell you */}
      <GlassCard style={{ marginTop: space.md }}>
        <Text style={[s.label, { marginLeft: 0 }]}>How the score works</Text>
        <Text style={{ color: colors.text, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 }}>{basic ? HOW.basic : HOW.ai}</Text>
        <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginTop: space.sm }}>
          It’s based only on what each of you wrote, not on what really happened. It’s an opinion to help you talk it through, not proof of who is right.
        </Text>
        {caveats.length ? (
          <View style={{ marginTop: space.sm, padding: 10, borderRadius: 12, backgroundColor: 'rgba(245,200,66,0.10)', borderWidth: 1, borderColor: 'rgba(245,200,66,0.45)' }}>
            <Text style={{ color: colors.gold, fontFamily: fonts.semibold, fontSize: 13.5, marginBottom: 2 }}>Inconclusive</Text>
            {caveats.map((t) => (
              <View key={t} style={{ flexDirection: 'row', marginTop: 2 }}>
                <Ionicons name="information-circle-outline" size={15} color={colors.gold} style={{ marginRight: 6, marginTop: 2 }} />
                <Text style={{ flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 }}>{t}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </GlassCard>

      {v.headline || summary ? (
        <View style={{ marginTop: space.lg }}>
          <Text style={[s.label, { marginLeft: 0 }]}>The Referee says</Text>
          {v.headline ? <Text style={{ fontFamily: fonts.displayBold, fontSize: 17, lineHeight: 24, color: colors.text }}>{v.headline}</Text> : null}
          {summary ? <Text style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.text, marginTop: 4 }}>{summary}</Text> : null}
        </View>
      ) : null}

      {v.safety ? (
        <GlassCard style={{ marginTop: space.xl, borderColor: 'rgba(66,232,192,0.5)' }}>
          <Text style={{ color: colors.mint, fontFamily: fonts.semibold, fontSize: 14 }}>{v.safety}</Text>
        </GlassCard>
      ) : null}

      <Text style={[s.label, { marginTop: space.xl, marginLeft: 0 }]}>Everyone's side</Text>
      {board.map((p) => {
        const x = v.people.find((q) => q.seat === p.seat) || {};
        const lead = !split && p.seat === top.seat;
        return (
          <GlassCard key={p.seat} style={{ marginBottom: space.md, borderColor: lead ? 'rgba(245,200,66,0.6)' : colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Bubble name={p.name} user={p.user} size={40} highlight={lead} />
              <Text style={{ flex: 1, marginLeft: space.md, color: colors.text, fontFamily: fonts.displayBold, fontSize: 16 }}>{p.name}</Text>
              <Text style={{ color: lead ? colors.gold : colors.aura, fontFamily: fonts.display, fontSize: 18 }}>{x.fairness}%</Text>
            </View>
            <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginTop: space.sm, fontStyle: 'italic' }} numberOfLines={4}>"{p.statement}"</Text>
            {x.strength ? (
              <View style={{ flexDirection: 'row', marginTop: space.sm }} accessible accessibilityLabel={`Got right: ${x.strength}`}>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.mint} style={{ marginRight: 6, marginTop: 1 }} />
                <Text style={{ flex: 1, color: colors.mint, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 }}>{x.strength}</Text>
              </View>
            ) : null}
            {x.blindSpot ? (
              <View style={{ flexDirection: 'row', marginTop: 4 }} accessible accessibilityLabel={`Missed: ${x.blindSpot}`}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.gold} style={{ marginRight: 6, marginTop: 1 }} />
                <Text style={{ flex: 1, color: colors.gold, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 }}>{x.blindSpot}</Text>
              </View>
            ) : null}
          </GlassCard>
        );
      })}
      {v.advice ? (
        <GlassCard style={{ marginTop: space.sm }}>
          <Text style={[s.label, { marginLeft: 0 }]}>Next step</Text>
          <Text style={{ color: colors.text, fontFamily: fonts.body, fontSize: 15, lineHeight: 22 }}>{v.advice}</Text>
        </GlassCard>
      ) : null}
      <Text style={{ color: colors.dim, fontFamily: fonts.body, fontSize: 12, textAlign: 'center', marginTop: space.lg }}>
        {c.judge === 'claude' ? 'Judged by Claude AI' : basic ? 'Quick verdict by the basic judge' : 'Judged by Soulink AI'}
        {' · AI-generated opinion, not legal advice'}
      </Text>
      <Button title="New argument" style={{ marginTop: space.lg }} onPress={() => router.replace('/argue')} />
    </BrandScreen>
  );
}

function SideInput({ name, onSubmit, busy, error, cta }) {
  const [text, setText] = useState('');
  return (
    <View>
      <Input label={`${name}'s side`} value={text} onChangeText={setText} multiline maxLength={2000}
        placeholder="What happened, and why do you think you're right? Be honest, the Referee is fair."
        hint={`${text.length}/2000 · only the Referee sees this until the verdict`} style={{ marginBottom: space.md }}
        inputStyle={{ minHeight: 170, textAlignVertical: 'top', paddingTop: 12 }} autoFocus />
      <MicButton onText={(t) => setText((cur) => (cur ? `${cur} ${t}` : t))} />
      <ErrorText>{error}</ErrorText>
      <Button title={cta} style={{ marginTop: space.lg }} loading={busy} disabled={text.trim().length < 10} onPress={() => onSubmit(text.trim())} />
    </View>
  );
}

export default function ArgueCase() {
  const { id } = useLocalSearchParams();
  const [c, setC] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState(false); // together mode: the next person has the phone
  const [judging, setJudging] = useState(false);

  const load = useCallback(async () => {
    try { setC((await api(`/argue/${id}`)).case); } catch (e) { setError(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  // Invite mode: keep checking until every side is in
  useEffect(() => {
    if (!c || c.status === 'decided' || c.mode !== 'invite') return undefined;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [c, load]);

  const submit = async (text, seat) => {
    setBusy(true); setError(null);
    const last = c.mode === 'phone' ? c.people.filter((p) => !p.submitted).length === 1 : c.people.filter((p) => !p.submitted).length === 1;
    if (last) setJudging(true);
    try {
      const r = await api(`/argue/${id}/statement`, { method: 'POST', body: { text, ...(seat ? { seat } : {}) }, timeoutMs: 300000 });
      setC(r.case); setRevealed(false);
    } catch (e) { setError(e.message); } finally { setBusy(false); setJudging(false); }
  };

  if (!c && !error) return <Loading />;
  if (!c) return <BrandScreen back><ErrorText>{error}</ErrorText></BrandScreen>;
  if (judging || c.status === 'judging') return <Thinking />;
  if (c.status === 'decided') return <Verdict c={c} />;

  const total = c.people.length;
  const done = c.people.filter((p) => p.submitted).length;
  const Progress = (
    <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: space.xl }}>
      {c.people.map((p) => (
        <View key={p.seat} style={{ alignItems: 'center', marginHorizontal: 6 }}>
          <View style={{ opacity: p.submitted ? 1 : 0.45 }}><Bubble name={p.name} user={p.user} size={44} /></View>
          <Ionicons name={p.submitted ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={p.submitted ? colors.mint : colors.dim} style={{ marginTop: 4 }} />
        </View>
      ))}
    </View>
  );

  if (c.mode === 'phone') {
    const next = c.people.find((p) => !p.submitted);
    if (!revealed) {
      return (
        <BrandScreen back>
          {Progress}
          <View style={{ alignItems: 'center' }}>
            <Bubble name={next.name} size={96} />
            <Text style={{ fontFamily: fonts.body, fontSize: 15, color: colors.muted, marginTop: space.lg }}>Side {done + 1} of {total}</Text>
            <Text style={{ fontFamily: fonts.displayBold, fontSize: 26, lineHeight: 32, color: colors.text, textAlign: 'center', marginTop: 4 }}>Pass the phone to {next.name}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: space.sm }}>Others: no peeking. Each side stays private until the verdict.</Text>
          </View>
          <Button title={`I'm ${next.name}, let me talk`} style={{ marginTop: space.xl }} onPress={() => setRevealed(true)} />
        </BrandScreen>
      );
    }
    const isLast = done + 1 === total;
    return (
      <BrandScreen back onBack={() => setRevealed(false)} center={false}>
        <BrandHeader size={0} title={`${next.name}, your turn`} subtitle={c.topic ? `About: ${c.topic}` : 'Tell the Referee your side.'} />
        <SideInput key={next.seat} name={next.name} busy={busy} error={error} cta={isLast ? 'Done: get the verdict' : 'Done: hide it and pass the phone'} onSubmit={(t) => submit(t, next.seat)} />
      </BrandScreen>
    );
  }

  // invite mode
  const me = c.people.find((p) => p.seat === c.mySeat);
  return (
    <BrandScreen back center={false}>
      <BrandHeader size={0} title={c.topic || 'Argument'} subtitle={`${done} of ${total} sides in`} />
      {Progress}
      {me && !me.submitted ? (
        <SideInput name={me.name} busy={busy} error={error} cta={done + 1 === total ? 'Send: get the verdict' : 'Send my side'} onSubmit={(t) => submit(t)} />
      ) : (
        <GlassCard style={{ alignItems: 'center', padding: space.xl }}>
          <ScalesIcon size={72} />
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 18, color: colors.text, marginTop: space.md, textAlign: 'center' }}>Your side is in</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted, marginTop: space.sm, textAlign: 'center' }}>
            Waiting for {c.people.filter((p) => !p.submitted).map((p) => p.name).join(', ')}. You'll get a notification when the verdict is ready.
          </Text>
        </GlassCard>
      )}
    </BrandScreen>
  );
}
