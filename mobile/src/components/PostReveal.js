// Scheduled reveal for posts: the post goes up now, blurred for everyone else until the reveal time.
//   useCountdown(at)   – live "2d 04:12:09" text, and done=true once the time passes
//   RevealCover        – what others see: the blurred teaser, a lock and the countdown (fills the photo area)
//   RevealBadge        – the owner's own post: a small "Reveals in …" chip over the photos
//   ScheduleSheet      – pick the day and time (no swiping: tap the chips and the + / − buttons)
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { mediaUrl } from '../lib/api';
import { BottomSheet } from './PostSheets';
import { colors, fonts, gradients, space } from '../lib/theme';

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
const pad = (n) => String(n).padStart(2, '0');

export function useCountdown(at) {
  const target = at ? new Date(at).getTime() : 0;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!target) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  const ms = Math.max(0, target - now);
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400); const h = Math.floor((s % 86400) / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60;
  return { done: !!target && ms <= 0, d, h, m, s: sec, text: d ? `${d}d ${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(h)}:${pad(m)}:${pad(sec)}` };
}

export const revealLabel = (at) => new Date(at).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

function Unit({ v, label }) {
  return (
    <View style={{ alignItems: 'center', minWidth: 54 }}>
      <Text style={{ fontFamily: fonts.monoBold, fontSize: 30, color: '#fff' }}>{pad(v)}</Text>
      <Text style={{ fontFamily: fonts.mono, fontSize: 9.5, letterSpacing: 1.4, color: 'rgba(255,255,255,0.75)' }}>{label}</Text>
    </View>
  );
}

/** Others' view of a scheduled post until it reveals. onRevealed() runs when the countdown reaches zero. */
export function RevealCover({ reveal, onRevealed, aspect = 1 }) {
  const c = useCountdown(reveal.at);
  const fired = useRef(false);
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(glow, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start(); return () => loop.stop();
  }, [glow]);
  useEffect(() => { if (c.done && !fired.current) { fired.current = true; onRevealed?.(); } }, [c.done, onRevealed]);
  return (
    <View style={{ width: '100%', aspectRatio: aspect, overflow: 'hidden', backgroundColor: colors.card }}>
      {reveal.teaser ? (
        <Image source={{ uri: mediaUrl(reveal.teaser) }} blurRadius={40} contentFit="cover"
          style={[FILL, Platform.OS === 'web' ? { filter: 'blur(26px) saturate(1.3)', transform: [{ scale: 1.25 }] } : null]} />
      ) : <LinearGradient colors={['#3a2a9c', '#7c5cfc', '#ff6b9d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={FILL} />}
      <View style={[FILL, { backgroundColor: 'rgba(8,7,13,0.35)', alignItems: 'center', justifyContent: 'center', padding: space.lg }]}>
        <Animated.View style={{ width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,7,13,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
          transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>
          <Ionicons name={c.done ? 'lock-open' : 'lock-closed'} size={26} color="#fff" />
        </Animated.View>
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 2, color: 'rgba(255,255,255,0.85)', marginTop: space.md }}>{c.done ? 'REVEALING…' : 'REVEALS IN'}</Text>
        {c.done ? null : (
          <View style={{ flexDirection: 'row', marginTop: 6 }}>
            {c.d ? <Unit v={c.d} label="DAYS" /> : null}
            <Unit v={c.h} label="HRS" /><Unit v={c.m} label="MIN" /><Unit v={c.s} label="SEC" />
          </View>
        )}
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: '#fff', marginTop: 10, opacity: 0.9 }}>{revealLabel(reveal.at)}</Text>
      </View>
    </View>
  );
}

/** The owner sees the real photos with this chip on top. */
export function RevealBadge({ reveal, onRevealed }) {
  const c = useCountdown(reveal.at);
  const fired = useRef(false);
  useEffect(() => { if (c.done && !fired.current) { fired.current = true; onRevealed?.(); } }, [c.done, onRevealed]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, height: 28, borderRadius: 14, backgroundColor: 'rgba(8,7,13,0.72)', borderWidth: 1, borderColor: 'rgba(255,107,157,0.55)' }}>
      <Ionicons name="lock-closed" size={13} color={colors.spark} />
      <Text style={{ marginLeft: 5, fontFamily: fonts.semibold, fontSize: 12, color: '#fff' }}>{c.done ? 'Revealed' : `Blurred for others · ${c.text}`}</Text>
    </View>
  );
}

// ---------- picking the reveal time ----------
const MIN_AHEAD = 2 * 60_000;
const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
function compose(day, h12, minute, pm) { const x = new Date(day); x.setHours((h12 % 12) + (pm ? 12 : 0), minute, 0, 0); return x; }

function Chip({ on, label, sub, onPress }) {
  return (
    <Pressable onPress={onPress} style={{ minWidth: 64, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 14, marginRight: 8, marginBottom: 8, alignItems: 'center', overflow: 'hidden', borderWidth: on ? 0 : 1, borderColor: colors.border, backgroundColor: on ? undefined : colors.glass }}>
      {on ? <LinearGradient colors={gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={FILL} /> : null}
      <Text style={{ fontFamily: on ? fonts.bold : fonts.semibold, fontSize: 13, color: on ? '#fff' : colors.text }}>{label}</Text>
      {sub ? <Text style={{ fontFamily: fonts.body, fontSize: 10.5, color: on ? '#fff' : colors.muted, marginTop: 1 }}>{sub}</Text> : null}
    </Pressable>
  );
}
function Step({ icon, onPress, label }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityLabel={label}
      style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? 'rgba(124,92,252,0.35)' : 'rgba(124,92,252,0.16)' })}>
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

export function ScheduleSheet({ visible, onClose, onPick }) {
  const [day, setDay] = useState(dayStart(Date.now()));
  const [h12, setH12] = useState(9);
  const [minute, setMinute] = useState(0);
  const [pm, setPm] = useState(true);
  useEffect(() => {
    if (!visible) return;
    // start one hour from now, rounded up to the next quarter hour
    const t = new Date(Date.now() + 60 * 60_000); t.setMinutes(Math.ceil(t.getMinutes() / 15) * 15, 0, 0);
    setDay(dayStart(t)); setH12(t.getHours() % 12 || 12); setMinute(t.getMinutes() % 60); setPm(t.getHours() >= 12);
  }, [visible]);
  const at = compose(day, h12, minute, pm);
  const tooSoon = at.getTime() - Date.now() < MIN_AHEAD;
  const days = Array.from({ length: 14 }, (_, i) => { const d = dayStart(Date.now()); d.setDate(d.getDate() + i); return d; });
  const preset = (d) => { setDay(dayStart(d)); setH12(d.getHours() % 12 || 12); setMinute(d.getMinutes()); setPm(d.getHours() >= 12); };
  const quick = [
    ['In 1 hour', (() => { const d = new Date(Date.now() + 3600_000); d.setSeconds(0, 0); return d; })()],
    ['Tonight 9 PM', (() => { const d = new Date(); d.setHours(21, 0, 0, 0); if (d.getTime() - Date.now() < MIN_AHEAD) d.setDate(d.getDate() + 1); return d; })()],
    ['Tomorrow 9 AM', (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; })()],
  ];
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Schedule the reveal" tall>
      <View style={{ padding: space.lg, flex: 1 }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, lineHeight: 19 }}>Your post goes up now, blurred, with a countdown. Everyone sees it clearly at the time you pick.</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space.md }}>
          {quick.map(([label, d]) => <Chip key={label} label={label} onPress={() => preset(d)} on={Math.abs(d.getTime() - at.getTime()) < 60_000} />)}
        </View>
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.2, color: colors.aura, marginTop: space.md, marginBottom: 6 }}>DAY</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
          {days.map((d, i) => (
            <Chip key={d.toISOString()} on={d.getTime() === day.getTime()} onPress={() => setDay(d)}
              label={i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short' })}
              sub={d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} />
          ))}
        </ScrollView>
        <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.2, color: colors.aura, marginTop: space.sm, marginBottom: 6 }}>TIME</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Step icon="remove" label="Earlier hour" onPress={() => setH12((h) => (h === 1 ? 12 : h - 1))} />
          <Text style={{ fontFamily: fonts.monoBold, fontSize: 30, color: colors.text, width: 64, textAlign: 'center' }}>{pad(h12)}</Text>
          <Step icon="add" label="Later hour" onPress={() => setH12((h) => (h === 12 ? 1 : h + 1))} />
          <Text style={{ fontFamily: fonts.monoBold, fontSize: 30, color: colors.text, marginHorizontal: 8 }}>:</Text>
          <Step icon="remove" label="Earlier minutes" onPress={() => setMinute((m) => (m + 55) % 60)} />
          <Text style={{ fontFamily: fonts.monoBold, fontSize: 30, color: colors.text, width: 64, textAlign: 'center' }}>{pad(minute)}</Text>
          <Step icon="add" label="Later minutes" onPress={() => setMinute((m) => (m + 5) % 60)} />
        </View>
        <View style={{ flexDirection: 'row', marginTop: space.sm }}>
          <Chip label="AM" on={!pm} onPress={() => setPm(false)} />
          <Chip label="PM" on={pm} onPress={() => setPm(true)} />
        </View>
        <View style={{ flex: 1 }} />
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: tooSoon ? colors.danger : colors.text, textAlign: 'center', marginBottom: space.sm }}>
          {tooSoon ? 'Pick a time a little later than now' : `Reveals ${revealLabel(at)}`}
        </Text>
        <Pressable disabled={tooSoon} onPress={() => { onPick(at); onClose(); }}
          style={{ height: 52, borderRadius: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', opacity: tooSoon ? 0.5 : 1 }}>
          <LinearGradient colors={gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={FILL} />
          <Ionicons name="time" size={19} color="#fff" style={{ marginRight: 8 }} />
          <Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: 15 }}>Post now, reveal then</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
