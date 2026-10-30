// Open Mic: speak your mind. Pick what it's about, say it in a line, then speak on video or with just your voice
// (for anyone who'd rather not show their face). Anyone can listen, react, comment and share.
import { useEffect, useLayoutEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { notice } from '../../lib/confirm';
import { MIC_TOPICS, postSpark } from '../../lib/sparks';
import MicVoice from '../../components/MicVoice';
import { GradButton } from '../../components/SparkHub';
import { colors, fonts, space } from '../../lib/theme';

const MAX_MS = 3 * 60 * 1000; // up to 3 minutes of voice
const mmss = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;

const Label = ({ children }) => <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, marginTop: space.lg, marginBottom: 8 }}>{children}</Text>;

export default function Speak() {
  const navigation = useNavigation();
  useLayoutEffect(() => { navigation.setOptions({ title: 'Speak your mind' }); }, [navigation]);
  const [topic, setTopic] = useState(null);
  const [caption, setCaption] = useState('');
  const [mode, setMode] = useState(null); // null | 'voice'
  const [clip, setClip] = useState(null); // { uri, type, ms }
  const [busy, setBusy] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const rec = useAudioRecorderState(recorder, 250);

  const stop = async () => {
    const ms = rec.durationMillis;
    try { await recorder.stop(); } catch { /* already stopped */ }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
    if (recorder.uri && ms > 1500) setClip({ uri: recorder.uri, type: Platform.OS === 'web' ? 'audio/webm' : 'audio/m4a', ms });
    else notice('Too short', 'Speak for at least a couple of seconds.');
  };
  useEffect(() => { if (rec.isRecording && rec.durationMillis >= MAX_MS) stop(); }, [rec.durationMillis]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) { notice('Microphone', 'Allow the microphone to speak on Open Mic.'); return; }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      setClip(null);
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch (e) { notice('Microphone', e.message || 'Could not start recording'); }
  };

  const post = async () => {
    setBusy(true);
    try {
      await postSpark({ videoUri: clip.uri, videoType: clip.type, category: 'openmic', caption: caption.trim(), details: {}, oneTake: false, mic: topic });
      router.replace('/spark/stage');
    } catch (e) { notice('Not posted', e.message); } finally { setBusy(false); }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
      <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.muted }}>
        Open Mic is your space to say it openly: something you went through, something you saw, or something you want to raise your voice about.
      </Text>

      <Label>What is it about?</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {MIC_TOPICS.map((t) => {
          const on = topic === t.key;
          return (
            <Pressable key={t.key} onPress={() => setTopic(t.key)} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={({ hovered }) => ({ paddingHorizontal: 14, height: 36, borderRadius: 18, justifyContent: 'center', borderWidth: 1.5,
                borderColor: on ? colors.gold : hovered ? colors.aura : colors.border, backgroundColor: on ? 'rgba(245,200,66,0.14)' : 'transparent' })}>
              <Text style={{ fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 13.5, color: on ? colors.text : colors.muted }}>{t.emoji}  {t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Label>In a line, what do you want to say? (optional)</Label>
      <TextInput value={caption} onChangeText={setCaption} maxLength={1000} multiline placeholder="e.g. What happened to me at the bus stop yesterday" placeholderTextColor={colors.dim}
        style={{ minHeight: 64, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text, fontFamily: fonts.body, fontSize: 15, padding: 14, outlineStyle: 'none' }} />

      <View style={{ flexDirection: 'row', marginTop: space.lg, padding: space.md, borderRadius: 14, backgroundColor: 'rgba(124,92,252,0.1)', borderWidth: 1, borderColor: 'rgba(124,92,252,0.3)' }}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.aura} style={{ marginRight: 8, marginTop: 1 }} />
        <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.muted }}>
          Speak honestly and with respect. No hate against any group, no threats, and no one else's phone number or address. Don't present something you can't back up as fact about a real person. Posts many people mark as offensive are taken down.
        </Text>
      </View>

      {mode !== 'voice' ? (
        <>
          <GradButton title="Speak on video" icon="video" disabled={!topic} style={{ marginTop: space.xl }}
            onPress={() => router.push({ pathname: '/spark/new', params: { mic: topic, caption: caption.trim() } })} />
          <Pressable onPress={() => setMode('voice')} disabled={!topic}
            style={({ hovered }) => ({ marginTop: space.md, height: 50, borderRadius: 25, borderWidth: 1.5, borderColor: hovered ? colors.gold : 'rgba(245,200,66,0.6)', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', opacity: topic ? 1 : 0.5 })}>
            <Ionicons name="mic" size={19} color={colors.gold} style={{ marginRight: 8 }} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.text }}>Speak with just your voice</Text>
          </Pressable>
          {!topic ? <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.dim, textAlign: 'center', marginTop: 8 }}>Pick what it's about first.</Text> : null}
        </>
      ) : (
        <View style={{ marginTop: space.xl }}>
          {clip ? (
            <>
              <MicVoice uri={clip.uri} topic={topic} height={240} />
              <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.md }}>
                <Pressable onPress={() => setClip(null)} style={{ flex: 1, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fonts.semibold, color: colors.text }}>Record again</Text>
                </Pressable>
                <GradButton title={busy ? 'Posting…' : 'Post'} icon="microphone-variant" disabled={busy} onPress={post} style={{ flex: 1, height: 48 }} />
              </View>
            </>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <Pressable onPress={rec.isRecording ? stop : start} accessibilityRole="button" accessibilityLabel={rec.isRecording ? 'Stop recording' : 'Start recording'}
                style={{ width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: rec.isRecording ? colors.spark : 'rgba(245,200,66,0.18)', borderWidth: 2, borderColor: colors.gold }}>
                <Ionicons name={rec.isRecording ? 'stop' : 'mic'} size={40} color={rec.isRecording ? '#fff' : colors.gold} />
              </Pressable>
              <Text style={{ fontFamily: fonts.mono, fontSize: 14, color: colors.text, marginTop: space.md }}>
                {rec.isRecording ? `Recording  ${mmss(rec.durationMillis)} / 3:00` : 'Tap to start speaking (up to 3 minutes)'}
              </Text>
              <Text onPress={() => setMode(null)} style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.aura, marginTop: space.lg }}>Use video instead</Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}
