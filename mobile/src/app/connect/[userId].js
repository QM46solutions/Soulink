// Send a Connect request: someone you know or someone new → what you're hoping for → optional note → send.
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { BrandScreen } from '../../components/BrandScreen';
import { AuraAvatar } from '../../components/ProfileHeader';
import { ChoiceCard, IntentBadge, IntentCard, ScorePill } from '../../components/Choice';
import MatchPanel from '../../components/MatchPanel';
import { Button, ErrorText, Input, Loading, s } from '../../components/ui';
import { INTENTS, intentOf } from '../../lib/intents';
import { colors, fonts, space } from '../../lib/theme';

export default function Connect() {
  const { userId, username } = useLocalSearchParams();
  const { user: me } = useAuth();
  const [target, setTarget] = useState(null);
  const [status, setStatus] = useState(null);
  const [match, setMatch] = useState(null);
  const [knows, setKnows] = useState(null);
  const [intent, setIntent] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!me.soulReady) { router.replace('/soul'); return; }
    (async () => {
      try {
        const [p, st] = await Promise.all([api(`/users/u/${encodeURIComponent(username)}`), api(`/connections/status/${userId}`)]);
        setTarget(p.user); setStatus(st); setMatch(p.match || null);
      } catch (e) { setError(e.message); }
    })();
  }, [userId, username, me.soulReady]);

  const send = async () => {
    setBusy(true); setError(null);
    try {
      await api('/connections/requests', { method: 'POST', body: { toUserId: userId, intent, knows: knows === 'known', note: note.trim() || undefined } });
      setSent(true);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (!target && !error) return <Loading />;
  const first = target?.displayName?.split(' ')[0] || target?.username;

  if (sent) {
    const it = intentOf(intent);
    return (
      <BrandScreen back>
        <View style={{ alignItems: 'center' }}>
          <IntentBadge intent={it} size={96} />
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 24, color: colors.text, marginTop: space.lg, textAlign: 'center' }}>Request sent</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.muted, marginTop: space.sm, textAlign: 'center' }}>
            {first} will see you want to connect for {it.label} {it.emoji}. You'll get a notification when they accept, hold or reject.
          </Text>
        </View>
        <Button title="Done" style={{ marginTop: space.xl }} onPress={() => router.back()} />
      </BrandScreen>
    );
  }

  return (
    <BrandScreen back center={false}>
      <View style={{ alignItems: 'center', marginTop: space.md }}>
        {target ? <AuraAvatar user={target} size={84} /> : null}
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 22, color: colors.text, marginTop: space.md, textAlign: 'center' }}>Connect with {first}</Text>
        <ScorePill score={status?.soulScore} intent={intent} style={{ marginTop: space.sm }} />
      </View>
      {/* the full Soul Score, right when you decide to connect */}
      {match ? <View style={{ marginTop: space.lg, marginHorizontal: -space.xl }}><MatchPanel match={match} userId={userId} name={first} /></View> : null}

      <Text style={[s.label, { marginTop: space.xl, marginLeft: 0, textAlign: 'center' }]}>Who is {first} to you?</Text>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <ChoiceCard icon="people" title="Someone I know" text="Friend, classmate, colleague" selected={knows === 'known'} onPress={() => setKnows('known')} />
        <ChoiceCard icon="sparkles" title="Someone new" text="We haven't met yet" selected={knows === 'new'} onPress={() => setKnows('new')} />
      </View>

      <Text style={[s.label, { marginTop: space.xl, marginLeft: 0, textAlign: 'center' }]}>What are you hoping for?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {INTENTS.map((i) => (
          <IntentCard key={i.key} intent={i} selected={intent === i.key} onPress={() => setIntent(i.key)} />
        ))}
      </View>

      <Input label="Add a note (optional)" value={note} onChangeText={setNote} maxLength={150} multiline
        placeholder={`e.g. We met at the Hitex tech meetup!`} hint={`${note.length}/150 · ${first} sees this with your request`} style={{ marginTop: space.xl }} />

      <ErrorText>{error}</ErrorText>
      <Button title={intent ? `Send ${intentOf(intent).label} request` : 'Send request'} onPress={send} loading={busy} disabled={!knows || !intent} />
    </BrandScreen>
  );
}
