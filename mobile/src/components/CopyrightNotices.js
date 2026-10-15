// Account status › Copyright: my removed content, who complained (as Instagram shows), my strikes, and "Contest".
import { useCallback, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../lib/api';
import { InfoRow, Note, Section } from './SettingsUI';
import { Button, ErrorText, s } from './ui';
import Consent from './Consent';
import { colors, fonts, space } from '../lib/theme';

const when = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const STATUS = { removed: ['Removed', colors.danger], restored: ['Restored', colors.mint], court_order: ['Removed (court order)', colors.danger] };

function Contest({ n, onDone }) {
  const [text, setText] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const send = async () => {
    setBusy(true); setError(null);
    try { await api(`/copyright/${n.id}/appeal`, { method: 'POST', body: { text, confirm: true } }); onDone(); }
    catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md }}>
      <TextInput value={text} onChangeText={setText} multiline maxLength={1000} placeholder="Why you have the right to use it: your own work, permission from the owner, or a use the law allows"
        placeholderTextColor={colors.dim} style={[s.input, { minHeight: 90, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: space.md, textAlignVertical: 'top' }]} />
      <Pressless value={ok} onChange={setOk} />
      <ErrorText>{error}</ErrorText>
      <Button title="Contest the removal" onPress={send} loading={busy} disabled={!ok || text.trim().length < 20} small />
    </View>
  );
}
// a single statement checkbox, styled like the sign-up consent
function Pressless({ value, onChange }) {
  return <Consent value={value} onChange={onChange} statement="I believe in good faith that this was removed by mistake, and the information I give is true. My contest and contact details will be shared with the person who complained." />;
}

export default function CopyrightNotices() {
  const [d, setD] = useState(null);
  const [open, setOpen] = useState(null);
  const load = useCallback(() => { api('/copyright/mine').then(setD).catch(() => setD({ notices: [], strikes: 0 })); }, []);
  useFocusEffect(load);
  if (!d || (!d.notices.length && !d.strikes)) return null;
  return (
    <View>
      <Section>Copyright</Section>
      <InfoRow icon="musical-notes" title="Copyright strikes (last 12 months)" value={`${d.strikes} of 3`} color={d.strikes ? colors.danger : colors.mint} />
      {d.postingBlockedUntil && new Date(d.postingBlockedUntil) > new Date() ? <Note>You can't post until {when(d.postingBlockedUntil)} because of copyright strikes.</Note> : null}
      {d.notices.map((n) => {
        const [label, color] = STATUS[n.status] || [n.status, colors.muted];
        return (
          <View key={n.id} style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <InfoRow icon={n.kind === 'spark' ? 'film' : 'image'} title={`Your ${n.kind === 'spark' ? 'Spark' : 'post'} · ${when(n.createdAt)}`} value={label} color={color} />
            <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, paddingHorizontal: space.lg, lineHeight: 19 }}>
              Complaint from {n.reporter.name} ({n.reporter.email}) for {n.rightsOwner}: {n.work}
            </Text>
            {n.status === 'removed' && !n.appealed ? (
              open === n.id ? <Contest n={n} onDone={() => { setOpen(null); load(); }} />
                : <Text onPress={() => setOpen(n.id)} style={{ fontFamily: fonts.semibold, color: colors.aura, paddingHorizontal: space.lg, paddingVertical: space.md }}>Contest this removal</Text>
            ) : n.status === 'removed' ? (
              <Note>You contested this. It comes back on {when(n.restoreAfter)} unless the owner sends a court order.</Note>
            ) : <View style={{ height: space.md }} />}
          </View>
        );
      })}
      <Note>You can also contact the person who complained directly; they can withdraw it. 3 strikes in 12 months remove your account.</Note>
    </View>
  );
}
