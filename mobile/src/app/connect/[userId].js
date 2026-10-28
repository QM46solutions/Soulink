// Send a Connect request, one clear question at a time:
//   1. Do you already know them?
//   2. Yes → who are they to you: Family, Friend, Colleague or Other.  No → what are you hoping for?
//   3. (someone new, optional) 2-3 quick scenarios about what Soul DNA can't judge yet for you two
//   4. Send.   (No note: nothing can be sent to someone until they accept.)
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { BrandScreen } from '../../components/BrandScreen';
import { AuraAvatar } from '../../components/ProfileHeader';
import { ChoiceCard, IntentBadge, IntentCard, ScorePill } from '../../components/Choice';
import { Button, ErrorText, Loading, s } from '../../components/ui';
import { INTENTS, KNOWN, intentOf } from '../../lib/intents';
import { colors, fonts, space } from '../../lib/theme';

function PairQuestion({ q, value, onPick }) {
  return (
    <View style={{ marginBottom: space.lg }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 15.5, lineHeight: 22, color: colors.text, marginBottom: space.sm }}>{q.text}</Text>
      {q.options.map((label, idx) => {
        const on = value?.o === idx;
        return (
          <Pressable key={label} onPress={() => onPick(idx)} accessibilityRole="button"
            style={({ hovered }) => ({ borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 11, marginBottom: 8,
              borderColor: on ? colors.soul : hovered ? colors.aura : colors.border, backgroundColor: on ? 'rgba(124,92,252,0.22)' : colors.inputBg })}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, color: colors.text }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Connect() {
  const { userId, username } = useLocalSearchParams();
  const { user: me } = useAuth();
  const [target, setTarget] = useState(null);
  const [status, setStatus] = useState(null);
  const [knows, setKnows] = useState(null);     // 'known' | 'new'
  const [knownAs, setKnownAs] = useState(null); // family | friend | colleague | other
  const [intent, setIntent] = useState(null);   // what you hope for, with someone new
  const [pairQs, setPairQs] = useState([]);
  const [pairAns, setPairAns] = useState({});
  const [shownAt, setShownAt] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(null);

  useEffect(() => {
    if (!me.soulReady) { router.replace('/soul'); return; }
    (async () => {
      try {
        const [p, st] = await Promise.all([api(`/users/u/${encodeURIComponent(username)}`), api(`/connections/status/${userId}`)]);
        setTarget(p.user); setStatus(st);
      } catch (e) { setError(e.message); }
    })();
  }, [userId, username, me.soulReady]);

  // someone new + an expectation: ask Soul DNA if it needs to know anything more about you two
  useEffect(() => {
    setPairQs([]); setPairAns({});
    if (knows !== 'new' || !intent) return;
    api(`/soul/pair/${userId}?intent=${intent}`).then((r) => { setPairQs(r.questions || []); setShownAt(Date.now()); }).catch(() => {});
  }, [knows, intent, userId]);

  const pick = (q, o) => setPairAns((a) => ({ ...a, [q.id]: { o, ms: Date.now() - shownAt, ...(a[q.id] ? { ch: (a[q.id].ch || 0) + 1 } : {}) } }));

  const send = async () => {
    setBusy(true); setError(null);
    try {
      if (knows === 'new' && Object.keys(pairAns).length) {
        await api(`/soul/pair/${userId}`, { method: 'POST', body: { answers: pairAns, intent } }).catch(() => {}); // optional: never blocks the request
      }
      const body = knows === 'known' ? { toUserId: userId, knows: true, knownAs } : { toUserId: userId, knows: false, intent };
      const r = await api('/connections/requests', { method: 'POST', body });
      setSent(r.request);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (!target && !error) return <Loading />;
  const first = target?.displayName?.split(' ')[0] || target?.username;

  if (sent) {
    const it = intentOf(sent.intent);
    return (
      <BrandScreen back>
        <View style={{ alignItems: 'center' }}>
          <IntentBadge intent={it} size={96} />
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 24, color: colors.text, marginTop: space.lg, textAlign: 'center' }}>Request sent</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.muted, marginTop: space.sm, textAlign: 'center' }}>
            {knows === 'known' ? `${first} will see you know them as ${it.label.toLowerCase()} ${it.emoji}.` : `${first} will see you want to connect for ${it.label} ${it.emoji}.`} You'll get a notification when they accept, hold or reject.
          </Text>
        </View>
        <Button title="Done" style={{ marginTop: space.xl }} onPress={() => router.back()} />
      </BrandScreen>
    );
  }

  const ready = knows === 'known' ? !!knownAs : knows === 'new' ? !!intent : false;
  const label = knows === 'known' ? (knownAs ? `Send request as ${KNOWN.find((k) => k.key === knownAs)?.label}` : 'Send request') : intent ? `Send ${intentOf(intent).label} request` : 'Send request';

  return (
    <BrandScreen back center={false}>
      <View style={{ alignItems: 'center', marginTop: space.md }}>
        {target ? <AuraAvatar user={target} size={84} /> : null}
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 22, color: colors.text, marginTop: space.md, textAlign: 'center' }}>Connect with {first}</Text>
        {knows === 'new' ? <ScorePill score={status?.soulScore} intent={intent} style={{ marginTop: space.sm }} /> : null}
      </View>

      <Text style={[s.label, { marginTop: space.xl, marginLeft: 0, textAlign: 'center' }]}>Do you already know {first}?</Text>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <ChoiceCard icon="people" title="Yes, I know them" text="Family, friend, colleague…" selected={knows === 'known'} onPress={() => { setKnows('known'); setIntent(null); }} />
        <ChoiceCard icon="sparkles" title="No, someone new" text="We haven't met yet" selected={knows === 'new'} onPress={() => { setKnows('new'); setKnownAs(null); }} />
      </View>

      {knows === 'known' ? (
        <>
          <Text style={[s.label, { marginTop: space.xl, marginLeft: 0, textAlign: 'center' }]}>Who is {first} to you?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
            {KNOWN.map((k) => (
              <View key={k.key} style={{ width: '47%' }}>
                <ChoiceCard icon={k.icon} title={`${k.emoji}  ${k.label}`} text={k.line} selected={knownAs === k.key} onPress={() => setKnownAs(k.key)} />
              </View>
            ))}
          </View>
        </>
      ) : null}

      {knows === 'new' ? (
        <>
          <Text style={[s.label, { marginTop: space.xl, marginLeft: 0, textAlign: 'center' }]}>What are you hoping for with {first}?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {INTENTS.map((i) => (
              <IntentCard key={i.key} intent={i} selected={intent === i.key} onPress={() => setIntent(i.key)} />
            ))}
          </View>
        </>
      ) : null}

      {knows === 'new' && intent && pairQs.length ? (
        <View style={{ marginTop: space.xl, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: space.lg }}>
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.1, color: colors.aura, textTransform: 'uppercase' }}>Optional · {pairQs.length} quick question{pairQs.length > 1 ? 's' : ''}</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.muted, marginTop: 6, marginBottom: space.lg }}>
            Soul DNA isn't sure yet how you two would fit here. Go with your gut. {first} gets questions too.
          </Text>
          {pairQs.map((q) => <PairQuestion key={q.id} q={q} value={pairAns[q.id]} onPick={(o) => pick(q, o)} />)}
        </View>
      ) : null}

      <View style={{ height: space.xl }} />
      <ErrorText>{error}</ErrorText>
      <Button title={label} onPress={send} loading={busy} disabled={!ready} />
    </BrandScreen>
  );
}
