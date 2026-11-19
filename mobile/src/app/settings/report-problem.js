// Settings › Report a problem: goes straight to the Soulink team console (Issues), with a reference number.
// Sent: the category, what the person types, an optional screenshot they pick, and (if they leave the switch on) the
// app version, app code, phone model and OS version. Never chats, codes, passwords or anything else from the phone.
// If sending fails, everything typed stays on screen so they can try again.
import { useState } from 'react';
import { Image, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { diagnostics, reportProblem } from '../../lib/telemetry';
import { notice } from '../../lib/confirm';
import { Button, ErrorText, Input, s } from '../../components/ui';
import { Note } from '../../components/SettingsUI';
import { colors, fonts, space } from '../../lib/theme';

const CATEGORIES = ['App crashing', 'Screen not loading', 'Login or registration issue', 'Email verification issue', 'Slow performance or lag', 'Profile-related issue', 'Other'];

export default function ReportProblem() {
  const [category, setCategory] = useState(null);
  const [text, setText] = useState('');
  const [comments, setComments] = useState('');
  const [shot, setShot] = useState(null);
  const [withDetails, setWithDetails] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const ok = !!category && text.trim().length >= 10 && !busy;
  const d = diagnostics();
  const detailLine = [d.appVersion && `app ${d.appVersion}`, d.build && d.build !== 'store' && `code ${d.build.replace('ota-', '')}`, d.device, d.osVersion && `${d.platform === 'ios' ? 'iOS' : d.platform === 'android' ? 'Android' : ''} ${d.osVersion}`.trim()].filter(Boolean).join(' · ');

  const pick = async () => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (!r.canceled && r.assets?.[0]?.uri) setShot(r.assets[0].uri);
    } catch { setError("Couldn't open your photos. You can send the report without a screenshot."); }
  };

  const send = async () => {
    if (!ok) return;
    setBusy(true); setError(null);
    try {
      const r = await reportProblem(text.trim(), { category, comments: comments.trim() || undefined, screenshotUri: shot || undefined, includeDiagnostics: withDetails });
      notice('Thank you', `Thank you for reporting this issue. Your feedback helps us improve Soulink.\n\nYour reference is ${r.ref}.`);
      router.back();
    } catch (e) {
      // keep everything typed so it can be sent again
      setError(e.status === 429 ? 'You have sent a lot of reports in the last hour. Please try again later.' : `${e.message || "Couldn't send it."} Your report is still here: tap Submit Report to try again.`);
      setBusy(false);
    }
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.text }}>Report a Problem</Text>
      <Note>Having trouble with Soulink? Let us know what happened so we can help improve your experience.</Note>

      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, marginTop: space.lg, marginBottom: space.sm }}>What kind of problem?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {CATEGORIES.map((a) => (
          <Text key={a} onPress={() => setCategory(a)} accessibilityRole="button" accessibilityState={{ selected: category === a }}
            style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, overflow: 'hidden', fontFamily: fonts.medium, fontSize: 13,
              color: category === a ? '#fff' : colors.text, backgroundColor: category === a ? colors.soul : 'rgba(255,255,255,0.06)',
              borderWidth: 1, borderColor: category === a ? colors.soul : 'rgba(255,255,255,0.12)' }}>{a}</Text>
        ))}
      </View>

      <Input label="Describe the problem" value={text} onChangeText={setText} multiline maxLength={2000} placeholder="What were you doing, and what happened? For example: the chat doesn't scroll after I send a photo"
        inputStyle={{ minHeight: 120, textAlignVertical: 'top' }} style={{ marginTop: space.lg }} hint="At least 10 characters" />

      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, marginTop: space.md, marginBottom: space.sm }}>Screenshot (optional)</Text>
      {shot ? (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Image source={{ uri: shot }} style={{ width: 72, height: 128, borderRadius: 10, backgroundColor: colors.card }} />
          <Pressable onPress={() => setShot(null)} accessibilityRole="button" style={{ marginLeft: space.md, padding: 8 }}>
            <Text style={{ fontFamily: fonts.semibold, color: colors.danger }}>Remove</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={pick} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }}>
          <Ionicons name="image-outline" size={18} color={colors.aura} style={{ marginRight: 8 }} />
          <Text style={{ fontFamily: fonts.medium, color: colors.text }}>Add a screenshot</Text>
        </Pressable>
      )}
      <Note>Only the picture you choose is sent. Check it doesn't show anything private, like a chat.</Note>

      <Input label="Anything else? (optional)" value={comments} onChangeText={setComments} multiline maxLength={1000} inputStyle={{ minHeight: 70, textAlignVertical: 'top' }} style={{ marginTop: space.md }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.md }}>
        <View style={{ flex: 1, paddingRight: space.md }}>
          <Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 14 }}>Include app and phone details</Text>
          <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12.5, lineHeight: 18, marginTop: 2 }}>{detailLine || 'App version and phone type'}. Helps us find the problem faster.</Text>
        </View>
        <Switch value={withDetails} onValueChange={setWithDetails} trackColor={{ true: colors.soul }} />
      </View>

      <View style={{ marginTop: space.lg }}>
        <ErrorText>{error}</ErrorText>
        <Button title="Submit Report" onPress={send} loading={busy} disabled={!ok} />
      </View>
    </ScrollView>
  );
}
