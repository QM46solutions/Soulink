// Soul DNA v7: 8 categories, short playful activities, no right answers.
// The first session is 11 activities (about 3 minutes): every category, plus 4 "anchor" activities everyone gets.
// After that, optional check-ins (3 new activities each) and per-category updates refine it, free, any time.
// Activity formats: choose what you'd do, reaction, conversation cards, pick what matters more, put in order,
// a slider, build your ideal day, pick 3 (drawn tiles), quick taps about you, and what you need in a partner.
// Every screen is saved when you tap Next, so you can stop and continue later. Taps only, no typing.
// Ends with your Soul DNA as tendencies per category, with how sure Soul DNA is, "Does this feel right?" and a way
// to update any category.
//   /soul                    first session (or your Soul DNA, when it's done)
//   /soul?retake=1           Premium: start over
//   /soul?checkin=1          a check-in (for a v6 Soul DNA: the new first session, to refresh it)
//   /soul?category=conflict  update one category ("Not quite" / Update answers)
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { retakeSoulDna } from '../lib/retake';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { BrandHeader, BrandScreen } from '../components/BrandScreen';
import { GlassCard, GradientText, PillTag } from '../components/brand';
import { Button, ErrorText } from '../components/ui';
import { colors, fonts, gradients, space } from '../lib/theme';
import { SoulDnaIcon } from '../components/LiveIcons';

// ---------- what each category measures (shown under "Why we ask") ----------
const WHY = {
  social: ['How you like to be with people', 'Big groups or a few close friends, out or in. Neither is better; it shapes who you’ll enjoy time with.', 'Big Five extraversion research (IPIP)'],
  comm: ['How you talk and listen', 'Whether you say things straight away or wait, and what you love talking about.', 'Communication style research'],
  conflict: ['How you handle disagreements', 'Talking it through or cooling off first: both work, and knowing each other’s way avoids hurt.', 'Gottman’s couples research; dual-concern model of conflict'],
  trust: ['Trust, closeness and space', 'How much closeness and reassurance feels right to you. Matched with the other person’s, never judged.', 'Attachment research (Fraley et al.)'],
  values: ['What matters most to you', 'What wins when life pulls two ways, and how firmly you hold it.', 'Schwartz theory of basic human values'],
  lifestyle: ['Your rhythm and habits', 'Body clock, plans and everyday habits. Habits are used only for what you and others say they need in a partner.', 'Morning–evening type research (Horne & Östberg)'],
  interests: ['What you’re into', 'Used for a small shared-interests bonus in your match, never as a personality trait.', 'Shared-activity research'],
  expect: ['What you want from closeness', 'Your pace and what you need in a partner. A “Never” the other person matches stops a dating or life-partner match.', 'Relationship deal-breakers research (Jonason et al., 2015)'],
};
const LEVEL = { early: ['Early read', colors.gold], fairly: ['Fairly sure', colors.aura], sure: ['Sure', colors.mint] };
const SKIPPABLE = (q) => !q.noSkip;

/** What to do on this screen; the step you're on is highlighted (index = how many are done). */
function stepsFor(q, v) {
  const has = (x) => Number.isInteger(x);
  switch (q.kind) {
    case 'react': return { list: [q.look === 'cards' ? 'Tap the card you’d enjoy most' : q.look === 'fits' ? 'Tap what fits you best' : 'Tap what feels most natural. Don’t overthink it.'], at: has(v?.o) ? 1 : 0 };
    case 'more': return q.dial ? { list: ['Tap the one that matters more to you', 'Then choose how firm you are on it'], at: !has(v?.o) ? 0 : !has(v?.f) ? 1 : 2 } : { list: ['Tap the one that suits you more'], at: has(v?.o) ? 1 : 0 };
    case 'slider': return { list: ['Tap the point between the two that fits you'], at: has(v?.v) ? 1 : 0 };
    case 'rank': { const n = v?.r?.length || 0; return { list: [`Tap them in order, most first (${n} of ${q.options.length})`], at: n >= q.options.length ? 1 : 0 }; }
    case 'day': { const n = (v?.s || []).filter(has).length; return { list: ['Pick one for each part of the day'], at: n >= q.slots.length ? 1 : 0 }; }
    case 'tiles': { const n = v?.s?.length || 0; return { list: [`Pick up to ${q.max}, your favourite first (${n} of ${q.max})`], at: n ? 1 : 0 }; }
    case 'habits': { const n = (q.groups || []).filter((g) => has(v?.[g.key])).length; return { list: ['One tap per row. “Prefer not to say” is fine.'], at: n >= (q.groups || []).length ? 1 : 0 }; }
    case 'needs': return { list: ['Tap a chip to mark it Must, tap again for Nice to have, again for Never (life together only)'], at: 1, optional: true };
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
      {done && !optional ? <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.mint, marginLeft: 34 }}>All set: tap Next</Text> : null}
      {optional ? <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.mint, marginLeft: 34 }}>Nothing you must have? Just tap Next</Text> : null}
    </View>
  );
}

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

/** A tappable box. `tone`: soul (chosen), mint (Must), gold (Nice to have), spark (Never). */
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
const Label = ({ children, size = 15, center, bold, color = colors.text }) => (
  <Text style={{ color, fontFamily: bold ? fonts.semibold : fonts.medium, fontSize: size, lineHeight: size * 1.35, textAlign: center ? 'center' : 'left' }}>{children}</Text>
);
/** A number in a small round badge (picked order, rank). */
const Badge = ({ n, size = 24 }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
    <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
    <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.5, color: '#fff' }}>{n}</Text>
  </View>
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

// ---------- the activity formats ----------
/** Choose what you'd do / reaction / choose what fits: a list. Conversation cards: a 2 × 2 grid of cards. */
function Choices({ q, value, onChange }) {
  const o = value?.o;
  if (q.look === 'cards') {
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
        {q.options.map((label, k) => (
          <Tap key={label} on={o === k} onPress={() => onChange({ o: k })} label={label} style={{ width: '48.5%', minHeight: 116, padding: 14, justifyContent: 'space-between' }}>
            <MaterialCommunityIcons name="chat-processing-outline" size={20} color={o === k ? colors.soul : colors.aura} />
            <Label size={15} bold>{label}</Label>
          </Tap>
        ))}
      </View>
    );
  }
  return (
    <View style={{ gap: 9 }}>
      {q.options.map((label, k) => (
        <Tap key={label} on={o === k} onPress={() => onChange({ o: k })} label={label} style={{ minHeight: 50, paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 20, height: 20, borderRadius: 10, marginRight: 12, borderWidth: 2, borderColor: o === k ? colors.soul : colors.dim, alignItems: 'center', justifyContent: 'center' }}>
            {o === k ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.soul }} /> : null}
          </View>
          <View style={{ flex: 1 }}><Label>{label}</Label></View>
        </Tap>
      ))}
    </View>
  );
}

/** Pick what matters more: two cards side by side. */
function More({ q, value, onChange }) {
  const o = value?.o;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {q.options.map((label, k) => (
        <View key={label} style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          {k === 1 ? <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.dim, marginRight: 8 }}>OR</Text> : null}
          <Tap on={o === k} onPress={() => onChange({ ...value, o: k })} label={label} style={{ flex: 1, minHeight: 104, padding: 14, alignItems: 'center', justifyContent: 'center' }}>
            <Label size={15.5} center bold>{label}</Label>
          </Tap>
        </View>
      ))}
    </View>
  );
}

/** A point between two ends: 5 stops. */
function Slider({ q, value, onChange }) {
  const v = value?.v;
  return (
    <View style={{ paddingTop: space.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: space.md }}>
        <View style={{ flex: 1 }}><Label size={14.5} bold color={Number.isInteger(v) && v < 2 ? colors.text : colors.muted}>{q.options[0]}</Label></View>
        <View style={{ flex: 1 }}><Text style={{ textAlign: 'right', fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 20, color: Number.isInteger(v) && v > 2 ? colors.text : colors.muted }}>{q.options[1]}</Text></View>
      </View>
      <View style={{ height: 44, justifyContent: 'center' }}>
        <View style={{ position: 'absolute', left: 18, right: 18, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.border }}>
          <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, opacity: 0.45 }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {[0, 1, 2, 3, 4].map((k) => {
            const on = v === k;
            const label = k === 0 ? q.options[0] : k === 4 ? q.options[1] : k === 2 ? 'In between' : k === 1 ? `Leaning: ${q.options[0]}` : `Leaning: ${q.options[1]}`;
            return (
              <Pressable key={k} onPress={() => onChange({ v: k })} hitSlop={8} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }}
                style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? '#fff' : colors.inputBg, borderWidth: on ? 4 : 1.5, borderColor: on ? colors.soul : colors.aura }}>
                {on ? null : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.aura, opacity: 0.6 }} />}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/** Put in order: tap them one after another, most first (tap one again to take it back). The last fills itself. */
function Rank({ q, value, onChange }) {
  const r = value?.r || [];
  const tap = (k) => {
    if (r.includes(k)) { onChange({ r: r.filter((x) => x !== k) }); return; }
    const next = [...r, k];
    if (next.length === q.options.length - 1) next.push(q.options.findIndex((_, x) => !next.includes(x)));
    onChange({ r: next });
  };
  return (
    <View style={{ gap: 9 }}>
      {q.options.map((label, k) => {
        const pos = r.indexOf(k);
        return (
          <Tap key={label} on={pos >= 0} onPress={() => tap(k)} label={pos >= 0 ? `${label}, number ${pos + 1}` : label} style={{ minHeight: 50, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ marginRight: 12 }}>{pos >= 0 ? <Badge n={pos + 1} /> : <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.dim }} />}</View>
            <View style={{ flex: 1 }}><Label>{label}</Label></View>
          </Tap>
        );
      })}
    </View>
  );
}

/** Build your ideal day: one pick per part of the day. */
function Day({ q, value, onChange }) {
  const s = value?.s || [];
  return (
    <View style={{ gap: space.lg }}>
      {q.slots.map((slot, i) => (
        <View key={slot.name}>
          <Kicker style={{ marginBottom: 8 }}>{slot.name}</Kicker>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {slot.options.map((label, k) => (
              <Tap key={label} on={s[i] === k} onPress={() => { const n = [...s]; n[i] = k; onChange({ s: n }); }} label={`${slot.name}: ${label}`}
                style={{ flex: 1, minHeight: 64, padding: 10, alignItems: 'center', justifyContent: 'center' }}>
                <Label size={14} center bold>{label}</Label>
              </Tap>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/** Pick 3 from a visual set: drawn icon tiles in Soulink's colours (4 across); the order you tap is your ranking. */
function Tiles({ q, value, onChange }) {
  const s = value?.s || [];
  const full = s.length >= q.max;
  const tap = (k) => { if (s.includes(k)) onChange({ s: s.filter((x) => x !== k) }); else if (!full) onChange({ s: [...s, k] }); };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>
      {q.options.map((label, k) => {
        const on = s.includes(k);
        return (
          <Pressable key={label} onPress={() => tap(k)} accessibilityRole="button" accessibilityLabel={`${label}${on ? `, pick ${s.indexOf(k) + 1}` : ''}`} accessibilityState={{ selected: on }}
            style={{ width: '23.5%', opacity: full && !on ? 0.4 : 1 }}>
            <View style={{ aspectRatio: 1, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: on ? 2.5 : 1, borderColor: on ? colors.soul : colors.border }}>
              <LinearGradient colors={on ? ['rgba(124,92,252,0.55)', 'rgba(255,107,157,0.45)'] : ['rgba(124,92,252,0.18)', 'rgba(255,107,157,0.10)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <MaterialCommunityIcons name={q.icons?.[k] || 'star-four-points'} size={28} color={on ? '#fff' : colors.aura} />
              {on ? <View style={{ position: 'absolute', top: 4, right: 4 }}><Badge n={s.indexOf(k) + 1} size={20} /></View> : null}
            </View>
            <Text numberOfLines={2} style={{ marginTop: 5, minHeight: 30, fontFamily: on ? fonts.bold : fonts.medium, fontSize: 11.5, lineHeight: 15, color: on ? colors.text : colors.muted, textAlign: 'center' }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Quick taps about you: one per row, or "Prefer not to say". */
function Habits({ q, value, onChange }) {
  const v = value || {};
  return (
    <View style={{ gap: space.lg }}>
      {(q.groups || []).map((g) => (
        <View key={g.key}>
          <Kicker style={{ marginBottom: 8 }}>{g.label}</Kicker>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[...g.options, 'Prefer not to say'].map((label, k) => {
              const val = k === g.options.length ? -1 : k;
              return (
                <Tap key={label} on={v[g.key] === val} onPress={() => onChange({ ...v, [g.key]: val })} label={`${g.label}: ${label}`} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 }}>
                  <Text style={{ color: val === -1 ? colors.muted : colors.text, fontFamily: fonts.semibold, fontSize: 14 }}>{label}</Text>
                </Tap>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

/** What you need in a partner: each chip cycles Doesn't matter → Must → Nice to have → Never (life together only). */
const NEED_TONE = { must: ['mint', 'MUST', colors.mint], nice: ['gold', 'NICE TO HAVE', colors.gold], never: ['spark', 'NEVER', colors.spark] };
function Needs({ q, value, onChange }) {
  const v = value || {};
  const tap = (c) => {
    const order = c.group === 'life' ? [undefined, 'must', 'nice', 'never'] : [undefined, 'must', 'nice'];
    const next = order[(order.indexOf(v[c.key]) + 1) % order.length];
    const out = { ...v }; if (next) out[c.key] = next; else delete out[c.key];
    onChange(out);
  };
  const group = (key, title) => (
    <View style={{ marginBottom: space.lg }}>
      <Kicker style={{ marginBottom: 8 }}>{title}</Kicker>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(q.chips || []).filter((c) => c.group === key).map((c) => {
          const st = v[c.key]; const t = NEED_TONE[st];
          return (
            <Tap key={c.key} on={!!st} tone={t?.[0]} onPress={() => tap(c)} label={`${c.label}: ${t?.[1] || 'doesn’t matter'}`}
              style={{ paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', borderRadius: 999 }}>
              <Text style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 14 }}>{c.label}</Text>
              {t ? <Text style={{ marginLeft: 7, fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 0.6, color: t[2] }}>{t[1]}</Text> : null}
            </Tap>
          );
        })}
      </View>
    </View>
  );
  return (
    <>
      <View style={{ gap: 6, marginBottom: space.lg }}>
        {[[colors.mint, 'MUST', 'they need to be like this'], [colors.gold, 'NICE TO HAVE', 'a plus, not a must'], [colors.spark, 'NEVER', 'a deal-breaker for me']].map(([c, k, t]) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ width: 104, fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 0.6, color: c }}>{k}</Text>
            <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.text }}>{t}</Text>
          </View>
        ))}
      </View>
      {group('treat', 'How they treat you')}
      {group('life', 'Life together')}
    </>
  );
}

/** Is this answer complete enough to move on? */
const ready = (q, v) => {
  if (q.kind === 'needs') return true; // nothing marked is a fine answer
  if (!v) return false;
  if (v.skip) return true;
  switch (q.kind) {
    case 'react': return Number.isInteger(v.o);
    case 'more': return Number.isInteger(v.o) && (!q.dial || Number.isInteger(v.f));
    case 'slider': return Number.isInteger(v.v);
    case 'rank': return v.r?.length === q.options.length;
    case 'day': return q.slots.every((_, i) => Number.isInteger(v.s?.[i]));
    case 'tiles': return v.s?.length > 0;
    case 'habits': return (q.groups || []).every((g) => Number.isInteger(v[g.key]));
    default: return false;
  }
};
const TIMED = ['react', 'more', 'slider', 'rank', 'day', 'tiles'];
/** A round number in a small ring. */
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

/** One category as a tendency: how sure Soul DNA is, "Does this feel right?", and Update answers. */
function CategoryRow({ c, felt, onFelt }) {
  const [label, tone] = c.earlier ? ['From your earlier Soul DNA', colors.dim] : LEVEL[c.level] || ['Not asked yet', colors.dim];
  const open = () => router.push({ pathname: '/soul', params: { category: c.key } });
  return (
    <View style={{ paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text }}>{c.label}</Text>
        <View style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: tone }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 0.4, color: tone }}>{label}</Text>
        </View>
      </View>
      {c.line ? <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.text, marginTop: 6 }}>{c.line}</Text>
        : <Text style={{ fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.muted, marginTop: 6 }}>Not enough answers yet.</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginTop: 8 }}>
        {c.line && !felt ? (
          <>
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.muted }}>Does this feel right?</Text>
            <Pressable onPress={() => onFelt(c)} hitSlop={8} accessibilityRole="button"><Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.mint }}>Yes</Text></Pressable>
            <Pressable onPress={open} hitSlop={8} accessibilityRole="button"><Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.spark }}>Not quite</Text></Pressable>
          </>
        ) : null}
        <Pressable onPress={open} hitSlop={8} accessibilityRole="button" style={{ marginLeft: 'auto' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.aura }}>{c.line ? 'Update answers' : 'Answer now'}</Text>
        </Pressable>
      </View>
    </View>
  );
}
const feltKey = (c) => `soulink.soulFelt.${c.key}.${c.line}`;

export function DnaResult({ type, tagline, me, labels = {}, onDone, onRetake, refresh }) {
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(glow, { toValue: 1, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(); }, [glow]);
  const scale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const cats = me?.categories || [];
  const [felt, setFelt] = useState({});
  useEffect(() => {
    (async () => {
      try {
        const keys = cats.filter((c) => c.line).map(feltKey);
        const got = await AsyncStorage.multiGet(keys);
        setFelt(Object.fromEntries(got.filter(([, x]) => x).map(([k]) => [k, true])));
      } catch { /* not kept: ask again */ }
    })();
  }, [me]); // eslint-disable-line react-hooks/exhaustive-deps
  const onFelt = (c) => { setFelt((f) => ({ ...f, [feltKey(c)]: true })); AsyncStorage.setItem(feltKey(c), '1').catch(() => {}); };
  return (
    <>
      <BrandHeader size={36} title="Your Soul DNA" />
      <Animated.View style={{ alignItems: 'center', opacity: glow, transform: [{ scale }] }}>
        <View style={{ width: 120, height: 120, borderRadius: 60, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          <LinearGradient colors={[...gradients.button]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.35 }} />
          <SoulDnaIcon size={104} />
        </View>
        <PillTag style={{ alignSelf: 'center', marginTop: space.lg }}>You are</PillTag>
        <GradientText style={{ fontFamily: fonts.display, fontSize: 30, lineHeight: 38, textAlign: 'center', marginTop: space.sm }}>{type}</GradientText>
        <Text style={{ fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.muted, textAlign: 'center', marginTop: space.sm, paddingHorizontal: space.md }}>{tagline}</Text>
      </Animated.View>

      {refresh ? (
        <Pressable onPress={() => router.push({ pathname: '/soul', params: { checkin: '1' } })} accessibilityRole="button"
          style={{ marginTop: space.xl, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(176,143,255,0.45)', backgroundColor: 'rgba(124,92,252,0.12)' }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.text }}>Refresh your Soul DNA</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 3 }}>New short activities, about 3 minutes. Optional: your matches keep working, and nothing you answered before is lost.</Text>
        </Pressable>
      ) : null}

      {cats.length ? (
        <GlassCard style={{ marginTop: space.xl }}>
          <Kicker style={{ marginBottom: 4 }}>Your tendencies</Kicker>
          <Text style={{ fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.muted, marginBottom: space.sm }}>Preferences and tendencies, not fixed judgements. They get surer as you answer more.</Text>
          {cats.map((c) => <CategoryRow key={c.key} c={c} felt={felt[feltKey(c)]} onFelt={onFelt} />)}
          <Button small variant="ghost" title="Check-in: 3 more activities" style={{ marginTop: space.md }} onPress={() => router.push({ pathname: '/soul', params: { checkin: '1' } })} />
        </GlassCard>
      ) : null}

      {me?.summary?.length ? (
        <GlassCard style={{ marginTop: space.lg }}>
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

      {me?.spectrum?.length ? (
        <GlassCard style={{ marginTop: space.lg }}>
          <Kicker>Your nature & mindset</Kicker>
          {me.spectrum.map((x) => <Spectrum key={x.key} left={x.left} right={x.right} value={x.value} />)}
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
      {onRetake ? <Button variant="ghost" title="Start Soul DNA over" style={{ marginTop: space.sm }} onPress={onRetake} /> : null}
    </>
  );
}


// ---------- the activities ----------
export default function SoulGames() {
  const { user, setUser } = useAuth();
  const { retake, checkin, category } = useLocalSearchParams();
  const extra = !!(checkin || category); // a check-in or one category's update: saved straight into your Soul DNA
  const [data, setData] = useState(null); // { sections, questions, plan, upgrade, completed, refresh }
  const [ids, setIds] = useState([]);     // the activities to play this time
  const [answers, setAnswers] = useState({});
  const [phase, setPhase] = useState('loading'); // loading | intro | play | saving | result
  const [i, setI] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [why, setWhy] = useState(false);
  const [busy, setBusy] = useState(false);
  const lastMe = useRef(null);             // the newest Soul DNA, after a check-in answer
  const shownAt = useRef(Date.now());      // gut-reaction timing: when this screen appeared
  const firstTap = useRef({});             // item id → ms to the first tap
  const changes = useRef({});              // item id → times the answer was changed
  useEffect(() => { shownAt.current = Date.now(); firstTap.current = {}; changes.current = {}; setWhy(false); }, [i, phase]);

  const showMine = async () => {
    const m = await api('/soul/dna/me');
    if (m.ready) { setResult({ type: m.type, tagline: m.tagline, me: m.me, refresh: m.refresh }); setPhase('result'); return true; }
    return false;
  };

  useEffect(() => {
    (async () => {
      try {
        const d = await api('/soul/dna');
        setData(d);
        if (extra) {
          const c = await api(`/soul/dna/checkin${category ? `?category=${encodeURIComponent(category)}` : ''}`);
          setData({ ...d, questions: [...d.questions.filter((q) => !c.ids.includes(q.id)), ...c.questions] });
          setIds(c.ids); setAnswers({ ...(d.answers || {}), ...(c.answers || {}) });
          if (!c.ids.length) { await showMine(); return; }
          setI(0); setPhase('play'); return;
        }
        setIds(d.plan); setAnswers(d.answers || {});
        if (d.completed && user?.soulReady && !retake && !d.retaking) { if (await showMine()) return; }
        setPhase('intro');
      } catch (e) { setError(e.message); setPhase('intro'); }
    })();
  }, [retake, checkin, category]); // eslint-disable-line react-hooks/exhaustive-deps

  const steps = useMemo(() => (data ? ids.map((id) => data.questions.find((q) => q.id === id)).filter(Boolean) : []), [data, ids]);
  const sections = data?.sections || [];
  const answered = ids.filter((id) => answers[id] !== undefined).length;
  const firstOpen = Math.max(0, steps.findIndex((q) => answers[q.id] === undefined));

  const setAnswer = (q, v) => {
    const prev = answers[q.id];
    if (firstTap.current[q.id] == null) firstTap.current[q.id] = Date.now() - shownAt.current;
    else if (!extra && prev && !prev.skip && JSON.stringify({ ...prev, f: undefined, ms: undefined, ch: undefined }) !== JSON.stringify({ ...v, f: undefined, ms: undefined, ch: undefined })) changes.current[q.id] = (changes.current[q.id] || 0) + 1; // the dial isn't a change of mind
    setAnswers((a) => ({ ...a, [q.id]: v }));
  };

  const save = async (q, given) => {
    let v = given ?? answers[q.id] ?? (q.kind === 'needs' ? {} : null);
    if (TIMED.includes(q.kind) && !v?.skip) {
      const ms = firstTap.current[q.id]; const ch = changes.current[q.id];
      v = { ...v, ...(ms != null ? { ms } : {}), ...(ch ? { ch: Math.min(ch, 49) } : {}) };
    }
    const r = await api('/soul/dna/answers', { method: 'PUT', body: { answers: { [q.id]: v } } });
    if (r?.me) lastMe.current = r.me;
    setAnswers((a) => ({ ...a, [q.id]: v }));
  };

  const finish = async () => {
    setPhase('saving'); setError(null);
    try {
      if (extra) {
        const m = await api('/soul/dna/me');
        setResult({ type: m.type, tagline: m.tagline, me: lastMe.current || m.me, refresh: m.refresh, updated: true });
        setPhase('result');
        return;
      }
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

  const next = async (given) => {
    const q = steps[i];
    if (!q || busy) return;
    setBusy(true); setError(null);
    try {
      await save(q, given);
      if (i + 1 >= steps.length) await finish(); else setI(i + 1);
    } catch (e) {
      setError(e.code === 'premium_required' ? e.message : 'Could not save. Check your connection and tap Next again.');
    } finally { setBusy(false); }
  };
  const skip = (depends) => next({ skip: true, ...(depends ? { d: 1 } : {}) });

  const back = () => {
    if (phase === 'play') { if (i > 0) setI(i - 1); else if (extra) { router.canGoBack() ? router.back() : router.replace('/soul'); } else setPhase('intro'); return; }
    router.canGoBack() ? router.back() : router.replace('/');
  };

  if (phase === 'loading') return <BrandScreen back><ActivityIndicator color={colors.aura} size="large" /></BrandScreen>;

  if (phase === 'result' && result) {
    return (
      <BrandScreen back center={false}>
        {result.updated ? <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.mint, textAlign: 'center', marginBottom: space.sm }}>Saved. Your Soul DNA is updated.</Text> : null}
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
        <BrandHeader size={36} title={retake ? 'Start Soul DNA over' : upgrade ? 'Soul DNA has changed' : 'Create your Soul DNA'}
          subtitle={upgrade || retake
            ? `${steps.length} short activities, about 3 minutes. Your current Soul DNA and matches stay until you finish.`
            : `${steps.length || 11} short activities, about 3 minutes. No right answers: pick what fits you.`} />
        {error ? <ErrorText>{error}</ErrorText> : null}
        <GlassCard>
          {sections.map((s, n) => {
            const list = ids.filter((id) => data.questions.find((q) => q.id === id)?.section === s.key);
            const done = list.filter((id) => answers[id] !== undefined).length;
            const all = !!list.length && done === list.length;
            return (
              <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                <View style={{ marginRight: 12 }}><Num n={n + 1} done={all} /></View>
                <Text style={{ flex: 1, fontFamily: fonts.medium, fontSize: 14.5, color: colors.text }}>{s.title}</Text>
                <Text style={{ fontFamily: fonts.mono, fontSize: 11.5, color: all ? colors.mint : colors.dim }}>{done}/{list.length}</Text>
              </View>
            );
          })}
        </GlassCard>
        <Text style={{ fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.dim, marginTop: space.md }}>More activities come later as optional check-ins, so Soul DNA gets surer over time.</Text>
        {steps.length ? (
          <Button title={started ? `Continue (${answered}/${ids.length})` : 'Start'} style={{ marginTop: space.xl }}
            onPress={() => { setI(answered >= ids.length ? steps.length - 1 : firstOpen); setPhase('play'); }} />
        ) : null}
        {answered >= ids.length && ids.length ? <Button variant="ghost" title="See my Soul DNA" style={{ marginTop: space.sm }} onPress={finish} /> : null}
      </BrandScreen>
    );
  }

  const q = steps[Math.min(i, steps.length - 1)];
  const secN = sections.findIndex((s) => s.key === q.section);
  const sec = sections[secN];
  const v = answers[q.id]?.skip ? undefined : answers[q.id];
  const w = WHY[q.section];
  const title = q.kind === 'more' && q.text === 'Which matters more?' ? 'Which matters more to you?' : q.text;
  const lastOne = i + 1 >= steps.length;
  return (
    <BrandScreen back onBack={back} center={false} fit={false}
      right={<><Bar value={(i + (ready(q, v) ? 1 : 0)) / Math.max(1, steps.length)} style={{ marginHorizontal: space.md }} /><Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted, width: 44, textAlign: 'right' }}>{i + 1}/{steps.length}</Text></>}>
      <View style={{ marginTop: space.md, marginBottom: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <View style={{ backgroundColor: 'rgba(255,107,157,0.16)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 1, color: colors.spark, textTransform: 'uppercase' }}>{extra ? (category ? 'Update' : 'Check-in') : `${secN + 1} of ${sections.length}`} · {sec?.title}</Text>
          </View>
        </View>
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 29, color: colors.text, marginTop: 10 }}>{title}</Text>
      </View>
      <Instructions {...stepsFor(q, v)} />
      {error ? <ErrorText>{error}</ErrorText> : null}

      {q.kind === 'react' ? <Choices q={q} value={v} onChange={(x) => setAnswer(q, x)} /> : null}
      {q.kind === 'more' ? <More q={q} value={v} onChange={(x) => setAnswer(q, x)} /> : null}
      {q.kind === 'more' && q.dial && Number.isInteger(v?.o) ? <Dial labels={q.dial} value={v?.f} onPick={(f) => setAnswer(q, { ...v, f })} /> : null}
      {q.kind === 'slider' ? <Slider q={q} value={v} onChange={(x) => setAnswer(q, x)} /> : null}
      {q.kind === 'rank' ? <Rank q={q} value={v} onChange={(x) => setAnswer(q, x)} /> : null}
      {q.kind === 'day' ? <Day q={q} value={v} onChange={(x) => setAnswer(q, x)} /> : null}
      {q.kind === 'tiles' ? <Tiles q={q} value={v} onChange={(x) => setAnswer(q, x)} /> : null}
      {q.kind === 'habits' ? <Habits q={q} value={v} onChange={(x) => setAnswer(q, x)} /> : null}
      {q.kind === 'needs' ? <Needs q={q} value={v} onChange={(x) => setAnswer(q, x)} /> : null}

      {SKIPPABLE(q) ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 22, marginTop: space.lg }}>
          {['react', 'more'].includes(q.kind) ? (
            <Pressable onPress={() => skip(true)} hitSlop={8} disabled={busy} accessibilityRole="button"><Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.aura }}>It depends</Text></Pressable>
          ) : null}
          <Pressable onPress={() => skip(false)} hitSlop={8} disabled={busy} accessibilityRole="button"><Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.muted }}>Skip</Text></Pressable>
        </View>
      ) : null}

      {why && w ? (
        <View style={{ marginTop: space.lg, padding: 14, borderRadius: 14, backgroundColor: 'rgba(66,232,192,0.10)', borderWidth: 1, borderColor: 'rgba(66,232,192,0.35)' }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: colors.mint, marginBottom: 4 }}>What this tells us: {w[0]}</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.text }}>{w[1]}</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 6, fontStyle: 'italic' }}>Based on: {w[2]}</Text>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: space.xl, marginBottom: space.xl }}>
        <Button small variant="ghost" title={why ? 'Hide' : 'Why we ask'} onPress={() => setWhy(!why)} style={{ flex: 1 }} />
        <Button title={lastOne ? (extra ? 'Save' : 'See my Soul DNA') : 'Next'} disabled={!ready(q, v)} loading={busy} onPress={() => next()} style={{ flex: 2 }} />
      </View>
    </BrandScreen>
  );
}
