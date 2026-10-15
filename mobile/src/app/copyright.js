// Report a copyright problem. Public: anyone can file, logged in or not. Modelled on Instagram's copyright report form,
// plus what India's Copyright Rules 2013 (Rule 75) ask of a notice.
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { api } from '../lib/api';
import { Button, Chip, ErrorText, Input, s } from '../components/ui';
import Consent from '../components/Consent';
import { colors, fonts, space } from '../lib/theme';

export default function CopyrightReport() {
  const q = useLocalSearchParams();
  const [f, setF] = useState({ name: '', email: '', phone: '', address: '', relationship: 'owner', rightsOwner: '', work: '', originalUrl: '', proof: '', contentUrl: q.url ? String(q.url) : '', explanation: '', signature: '' });
  const [st, setSt] = useState({ goodFaith: false, accurate: false, suitUndertaking: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const ready = f.name && f.email && f.address && f.rightsOwner && f.work && f.contentUrl && f.signature && st.goodFaith && st.accurate && st.suitUndertaking;

  const send = async () => {
    setBusy(true); setError(null);
    try {
      const body = { ...f, ...st };
      for (const k of ['phone', 'originalUrl', 'proof', 'explanation']) if (!body[k]) delete body[k];
      const r = await api('/copyright/reports', { method: 'POST', body });
      setDone(r.reference);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  if (done) {
    return (
      <View style={[s.screen, { padding: space.xl, justifyContent: 'center' }]}>
        <Stack.Screen options={{ title: 'Copyright report' }} />
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 22, color: colors.text, textAlign: 'center' }}>Report received</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: space.md, lineHeight: 21 }}>
          Reference {done}. We review every report within 24 hours and email you the outcome. If we remove the content, the person who posted it sees your name and email so they can contact you.
        </Text>
        <Button title="Done" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={{ marginTop: space.xl }} />
      </View>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Report copyright' }} />
      <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted, lineHeight: 21, marginBottom: space.lg }}>
        Use this form if a Spark or post on Soulink uses your copyrighted work (music, video, photo or text) without permission. Only the copyright owner or someone authorised to act for them can file. Your name and email are shared with the person who posted it.
      </Text>

      <Text style={s.label}>You are</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.md }}>
        <Chip label="The copyright owner" selected={f.relationship === 'owner'} onPress={() => set('relationship')('owner')} />
        <Chip label="Authorised to act for the owner" selected={f.relationship === 'agent'} onPress={() => set('relationship')('agent')} />
      </View>
      <Input label="Your full name" value={f.name} onChangeText={set('name')} maxLength={120} />
      <Input label="Email" value={f.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" maxLength={254} />
      <Input label="Phone (optional)" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" maxLength={30} />
      <Input label="Postal address" value={f.address} onChangeText={set('address')} multiline maxLength={400} />
      <Input label="Name of the copyright owner" value={f.rightsOwner} onChangeText={set('rightsOwner')} maxLength={200} hint="A person, label, studio or company" />

      <Input label="Describe your work" value={f.work} onChangeText={set('work')} multiline maxLength={1000} hint='e.g. The song "Monsoon Nights" (2024), sound recording and lyrics' />
      <Input label="Link to your original work (optional)" value={f.originalUrl} onChangeText={set('originalUrl')} autoCapitalize="none" maxLength={500} />
      <Input label="Proof you own it (optional)" value={f.proof} onChangeText={set('proof')} multiline maxLength={1000} hint="Copyright registration number, licence or label agreement, or a link" />
      <Input label="Link to the Spark or post on Soulink" value={f.contentUrl} onChangeText={set('contentUrl')} autoCapitalize="none" maxLength={500} hint="Share › Copy link on the Spark or post" />
      <Input label="Anything else we should know (optional)" value={f.explanation} onChangeText={set('explanation')} multiline maxLength={1000} />

      <Consent value={st.goodFaith} onChange={(v) => setSt((x) => ({ ...x, goodFaith: v }))} statement="I believe in good faith that this use is not authorised by the copyright owner, its agent or the law (it is not a fair dealing or other use allowed by section 52 of the Copyright Act, 1957)." />
      <Consent value={st.accurate} onChange={(v) => setSt((x) => ({ ...x, accurate: v }))} statement="The information in this report is accurate, and I am the owner or authorised to act on the owner's behalf." />
      <Consent value={st.suitUndertaking} onChange={(v) => setSt((x) => ({ ...x, suitUndertaking: v }))} statement="If the person who posted it contests this, I will file an infringement suit and send Soulink a court order within 21 days; otherwise the content may be restored (Copyright Rules 2013, Rule 75)." />
      <View style={{ marginTop: space.lg }}>
        <Input label="Electronic signature: type your full name" value={f.signature} onChangeText={set('signature')} maxLength={120} />
      </View>
      <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.dim, lineHeight: 18, marginBottom: space.md }}>
        False reports can be a legal offence and can lead to your account being removed. For trademarks, impersonation or anything else, write to our Grievance Officer.
      </Text>
      <ErrorText>{error}</ErrorText>
      <Button title="Submit report" onPress={send} loading={busy} disabled={!ready} />
    </ScrollView>
  );
}
