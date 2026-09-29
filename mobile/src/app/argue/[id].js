// One argument. Together mode: "pass the phone to X" → X gives their side privately → next person.
// Invite mode: give your side; see who's still thinking. Then the Referee thinks and gives the verdict.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { BrandHeader, BrandScreen } from '../../components/BrandScreen';
import { GlassCard, GradientText, PillTag } from '../../components/brand';
import MicButton from '../../components/MicButton';
import { Avatar, Button, ErrorText, Input, Loading, s } from '../../components/ui';
import { colors, fonts, gradients, space } from '../../lib/theme';

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
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }));
    loop.start(); return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-12deg', '12deg', '-12deg'] });
  return (
    <BrandScreen>
      <View style={{ alignItems: 'center' }}>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="scale-balance" size={60} color="#fff" />
          </LinearGradient>
        </Animated.View>
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 22, color: colors.text, marginTop: space.xl }}>The Referee is thinking…</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted, marginTop: space.sm, textAlign: 'center' }}>Reading every side carefully. This takes a few seconds.</Text>
      </View>
    </BrandScreen>
  );
}

function Verdict({ c }) {
  const v = c.verdict;
  const won = (seat) => v.winnerSeats.includes(seat);
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(pop, { toValue: 1, friction: 6, useNativeDriver: true }).start(); }, [pop]);
  const winners = c.people.filter((p) => won(p.seat));
  return (
    <BrandScreen back center={false}>
      <Animated.View style={{ alignItems: 'center', opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }}>
        <PillTag style={{ alignSelf: 'center' }}>The verdict</PillTag>
        <View style={{ flexDirection: 'row', marginTop: space.lg }}>
          {winners.map((p) => (
            <View key={p.seat} style={{ alignItems: 'center', marginHorizontal: space.sm }}>
              <MaterialCommunityIcons name="crown" size={30} color={colors.gold} />
              <Bubble name={p.name} user={p.user} highlight size={80} />
              <Text style={{ color: colors.text, fontFamily: fonts.displayBold, fontSize: 16, marginTop: 6 }}>{p.name}</Text>
            </View>
          ))}
        </View>
        <GradientText style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 32, textAlign: 'center', marginTop: space.lg }}>{v.headline}</GradientText>
        {v.summary ? <Text style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.text, textAlign: 'center', marginTop: space.sm }}>{v.summary}</Text> : null}
      </Animated.View>

      {v.safety ? (
        <GlassCard style={{ marginTop: space.xl, borderColor: 'rgba(66,232,192,0.5)' }}>
          <Text style={{ color: colors.mint, fontFamily: fonts.semibold, fontSize: 14 }}>{v.safety}</Text>
        </GlassCard>
      ) : null}

      <Text style={[s.label, { marginTop: space.xl, marginLeft: 0 }]}>Everyone's side</Text>
      {c.people.map((p) => {
        const x = v.people.find((q) => q.seat === p.seat) || {};
        return (
          <GlassCard key={p.seat} style={{ marginBottom: space.md, borderColor: won(p.seat) ? 'rgba(245,200,66,0.6)' : colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Bubble name={p.name} user={p.user} size={40} highlight={won(p.seat)} />
              <Text style={{ flex: 1, marginLeft: space.md, color: colors.text, fontFamily: fonts.displayBold, fontSize: 16 }}>{p.name}</Text>
              <Text style={{ color: won(p.seat) ? colors.gold : colors.aura, fontFamily: fonts.display, fontSize: 18 }}>{x.fairness}%</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border, marginTop: space.sm, overflow: 'hidden' }}>
              <LinearGradient colors={won(p.seat) ? [colors.gold, colors.spark] : gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${x.fairness}%`, height: 6 }} />
            </View>
            <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginTop: space.sm, fontStyle: 'italic' }} numberOfLines={4}>"{p.statement}"</Text>
            {x.strength ? <Text style={{ color: colors.mint, fontFamily: fonts.medium, fontSize: 13, marginTop: space.sm }}>✓ {x.strength}</Text> : null}
            {x.blindSpot ? <Text style={{ color: colors.gold, fontFamily: fonts.medium, fontSize: 13, marginTop: 4 }}>⚠ {x.blindSpot}</Text> : null}
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
        {c.judge === 'claude' ? 'Judged by Claude AI' : 'Quick verdict by the basic judge. Add a Claude API key for full AI verdicts.'}
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
        hint={`${text.length}/2000 · only the Referee sees this until the verdict`} style={{ marginBottom: space.md }} />
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
      const r = await api(`/argue/${id}/statement`, { method: 'POST', body: { text, ...(seat ? { seat } : {}) }, timeoutMs: 60000 });
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
          <MaterialCommunityIcons name="timer-sand" size={40} color={colors.aura} />
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 18, color: colors.text, marginTop: space.md, textAlign: 'center' }}>Your side is in</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted, marginTop: space.sm, textAlign: 'center' }}>
            Waiting for {c.people.filter((p) => !p.submitted).map((p) => p.name).join(', ')}. You'll get a notification when the verdict is ready.
          </Text>
        </GlassCard>
      )}
    </BrandScreen>
  );
}
