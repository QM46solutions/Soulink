// Settings › Report a problem: goes straight to the Soulink team console (Issues), with a reference number.
// Only what the person types is sent, plus the phone type and app version (no screenshots, no chats).
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { reportProblem, platform, appVersion } from '../../lib/telemetry';
import { notice } from '../../lib/confirm';
import { Button, ErrorText, Input, s } from '../../components/ui';
import { Note } from '../../components/SettingsUI';
import { colors, fonts, space } from '../../lib/theme';
import { router } from 'expo-router';

const AREAS = ['Sign-in', 'Home & posts', 'Sparks', 'Chat', 'Soul DNA', 'Discover', 'Profile', 'Notifications', 'Something else'];

export default function ReportProblem() {
  const [area, setArea] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const ok = text.trim().length >= 10;
  const send = async () => {
    setBusy(true); setError(null);
    try {
      const r = await reportProblem(text.trim(), area || undefined);
      notice('Thanks, the team has it', `Your reference is ${r.ref}. We look at every report.`);
      router.back();
    } catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.text }}>What went wrong?</Text>
      <Note>Tell us what you were doing and what happened. The team sees it right away.</Note>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, marginTop: space.lg, marginBottom: space.sm }}>Where in the app? (optional)</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {AREAS.map((a) => (
          <Text key={a} onPress={() => setArea(area === a ? null : a)} accessibilityRole="button" accessibilityState={{ selected: area === a }}
            style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, overflow: 'hidden', fontFamily: fonts.medium, fontSize: 13,
              color: area === a ? '#fff' : colors.text, backgroundColor: area === a ? colors.soul : 'rgba(255,255,255,0.06)',
              borderWidth: 1, borderColor: area === a ? colors.soul : 'rgba(255,255,255,0.12)' }}>{a}</Text>
        ))}
      </View>
      <Input label="Describe the problem" value={text} onChangeText={setText} multiline maxLength={2000} placeholder="For example: the chat doesn't scroll after I send a photo"
        inputStyle={{ minHeight: 120, textAlignVertical: 'top' }} style={{ marginTop: space.lg }} />
      <Note>We also send your phone type ({platform}){appVersion ? ` and app version (${appVersion})` : ''}, so we can find the problem faster.</Note>
      <View style={{ marginTop: space.lg }}>
        <ErrorText>{error}</ErrorText>
        <Button title="Send to the team" onPress={send} loading={busy} disabled={!ok} />
      </View>
    </ScrollView>
  );
}
