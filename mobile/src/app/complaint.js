// Raise a complaint with the Grievance Officer. Public: anyone can file, logged in or not.
// India's IT Rules 2021 (as amended) and the DPDP Rules 2025: we acknowledge at once by email and decide within 7 days;
// intimate, morphed or impersonating content of the complainant is acted on within 2 hours.
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, Chip, ErrorText, Input, s } from '../components/ui';
import { colors, fonts, space } from '../lib/theme';

const FALLBACK = [
  ['intimate_or_impersonation', 'Nude, sexual, morphed or fake content of me, or someone pretending to be me'],
  ['content', 'A post, Spark, comment or message breaks the rules or the law'],
  ['account', 'My account (blocked, limited, removed, or a decision I disagree with)'],
  ['privacy', 'My privacy or personal data'],
  ['data_rights', 'See, correct or erase my data, or withdraw consent'],
  ['ai_content', 'AI-made content (Soulmoji, Argue Referee, translation)'],
  ['payment', 'A payment or refund'],
  ['other', 'Something else'],
].map(([key, text]) => ({ key, text }));

export default function Complaint() {
  const q = useLocalSearchParams();
  const { user } = useAuth() || {};
  const [cats, setCats] = useState(FALLBACK);
  const [f, setF] = useState({ name: user?.displayName || user?.display_name || '', email: user?.email || '', phone: '', category: q.category ? String(q.category) : '', aboutUrl: q.url ? String(q.url) : '', aboutUsername: q.username ? String(q.username) : '', details: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  useEffect(() => { api('/grievances/categories').then((r) => r?.categories?.length && setCats(r.categories)).catch(() => {}); }, []);
  const ready = f.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(f.email) && f.category && f.details.trim().length >= 20;

  const send = async () => {
    setBusy(true); setError(null);
    try {
      const body = { ...f };
      for (const k of ['phone', 'aboutUrl', 'aboutUsername']) if (!String(body[k] || '').trim()) delete body[k];
      const r = await api('/grievances', { method: 'POST', body });
      setDone(r);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  if (done) {
    return (
      <View style={[s.screen, { padding: space.xl, justifyContent: 'center' }]}>
        <Stack.Screen options={{ title: 'Complaint received' }} />
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 22, color: colors.text, textAlign: 'center' }}>Complaint #{done.ticket} received</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: space.md, lineHeight: 21 }}>
          {done.urgent
            ? 'We act on complaints about intimate, morphed or impersonating content within 2 hours.'
            : 'Our Grievance Officer will reply with a decision within 7 days.'} We emailed you a copy with your ticket number.
        </Text>
        <Button title="Done" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={{ marginTop: space.xl }} />
      </View>
    );
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Raise a complaint' }} />
      <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted, lineHeight: 21, marginBottom: space.lg }}>
        Tell our Grievance Officer about content, your account or your personal data. We email you a ticket number straight away and reply with a decision within 7 days. For copyright, use Report copyright instead.
      </Text>

      <Text style={s.label}>What is it about?</Text>
      <View style={{ marginBottom: space.md }}>
        {cats.map((c) => <Chip key={c.key} label={c.text} selected={f.category === c.key} onPress={() => set('category')(c.key)} style={{ alignSelf: 'flex-start' }} />)}
      </View>
      {f.category === 'intimate_or_impersonation' ? (
        <View style={{ borderRadius: 14, padding: space.md, backgroundColor: 'rgba(255,107,157,0.12)', marginBottom: space.md }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.text, lineHeight: 19 }}>We act on this within 2 hours. If you are in danger, call 112. You can also report to the cyber crime helpline 1930 or cybercrime.gov.in.</Text>
        </View>
      ) : null}

      <Input label="Your full name" value={f.name} onChangeText={set('name')} maxLength={120} />
      <Input label="Email (we reply here)" value={f.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" maxLength={254} />
      <Input label="Phone (optional)" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" maxLength={30} />
      <Input label="Link to the Spark, post or profile (optional)" value={f.aboutUrl} onChangeText={set('aboutUrl')} autoCapitalize="none" maxLength={500} hint="Share › Copy link" />
      <Input label="Their @username (optional)" value={f.aboutUsername} onChangeText={set('aboutUsername')} autoCapitalize="none" maxLength={41} />
      <Input label="What happened" value={f.details} onChangeText={set('details')} multiline maxLength={2000} hint="What, when, and what you would like us to do. At least 20 characters." />

      <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.dim, lineHeight: 18, marginBottom: space.md }}>
        We use these details only to handle your complaint and keep them as a record for 3 years, as the law requires. If you disagree with our decision you can appeal to the Grievance Appellate Committee (gac.gov.in), or to the Data Protection Board of India for personal data.
      </Text>
      <ErrorText>{error}</ErrorText>
      <Button title="Send complaint" onPress={send} loading={busy} disabled={!ready} />
    </ScrollView>
  );
}
