// Post a Spark 🎬: 1) pick a category  2) record in Soulink (clips, timer) or choose one or more videos
// 2b) several videos: put them together in Spark Clips (order, trim, split, transitions) → joined into one video
// 3) edit in Spark Studio
// (trim, speed, filters, text, stickers, music, cover)  4) the category's extras + caption.
// Also used for a Casting Board audition (?casting=<id>) and for this week's Open Mic (?stage=1).
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { notice } from '../../lib/confirm';
import { CATEGORIES, DIETS, FIT_LEVELS, FIT_TYPES, NEWS_TOPICS, catOf, fitChallengeOfWeek, micTopicOf, postSpark, rollDice, scriptOfWeek } from '../../lib/sparks';
import SparkVideo from '../../components/SparkVideo';
import SparkCatBadge from '../../components/SparkCatBadge';
import SparkRecorder from '../../components/SparkRecorder';
import SparkStudio from '../../components/SparkStudio';
import SparkClips, { MAX_SPARK, newClipId } from '../../components/SparkClips';
import { joinClips } from '../../lib/joinClips';
import { api } from '../../lib/api';
import { cleanEdit, emptyEdit } from '../../lib/sparkEdit';
import MusicPicker from '../../components/MusicPicker';
import CityField from '../../components/CityField';
import { colors, fonts, gradients, space } from '../../lib/theme';

const MAX_MB = 40;
const Label = ({ children }) => <Text style={{ color: colors.dim, fontSize: 12, fontFamily: fonts.semibold, textTransform: 'uppercase', letterSpacing: 1, marginTop: space.lg, marginBottom: space.sm }}>{children}</Text>;
const Field = (props) => (
  <TextInput placeholderTextColor={colors.dim} {...props}
    style={[{ minHeight: 46, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text, fontFamily: fonts.body, fontSize: 15, outlineStyle: 'none' }, props.style]} />
);
function Pills({ options, value, onPick }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map(([k, label]) => (
        <Pressable key={k} onPress={() => onPick(value === k ? null : k)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5,
          borderColor: value === k ? colors.soul : colors.border, backgroundColor: value === k ? 'rgba(124,92,252,0.22)' : 'transparent' }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: value === k ? colors.text : colors.muted }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
function BigOption({ icon, title, text, onPress, colors: c, selected, badge }) {
  return (
    <Pressable onPress={onPress} style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', padding: space.md, borderRadius: 20, marginBottom: space.md, borderWidth: 1.5,
      borderColor: selected ? c[0] : hovered ? colors.aura : colors.border, backgroundColor: selected ? `${c[0]}22` : colors.glass })}>
      {badge || (
        <View style={{ width: 48, height: 48, borderRadius: 24, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          <LinearGradient colors={c} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <Ionicons name={icon} size={24} color="#fff" />
        </View>
      )}
      <View style={{ flex: 1, marginLeft: space.md }}>
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 16, color: colors.text }}>{title}</Text>
        {text ? <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 2 }}>{text}</Text> : null}
      </View>
      <Ionicons name={selected ? 'checkmark-circle' : 'chevron-forward'} size={22} color={selected ? c[0] : colors.dim} />
    </Pressable>
  );
}

export default function NewSpark() {
  const params = useLocalSearchParams();
  const castingId = typeof params.casting === 'string' ? params.casting : null;
  const forStage = params.stage === '1';
  const micTopic = typeof params.mic === 'string' ? params.mic : null; // Open Mic on video (topic chosen already)
  const [casting, setCasting] = useState(null); // the role you're auditioning for
  const [stage, setStage] = useState(null); // this week's Open Mic theme
  const [step, setStep] = useState(micTopic ? 'video' : 'category'); // category | video | clips | edit | details
  const [clips, setClips] = useState([]); // [{ id, uri, type, start, end }] when putting several videos together
  const [transition, setTransition] = useState('cut');
  const [joining, setJoining] = useState(null); // null, or how far joining the clips has got (0-1)
  const [edit, setEdit] = useState(emptyEdit());
  const [clipLen, setClipLen] = useState(0);
  const [category, setCategory] = useState(micTopic ? 'openmic' : null);
  const [mode, setMode] = useState(null); // acting: dice | script | scene | dub
  const [dice, setDice] = useState(null);
  const [video, setVideo] = useState(null); // { uri, type, oneTake }
  const [recording, setRecording] = useState(false);
  const [music, setMusic] = useState(null); // { uri, name, type }
  const [voice, setVoice] = useState(null); // the voiceover recorded in the studio { uri, type, name }
  const [caption, setCaption] = useState(typeof params.caption === 'string' ? params.caption : '');
  const [place, setPlace] = useState('');
  const [sound, setSound] = useState('place');
  const [cook, setCook] = useState({ dish: '', minutes: '', diet: null, ingredients: '', steps: '' });
  const [scene, setScene] = useState('');
  const [fit, setFit] = useState({ type: null, level: null, minutes: '', moves: '', useChallenge: false });
  const [news, setNews] = useState({ headline: '', topic: null, source: '' });
  const [busy, setBusy] = useState(false);
  const cat = category ? catOf(category) : null;
  const script = scriptOfWeek();

  useEffect(() => {
    if (castingId) api(`/sparks/casting/${castingId}`).then((r) => { setCasting(r.call); setCategory(r.call.category); if (r.call.category === 'acting') setMode('scene'); setStep('video'); }).catch((e) => notice('Casting', e.message));
    if (forStage) api('/sparks/stage').then((r) => setStage(r.theme)).catch(() => {});
  }, [castingId, forStage]);
  // nothing inside a category is required: the dice, script, scene and cards are all optional extras
  const pickCategory = (k) => { setCategory(k); setStep('video'); if (k === 'acting') setDice(rollDice()); };
  // choose one or more videos; several open Spark Clips to put them together into one Spark
  const gallery = async () => {
    const many = Platform.OS === 'web';
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], videoMaxDuration: 180, quality: 0.8, ...(many ? { allowsMultipleSelection: true, selectionLimit: 10 } : {}) });
    const list = r.canceled ? [] : r.assets || [];
    if (!list.length) return;
    const ok = list.filter((a) => !(a.duration && a.duration > 181000) && !(a.fileSize && a.fileSize > MAX_MB * 1024 * 1024));
    if (ok.length < list.length) notice(ok.length ? 'Some videos were left out' : 'Too long or too big', `Each video can be up to 3 minutes and ${MAX_MB} MB.`);
    if (!ok.length) return;
    const fresh = ok.map((a) => ({ id: newClipId(), uri: a.uri, type: a.mimeType || 'video/mp4', start: 0, end: a.duration ? Math.min(a.duration / 1000, MAX_SPARK) : null }));
    addClips(fresh);
  };
  // phone app: record with the phone's own camera (front / back, up to 60 s), then on to the editor
  const recordWithCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { notice('Camera', 'Allow the camera for Soulink in your phone settings to record a Spark.'); return; }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: 60, quality: 0.8, cameraType: ImagePicker.CameraType.front });
    const a = r.canceled ? null : r.assets?.[0];
    if (!a) return;
    addClips([{ id: newClipId(), uri: a.uri, type: a.mimeType || 'video/mp4', start: 0, end: a.duration ? Math.min(a.duration / 1000, MAX_SPARK) : null }], true);
  };
  // a new clip (from the phone or recorded in Soulink): one video goes straight to Spark Studio, more open Spark Clips
  const addClips = (fresh, oneTake = false) => {
    if (step === 'clips' || step === 'edit' || clips.length + fresh.length > 1) {
      setClips((c) => [...(step === 'video' ? [] : c), ...fresh]); setStep('clips'); return;
    }
    const a = fresh[0];
    setClips([a]); setVideo({ uri: a.uri, type: a.type, oneTake }); setEdit(emptyEdit()); setStep('edit');
  };
  // Spark Clips → Next: one clip goes on as it is (its trim kept), several are joined into one video first
  const clipsDone = async () => {
    if (clips.length === 1) {
      const c = clips[0];
      setVideo({ uri: c.uri, type: c.type, oneTake: !!c.oneTake }); setEdit({ ...emptyEdit(), trim: c.end != null ? [c.start, c.end] : null }); setStep('edit'); return;
    }
    setJoining(0);
    try {
      const j = await joinClips(clips.map((c) => ({ uri: c.uri, start: c.start || 0, end: c.end })), { transition, onProgress: setJoining });
      if (j.size > MAX_MB * 1024 * 1024) { notice('Too big', `The joined Spark is over ${MAX_MB} MB. Trim it a little shorter and try again.`); return; }
      setVideo({ uri: j.uri, type: j.type, oneTake: false });
      setEdit((e) => ({ ...e, trim: null, cover: 0 })); // text, music and filters stay; the length is new
      setStep('edit');
    } catch (e) { notice('Couldn’t join the clips', e.message); } finally { setJoining(null); }
  };
  // from Spark Studio back to the clips (the video you were editing becomes the first clip if it was a single one)
  const openClips = () => {
    if (!clips.length && video) setClips([{ id: newClipId(), uri: video.uri, type: video.type, start: edit.trim?.[0] ?? 0, end: edit.trim?.[1] ?? null, oneTake: video.oneTake }]);
    setStep('clips');
  };
  const [musicOpen, setMusicOpen] = useState(false);
  const addMusic = () => setMusicOpen(true); // JioSaavn / Deezer / free music / a song from the phone
  const castingCue = casting ? `🎭 ${casting.title}: ${casting.role}${casting.script ? `\n“${casting.script}”` : ''}` : null;
  const stageCue = stage ? `🎤 Open Mic: ${stage.title}` : null;
  const micCue = micTopic ? `🎤 Open Mic · ${micTopicOf(micTopic).label}` : null;
  const cue = castingCue || stageCue || micCue || (category === 'acting' ? (mode === 'dice' && dice ? `🎲 ${dice.emotion} · ${dice.situation} · ${dice.character}` : mode === 'script' ? `📜 ${script.title}\n“${script.lines}”` : null)
    : category === 'fitness' && fit.useChallenge ? `💪 ${fitChallengeOfWeek()}` : null);

  const details = () => ({ ...baseDetails(), ...(cleanEdit(edit, clipLen) ? { edit: cleanEdit(edit, clipLen) } : {}) });
  const baseDetails = () => {
    if (category === 'openmic') return {};
    if (category === 'travel') return { sound: music ? 'music' : sound };
    if (category === 'cooking') {
      const lines = (t) => t.split('\n').map((x) => x.trim()).filter(Boolean);
      return { ...(cook.dish.trim() ? { dish: cook.dish.trim() } : {}), ...(Number(cook.minutes) ? { minutes: Math.round(Number(cook.minutes)) } : {}), ...(cook.diet ? { diet: cook.diet } : {}),
        ingredients: lines(cook.ingredients).slice(0, 25), steps: lines(cook.steps).slice(0, 15) };
    }
    if (category === 'acting') return { ...(mode ? { mode } : {}), ...(mode === 'dice' && dice ? { prompt: { emotion: dice.emotion, situation: dice.situation, character: dice.character } } : {}), ...(mode === 'script' ? { scriptTitle: script.title } : {}), ...(scene.trim() ? { scene: scene.trim() } : {}) };
    if (category === 'fitness') {
      const moves = fit.moves.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 20);
      return { ...(fit.type ? { type: fit.type } : {}), ...(fit.level ? { level: fit.level } : {}), ...(Number(fit.minutes) ? { minutes: Math.round(Number(fit.minutes)) } : {}),
        ...(moves.length ? { moves } : {}), ...(fit.useChallenge ? { challenge: fitChallengeOfWeek() } : {}) };
    }
    const src = news.source.trim();
    return { ...(news.headline.trim() ? { headline: news.headline.trim() } : {}), ...(news.topic ? { topic: news.topic } : {}),
      ...(src ? { source: /^https?:\/\//i.test(src) ? src : `https://${src}` } : {}) };
  };
  const post = async () => {
    setBusy(true);
    try {
      await postSpark({ videoUri: video.uri, videoType: video.type, music, voice, category, caption, place: place.trim(), details: details(), oneTake: video.oneTake, musicTitle: music?.title || music?.name?.replace(/\.[a-z0-9]{2,4}$/i, ''),
        castingId: casting?.id, stage: forStage, mic: micTopic });
      if (casting) router.replace(`/spark/casting/${casting.id}`); else if (forStage || micTopic) router.replace('/spark/stage'); else router.replace('/sparks');
    } catch (e) { notice('Not posted', e.message); } finally { setBusy(false); }
  };
  const back = () => {
    if (step === 'category' || (step === 'video' && (casting || micTopic))) return router.back();
    if (step === 'video') return setStep('category');
    if (step === 'clips' && video) return setStep('edit'); // came here from Spark Studio: back to it
    if (step === 'clips' || (step === 'edit' && clips.length <= 1)) { setStep('video'); setVideo(null); setClips([]); setMusic(null); setVoice(null); return undefined; }
    if (step === 'edit') return setStep('clips'); // several clips: back to putting them together
    return setStep('edit');
  };

  // Spark Clips takes the whole screen
  if (step === 'clips') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#07060c' }}>
        <SparkClips clips={clips} onChange={setClips} transition={transition} onTransition={setTransition} cue={cue}
          onAdd={gallery} onRecord={Platform.OS === 'web' ? () => setRecording(true) : null} onBack={back} onNext={clipsDone}
          joining={joining != null} progress={joining || 0} />
        <SparkRecorder visible={recording} cue={cue} onClose={() => setRecording(false)}
          onDone={(v) => { setRecording(false); setClips((c) => [...c, { id: newClipId(), uri: v.uri, type: v.type, start: 0, end: v.seconds ? Math.min(v.seconds, MAX_SPARK) : null, oneTake: v.oneTake }]); }} />
      </SafeAreaView>
    );
  }

  // Spark Studio takes the whole screen
  if (step === 'edit' && video) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#07060c' }}>
        <SparkStudio video={video} edit={edit} onChange={setEdit} music={music} onMusic={setMusic} voice={voice} onVoice={setVoice} cue={cue} onClips={Platform.OS === 'web' ? openClips : null}
          onBack={back} onNext={({ duration }) => { setClipLen(duration || 0); setStep('details'); }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg }}>
        <Pressable onPress={back} hitSlop={12} accessibilityLabel="Back"><Ionicons name={step === 'category' ? 'close' : 'arrow-back'} size={26} color={colors.text} /></Pressable>
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 17, color: colors.text }}>{casting ? 'Audition' : forStage || micTopic ? 'Open Mic' : cat ? `${cat.label} Spark` : 'New Spark'}</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {step === 'category' ? (
            <>
              {stage ? (
                <View style={{ padding: space.lg, borderRadius: 20, overflow: 'hidden', marginBottom: space.lg }}>
                  <LinearGradient colors={['rgba(124,92,252,0.35)', 'rgba(255,107,157,0.25)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                  <Text style={{ fontFamily: fonts.mono, color: colors.gold, fontSize: 11, letterSpacing: 1 }}>THIS WEEK'S OPEN MIC</Text>
                  <Text style={{ fontFamily: fonts.displayBold, color: colors.text, fontSize: 20, marginTop: 4 }}>{stage.title}</Text>
                  <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 13, marginTop: 4 }}>{stage.line}. Pick what kind of act it is.</Text>
                </View>
              ) : null}
              <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 14, marginBottom: space.lg, textAlign: 'center' }}>What are you sharing today? Each category has its own tools.</Text>
              {CATEGORIES.map((c) => <BigOption key={c.key} badge={<SparkCatBadge cat={c} size={50} />} title={c.label} text={c.line} colors={c.colors} onPress={() => pickCategory(c.key)} />)}
            </>
          ) : null}

          {step === 'video' ? (
            <>
              {casting ? (
                <View style={{ padding: space.lg, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(176,143,255,0.4)', backgroundColor: colors.glass, marginBottom: space.md }}>
                  <Text style={{ fontFamily: fonts.mono, color: colors.aura, fontSize: 11, letterSpacing: 1 }}>AUDITION · CASTING BOARD</Text>
                  <Text style={{ fontFamily: fonts.displayBold, color: colors.text, fontSize: 19, marginTop: 4 }}>{casting.title}</Text>
                  <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 }}>{casting.role}</Text>
                  {casting.script ? <Text style={{ fontFamily: fonts.body, color: colors.text, fontSize: 15, lineHeight: 22, marginTop: 8 }}>“{casting.script}”</Text> : null}
                  <Text style={{ fontFamily: fonts.body, color: colors.dim, fontSize: 12, marginTop: 8 }}>The lines show on screen while you record.</Text>
                </View>
              ) : null}
              {category === 'acting' && !casting ? (
                <>
                  <Label>Want a ready-made challenge? (optional)</Label>
                  <Pills value={mode} onPick={(m) => setMode(m)} options={[['dice', '🎲 Improv Dice'], ['script', '📜 Script of the week'], ['scene', '🎬 Movie scene'], ['dub', '🎙️ Dub']]} />
                  {!mode ? (
                    <View style={{ marginTop: space.md, gap: 6 }}>
                      {[['🎲 Improv Dice', 'Soulink gives you a random feeling, place and character to act out'], ['📜 Script of the week', 'everyone performs the same short lines this week'], ['🎬 Movie scene', 'recreate a scene or dialogue your way'], ['🎙️ Dub', 'act to a dialogue or song you add']].map(([k, t]) => (
                        <Text key={k} style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 13, lineHeight: 19 }}><Text style={{ fontFamily: fonts.semibold, color: colors.text }}>{k}</Text>: {t}</Text>
                      ))}
                      <Text style={{ fontFamily: fonts.semibold, color: colors.mint, fontSize: 13, marginTop: 4 }}>Or skip this and just record your own act.</Text>
                    </View>
                  ) : null}
                  {mode === 'dice' && dice ? (
                    <View style={{ marginTop: space.md, padding: space.lg, borderRadius: 20, overflow: 'hidden' }}>
                      <LinearGradient colors={['rgba(124,92,252,0.35)', 'rgba(255,107,157,0.25)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                      <Text style={{ fontFamily: fonts.mono, color: colors.gold, fontSize: 11, letterSpacing: 1, textAlign: 'center' }}>🎲 IMPROV DICE</Text>
                      <Text style={{ fontFamily: fonts.body, color: colors.text, fontSize: 13.5, lineHeight: 19, textAlign: 'center', marginTop: 6 }}>
                        An acting game: Soulink rolls a random feeling, a place and a character. Act all three together in one short take.
                      </Text>
                      {[['Feeling', dice.emotion], ['Where', dice.situation], ['Play it', dice.character]].map(([k, v]) => (
                        <View key={k} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, padding: 10, borderRadius: 14, backgroundColor: 'rgba(14,12,22,0.55)' }}>
                          <Text style={{ width: 70, fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.6, color: colors.aura, textTransform: 'uppercase' }}>{k}</Text>
                          <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15.5, color: colors.text }}>{v}</Text>
                        </View>
                      ))}
                      <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12.5, textAlign: 'center', marginTop: 10 }}>
                        Example: “Angry, in a job interview, as a grandmother”. Take 10 seconds to think, then act it.
                      </Text>
                      <Pressable onPress={() => setDice(rollDice())} style={{ alignSelf: 'center', marginTop: space.md, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 38, borderRadius: 19, borderWidth: 1.5, borderColor: colors.gold }}>
                        <Ionicons name="dice" size={20} color={colors.gold} /><Text style={{ marginLeft: 6, fontFamily: fonts.bold, color: colors.gold }}>Roll the dice again</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  {mode === 'script' ? (
                    <View style={{ marginTop: space.md, padding: space.lg, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.glass }}>
                      <Text style={{ fontFamily: fonts.mono, color: colors.aura, fontSize: 11, letterSpacing: 1 }}>SCRIPT OF THE WEEK</Text>
                      <Text style={{ fontFamily: fonts.displayBold, color: colors.text, fontSize: 18, marginTop: 4 }}>{script.title}</Text>
                      <Text style={{ fontFamily: fonts.body, color: colors.text, fontSize: 15, lineHeight: 22, marginTop: 8 }}>“{script.lines}”</Text>
                      <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12, marginTop: 8 }}>Everyone performs the same lines this week. Make them yours.</Text>
                    </View>
                  ) : null}
                  {mode === 'scene' ? <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 13, marginTop: space.md }}>Recreate a movie scene or dialogue in your own way. You can add the movie sound or song from your phone in the next step.</Text> : null}
                  {mode === 'dub' ? <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 13, marginTop: space.md }}>Act to a dialogue or song. Record your acting here, then add the audio from your phone in the next step (your video plays muted under it).</Text> : null}
                </>
              ) : null}
              {category === 'fitness' ? (
                <Pressable onPress={() => setFit((f) => ({ ...f, useChallenge: !f.useChallenge }))} style={{ marginBottom: space.md, padding: space.lg, borderRadius: 20, borderWidth: 1.5, borderColor: fit.useChallenge ? colors.mint : colors.border, backgroundColor: fit.useChallenge ? 'rgba(66,232,192,0.12)' : colors.glass }}>
                  <Text style={{ fontFamily: fonts.mono, color: colors.mint, fontSize: 11, letterSpacing: 1 }}>CHALLENGE OF THE WEEK</Text>
                  <Text style={{ fontFamily: fonts.displayBold, color: colors.text, fontSize: 18, marginTop: 4 }}>{fitChallengeOfWeek()}</Text>
                  <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12, marginTop: 6 }}>{fit.useChallenge ? '✅ You are taking this week’s challenge' : 'Tap to take this week’s challenge (optional), or post any workout'}</Text>
                </Pressable>
              ) : null}
              {category === 'news' ? (
                <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 13, marginBottom: space.md, lineHeight: 19 }}>Share something that happened: in your area, in India or the world. Record yourself telling it, or a clip you shot. Add the headline and a source link in the next step.</Text>
              ) : null}
              <Label>Your video · up to 60 seconds</Label>
              {Platform.OS === 'web' ? <BigOption icon="videocam" title="Record in Soulink" text="Record in clips with a timer · one clip gets the ✅ One take badge" colors={['#ff6b9d', '#ff9a5a']} onPress={() => setRecording(true)} />
                : <BigOption icon="videocam" title="Record a video" text="Opens your camera · up to 60 seconds" colors={['#ff6b9d', '#ff9a5a']} onPress={recordWithCamera} />}
              <BigOption icon="folder-open" title="Upload from your phone" text={Platform.OS === 'web' ? 'Pick one video, or several to join into one Spark (each up to 3 min)' : `Up to 3 min and ${MAX_MB} MB · trim it to 60 s in the editor`} colors={['#7c5cfc', '#b08fff']} onPress={gallery} />
              <Text style={{ fontFamily: fonts.body, color: colors.dim, fontSize: 12, textAlign: 'center', marginTop: 4 }}>Next: edit it in Spark Studio (trim, speed, filters, adjust, crop, text, stickers, music, voiceover, fade, cover).</Text>
            </>
          ) : null}

          {step === 'details' && video ? (
            <>
              <SparkVideo uri={video.uri} musicUri={music?.uri} voiceUri={voice?.uri} local height={420} edit={cleanEdit(edit, clipLen)} />
              <Pressable onPress={() => setStep('edit')} style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingHorizontal: 14, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.border }}>
                <Ionicons name="color-wand-outline" size={16} color={colors.aura} /><Text style={{ marginLeft: 6, fontFamily: fonts.semibold, color: colors.text, fontSize: 13 }}>Back to editing</Text>
              </Pressable>
              {video.oneTake ? <Text style={{ fontFamily: fonts.semibold, color: colors.mint, fontSize: 13, marginTop: 6 }}>✅ One take: recorded in Soulink</Text> : null}

              {category === 'travel' ? (
                <>
                  <Label>📍 Where is this? (optional)</Label>
                  <CityField value={place} onChange={setPlace} autoLocate={false} />
                  <Label>Sound</Label>
                  <Pills value={music ? 'music' : sound} onPick={(k) => { if (k === 'music') addMusic(); else { setMusic(null); setSound(k || 'place'); } }}
                    options={[['place', '🌊 Real sound of the place'], ['music', music ? `🎵 ${music.title || music.name}` : '🎵 Add music'], ['none', '🔇 No sound']]} />
                </>
              ) : null}

              {category === 'cooking' ? (
                <>
                  <Label>🍳 Recipe card (optional)</Label>
                  <Field value={cook.dish} onChangeText={(v) => setCook({ ...cook, dish: v })} placeholder="Dish name (e.g. Hyderabadi biryani)" maxLength={80} />
                  <Field value={cook.minutes} onChangeText={(v) => setCook({ ...cook, minutes: v.replace(/[^0-9]/g, '') })} placeholder="Total time in minutes" keyboardType="number-pad" maxLength={3} style={{ marginTop: space.sm }} />
                  <View style={{ marginTop: space.sm }}><Pills value={cook.diet} onPick={(k) => setCook({ ...cook, diet: k })} options={DIETS} /></View>
                  <Field value={cook.ingredients} onChangeText={(v) => setCook({ ...cook, ingredients: v })} placeholder={'Ingredients, one per line\n2 cups basmati rice\n500 g chicken'} multiline style={{ marginTop: space.sm, minHeight: 100 }} />
                  <Field value={cook.steps} onChangeText={(v) => setCook({ ...cook, steps: v })} placeholder={'Steps, one per line\nMarinate the chicken\nLayer and cook on dum'} multiline style={{ marginTop: space.sm, minHeight: 100 }} />
                </>
              ) : null}

              {category === 'acting' ? (
                <>
                  {mode === 'scene' || mode === 'dub' ? (
                    <>
                      <Label>{mode === 'dub' ? '🎙️ What are you dubbing?' : '🎬 Which scene?'}</Label>
                      <Field value={scene} onChangeText={setScene} placeholder="e.g. the interval scene from your favourite film" maxLength={120} />
                    </>
                  ) : null}
                  <Label>{mode === 'dub' ? 'The dialogue or song you act to (optional)' : 'Movie sound or song (optional)'}</Label>
                  <Pills value={music ? 'yes' : null} onPick={(k) => (k ? addMusic() : setMusic(null))} options={[['yes', music ? `🎵 ${music.title || music.name}` : '🎵 Add audio or a song']]} />
                </>
              ) : null}

              {category === 'fitness' ? (
                <>
                  <Label>💪 Workout card (optional)</Label>
                  <Pills value={fit.type} onPick={(k) => setFit({ ...fit, type: k })} options={FIT_TYPES} />
                  <View style={{ marginTop: space.sm }}><Pills value={fit.level} onPick={(k) => setFit({ ...fit, level: k })} options={FIT_LEVELS} /></View>
                  <Field value={fit.minutes} onChangeText={(v) => setFit({ ...fit, minutes: v.replace(/[^0-9]/g, '') })} placeholder="How many minutes?" keyboardType="number-pad" maxLength={3} style={{ marginTop: space.sm }} />
                  <Field value={fit.moves} onChangeText={(v) => setFit({ ...fit, moves: v })} placeholder={'Moves, one per line (optional)\nSquats × 15\nPlank 30 s'} multiline style={{ marginTop: space.sm, minHeight: 100 }} />
                  <Label>Workout music (optional)</Label>
                  <Pills value={music ? 'yes' : null} onPick={(k) => (k ? addMusic() : setMusic(null))} options={[['yes', music ? `🎵 ${music.title || music.name}` : '🎵 Add music']]} />
                </>
              ) : null}

              {category === 'news' ? (
                <>
                  <Label>📰 Headline (optional)</Label>
                  <Field value={news.headline} onChangeText={(v) => setNews({ ...news, headline: v })} placeholder="What happened, in one line" maxLength={120} />
                  <Label>Topic (optional)</Label>
                  <Pills value={news.topic} onPick={(k) => setNews({ ...news, topic: k })} options={NEWS_TOPICS} />
                  <Label>📍 Where (optional)</Label>
                  <CityField value={place} onChange={setPlace} autoLocate={false} />
                  <Label>Source link (optional)</Label>
                  <Field value={news.source} onChangeText={(v) => setNews({ ...news, source: v })} placeholder="https://… where people can read more" autoCapitalize="none" keyboardType="url" maxLength={300} />
                  <Text style={{ fontFamily: fonts.body, color: colors.dim, fontSize: 12, marginTop: 6 }}>Only share what you know is true. A source helps people trust it.</Text>
                </>
              ) : null}

              <Label>Caption</Label>
              <Field value={caption} onChangeText={setCaption} placeholder="Say something about it…" multiline maxLength={1000} style={{ minHeight: 70 }} />
              {music ? <Text style={{ fontFamily: fonts.body, color: colors.dim, fontSize: 12, marginTop: 6 }}>The music mix (song start, music and original sound volume) is set in the editor. Only use music you're allowed to share.</Text> : null}

              <Pressable onPress={post} disabled={busy} style={{ marginTop: space.xl, height: 52, borderRadius: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                <LinearGradient colors={cat?.colors || gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: 16 }}>Post Spark 🎬</Text>}
              </Pressable>
              {busy ? <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 8 }}>Uploading your video… this can take a minute.</Text> : null}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <MusicPicker visible={musicOpen} onClose={() => setMusicOpen(false)} onPick={(m) => { setMusic(m); setEdit((e) => ({ ...e, musicStart: m.start || 0 })); }} clip={60} title="Music for your Spark" />
      <SparkRecorder visible={recording} cue={cue} onClose={() => setRecording(false)} onDone={(v) => { setRecording(false); addClips([{ id: newClipId(), uri: v.uri, type: v.type, start: 0, end: v.seconds ? Math.min(v.seconds, MAX_SPARK) : null, oneTake: v.oneTake }], v.oneTake); }} />
    </SafeAreaView>
  );
}
