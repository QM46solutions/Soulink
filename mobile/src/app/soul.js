// Soul DNA v5: 7 short tap games (plus 3 taps about what you want), about 6 minutes, no typing.
// Each game is built on published psychology research ("Why we ask" on every screen says what it measures).
//   Before we start  what you want (3 picks)          Game 4  Loyalty & commitment (+ how firm you are)
//   Game 1  Which one is you? (Most me / Least me)    Game 5  Three boxes (you, then Must / Never for a partner)
//   Game 2  React (gut reactions, timed)              Game 6  Build my day
//   Game 3  Which matters more? (+ how firm you are)  Game 7  Your move (after a disagreement)
// Every screen is saved when you tap Next, so you can stop and continue later. Taps only: no swiping.
// Ends with your Soul DNA: how you think (in words), give and take, your spectrum and what wins for you.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, Text, View } from 'react-native';
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

// ---------- what each game measures (shown under "Why we ask") ----------
const WHY = {
  intent: ['What you want', 'Different goals (marriage vs exploring, kids vs no kids) are among the most common deal-breakers.', 'Relationship deal-breakers research (Jonason et al., 2015)'],
  personality: ['Your personality (the Big Five)', 'Each trait appears 4 times. Choosing “Most me” and “Least me” is harder to fake than rating yourself.', 'IPIP / Mini-IPIP Big Five (public domain)'],
  emotion: ['How you handle closeness and feelings', 'Your first reaction is noted, and how quickly you tap. Gut reactions are more honest.', 'Attachment research (Fraley et al.) and emotion regulation (Gross & John)'],
  values: ['What matters most, and how firmly', 'The cards pit opposite values against each other, so you can’t pick both. The dial shows whether it’s a preference or a line you won’t cross.', 'Schwartz theory of basic human values'],
  loyalty: ['Loyalty, trust and commitment', 'Your answers are matched with the other person’s lines, never judged. Nobody is labelled “disloyal”.', 'Investment Model of commitment (Rusbult) and jealousy research'],
  flex: ['Deal-breakers and must-haves', 'A “Never” that the other person has stops a match. Everything starts as Flexible.', 'Relationship deal-breakers research (Jonason et al., 2015)'],
  rhythm: ['Your daily rhythm', 'Partners whose sleep and free time barely overlap get less time together.', 'Morning–evening type research (Horne & Östberg)'],
  conflict: ['How you argue and make up', 'Criticism, defensiveness and stonewalling are warning signs; making up quickly protects a relationship. Your picks are shown to someone only after you connect.', 'Gottman’s couples research; dual-concern model of conflict'],
};
const HINT = {
  mostleast: 'Tap one for “Most me”, then another for “Least me”.',
  me: 'Skip anything that doesn’t apply.',
  boxes: 'Tap a chip to change it: Flexible → Must → Never.',
};
const DIAL_KINDS = ['vs', 'loyal'];

function Bar({ value, style }) {
  return (
    <View style={[{ flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' }, style]}>
      <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: 4 }} />
    </View>
  );
}

const Kicker = ({ children, style }) => (
  <Text style={[{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.2, color: colors.aura, textTransform: 'uppercase', marginBottom: space.md }, style]}>{children}</Text>
);

/** A tappable box. `tone`: soul (chosen), mint (Most me / Must), spark (Least me / Never). */
function Tap({ onPress, on, tone = 'soul', style, children, label }) {
  const c = { soul: colors.soul, mint: colors.mint, spark: colors.spark, gold: colors.gold }[tone];
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!on }}
      style={({ hovered, pressed }) => [{
        borderRadius: 16, borderWidth: 1.5,
        borderColor: on ? c : hovered ? colors.aura : colors.border,
        backgroundColor: on ? `${c}33` : pressed ? 'rgba(124,92,252,0.12)' : colors.inputBg,
      }, style]}>
      {children}
    </Pressable>
  );
}
const Label = ({ children, size = 15, center, bold }) => (
  <Text style={{ color: colors.text, fontFamily: bold ? fonts.semibold : fonts.medium, fontSize: size, lineHeight: size * 1.35, textAlign: center ? 'center' : 'left' }}>{children}</Text>
);

function Dial({ value, onPick, labels }) {
  return (
    <View style={{ marginTop: space.md }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.muted, marginBottom: 8 }}>How firm are you on this?</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {labels.map((l, k) => (
          <Tap key={l} on={value === k} tone={['mint', 'gold', 'spark'][k]} onPress={() => onPick(k)} style={{ flex: 1, paddingVertical: 11, alignItems: 'center' }} label={l}>
            <Text style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 13 }}>{l}</Text>
          </Tap>
        ))}
      </View>
    </View>
  );
}

// ---------- one screen per game round ----------
function MostLeast({ q, value, onChange }) {
  const v = value || {};
  const tap = (k) => {
    if (v.m === k) onChange({ ...v, m: undefined });
    else if (v.l === k) onChange({ ...v, l: undefined });
    else if (v.m === undefined) onChange({ ...v, m: k });
    else onChange({ ...v, l: k });
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {q.options.map((label, k) => {
        const tag = v.m === k ? 'Most me' : v.l === k ? 'Least me' : null;
        return (
          <Tap key={label} on={!!tag} tone={v.m === k ? 'mint' : 'spark'} onPress={() => tap(k)} label={label} style={{ width: '47.5%', padding: 10 }}>
            <View style={{ aspectRatio: 4 / 3, borderRadius: 10, backgroundColor: ['rgba(124,92,252,0.18)', 'rgba(66,232,192,0.14)', 'rgba(245,200,66,0.14)', 'rgba(255,107,157,0.14)'][k % 4], alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 40 }}>{q.emojis[k]}</Text>
            </View>
            <Label size={13.5} bold>{label}</Label>
            {tag ? <Text style={{ position: 'absolute', top: 6, right: 6, fontFamily: fonts.bold, fontSize: 11, color: '#fff', backgroundColor: v.m === k ? colors.mint : colors.spark, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' }}>{tag}</Text> : null}
          </Tap>
        );
      })}
    </View>
  );
}

function Choices({ q, value, onChange }) {
  const o = value?.o;
  if (q.kind === 'vs' || (q.kind === 'check' && q.section === 'values')) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'stretch', gap: 8 }}>
        {q.options.map((label, k) => (
          <View key={label} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            {k === 1 ? <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.dim, marginRight: 8 }}>OR</Text> : null}
            <Tap on={o === k} onPress={() => onChange({ ...value, o: k })} label={label} style={{ flex: 1, minHeight: 130, padding: 12, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>{q.emojis[k]}</Text>
              <Label size={14.5} center bold>{label}</Label>
            </Tap>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={{ gap: 9 }}>
      {q.options.map((label, k) => (
        <Tap key={label} on={o === k} onPress={() => onChange({ ...value, o: k })} label={label} style={{ minHeight: 52, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }}>
          {q.emojis[k] ? <Text style={{ fontSize: 22, marginRight: 12 }}>{q.emojis[k]}</Text> : null}
          <View style={{ flex: 1 }}><Label>{label}</Label></View>
        </Tap>
      ))}
    </View>
  );
}

function Chips({ q, value, onChange }) {
  const boxes = q.kind === 'boxes';
  const v = value || (boxes ? { must: [], never: [] } : { s: [] });
  const stateOf = (k) => (boxes ? (v.must.includes(k) ? 'must' : v.never.includes(k) ? 'never' : 'flex') : v.s.includes(k) ? 'on' : 'off');
  const tap = (k) => {
    if (!boxes) { onChange({ s: v.s.includes(k) ? v.s.filter((x) => x !== k) : [...v.s, k] }); return; }
    const st = stateOf(k);
    const must = v.must.filter((x) => x !== k); const never = v.never.filter((x) => x !== k);
    if (st === 'flex') must.push(k); else if (st === 'must') never.push(k);
    onChange({ must, never });
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {q.chips.map((c) => {
        const st = stateOf(c.key);
        return (
          <Tap key={c.key} on={st === 'on' || st === 'must' || st === 'never'} tone={st === 'never' ? 'spark' : 'mint'} onPress={() => tap(c.key)} label={c.label}
            style={{ paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', borderRadius: 999 }}>
            <Text style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 14 }}>{c.label}</Text>
            {boxes ? <Text style={{ marginLeft: 7, fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 0.6, color: st === 'must' ? colors.mint : st === 'never' ? colors.spark : colors.dim }}>{st === 'must' ? 'MUST' : st === 'never' ? 'NEVER' : 'FLEXIBLE'}</Text> : null}
          </Tap>
        );
      })}
    </View>
  );
}

function PickRow({ q, value, onChange, icons }) {
  return (
    <View style={{ marginBottom: space.lg }}>
      <Text style={{ fontFamily: icons ? fonts.mono : fonts.semibold, fontSize: icons ? 11 : 16, letterSpacing: icons ? 1.1 : 0, textTransform: icons ? 'uppercase' : 'none', color: icons ? colors.muted : colors.text, marginBottom: 8 }}>{q.text}</Text>
      <View style={{ flexDirection: 'row', flexWrap: icons ? 'nowrap' : 'wrap', gap: 8 }}>
        {q.options.map((label, k) => (
          <Tap key={label} on={value?.o === k} onPress={() => onChange({ ...value, o: k })} label={label}
            style={icons ? { flex: 1, paddingVertical: 8, paddingHorizontal: 2, alignItems: 'center' } : { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 999, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: icons ? 22 : 16, marginRight: icons ? 0 : 6 }}>{q.emojis[k]}</Text>
            <Text style={{ color: colors.text, fontFamily: fonts.medium, fontSize: icons ? 11 : 14, textAlign: 'center', marginTop: icons ? 3 : 0 }}>{label}</Text>
          </Tap>
        ))}
      </View>
    </View>
  );
}

/** Is this answer complete enough to move on? */
const ready = (q, v) => {
  if (q.kind === 'me' || q.kind === 'boxes') return true; // nothing ticked is a fine answer
  if (!v) return false;
  if (q.kind === 'mostleast') return Number.isInteger(v.m) && Number.isInteger(v.l);
  if (!Number.isInteger(v.o)) return false;
  return DIAL_KINDS.includes(q.kind) ? Number.isInteger(v.f) : true;
};
/** The answer as sent to the server (empty chip games get their empty shape). */
const finalOf = (q, v) => (q.kind === 'me' ? (v || { s: [] }) : q.kind === 'boxes' ? (v || { must: [], never: [] }) : v);

/** Steps (screens) for this person: grouped screens (intent, the day) and one item per screen otherwise. */
function buildSteps(questions, plan) {
  const inPlan = new Set(plan);
  const steps = [];
  for (const q of questions) {
    if (!inPlan.has(q.id)) continue;
    const last = steps[steps.length - 1];
    if (q.screen && last?.screen === q.screen) last.items.push(q);
    else steps.push({ key: q.id, screen: q.screen || null, section: q.section, items: [q] });
  }
  return steps;
}

// ---------- your Soul DNA (after finishing, or when you open it again) ----------
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

export function DnaResult({ type, tagline, me, labels = {}, onDone, onRetake }) {
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
        </GlassCard>
      ) : null}

      {me?.tensions?.length ? (
        <GlassCard style={{ marginTop: space.lg }}>
          <Kicker>Worth reflecting on</Kicker>
          {me.tensions.map((t) => <Text key={t} style={{ fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.muted, marginBottom: 8 }}>• {t}</Text>)}
        </GlassCard>
      ) : null}

      <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.dim, textAlign: 'center', marginTop: space.xl }}>
        Soul DNA is a matching aid built on published psychology research, not a psychological assessment. Match scores are predicted from your Soul DNA (and, if you allow it, what you're into on Soulink). Your chats and meetups stay private and are never used.
      </Text>
      {onDone ? <Button title="Start connecting" style={{ marginTop: space.lg }} onPress={onDone} /> : null}
      {onRetake ? <Button variant="ghost" title="Play Soul DNA again 💎" style={{ marginTop: space.sm }} onPress={onRetake} /> : null}
    </>
  );
}

// ---------- the games ----------
export default function SoulGames() {
  const { user, setUser } = useAuth();
  const { retake } = useLocalSearchParams(); // Premium retake: start from the first game
  const [data, setData] = useState(null); // { sections, questions, plan, upgrade, completed }
  const [answers, setAnswers] = useState({});
  const [phase, setPhase] = useState('loading'); // loading | intro | play | saving | result
  const [i, setI] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [why, setWhy] = useState(false);
  const [busy, setBusy] = useState(false);
  const shownAt = useRef(Date.now()); // gut-reaction timing: when this screen appeared
  const firstTap = useRef({});        // item id → ms to the first tap
  const changes = useRef({});         // item id → times the answer was changed
  useEffect(() => { shownAt.current = Date.now(); firstTap.current = {}; changes.current = {}; setWhy(false); }, [i, phase]);

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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // the loyalty version follows "What are you looking for?", so the steps are worked out from the live answers
  const plan = useMemo(() => {
    if (!data) return [];
    const friend = data.questions.find((q) => q.id === 'it_look')?.options?.[answers.it_look?.o ?? answers.it_look] === 'Friendship';
    return data.questions.filter((q) => !q.variant || q.variant === (friend ? 'friend' : 'partner')).map((q) => q.id);
  }, [data, answers.it_look]);
  const steps = useMemo(() => (data ? buildSteps(data.questions, plan) : []), [data, plan]);
  const sections = data?.sections || [];
  const answered = plan.filter((id) => answers[id] !== undefined).length;
  const firstOpen = Math.max(0, steps.findIndex((s) => s.items.some((q) => answers[q.id] === undefined)));

  const setAnswer = (q, v) => {
    const prev = answers[q.id];
    if (firstTap.current[q.id] == null) firstTap.current[q.id] = Date.now() - shownAt.current;
    else if (Number.isInteger(prev?.o) && v?.o !== prev.o) changes.current[q.id] = (changes.current[q.id] || 0) + 1; // the dial isn't a change of mind
    setAnswers((a) => ({ ...a, [q.id]: v }));
  };

  const save = async (step) => {
    const batch = {};
    for (const q of step.items) {
      let v = finalOf(q, answers[q.id]);
      if (q.kind !== 'me' && q.kind !== 'boxes') {
        const ms = firstTap.current[q.id]; const ch = changes.current[q.id];
        v = { ...v, ...(ms != null ? { ms } : {}), ...(ch ? { ch: Math.min(ch, 49) } : {}) };
      }
      batch[q.id] = v;
    }
    await api('/soul/dna/answers', { method: 'PUT', body: { answers: batch } });
    setAnswers((a) => ({ ...a, ...batch }));
  };

  const finish = async () => {
    setPhase('saving'); setError(null);
    try {
      const r = await api('/soul/dna/complete', { method: 'POST' });
      setUser(r.user);
      setResult({ type: r.soul.type, tagline: r.soul.tagline, me: r.me, fresh: true });
      setPhase('result');
    } catch (e) {
      setError(e.message); setPhase('play');
      const open = steps.findIndex((s) => s.items.some((q) => answers[q.id] === undefined));
      if (open >= 0) setI(open);
    }
  };

  const next = async () => {
    const step = steps[i];
    if (!step || busy) return;
    setBusy(true); setError(null);
    try {
      await save(step);
      if (i + 1 >= steps.length) await finish(); else setI(i + 1);
    } catch (e) {
      setError(e.code === 'premium_required' ? e.message : 'Could not save. Check your connection and tap Next again.');
    } finally { setBusy(false); }
  };

  const back = () => {
    if (phase === 'play') { if (i > 0) setI(i - 1); else setPhase('intro'); return; }
    router.canGoBack() ? router.back() : router.replace('/');
  };

  if (phase === 'loading') return <BrandScreen back><ActivityIndicator color={colors.aura} size="large" /></BrandScreen>;

  if (phase === 'result' && result) {
    return (
      <BrandScreen back center={false}>
        <DnaResult {...result} onDone={result.fresh ? () => router.back() : null} onRetake={() => retakeSoulDna(user)} />
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

  if (phase === 'intro' || !steps.length) {
    const started = answered > 0;
    const upgrade = data?.upgrade || user?.soulUpgrade;
    return (
      <BrandScreen back onBack={back}>
        <BrandHeader size={36} title={retake ? 'Play Soul DNA again' : upgrade ? 'Soul DNA is now 7 quick games' : 'Create your Soul DNA'}
          subtitle={upgrade
            ? 'No more long quiz. Seven quick tap games, about 6 minutes. Your current Soul DNA and matches stay until you finish.'
            : 'Seven quick tap games, about 6 minutes. No typing, no right answers: go with your gut.'} />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <GlassCard>
          {sections.map((s) => {
            const list = plan.filter((id) => data.questions.find((q) => q.id === id)?.section === s.key);
            const done = list.filter((id) => answers[id] !== undefined).length;
            return (
              <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7 }}>
                <Text style={{ width: 28, fontSize: 16 }}>{s.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: colors.text }}>{s.title}</Text>
                  <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: colors.dim }}>{s.game}</Text>
                </View>
                <Text style={{ fontFamily: fonts.mono, fontSize: 11.5, color: done === list.length && list.length ? colors.aura : colors.dim }}>{done === list.length && list.length ? '✓' : `${done}/${list.length}`}</Text>
              </View>
            );
          })}
        </GlassCard>
        {steps.length ? (
          <Button title={started ? `Continue (${answered}/${plan.length})` : 'Start'} style={{ marginTop: space.xl }}
            onPress={() => { setI(answered >= plan.length ? steps.length - 1 : firstOpen); setPhase('play'); }} />
        ) : null}
        {answered >= plan.length && plan.length ? <Button variant="ghost" title="See my Soul DNA" style={{ marginTop: space.sm }} onPress={finish} /> : null}
      </BrandScreen>
    );
  }

  const step = steps[Math.min(i, steps.length - 1)];
  const sec = sections.find((s) => s.key === step.section);
  const inSec = steps.filter((s) => s.section === step.section);
  const pos = inSec.indexOf(step) + 1;
  const q = step.items[0];
  const canGo = step.items.every((x) => ready(x, answers[x.id]));
  const w = WHY[step.section];
  const title = step.screen ? null : q.kind === 'vs' ? 'Which matters more to you?' : q.kind === 'check' && q.section === 'values' ? 'One more, quickly.' : q.text;
  return (
    <BrandScreen back onBack={back} center={false}
      right={<><Bar value={answered / Math.max(1, plan.length)} style={{ marginHorizontal: space.md }} /><Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted, width: 44, textAlign: 'right' }}>{i + 1}/{steps.length}</Text></>}>
      <View style={{ marginTop: space.md, marginBottom: space.lg }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.2, color: colors.spark, textTransform: 'uppercase' }}>
          {sec?.game}{sec?.game !== sec?.title ? ` · ${sec?.title}` : ''}{inSec.length > 1 ? ` · ${pos} of ${inSec.length}` : ''}
        </Text>
        {title ? <Text style={{ fontFamily: fonts.displayBold, fontSize: 21, lineHeight: 28, color: colors.text, marginTop: 8 }}>{title}</Text> : null}
        {step.screen === 'day' ? <Text style={{ fontFamily: fonts.displayBold, fontSize: 21, lineHeight: 28, color: colors.text, marginTop: 8 }}>Build your ideal day.</Text> : null}
        {HINT[q.kind] ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 6 }}>{HINT[q.kind]}</Text> : null}
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}

      {step.screen ? step.items.map((x) => <PickRow key={x.id} q={x} value={answers[x.id]} icons={step.screen === 'day'} onChange={(v) => setAnswer(x, v)} />) : null}
      {!step.screen && q.kind === 'mostleast' ? <MostLeast q={q} value={answers[q.id]} onChange={(v) => setAnswer(q, v)} /> : null}
      {!step.screen && ['react', 'vs', 'loyal', 'check'].includes(q.kind) ? <Choices q={q} value={answers[q.id]} onChange={(v) => setAnswer(q, v)} /> : null}
      {!step.screen && DIAL_KINDS.includes(q.kind) && Number.isInteger(answers[q.id]?.o) ? <Dial labels={q.dial} value={answers[q.id]?.f} onPick={(f) => setAnswer(q, { ...answers[q.id], f })} /> : null}
      {!step.screen && (q.kind === 'me' || q.kind === 'boxes') ? <Chips q={q} value={answers[q.id]} onChange={(v) => setAnswer(q, v)} /> : null}

      {why && w ? (
        <View style={{ marginTop: space.lg, padding: 14, borderRadius: 14, backgroundColor: 'rgba(66,232,192,0.10)', borderWidth: 1, borderColor: 'rgba(66,232,192,0.35)' }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.mint, marginBottom: 4 }}>What this tells us: {w[0]}</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.text }}>{w[1]}</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 6, fontStyle: 'italic' }}>Based on: {w[2]}</Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: space.xl, marginBottom: space.xl }}>
        <Button small variant="ghost" title={why ? 'Hide' : 'Why we ask'} onPress={() => setWhy(!why)} style={{ flex: 1 }} />
        <Button title={i + 1 >= steps.length ? 'See my Soul DNA' : 'Next'} disabled={!canGo} loading={busy} onPress={next} style={{ flex: 2 }} />
      </View>
    </BrandScreen>
  );
}
