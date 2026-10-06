// Argue Referee: start screen. Step 1: how many people? Step 2: together on this phone, or invite
// connections to answer on their own phones. Then everyone gives their side and the Referee decides.
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { BrandHeader, BrandScreen } from '../../components/BrandScreen';
import { GlassCard } from '../../components/brand';
import { ChoiceCard } from '../../components/Choice';
import { Avatar, Button, ErrorText, Input, s } from '../../components/ui';
import { colors, fonts, gradients, space } from '../../lib/theme';
import { LiveFrame, ScalesIcon } from '../../components/LiveIcons';

function Stepper({ value, onChange, min = 2, max = 6 }) {
  const Btn = ({ icon, disabled, onPress }) => (
    <Pressable onPress={onPress} disabled={disabled} style={({ hovered }) => ({ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: hovered && !disabled ? colors.aura : colors.border, backgroundColor: colors.glass, opacity: disabled ? 0.35 : 1 })}>
      <Ionicons name={icon} size={24} color={colors.text} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      <Btn icon="remove" disabled={value <= min} onPress={() => onChange(value - 1)} />
      <View style={{ width: 120, alignItems: 'center' }}>
        <Text style={{ fontFamily: fonts.display, fontSize: 64, lineHeight: 72, color: colors.text }}>{value}</Text>
        <Text style={{ fontFamily: fonts.medium, color: colors.muted, fontSize: 13 }}>people</Text>
      </View>
      <Btn icon="add" disabled={value >= max} onPress={() => onChange(value + 1)} />
    </View>
  );
}

function PastCase({ c }) {
  const v = c.verdict;
  const winners = v ? c.people.filter((p) => v.winnerSeats.includes(p.seat)).map((p) => p.name).join(' & ') : null;
  return (
    <Pressable onPress={() => router.push(`/argue/${c.id}`)}>
      <GlassCard style={{ marginBottom: space.md, flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}>
        <MaterialCommunityIcons name={c.status === 'decided' ? 'gavel' : 'timer-sand'} size={22} color={c.status === 'decided' ? colors.gold : colors.aura} style={{ marginRight: space.md }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 15 }} numberOfLines={1}>{c.topic || c.people.map((p) => p.name).join(' vs ')}</Text>
          <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
            {c.status === 'decided' ? `Verdict: ${winners || 'split'}` : `Waiting for ${c.people.filter((p) => !p.submitted).length} side(s)`}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.dim} />
      </GlassCard>
    </Pressable>
  );
}

export default function Argue() {
  const { user } = useAuth();
  const first = user.displayName?.split(' ')[0] || user.username;
  const [step, setStep] = useState(0); // 0 intro+count, 1 details
  const [count, setCount] = useState(2);
  const [mode, setMode] = useState('phone');
  const [topic, setTopic] = useState('');
  const [names, setNames] = useState([first, '']);
  const [connections, setConnections] = useState([]);
  const [picked, setPicked] = useState([]);
  const [past, setPast] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useFocusEffect(useCallback(() => {
    api('/argue').then((r) => setPast(r.cases)).catch(() => {});
    api('/connections').then((r) => setConnections(r.connections)).catch(() => {});
  }, []));

  const confirmCount = () => {
    setNames((cur) => Array.from({ length: count }, (_, i) => cur[i] ?? (i === 0 ? first : '')));
    setPicked((cur) => cur.slice(0, count - 1));
    setError(null); setStep(1);
  };

  const start = async () => {
    if (!user.soulReady) { router.push('/soul'); return; }
    setBusy(true); setError(null);
    try {
      const body = mode === 'phone'
        ? { mode, count, topic: topic.trim() || undefined, names: names.map((n) => n.trim()) }
        : { mode, count, topic: topic.trim() || undefined, inviteUserIds: picked };
      const r = await api('/argue', { method: 'POST', body });
      setStep(0); setTopic(''); setPicked([]);
      router.push(`/argue/${r.case.id}`);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const ready = mode === 'phone' ? names.every((n) => n.trim()) : picked.length === count - 1;

  if (step === 0) {
    return (
      <BrandScreen back onBack={() => router.navigate('/')} center={false}>
        <View style={{ alignItems: 'center', marginTop: space.lg }}>
          <LiveFrame size={150}><ScalesIcon size={124} /></LiveFrame>
        </View>
        <BrandHeader size={0} title="Argue Referee" subtitle="Everyone tells their side. The AI referee listens to all of it and gives a fair verdict." />
        <GlassCard style={{ padding: space.xl }}>
          <Text style={[s.label, { marginLeft: 0, textAlign: 'center' }]}>How many people are in this?</Text>
          <Stepper value={count} onChange={setCount} />
          <Button title="OK" style={{ marginTop: space.xl }} onPress={confirmCount} />
        </GlassCard>
        {past.length ? (
          <View style={{ marginTop: space.xl }}>
            <Text style={[s.label, { marginLeft: 0 }]}>Your arguments</Text>
            {past.map((c) => <PastCase key={c.id} c={c} />)}
          </View>
        ) : null}
      </BrandScreen>
    );
  }

  return (
    <BrandScreen back onBack={() => setStep(0)} center={false}>
      <BrandHeader size={0} title={`${count} people`} subtitle="Where is everyone?" />
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <ChoiceCard icon="phone-portrait-outline" title="Together" text="Pass this phone around" selected={mode === 'phone'} onPress={() => setMode('phone')} />
        <ChoiceCard icon="people-outline" title="Invite" text="Each on their own phone" selected={mode === 'invite'} onPress={() => setMode('invite')} />
      </View>

      <Input label="What's it about? (optional)" value={topic} onChangeText={setTopic} maxLength={150} placeholder="e.g. Who should plan the Goa trip" style={{ marginTop: space.xl }} />

      {mode === 'phone' ? (
        <View>
          <Text style={s.label}>Names, in speaking order</Text>
          {names.map((n, i) => (
            <Input key={i} value={n} onChangeText={(t) => setNames((cur) => cur.map((x, j) => (j === i ? t : x)))} maxLength={50} placeholder={`Person ${i + 1}`}
              left={<Text style={{ color: colors.aura, fontFamily: fonts.bold, marginRight: 10 }}>{i + 1}</Text>} style={{ marginBottom: space.md }} />
          ))}
        </View>
      ) : (
        <View>
          <Text style={s.label}>Pick {count - 1} {count - 1 === 1 ? 'connection' : 'connections'} ({picked.length}/{count - 1})</Text>
          {!connections.length ? (
            <Text style={[s.hint, { marginBottom: space.lg }]}>You have no connections yet. Use "Together" mode, or connect with people first.</Text>
          ) : connections.map((c) => {
            const on = picked.includes(c.id);
            const full = !on && picked.length >= count - 1;
            return (
              <Pressable key={c.id} disabled={full} onPress={() => setPicked((cur) => (on ? cur.filter((x) => x !== c.id) : [...cur, c.id]))}
                style={{ flexDirection: 'row', alignItems: 'center', padding: space.md, marginBottom: space.sm, borderRadius: 20, borderWidth: 1.5, borderColor: on ? colors.soul : colors.border, backgroundColor: on ? 'rgba(124,92,252,0.18)' : colors.glass, opacity: full ? 0.4 : 1 }}>
                <Avatar uri={c.avatarUrl} name={c.displayName} size={40} />
                <View style={{ flex: 1, marginLeft: space.md }}>
                  <Text style={{ color: colors.text, fontFamily: fonts.semibold }}>{c.displayName || c.username}</Text>
                  <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 12 }}>@{c.username}</Text>
                </View>
                <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? colors.soul : colors.dim} />
              </Pressable>
            );
          })}
        </View>
      )}
      <ErrorText>{error}</ErrorText>
      <Button title={mode === 'phone' ? 'Start: pass the phone' : 'Send invites and start'} onPress={start} loading={busy} disabled={!ready} style={{ marginTop: space.md }} />
    </BrandScreen>
  );
}
