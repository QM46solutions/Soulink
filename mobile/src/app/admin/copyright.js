// Soulink team: copyright reports to review. Decide within 36 hours (Copyright Rules 2013, Rule 75); amber after 24.
import { useCallback, useState } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { api } from '../../lib/api';
import { confirm } from '../../lib/confirm';
import { Button, Chip, Empty, ErrorText, Loading, s } from '../../components/ui';
import { colors, fonts, space } from '../../lib/theme';

const TABS = [['received', 'To review'], ['removed', 'Removed'], ['rejected', 'Rejected'], ['restored', 'Restored']];
const ago = (d) => { const h = Math.round((Date.now() - new Date(d)) / 3600_000); return h < 1 ? 'just now' : h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`; };

export default function CopyrightQueue() {
  const [tab, setTab] = useState('received');
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => { setD(null); api(`/admin/copyright?status=${tab}`).then(setD).catch((e) => setError(e.message)); }, [tab]);
  useFocusEffect(load);
  const act = async (r, action, label) => {
    if (!(await confirm(`${label}?`, action === 'remove' ? 'The content is taken down, the uploader gets a strike and sees the reporter\'s name and email.' : undefined, { confirmText: label, destructive: action === 'remove' }))) return;
    try { await api(`/admin/copyright/${r.id}/decide`, { method: 'POST', body: { action } }); load(); } catch (e) { setError(e.message); }
  };
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.md }}>
        {TABS.map(([k, l]) => <Chip key={k} label={l} selected={tab === k} onPress={() => setTab(k)} />)}
      </View>
      <ErrorText>{error}</ErrorText>
      {!d ? <Loading /> : !d.reports.length ? <Empty icon="musical-notes-outline" title="Nothing here" text={tab === 'received' ? 'No copyright reports waiting.' : 'No reports in this list.'} /> : d.reports.map((r) => {
        const age = (Date.now() - new Date(r.createdAt)) / 3600_000;
        const late = tab === 'received' && age > d.decideWithinHours;
        const soon = tab === 'received' && !late && age > (d.remindAfterHours || 24);
        const left = Math.max(0, Math.ceil(d.decideWithinHours - age));
        return (
          <View key={r.id} style={{ borderWidth: 1, borderColor: late ? colors.danger : soon ? colors.gold : colors.border, borderRadius: 16, padding: space.md, marginBottom: space.md, backgroundColor: colors.glass }}>
            <Text style={{ fontFamily: fonts.semibold, color: colors.text }}>{r.rightsOwner} · {r.kind === 'spark' ? 'Spark' : 'Post'}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: late ? colors.danger : soon ? colors.gold : colors.dim, marginTop: 2 }}>{ago(r.createdAt)}{late ? ' · past the 36-hour limit, decide now' : tab === 'received' ? ` · ${left} h left to decide` : ''}</Text>
            <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: space.sm, lineHeight: 19 }}>
              {r.reporter.name} ({r.relationship === 'agent' ? 'agent' : 'owner'}), {r.reporter.email}{r.phone ? `, ${r.phone}` : ''}{'\n'}{r.address}{'\n\n'}Work: {r.work}
              {r.proof ? `\nProof: ${r.proof}` : ''}{r.explanation ? `\nNote: ${r.explanation}` : ''}{r.appealText ? `\n\nUploader contested: ${r.appealText}` : ''}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm }}>
              <Chip label={`Open the ${r.kind}`} onPress={() => router.push(`/${r.kind}/${r.contentId}`)} />
              {r.originalUrl ? <Chip label="Original work" onPress={() => Linking.openURL(r.originalUrl)} /> : null}
            </View>
            {tab === 'received' ? (
              <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
                <Button title="Remove" variant="danger" small onPress={() => act(r, 'remove', 'Remove it')} style={{ flex: 1 }} />
                <Button title="Reject" variant="ghost" small onPress={() => act(r, 'reject', 'Reject the report')} style={{ flex: 1 }} />
              </View>
            ) : tab === 'removed' ? (
              <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
                <Button title="Restore now" variant="ghost" small onPress={() => act(r, 'restore', 'Restore it')} style={{ flex: 1 }} />
                <Button title="Court order received" variant="ghost" small onPress={() => act(r, 'court_order', 'Record the court order')} style={{ flex: 1 }} />
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}
