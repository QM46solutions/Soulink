// Soul DNA v6: 7 short rounds, 3 taps each (21 in all), about 4 minutes, no typing.
// Every round opens with one photo grid ("which of these is you?", pick up to 3, the order you tap is your
// ranking), then two quick questions. Built on published psychology research ("Why we ask" says what each
// round measures).
//   1 Your nature   2 Your feelings   3 What matters most   4 Love and loyalty
//   5 Your lifestyle   6 Your day   7 After a disagreement
// Every screen is saved when you tap Next, so you can stop and continue later. Taps only: no swiping, no emoji.
// Ends with your Soul DNA: how you think (in words), give and take, your spectrum and what wins for you.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Pressable, Text, View } from 'react-native';
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

// ---------- what each round measures (shown under "Why we ask") ----------
const WHY = {
  personality: ['Your personality (the Big Five)', 'The photos you pick, and the order you pick them in, show how outgoing, organised, open, kind and steady you are.', 'IPIP / Mini-IPIP Big Five (public domain)'],
  emotion: ['How you handle closeness and feelings', 'How you cope when upset, and your first reaction to distance or closeness. Quick answers are more honest, so how fast you tap is noted.', 'Attachment research (Fraley et al.) and emotion regulation (Gross & John)'],
  values: ['What matters most, and how firmly', 'Your top 3 show what wins when life pulls two ways. The firmness dial shows whether it’s a preference or a line you won’t cross.', 'Schwartz theory of basic human values'],
  loyalty: ['What you want, loyalty and trust', 'Your answers are matched with the other person’s, never judged. Nobody is labelled “disloyal”.', 'Investment Model of commitment (Rusbult) and jealousy research'],
  flex: ['Your lifestyle and deal-breakers', 'A “Never” that the other person has stops a match. Everything starts as Flexible.', 'Relationship deal-breakers research (Jonason et al., 2015)'],
  rhythm: ['Your daily rhythm', 'Partners whose sleep and free time barely overlap get less time together.', 'Morning–evening type research (Horne & Östberg)'],
  conflict: ['How you argue and make up', 'Shouting, going silent and holding grudges are warning signs; making up quickly protects a relationship. Shown to someone only after you connect.', 'Gottman’s couples research; dual-concern model of conflict'],
};

/** What to do on this screen, step by step; the step you're on is highlighted (index = how many are done). */
function stepsFor(q, v) {
  switch (q.kind) {
    case 'photos': {
      const n = v?.s?.length || 0;
      if (q.exact) return { list: [`Tap your top ${q.max}, the most important first (${n} of ${q.max})`], at: n >= q.max ? 1 : 0 };
      return { list: [`Tap the photos that are you, up to ${q.max}. Your first tap counts most.`], at: n ? 1 : 0 };
    }
    case 'vs': return { list: ['Tap the one that matters more to you', 'Then choose how firm you are on it'], at: !Number.isInteger(v?.o) ? 0 : !Number.isInteger(v?.f) ? 1 : 2 };
    case 'loyal': return { list: ['Tap what you would really do', 'Then choose how firm you are on it'], at: !Number.isInteger(v?.o) ? 0 : !Number.isInteger(v?.f) ? 1 : 2 };
    case 'react': return { list: ['Tap your first reaction. Don’t overthink it.'], at: Number.isInteger(v?.o) ? 1 : 0 };
    case 'pick': return { list: ['Tap one answer'], at: Number.isInteger(v?.o) ? 1 : 0 };
    case 'me': return { list: ['Tap every photo that is you'], at: v?.s?.length ? 1 : 0, optional: true };
    case 'boxes': return { list: ['Tap a chip once for MUST, twice for NEVER, a third time to make it Flexible again'], at: v?.must?.length || v?.never?.length ? 1 : 0, optional: true };
    default: return { list: [], at: 0 };
  }
}

/** The instructions card: numbered steps, the current one highlighted, then "All set: tap Next". */
function Instructions({ list, at, optional }) {
  if (!list.length) return null;
  const done = at >= list.length;
  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: done ? 'rgba(66,232,192,0.45)' : 'rgba(255,107,157,0.45)', backgroundColor: done ? 'rgba(66,232,192,0.08)' : 'rgba(255,107,157,0.08)', padding: 12, marginBottom: space.lg, gap: 8 }}>
      {list.map((t, k) => {
        const state = k < at ? 'done' : k === at ? 'now' : 'next';
        return (
          <View key={t} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, marginRight: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: state === 'done' ? colors.mint : state === 'now' ? colors.spark : 'transparent', borderWidth: state === 'next' ? 1.5 : 0, borderColor: colors.dim }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 12.5, color: state === 'next' ? colors.dim : '#0e0c16' }}>{state === 'done' ? '✓' : k + 1}</Text>
            </View>
            <Text style={{ flex: 1, fontFamily: state === 'now' ? fonts.bold : fonts.medium, fontSize: 15, lineHeight: 20, color: state === 'next' ? colors.dim : state === 'done' ? colors.muted : colors.text }}>{t}</Text>
          </View>
        );
      })}
      {done || optional ? (
        <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.mint, marginLeft: 34 }}>{done ? 'All set: tap Next' : 'None of these? Just tap Next'}</Text>
      ) : null}
    </View>
  );
}
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

/** A tappable box. `tone`: soul (chosen), mint (Must), spark (Never), gold. */
function Tap({ onPress, on, tone = 'soul', style, children, label, disabled }) {
  const c = { soul: colors.soul, mint: colors.mint, spark: colors.spark, gold: colors.gold }[tone];
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!on, disabled: !!disabled }}
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

const DIAL_HELP = ['I can bend on this', 'It matters a lot', 'I won’t cross this line'];
function Dial({ value, onPick, labels }) {
  const waiting = !Number.isInteger(value);
  return (
    <View style={{ marginTop: space.lg, padding: 12, borderRadius: 16, borderWidth: waiting ? 1.5 : 1, borderColor: waiting ? colors.spark : colors.border, backgroundColor: waiting ? 'rgba(255,107,157,0.06)' : 'transparent' }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.text, marginBottom: 10 }}>How firm are you on this?</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {labels.map((l, k) => (
          <Tap key={l} on={value === k} tone={['mint', 'gold', 'spark'][k]} onPress={() => onPick(k)} style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center' }} label={`${l}: ${DIAL_HELP[k]}`}>
            <Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 13.5, textAlign: 'center' }}>{l}</Text>
            <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 11.5, lineHeight: 15, textAlign: 'center', marginTop: 3 }}>{DIAL_HELP[k]}</Text>
          </Tap>
        ))}
      </View>
    </View>
  );
}

// ---------- the photo grid (3 across) ----------
/** One photo tile: the photo, a short caption under it; when picked, a coloured frame and its number (1, 2, 3). */
function PhotoTile({ uri, label, badge, on, faded, onPress }) {
  const [broken, setBroken] = useState(false);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}${on ? `, picked ${badge}` : ''}`} accessibilityState={{ selected: !!on }}
      style={{ width: '31.6%', opacity: faded ? 0.45 : 1 }}>
      <View style={{ aspectRatio: 1, borderRadius: 14, overflow: 'hidden', borderWidth: on ? 3 : 1, borderColor: on ? colors.soul : colors.border, backgroundColor: colors.inputBg }}>
        {uri && !broken ? <Image source={{ uri }} onError={() => setBroken(true)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" accessibilityIgnoresInvertColors />
          : <LinearGradient colors={['rgba(124,92,252,0.30)', 'rgba(255,107,157,0.22)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />}
        {on ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(124,92,252,0.18)' }} /> : null}
        {on ? (
          <View style={{ position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
            <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={2} style={{ marginTop: 6, minHeight: 34, fontFamily: on ? fonts.bold : fonts.medium, fontSize: 12.5, lineHeight: 17, color: on ? colors.text : colors.muted, textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

/** Pick up to q.max photos; the order you tap them is your ranking (tap again to take one back). */
function PhotoGrid({ q, value, onChange }) {
  const s = value?.s || [];
  const full = s.length >= q.max;
  const tap = (k) => {
    if (s.includes(k)) onChange({ s: s.filter((x) => x !== k) });
    else if (!full) onChange({ s: [...s, k] });
  };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 }}>
      {q.options.map((label, k) => (
        <PhotoTile key={label} uri={q.photos?.[k]} label={label} on={s.includes(k)} badge={s.indexOf(k) + 1} faded={full && !s.includes(k)} onPress={() => tap(k)} />
      ))}
      {q.options.length % 3 ? <View style={{ width: '31.6%' }} /> : null}
    </View>
  );
}

/** Lifestyle photos: tap every one that is you (no limit). */
function MeGrid({ q, value, onChange }) {
  const s = value?.s || [];
  const tap = (key) => onChange({ s: s.includes(key) ? s.filter((x) => x !== key) : [...s, key] });
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 }}>
      {q.chips.map((c) => <PhotoTile key={c.key} uri={c.photo} label={c.label} on={s.includes(c.key)} badge="✓" onPress={() => tap(c.key)} />)}
      {q.chips.length % 3 ? <View style={{ width: '31.6%' }} /> : null}
    </View>
  );
}

function Choices({ q, value, onChange }) {
  const o = value?.o;
  if (q.kind === 'vs') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {q.options.map((label, k) => (
          <View key={label} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
            {k === 1 ? <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.dim, marginRight: 8 }}>OR</Text> : null}
            <Tap on={o === k} onPress={() => onChange({ ...value, o: k })} label={label} style={{ flex: 1, minHeight: 110, padding: 14, alignItems: 'center', justifyContent: 'center' }}>
              <Label size={15.5} center bold>{label}</Label>
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
          <View style={{ width: 20, height: 20, borderRadius: 10, marginRight: 12, borderWidth: 2, borderColor: o === k ? colors.soul : colors.dim, alignItems: 'center', justifyContent: 'center' }}>
            {o === k ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.soul }} /> : null}
          </View>
          <View style={{ flex: 1 }}><Label>{label}</Label></View>
        </Tap>
      ))}
    </View>
  );
}

/** For a partner: each chip is Flexible, MUST or NEVER. */
function Boxes({ q, value, onChange }) {
  const v = value || { must: [], never: [] };
  const stateOf = (k) => (v.must.includes(k) ? 'must' : v.never.includes(k) ? 'never' : 'flex');
  const tap = (k) => {
    const st = stateOf(k);
    const must = v.must.filter((x) => x !== k); const never = v.never.filter((x) => x !== k);
    if (st === 'flex') must.push(k); else if (st === 'must') never.push(k);
    onChange({ must, never });
  };
  return (
    <>
      <View style={{ gap: 6, marginBottom: space.md }}>
        {[[colors.mint, 'MUST', 'they need to have this'], [colors.spark, 'NEVER', 'a deal-breaker for me'], [colors.dim, 'FLEXIBLE', 'I don’t mind either way']].map(([c, k, t]) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ width: 82, fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.6, color: c }}>{k}</Text>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.text }}>{t}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {q.chips.map((c) => {
          const st = stateOf(c.key);
          return (
            <Tap key={c.key} on={st !== 'flex'} tone={st === 'never' ? 'spark' : 'mint'} onPress={() => tap(c.key)} label={`${c.label}: ${st}`}
              style={{ paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', borderRadius: 999 }}>
              <Text style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 14 }}>{c.label}</Text>
              <Text style={{ marginLeft: 7, fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 0.6, color: st === 'must' ? colors.mint : st === 'never' ? colors.spark : colors.dim }}>{st === 'must' ? 'MUST' : st === 'never' ? 'NEVER' : 'FLEXIBLE'}</Text>
            </Tap>
          );
        })}
      </View>
    </>
  );
}

/** Is this answer complete enough to move on? */
const ready = (q, v) => {
  if (q.kind === 'me' || q.kind === 'boxes') return true; // nothing ticked is a fine answer
  if (!v) return false;
  if (q.kind === 'photos') return q.exact ? v.s?.length === q.max : v.s?.length > 0;
  if (!Number.isInteger(v.o)) return false;
  return DIAL_KINDS.includes(q.kind) ? Number.isInteger(v.f) : true;
};
/** The answer as sent to the server (empty chip games get their empty shape). */
const finalOf = (q, v) => (q.kind === 'me' ? (v || { s: [] }) : q.kind === 'boxes' ? (v || { must: [], never: [] }) : v);
/** A round number in a small ring (used instead of icons). */
const Num = ({ n, done, size = 26 }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: done ? colors.mint : colors.aura, backgroundColor: done ? 'rgba(66,232,192,0.15)' : 'transparent' }}>
    <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.46, color: done ? colors.mint : colors.aura }}>{done ? '✓' : n}</Text>
  </View>
);

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
                <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.text }}>{d.label}</Text>
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
      {onRetake ? <Button variant="ghost" title="Play Soul DNA again" style={{ marginTop: space.sm }} onPress={onRetake} /> : null}
    </>
  );
}


// ---------- the games ----------
export default function SoulGames() {
  const { user, setUser } = useAuth();
  const { retake } = useLocalSearchParams(); // Premium retake: start from the first round
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

  // the loyalty question follows "What are you looking for?", so the plan is worked out from the live answers
  const plan = useMemo(() => {
    if (!data) return [];
    const friend = data.questions.find((q) => q.id === 'it_look')?.options?.[answers.it_look?.o ?? answers.it_look] === 'Friendship';
    return data.questions.filter((q) => !q.variant || q.variant === (friend ? 'friend' : 'partner')).map((q) => q.id);
  }, [data, answers.it_look]);
  const steps = useMemo(() => (data ? plan.map((id) => data.questions.find((q) => q.id === id)).filter(Boolean) : []), [data, plan]);
  const sections = data?.sections || [];
  const answered = plan.filter((id) => answers[id] !== undefined).length;
  const firstOpen = Math.max(0, steps.findIndex((q) => answers[q.id] === undefined));

  const setAnswer = (q, v) => {
    const prev = answers[q.id];
    if (firstTap.current[q.id] == null) firstTap.current[q.id] = Date.now() - shownAt.current;
    else if (Number.isInteger(prev?.o) && v?.o !== prev.o) changes.current[q.id] = (changes.current[q.id] || 0) + 1; // the dial isn't a change of mind
    setAnswers((a) => ({ ...a, [q.id]: v }));
  };

  const save = async (q) => {
    let v = finalOf(q, answers[q.id]);
    if (q.kind !== 'me' && q.kind !== 'boxes') {
      const ms = firstTap.current[q.id]; const ch = changes.current[q.id];
      v = { ...(typeof v === 'object' ? v : { o: v }), ...(ms != null ? { ms } : {}), ...(ch ? { ch: Math.min(ch, 49) } : {}) };
    }
    await api('/soul/dna/answers', { method: 'PUT', body: { answers: { [q.id]: v } } });
    setAnswers((a) => ({ ...a, [q.id]: v }));
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
      const open = steps.findIndex((q) => answers[q.id] === undefined);
      if (open >= 0) setI(open);
    }
  };

  const next = async () => {
    const q = steps[i];
    if (!q || busy) return;
    setBusy(true); setError(null);
    try {
      await save(q);
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
        <BrandHeader size={36} title={retake ? 'Play Soul DNA again' : upgrade ? 'Soul DNA is now shorter' : 'Create your Soul DNA'}
          subtitle={upgrade
            ? '7 quick rounds, 21 taps, about 4 minutes. Your current Soul DNA and matches stay until you finish.'
            : '7 quick rounds, 21 taps, about 4 minutes. Pick the photos that feel like you. No right answers.'} />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <GlassCard>
          {sections.map((s, n) => {
            const list = plan.filter((id) => data.questions.find((q) => q.id === id)?.section === s.key);
            const done = list.filter((id) => answers[id] !== undefined).length;
            const all = !!list.length && done === list.length;
            return (
              <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7 }}>
                <View style={{ marginRight: 12 }}><Num n={n + 1} done={all} /></View>
                <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14.5, color: colors.text }}>{s.title}</Text>
                <Text style={{ fontFamily: fonts.mono, fontSize: 11.5, color: all ? colors.mint : colors.dim }}>{done}/{list.length}</Text>
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

  const q = steps[Math.min(i, steps.length - 1)];
  const secN = sections.findIndex((s) => s.key === q.section);
  const sec = sections[secN];
  const inSec = steps.filter((x) => x.section === q.section);
  const pos = inSec.indexOf(q) + 1;
  const v = answers[q.id];
  const w = WHY[q.section];
  const title = q.kind === 'vs' ? 'Which matters more to you?' : q.kind === 'boxes' ? 'What do you need in a partner?' : q.text;
  return (
    <BrandScreen back onBack={back} center={false}
      right={<><Bar value={answered / Math.max(1, plan.length)} style={{ marginHorizontal: space.md }} /><Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted, width: 44, textAlign: 'right' }}>{i + 1}/{steps.length}</Text></>}>
      <View style={{ marginTop: space.md, marginBottom: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <View style={{ backgroundColor: 'rgba(255,107,157,0.16)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 1, color: colors.spark, textTransform: 'uppercase' }}>{secN + 1} of {sections.length} · {sec?.title}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {inSec.map((x, k) => <View key={x.id} style={{ width: 16, height: 4, borderRadius: 2, backgroundColor: k < pos ? colors.spark : colors.border }} />)}
          </View>
        </View>
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 23, lineHeight: 30, color: colors.text, marginTop: 10 }}>{title}</Text>
      </View>
      <Instructions {...stepsFor(q, v)} />
      {error ? <ErrorText>{error}</ErrorText> : null}

      {q.kind === 'photos' ? <PhotoGrid q={q} value={v} onChange={(x) => setAnswer(q, x)} /> : null}
      {q.kind === 'me' ? <MeGrid q={q} value={v} onChange={(x) => setAnswer(q, x)} /> : null}
      {q.kind === 'boxes' ? <Boxes q={q} value={v} onChange={(x) => setAnswer(q, x)} /> : null}
      {['pick', 'react', 'vs', 'loyal'].includes(q.kind) ? <Choices q={q} value={v} onChange={(x) => setAnswer(q, x)} /> : null}
      {DIAL_KINDS.includes(q.kind) && Number.isInteger(v?.o) ? <Dial labels={q.dial} value={v?.f} onPick={(f) => setAnswer(q, { ...v, f })} /> : null}

      {why && w ? (
        <View style={{ marginTop: space.lg, padding: 14, borderRadius: 14, backgroundColor: 'rgba(66,232,192,0.10)', borderWidth: 1, borderColor: 'rgba(66,232,192,0.35)' }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.mint, marginBottom: 4 }}>What this tells us: {w[0]}</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.text }}>{w[1]}</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 6, fontStyle: 'italic' }}>Based on: {w[2]}</Text>
        </View>
      ) : null}
      {q.photos || q.kind === 'me' ? <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.dim, marginTop: space.md }}>Photos: Unsplash</Text> : null}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: space.xl, marginBottom: space.xl }}>
        <Button small variant="ghost" title={why ? 'Hide' : 'Why we ask'} onPress={() => setWhy(!why)} style={{ flex: 1 }} />
        <Button title={i + 1 >= steps.length ? 'See my Soul DNA' : 'Next'} disabled={!ready(q, v)} loading={busy} onPress={next} style={{ flex: 2 }} />
      </View>
    </BrandScreen>
  );
}
