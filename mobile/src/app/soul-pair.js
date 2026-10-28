// "A truer match": 2-3 quick scenarios about what Soul DNA can't judge yet for you and one person (asked of the
// person who receives a request; the sender gets them while sending). Optional. Answers also sharpen your own Soul DNA.
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../lib/api';
import { BrandHeader, BrandScreen } from '../components/BrandScreen';
import { Button, ErrorText, Loading } from '../components/ui';
import { colors, fonts, space } from '../lib/theme';

export default function SoulPair() {
  const { userId, name } = useLocalSearchParams();
  const [qs, setQs] = useState(null);
  const [ans, setAns] = useState({});
  const [shownAt, setShownAt] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  useEffect(() => {
    api(`/soul/pair/${userId}`).then((r) => { setQs(r.questions || []); setShownAt(Date.now()); }).catch((e) => { setError(e.message); setQs([]); });
  }, [userId]);

  const pick = (q, o) => setAns((a) => ({ ...a, [q.id]: { o, ms: Date.now() - shownAt, ...(a[q.id] ? { ch: (a[q.id].ch || 0) + 1 } : {}) } }));
  const save = async () => {
    setBusy(true); setError(null);
    try { setDone(await api(`/soul/pair/${userId}`, { method: 'POST', body: { answers: ans } })); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  if (!qs) return <Loading />;
  if (done || !qs.length) {
    return (
      <BrandScreen back>
        <BrandHeader size={32} title={done ? 'Thanks, noted' : 'Nothing to ask'}
          subtitle={done ? `Your match with ${name || 'them'} is now ${done.soulScore ?? '–'}%.` : `Soul DNA already knows enough about you and ${name || 'them'}.`} />
        <Button title="Done" style={{ marginTop: space.xl }} onPress={() => router.back()} />
      </BrandScreen>
    );
  }
  return (
    <BrandScreen back center={false}>
      <BrandHeader size={32} title="A truer match" subtitle={`Soul DNA isn't sure yet how you and ${name || 'they'} would fit here. Go with your gut. Optional.`} />
      {qs.map((q) => (
        <View key={q.id} style={{ marginBottom: space.lg }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 16, lineHeight: 23, color: colors.text, marginBottom: space.sm }}>{q.text}</Text>
          {q.options.map((label, idx) => {
            const on = ans[q.id]?.o === idx;
            return (
              <Pressable key={label} onPress={() => pick(q, idx)} accessibilityRole="button"
                style={({ hovered }) => ({ borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 11, marginBottom: 8,
                  borderColor: on ? colors.soul : hovered ? colors.aura : colors.border, backgroundColor: on ? 'rgba(124,92,252,0.22)' : colors.inputBg })}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 14.5, color: colors.text }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
      <ErrorText>{error}</ErrorText>
      <Button title="Save" onPress={save} loading={busy} disabled={!Object.keys(ans).length} />
      <Button title="Skip" variant="ghost" style={{ marginTop: space.sm }} onPress={() => router.back()} />
    </BrandScreen>
  );
}
