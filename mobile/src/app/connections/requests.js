// Connect requests. Incoming: Accept (or accept as something else), Hold for a chosen time, or Reject.
// Sent: see status, withdraw. Every answer notifies the sender.
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { confirm } from '../../lib/confirm';
import { BrandHeader } from '../../components/BrandScreen';
import { GlassCard } from '../../components/brand';
import { IntentChip, ScorePill } from '../../components/Choice';
import { Avatar, Button, Empty, ErrorText, VerifiedBadge } from '../../components/ui';
import { HOLDS, INTENTS, fmtDate, intentOf } from '../../lib/intents';
import { colors, fonts, radius, space } from '../../lib/theme';

function Tabs({ value, onChange, counts }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.inputBg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, padding: 4, marginBottom: space.lg }}>
      {[['incoming', 'Received'], ['outgoing', 'Sent']].map(([k, label]) => {
        const on = value === k;
        return (
          <Pressable key={k} onPress={() => onChange(k)} style={{ flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: 'center', backgroundColor: on ? 'rgba(124,92,252,0.28)' : 'transparent' }}>
            <Text style={{ color: on ? colors.text : colors.muted, fontFamily: on ? fonts.semibold : fonts.medium }}>{label}{counts[k] ? ` (${counts[k]})` : ''}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Person({ r }) {
  const it = intentOf(r.intent);
  return (
    <Pressable onPress={() => router.push(`/user/${r.user.username}`)} style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Avatar uri={r.user.avatarUrl} name={r.user.displayName} size={52} />
      <View style={{ flex: 1, marginLeft: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: colors.text, fontFamily: fonts.displayBold, fontSize: 16 }} numberOfLines={1}>{r.user.displayName || r.user.username}</Text>
          {r.user.verified ? <VerifiedBadge /> : null}
        </View>
        <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 13, marginTop: 2 }}>
          {r.direction === 'incoming' ? 'wants to connect for ' : 'You asked for '}
          <Text style={{ color: colors.text, fontFamily: fonts.semibold }}>{it.label} {it.emoji}</Text>
        </Text>
      </View>
    </Pressable>
  );
}

function Incoming({ r, onDone }) {
  const [mode, setMode] = useState(null); // accept-as | hold
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const it = intentOf(r.intent);
  const first = r.user.displayName?.split(' ')[0] || r.user.username;
  const run = async (fn) => { setBusy(true); setError(null); try { await fn(); } catch (e) { setError(e.message); setBusy(false); } };

  const accept = (asIntent) => run(async () => {
    const res = await api(`/connections/requests/${r.id}/accept`, { method: 'POST', body: asIntent ? { asIntent } : {} });
    router.push(`/chat/${res.conversationId}`);
    onDone();
  });
  const hold = (days) => run(async () => { await api(`/connections/requests/${r.id}/hold`, { method: 'POST', body: { days } }); setMode(null); setBusy(false); onDone(); });
  const reject = async () => {
    if (!(await confirm(`Reject ${first}'s request?`, `${first} will be told it was rejected and can't ask again for 30 days.`, { confirmText: 'Reject', destructive: true }))) return;
    run(async () => { await api(`/connections/requests/${r.id}/reject`, { method: 'POST' }); onDone(); });
  };

  return (
    <GlassCard style={{ marginBottom: space.lg }}>
      <Person r={r} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', marginTop: space.md, gap: 6 }}>
        <ScorePill score={r.soulScore} intent={r.acceptedIntent || r.intent} />
        <View style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.muted, fontFamily: fonts.medium, fontSize: 12 }}>{r.knows ? 'Says you know each other' : 'Someone new'}</Text>
        </View>
      </View>
      {r.note ? (
        <View style={{ marginTop: space.md, padding: space.md, borderRadius: 16, backgroundColor: 'rgba(124,92,252,0.08)', borderLeftWidth: 3, borderLeftColor: colors.aura }}>
          <Text style={{ color: colors.text, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 }}>"{r.note}"</Text>
        </View>
      ) : null}
      {r.status === 'held' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: space.md }}>
          <Ionicons name="pause-circle" size={16} color={colors.gold} style={{ marginRight: 6 }} />
          <Text style={{ color: colors.gold, fontFamily: fonts.semibold, fontSize: 13 }}>On hold until {fmtDate(r.holdUntil)}</Text>
        </View>
      ) : null}

      {mode === 'accept-as' ? (
        <View style={{ marginTop: space.md }}>
          <Text style={{ color: colors.muted, fontFamily: fonts.medium, fontSize: 13, textAlign: 'center', marginBottom: 4 }}>Accept as…</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
            {INTENTS.filter((i) => i.key !== r.intent).map((i) => <IntentChip key={i.key} intent={i} onPress={() => accept(i.key)} />)}
          </View>
          <Button title="Back" variant="ghost" onPress={() => setMode(null)} />
        </View>
      ) : mode === 'hold' ? (
        <View style={{ marginTop: space.md }}>
          <Text style={{ color: colors.muted, fontFamily: fonts.medium, fontSize: 13, textAlign: 'center', marginBottom: 4 }}>
            {r.status === 'held' ? 'Extend the hold by… (only once)' : `How long do you want to hold? ${first} will be told.`}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
            {HOLDS.map((h) => (
              <Pressable key={h.days} onPress={() => hold(h.days)} style={({ hovered }) => ({ paddingHorizontal: 16, paddingVertical: 10, margin: 4, borderRadius: 999, borderWidth: 1.5, borderColor: hovered ? colors.gold : 'rgba(245,200,66,0.5)', backgroundColor: 'rgba(245,200,66,0.08)' })}>
                <Text style={{ color: colors.gold, fontFamily: fonts.semibold }}>{h.label}</Text>
              </Pressable>
            ))}
          </View>
          <Button title="Back" variant="ghost" onPress={() => setMode(null)} />
        </View>
      ) : (
        <View style={{ marginTop: space.lg }}>
          <Button title={`Accept · ${it.label} ${it.emoji}`} onPress={() => accept()} loading={busy} />
          <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.md }}>
            <Button title={r.status === 'held' ? (r.canExtend ? 'Extend hold' : 'On hold') : 'Hold'} icon="pause-outline" variant="secondary" style={{ flex: 1, height: 48 }}
              disabled={r.status === 'held' && !r.canExtend} onPress={() => setMode('hold')} />
            <Button title="Reject" variant="danger" style={{ flex: 1, height: 48 }} onPress={reject} />
          </View>
          <Text onPress={() => setMode('accept-as')} style={{ color: colors.aura, fontFamily: fonts.semibold, fontSize: 13, textAlign: 'center', marginTop: space.md }}>Accept as something else</Text>
        </View>
      )}
      <ErrorText>{error}</ErrorText>
    </GlassCard>
  );
}

function Outgoing({ r, onDone }) {
  const [busy, setBusy] = useState(false);
  const withdraw = async () => {
    if (!(await confirm('Withdraw this request?', undefined, { confirmText: 'Withdraw', destructive: true }))) return;
    setBusy(true);
    try { await api(`/connections/requests/${r.id}/withdraw`, { method: 'POST' }); onDone(); } finally { setBusy(false); }
  };
  return (
    <GlassCard style={{ marginBottom: space.lg }}>
      <Person r={r} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: space.md }}>
        <Ionicons name={r.status === 'held' ? 'pause-circle' : 'time-outline'} size={16} color={r.status === 'held' ? colors.gold : colors.muted} style={{ marginRight: 6 }} />
        <Text style={{ color: r.status === 'held' ? colors.gold : colors.muted, fontFamily: fonts.semibold, fontSize: 13 }}>
          {r.status === 'held' ? `On hold until ${fmtDate(r.holdUntil)}` : 'Waiting for an answer'}
        </Text>
      </View>
      <Button title="Withdraw request" variant="secondary" style={{ marginTop: space.md, height: 48 }} onPress={withdraw} loading={busy} />
    </GlassCard>
  );
}

export default function ConnectRequests() {
  const [tab, setTab] = useState('incoming');
  const [data, setData] = useState({ incoming: null, outgoing: null });
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [i, o] = await Promise.all([api('/connections/requests?box=incoming'), api('/connections/requests?box=outgoing')]);
      setData({ incoming: i.requests, outgoing: o.requests }); setError(null);
    } catch (e) { setError(e.message); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const list = data[tab];
  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: space.xxl }} showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.aura} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <BrandHeader size={32} title="Soul Requests" subtitle="People who want to connect with you, and why" />
      <Tabs value={tab} onChange={setTab} counts={{ incoming: data.incoming?.length, outgoing: data.outgoing?.length }} />
      <ErrorText>{error}</ErrorText>
      {list && !list.length ? (
        <Empty icon="people-outline" title={tab === 'incoming' ? 'No requests right now' : 'No requests sent'} text={tab === 'incoming' ? 'When someone wants to connect, it shows up here.' : 'Open a profile and tap Connect.'} />
      ) : null}
      {list?.map((r) => (tab === 'incoming' ? <Incoming key={r.id} r={r} onDone={load} /> : <Outgoing key={r.id} r={r} onDone={load} />))}
    </ScrollView>
  );
}
