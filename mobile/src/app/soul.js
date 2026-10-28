// Soul DNA v4: real-life scenarios that show how you think, act and react. Everyone gets their own mix
// (and a few more if Soul DNA is still unsure about something). Each scenario has "Anything else…" to type your own.
// How quickly you answer is noted too: a quick gut answer counts a little more than a long hesitation.
// Every answer is saved as you go, so you can stop and continue later.
// Ends with your Soul DNA: how you think (in words), give and take, your spectrum and what wins for you.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { retakeSoulDna } from '../lib/retake';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { BrandHeader, BrandScreen } from '../components/BrandScreen';
import { GlassCard, GradientText, PillTag } from '../components/brand';
import { Button, ErrorText } from '../components/ui';
import { colors, fonts, gradients, space } from '../lib/theme';
import { SoulDnaIcon } from '../components/LiveIcons';

function Bar({ value, style }) {
  return (
    <View style={[{ flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' }, style]}>
      <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: 4 }} />
    </View>
  );
}

function Option({ label, onPress, chosen, badge, dim }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ hovered, pressed }) => ({
        minHeight: 52, borderRadius: 18, borderWidth: 1.5, paddingHorizontal: 18, paddingVertical: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center',
        borderColor: chosen ? colors.soul : hovered ? colors.aura : colors.border,
        backgroundColor: chosen ? 'rgba(124,92,252,0.22)' : pressed ? 'rgba(124,92,252,0.12)' : colors.inputBg,
        opacity: dim ? 0.55 : 1,
      })}>
      {badge ? (
        <View style={{ width: 26, height: 26, borderRadius: 13, marginRight: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.soul }}>
          <Text style={{ color: '#fff', fontFamily: fonts.bold, fontSize: 13 }}>{badge}</Text>
        </View>
      ) : null}
      <Text style={{ flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 15.5, lineHeight: 21 }}>{label}</Text>
    </Pressable>
  );
}

function ScaleQ({ q, value, onPick }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md }}>
        {[0, 1, 2, 3, 4].map((v) => {
          const on = value === v; const size = [46, 38, 32, 38, 46][v];
          return (
            <Pressable key={v} onPress={() => onPick(v)} accessibilityLabel={`${v + 1} of 5`} style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
              {({ hovered }) => (
                <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: on || hovered ? colors.aura : colors.border, backgroundColor: on ? colors.soul : 'transparent' }} />
              )}
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm }}>
        <Text style={{ color: colors.muted, fontFamily: fonts.medium, fontSize: 13, maxWidth: '45%' }}>{q.left}</Text>
        <Text style={{ color: colors.muted, fontFamily: fonts.medium, fontSize: 13, maxWidth: '45%', textAlign: 'right' }}>{q.right}</Text>
      </View>
    </View>
  );
}

function RankQ({ q, value, onDone }) {
  const [order, setOrder] = useState(Array.isArray(value) ? value : []);
  useEffect(() => { setOrder(Array.isArray(value) ? value : []); }, [q.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const tap = (key) => {
    if (order.includes(key)) { setOrder(order.slice(0, order.indexOf(key))); return; } // tap again to undo from there
    let next = [...order, key];
    const left = q.items.filter((i) => !next.includes(i.key));
    if (left.length === 1) next = [...next, left[0].key];
    setOrder(next);
  };
  const need = Math.min(3, q.items.length);
  const done = order.length >= need;
  const full = () => [...order, ...q.items.map((x) => x.key).filter((k) => !order.includes(k))];
  return (
    <View>
      <Text style={{ color: colors.dim, fontFamily: fonts.body, fontSize: 12.5, textAlign: 'center', marginTop: -space.md, marginBottom: space.lg }}>
        Tap at least your top 3, most important first. Tap a number again to undo.
      </Text>
      {q.items.map((it) => {
        const pos = order.indexOf(it.key);
        return <Option key={it.key} label={it.label} chosen={pos >= 0} badge={pos >= 0 ? String(pos + 1) : null} onPress={() => tap(it.key)} />;
      })}
      <View style={{ flexDirection: 'row', marginTop: space.sm }}>
        <Button small variant="ghost" title="Reset" onPress={() => setOrder([])} style={{ flex: 1, marginRight: space.sm }} />
        <Button small title="Next" disabled={!done} onPress={() => onDone(full())} style={{ flex: 2 }} />
      </View>
    </View>
  );
}

const optOf = (x) => (x && typeof x === 'object' ? x.o : x);

const Kicker = ({ children }) => (
  <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.2, color: colors.aura, textTransform: 'uppercase', marginBottom: space.md }}>{children}</Text>
);

function Spectrum({ left, right, value }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: value <= 50 ? colors.text : colors.dim }}>{left}</Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: value > 50 ? colors.text : colors.dim }}>{right}</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border }}>
        <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 3, opacity: 0.35 }} />
        <View style={{ position: 'absolute', left: `${value}%`, top: -4, marginLeft: -7, width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff', borderWidth: 3, borderColor: colors.soul }} />
      </View>
    </View>
  );
}

/** Your own Soul DNA (after finishing, or when you open it again). */
export function DnaResult({ type, tagline, me, labels, onDone, onRetake }) {
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(glow, { toValue: 1, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, [glow]);
  const scale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const dims = (me?.dims || []).filter((d) => d.strength != null);
  return (
    <>
      <BrandHeader size={36} title="Your Soul DNA" />
      <Animated.View style={{ alignItems: 'center', opacity: glow, transform: [{ scale }] }}>
        <View style={{ width: 130, height: 130, borderRadius: 65, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          <LinearGradient colors={[...gradients.button]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.35 }} />
          <SoulDnaIcon size={112} />
        </View>
        <PillTag style={{ alignSelf: 'center', marginTop: space.lg }}>You are</PillTag>
        <GradientText style={{ fontFamily: fonts.display, fontSize: 30, lineHeight: 38, textAlign: 'center', marginTop: space.sm }}>{type}</GradientText>
        <Text style={{ fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.muted, textAlign: 'center', marginTop: space.sm, paddingHorizontal: space.md }}>{tagline}</Text>
      </Animated.View>

      {me?.summary?.length ? (
        <GlassCard style={{ marginTop: space.xl }}>
          <Kicker>How you think</Kicker>
          {me.summary.map((t) => <Text key={t} style={{ fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.text, marginBottom: 8 }}>• {t}</Text>)}
        </GlassCard>
      ) : null}

      {me?.priorities?.length ? (
        <GlassCard style={{ marginTop: space.lg }}>
          <Kicker>What wins when things clash</Kicker>
          {me.priorities.slice(0, 3).map((k, i) => (
            <Text key={k} style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.text, marginBottom: 6, textTransform: 'capitalize' }}>{i + 1}.  {labels[k] || k}</Text>
          ))}
        </GlassCard>
      ) : null}

      {me?.giveTake?.length ? (
        <GlassCard style={{ marginTop: space.lg }}>
          <Kicker>Give and take</Kicker>
          {me.giveTake.map((g) => (
            <View key={g.key} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.text, textTransform: 'capitalize' }}>{g.label}</Text>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: g.stance === 'lead' ? colors.gold : g.stance === 'bend' ? colors.mint : colors.aura }}>
                {g.stance === 'lead' ? 'You hold firm' : g.stance === 'bend' ? 'You bend easily' : 'Depends'}
              </Text>
            </View>
          ))}
        </GlassCard>
      ) : null}

      <GlassCard style={{ marginTop: space.lg }}>
        <Kicker>Your nature & mindset</Kicker>
        {(me?.spectrum || []).map((x) => <Spectrum key={x.key} left={x.left} right={x.right} value={x.value} />)}
      </GlassCard>

      {dims.length ? (
        <GlassCard style={{ marginTop: space.lg }}>
          <Kicker>How well Soul DNA knows you{me?.completeness != null ? ` · ${me.completeness}%` : ''}</Kicker>
          {dims.map((d) => (
            <View key={d.key} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.text }}>{d.emoji}  {d.label}</Text>
                <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.muted }}>{d.strength}</Text>
              </View>
              <Bar value={d.strength / 100} />
            </View>
          ))}
          {me?.strengths?.length ? (
            <Text style={{ fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.muted, marginTop: space.sm }}>
              You shine at {me.strengths.join(' and ')}.
            </Text>
          ) : null}
        </GlassCard>
      ) : null}

      {me?.tensions?.length ? (
        <GlassCard style={{ marginTop: space.lg }}>
          <Kicker>Worth reflecting on</Kicker>
          {me.tensions.map((t) => <Text key={t} style={{ fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.muted, marginBottom: 8 }}>• {t}</Text>)}
        </GlassCard>
      ) : null}

      <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.dim, textAlign: 'center', marginTop: space.xl }}>
        Match scores are predicted from your Soul DNA (and, if you allow it, what you're into on Soulink). Your chats and meetups stay private and are never used. Soul DNA gets sharper when you answer a few quick questions while connecting with someone.
      </Text>
      {onDone ? <Button title="Start connecting" style={{ marginTop: space.lg }} onPress={onDone} /> : null}
      {onRetake ? <Button variant="ghost" title="Retake Soul DNA 💎" style={{ marginTop: space.sm }} onPress={onRetake} /> : null}
    </>
  );
}

export default function SoulQuiz() {
  const { user, setUser } = useAuth();
  const { retake } = useLocalSearchParams(); // Premium retake: start from the first question
  const [data, setData] = useState(null); // { sections, questions, total, completed }
  const [answers, setAnswers] = useState({});
  const [phase, setPhase] = useState('loading'); // loading | intro | quiz | saving | result
  const [i, setI] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fade = useRef(new Animated.Value(1)).current;
  const pending = useRef({});
  const timer = useRef(null);
  const shownAt = useRef(Date.now());   // gut-reaction timing: when this scenario appeared
  const changes = useRef({});           // how many times an answer was changed
  const addedRef = useRef(0);           // scenarios Soul DNA added because it was still unsure
  const [other, setOther] = useState(null); // "Anything else…" text being typed (null = closed)
  useEffect(() => { shownAt.current = Date.now(); setOther(null); }, [i, phase]);

  useEffect(() => {
    (async () => {
      try {
        const d = await api('/soul/dna');
        setData(d); setAnswers(d.answers || {});
        if (d.completed && user?.soulReady && !retake) {
          const m = await api('/soul/dna/me');
          if (m.ready) { setResult({ type: m.type, tagline: m.tagline, me: m.me }); setPhase('result'); return; }
        }
        setPhase('intro');
      } catch (e) { setError(e.message); setPhase('intro'); }
    })();
    return () => clearTimeout(timer.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const qs = data?.questions || [];
  const sections = data?.sections || [];
  const labels = useMemo(() => Object.fromEntries((qs.find((x) => x.type === 'rank')?.items || []).map((x) => [x.key, x.label])), [qs]);
  const answeredCount = qs.filter((q) => answers[q.id] !== undefined).length;
  const firstOpen = Math.max(0, qs.findIndex((q) => answers[q.id] === undefined));

  // save answers in small batches so a lost signal never loses progress
  const flush = async () => {
    const batch = pending.current; pending.current = {};
    if (!Object.keys(batch).length) return;
    try {
      const r = await api('/soul/dna/answers', { method: 'PUT', body: { answers: batch } });
      if (r.added?.length) {
        addedRef.current += r.added.length;
        setData((d) => ({ ...d, questions: [...d.questions, ...r.added.filter((n) => !d.questions.some((q) => q.id === n.id))], total: r.total }));
      }
    }
    catch (e) {
      if (e.code === 'premium_required') { setError(e.message); return; } // finished Soul DNA can only be changed with Premium
      pending.current = { ...batch, ...pending.current }; setError('Could not save, will retry…');
    }
  };
  const queue = (id, v) => {
    pending.current[id] = v;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  };

  const finish = async () => {
    setPhase('saving'); setError(null);
    try {
      clearTimeout(timer.current); await flush();
      if (Object.keys(pending.current).length) throw new Error('Could not save your answers. Check the connection and try again.');
      if (addedRef.current) { // Soul DNA wants a few more answers first
        const from = qs.length; addedRef.current = 0;
        setPhase('quiz'); setI(from); return;
      }
      const r = await api('/soul/dna/complete', { method: 'POST' });
      setUser(r.user);
      setResult({ type: r.soul.type, tagline: r.soul.tagline, me: r.me, fresh: true });
      setPhase('result');
    } catch (e) { setError(e.message); setPhase('quiz'); }
  };

  const go = (next) => {
    Animated.timing(fade, { toValue: 0, duration: 130, useNativeDriver: true }).start(() => {
      setChosen(null);
      if (next >= qs.length) finish(); else setI(next);
      Animated.timing(fade, { toValue: 1, duration: 190, useNativeDriver: true }).start();
    });
  };
  const answer = (v, instant, text) => {
    const q = qs[i];
    if (chosen !== null) return;
    if (answers[q.id] !== undefined) changes.current[q.id] = (changes.current[q.id] || 0) + 1;
    const value = { o: v, ms: Date.now() - shownAt.current, ...(text ? { t: text } : {}), ...(changes.current[q.id] ? { ch: changes.current[q.id] } : {}) };
    setAnswers((a) => ({ ...a, [q.id]: value }));
    queue(q.id, value);
    if (instant) { go(i + 1); return; }
    setChosen(v);
    setTimeout(() => go(i + 1), 240);
  };

  const back = () => {
    if (phase === 'quiz') { if (i > 0) setI(i - 1); else setPhase('intro'); return; }
    flush(); router.canGoBack() ? router.back() : router.replace('/');
  };

  if (phase === 'loading') return <BrandScreen back><ActivityIndicator color={colors.aura} size="large" /></BrandScreen>;

  if (phase === 'result' && result) {
    return (
      <BrandScreen back center={false}>
        <DnaResult {...result} labels={labels}
          onDone={result.fresh ? () => router.back() : null}
          onRetake={() => retakeSoulDna(user)} />
      </BrandScreen>
    );
  }

  if (phase === 'intro') {
    const started = answeredCount > 0;
    return (
      <BrandScreen back onBack={back}>
        <BrandHeader size={36} title={retake ? 'Retake your Soul DNA' : user?.soulType && !user?.soulReady ? 'Soul DNA got smarter' : 'Create your Soul DNA'}
          subtitle={user?.soulType && !user?.soulReady
            ? 'Soul DNA now learns how you think, act and react, through real-life situations. Please take the new version (about 8 minutes) to see your matches again.'
            : 'Real-life situations that show how you think, act and react. About 8 minutes. No right answers: go with your gut.'} />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <GlassCard>
          {sections.map((s) => {
            const list = qs.filter((q) => q.section === s.key);
            const done = list.filter((q) => answers[q.id] !== undefined).length;
            return (
              <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7 }}>
                <Text style={{ width: 28, fontSize: 16 }}>{s.emoji}</Text>
                <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.text }}>{s.title}</Text>
                <Text style={{ fontFamily: fonts.mono, fontSize: 11.5, color: done === list.length ? colors.aura : colors.dim }}>{done === list.length ? '✓' : `${done}/${list.length}`}</Text>
              </View>
            );
          })}
        </GlassCard>
        <Button title={started ? `Continue (${answeredCount}/${qs.length})` : 'Start'} style={{ marginTop: space.xl }}
          onPress={() => { setI(answeredCount >= qs.length ? qs.length - 1 : firstOpen); setPhase('quiz'); }} />
        {answeredCount >= qs.length ? <Button variant="ghost" title="See my Soul DNA" style={{ marginTop: space.sm }} onPress={finish} /> : null}
      </BrandScreen>
    );
  }

  if (phase === 'saving') {
    return (
      <BrandScreen back={false}>
        <View style={{ alignItems: 'center' }}>
          <ActivityIndicator color={colors.aura} size="large" />
          <Text style={{ color: colors.muted, fontFamily: fonts.body, marginTop: space.md }}>Decoding your soul…</Text>
        </View>
      </BrandScreen>
    );
  }

  const q = qs[i];
  const sec = sections.find((s) => s.key === q?.section);
  const secIdx = sections.indexOf(sec);
  const current = answers[q?.id];
  return (
    <BrandScreen back onBack={back} center={false}
      right={<><Bar value={answeredCount / qs.length} style={{ marginHorizontal: space.md }} /><Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted, width: 44, textAlign: 'right' }}>{i + 1}/{qs.length}</Text></>}>
      <View style={{ alignItems: 'center', marginTop: space.lg, marginBottom: space.lg }}>
        <Text style={{ fontSize: 30 }}>{sec?.emoji}</Text>
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.2, color: colors.aura, textTransform: 'uppercase', marginTop: 6 }}>
          {sec?.title} · {secIdx + 1} of {sections.length}
        </Text>
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {q ? (
        <Animated.View style={{ opacity: fade }}>
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 20, lineHeight: 28, color: colors.text, textAlign: 'center', marginBottom: space.xl }}>{q.text}</Text>
          {q.type === 'scale' ? <ScaleQ q={q} value={chosen ?? current} onPick={(v) => answer(v)} /> : null}
          {q.type === 'rank' ? <RankQ q={q} value={current} onDone={(v) => answer(v, true)} /> : null}
          {q.type === 'forced' ? q.options.map((label, idx) => (
            <View key={label}>
              {idx === 1 ? <Text style={{ textAlign: 'center', fontFamily: fonts.mono, fontSize: 11, color: colors.dim, marginBottom: 10 }}>OR</Text> : null}
              <Option label={label} chosen={optOf(chosen ?? current) === idx} onPress={() => answer(idx)} />
            </View>
          )) : null}
          {q.type === 'choice' ? q.options.map((label, idx) => (
            <Option key={label} label={label} chosen={optOf(chosen ?? current) === idx} onPress={() => answer(idx)} />
          )) : null}
          {q.allowOther ? (other === null ? (
            <Option label={optOf(current) === -1 ? `Anything else: “${current.t}”` : 'Anything else… (type your own)'} chosen={optOf(current) === -1} dim={optOf(current) !== -1} onPress={() => setOther(optOf(current) === -1 ? current.t : '')} />
          ) : (
            <View style={{ marginBottom: 10 }}>
              <TextInput value={other} onChangeText={setOther} autoFocus maxLength={300} multiline placeholder="What would you do?" placeholderTextColor={colors.dim}
                style={{ minHeight: 52, borderRadius: 18, borderWidth: 1.5, borderColor: colors.aura, paddingHorizontal: 18, paddingVertical: 12, color: colors.text, fontFamily: fonts.medium, fontSize: 15.5, backgroundColor: colors.inputBg }} />
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <Button small variant="ghost" title="Cancel" onPress={() => setOther(null)} style={{ flex: 1, marginRight: space.sm }} />
                <Button small title="Save" disabled={!other.trim()} onPress={() => answer(-1, true, other.trim())} style={{ flex: 2 }} />
              </View>
            </View>
          )) : null}
          {current !== undefined && q.type !== 'rank' && i + 1 < qs.length ? (
            <Button small variant="ghost" title="Next" style={{ marginTop: space.md }} onPress={() => go(i + 1)} />
          ) : null}
          {i + 1 >= qs.length && answeredCount >= qs.length ? <Button title="See my Soul DNA" style={{ marginTop: space.lg }} onPress={finish} /> : null}
        </Animated.View>
      ) : null}
    </BrandScreen>
  );
}
