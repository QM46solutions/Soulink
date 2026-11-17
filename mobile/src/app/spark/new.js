// Post a Spark 🎬: 1) pick a category  2) record in Soulink or choose videos and photos
// 3) edit in Soulink Studio (components/SoulStudio.js): clips and photos on a timeline, split, trim, speed, text,
//    stickers, music, voiceover, looks, crop, fade, cover, undo / redo, kept as a draft
// 4) the category's extras + caption.
// Also used for a Casting Board audition (?casting=<id>) and for this week's Open Mic (?stage=1).
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { notice } from '../../lib/confirm';
import { CATEGORIES, DIETS, FIT_LEVELS, FIT_TYPES, NEWS_TOPICS, builderOn, catOf, fitChallengeOfWeek, micTopicOf, postSpark, postStudioSpark, rollDice, scriptOfWeek } from '../../lib/sparks';
import SparkVideo from '../../components/SparkVideo';
import SparkCatBadge from '../../components/SparkCatBadge';
import SparkRecorder from '../../components/SparkRecorder';
import SoulStudio from '../../components/SoulStudio';
import { canJoin, joinClips } from '../../lib/joinClips';
import * as Studio from '../../lib/studio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../../lib/api';
import MusicPicker from '../../components/MusicPicker';
import CityField from '../../components/CityField';
import { colors, fonts, gradients, space } from '../../lib/theme';

const MAX_MB = 40;
const DRAFT_KEY = 'soulink.sparkDraft';
// a picked video's length in seconds: the phone picker gives milliseconds, the web picker gives seconds
// (dividing the web value by 1000 made an 8 s video 0.008 s long, so it never played in the editor)
const pickedSeconds = (a) => (a?.duration && isFinite(a.duration) && a.duration > 0 ? (Platform.OS === 'web' ? a.duration : a.duration / 1000) : null);
// a draft can be reopened only if its files are still on this phone (web blob: links end when the page closes)
const keepable = (pr) => pr?.clips?.length && pr.clips.every((c) => !String(c.uri).startsWith('blob:'));
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
  const [step, setStep] = useState(micTopic ? 'video' : 'category'); // category | video | studio | details
  const [proj, setProj] = useState(null);   // the Soulink Studio project (lib/studio.js)
  const [studioKey, setStudioKey] = useState(0);
  const [draft, setDraft] = useState(null); // a Spark you were editing before, on this phone
  const [joining, setJoining] = useState(null); // null, or how far joining the clips has got (0-1)
  const [edit, setEdit] = useState({});    // what the players apply (details.edit), made from the project
  const [build, setBuild] = useState(false); // posted through the Soulink video builder (several clips / photos / a Soul Look)
  const [uploading, setUploading] = useState(null);
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

  useEffect(() => { AsyncStorage.getItem(DRAFT_KEY).then((v) => { try { const d = JSON.parse(v || 'null'); if (d && keepable(d.project)) setDraft(d); } catch { /* none */ } }).catch(() => {}); }, []);
  const saveDraft = (project) => {
    if (!keepable(project)) return;
    AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ project, category, savedAt: Date.now() })).catch(() => {});
  };
  const clearDraft = () => { setDraft(null); AsyncStorage.removeItem(DRAFT_KEY).catch(() => {}); };
  useEffect(() => {
    if (castingId) api(`/sparks/casting/${castingId}`).then((r) => { setCasting(r.call); setCategory(r.call.category); if (r.call.category === 'acting') setMode('scene'); setStep('video'); }).catch((e) => notice('Casting', e.message));
    if (forStage) api('/sparks/stage').then((r) => setStage(r.theme)).catch(() => {});
  }, [castingId, forStage]);
  // nothing inside a category is required: the dice, script, scene and cards are all optional extras
  const pickCategory = (k) => { setCategory(k); setStep('video'); if (k === 'acting') setDice(rollDice()); };
  // videos and photos from the phone (several at once): returns studio clips
  const pickMedia = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos', 'images'], videoMaxDuration: 180, quality: 0.85, allowsMultipleSelection: true, selectionLimit: 10, orderedSelection: true });
    const list = r.canceled ? [] : r.assets || [];
    if (!list.length) return [];
    const ok = list.filter((a) => a.type === 'image' || (!(pickedSeconds(a) > 181) && !(a.fileSize && a.fileSize > MAX_MB * 1024 * 1024)));
    if (ok.length < list.length) notice(ok.length ? 'Some videos were left out' : 'Too long or too big', `Each video can be up to 3 minutes and ${MAX_MB} MB.`);
    return ok.map((a) => Studio.makeClip({ uri: a.uri, type: a.mimeType || (a.type === 'image' ? 'image/jpeg' : 'video/mp4'), kind: a.type === 'image' ? 'photo' : 'video', duration: pickedSeconds(a) }));
  };
  // open Soulink Studio with these clips (from the gallery, the camera or the Soulink recorder)
  const openStudio = (clips, oneTake = false) => {
    if (!clips.length) return;
    const pr = Studio.addClips(Studio.emptyProject(), clips.map((c) => ({ ...c, ...(oneTake ? { oneTake: true } : {}) })));
    setProj(pr); setStudioKey((k) => k + 1); setStep('studio');
  };
  const gallery = async () => openStudio(await pickMedia());
  // phone app: record with the phone's own camera (front / back, up to 60 s), then on to the editor
  const recordWithCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { notice('Camera', 'Allow the camera for Soulink in your phone settings to record a Spark.'); return; }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: 60, quality: 0.8, cameraType: ImagePicker.CameraType.front });
    const a = r.canceled ? null : r.assets?.[0];
    if (!a) return;
    openStudio([Studio.makeClip({ uri: a.uri, type: a.mimeType || 'video/mp4', duration: pickedSeconds(a) })], true);
  };
  // Studio → Next: one video goes as it is with its edits; several clips / photos are joined into one video first
  const studioNext = async (project) => {
    setProj(project); setMusic(project.music || null); setVoice(project.voice || null);
    const recipe = Studio.toRecipe(project);
    // the video builder puts it together on the server: several clips or photos, or a Soul Look / adjustments
    // (looks are baked into the video so they show on every phone). Text and stickers stay live on top.
    const look = (project.filter && project.filter !== 'none') || Object.values(project.adjust || {}).some(Boolean);
    if ((!Studio.isSingleVideo(project) || look) && (await builderOn())) {
      const len = Studio.totalLen(project);
      const L = Studio.toLegacyEdit({ ...project, clips: [{ id: 'built', kind: 'video', in: 0, out: len, src: len, speed: 1 }] }) || {};
      setEdit({ ...(L.texts ? { texts: L.texts } : {}), ...(L.stickers ? { stickers: L.stickers } : {}), ...(L.cover != null ? { cover: L.cover } : {}) });
      setBuild(true); setVideo(null); setStep('details'); return;
    }
    setBuild(false);
    if (Studio.isSingleVideo(project)) {
      const c = project.clips[0];
      setVideo({ uri: c.uri, type: c.type, oneTake: !!c.oneTake });
      setEdit({ ...(Studio.toLegacyEdit(project) || {}), studio: recipe });
      setStep('details'); return;
    }
    if (!canJoin()) {
      notice('Almost there', 'Sparks with several clips or photos are put together by the Soulink video builder, which is switched on next. For now you can post them from the Soulink website, or post one video from your phone. Your edit is saved as a draft.');
      return;
    }
    setJoining(0);
    try {
      const j = await joinClips(project.clips.map((c) => ({ uri: c.uri, start: c.in, end: c.out, kind: c.kind, speed: c.speed })), { transition: 'cut', onProgress: setJoining });
      if (j.size > MAX_MB * 1024 * 1024) { notice('Too big', `The finished Spark is over ${MAX_MB} MB. Make it a little shorter and try again.`); return; }
      setVideo({ uri: j.uri, type: j.type, oneTake: false });
      // the joined video already has the trims and speeds in it: the rest of the edit is timed on it directly
      const flat = { ...project, clips: [{ id: 'joined', kind: 'video', uri: j.uri, type: j.type, src: j.seconds, in: 0, out: j.seconds, speed: 1 }] };
      setEdit({ ...(Studio.toLegacyEdit(flat) || {}), studio: recipe });
      setStep('details');
    } catch (e) { notice('Couldn’t put the clips together', e.message); } finally { setJoining(null); }
  };
  const [musicOpen, setMusicOpen] = useState(false);
  const addMusic = () => setMusicOpen(true); // JioSaavn / Deezer / free music / a song from the phone
  const castingCue = casting ? `🎭 ${casting.title}: ${casting.role}${casting.script ? `\n“${casting.script}”` : ''}` : null;
  const stageCue = stage ? `🎤 Open Mic: ${stage.title}` : null;
  const micCue = micTopic ? `🎤 Open Mic · ${micTopicOf(micTopic).label}` : null;
  const cue = castingCue || stageCue || micCue || (category === 'acting' ? (mode === 'dice' && dice ? `🎲 ${dice.emotion} · ${dice.situation} · ${dice.character}` : mode === 'script' ? `📜 ${script.title}\n“${script.lines}”` : null)
    : category === 'fitness' && fit.useChallenge ? `💪 ${fitChallengeOfWeek()}` : null);

  const details = () => ({ ...baseDetails(), ...(Object.keys(edit || {}).length ? { edit } : {}) });
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
    if (build) {
      try {
        const r = await postStudioSpark({ project: proj, recipe: Studio.toRecipe(proj), edit, category, caption, place: place.trim(), details: baseDetails(), castingId: casting?.id, stage: forStage, mic: micTopic, onProgress: setUploading });
        clearDraft();
        notice('Almost live 🎬', r.message || "We're putting your Spark together. We'll tell you when it's ready.");
        if (casting) router.replace(`/spark/casting/${casting.id}`); else if (forStage || micTopic) router.replace('/spark/stage'); else router.replace('/sparks');
      } catch (e) { notice('Not posted', e.message); } finally { setBusy(false); setUploading(null); }
      return;
    }
    try {
      await postSpark({ videoUri: video.uri, videoType: video.type, music, voice, category, caption, place: place.trim(), details: details(), oneTake: video.oneTake, musicTitle: music?.title || music?.name?.replace(/\.[a-z0-9]{2,4}$/i, ''),
        castingId: casting?.id, stage: forStage, mic: micTopic });
      clearDraft();
      if (casting) router.replace(`/spark/casting/${casting.id}`); else if (forStage || micTopic) router.replace('/spark/stage'); else router.replace('/sparks');
    } catch (e) { notice('Not posted', e.message); } finally { setBusy(false); }
  };
  const back = () => {
    if (step === 'category' || (step === 'video' && (casting || micTopic))) return router.back();
    if (step === 'video') return setStep('category');
    if (step === 'studio') { setStep('video'); setVideo(null); setMusic(null); setVoice(null); return undefined; } // the draft stays
    return setStep('studio');
  };

  // Soulink Studio takes the whole screen
  if (step === 'studio' && proj) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#07060c' }}>
        <SoulStudio key={studioKey} initial={proj} cue={cue} onBack={(pr) => { saveDraft(pr); back(); }} onNext={studioNext} onDraft={saveDraft}
          onAddMedia={pickMedia} />
        {joining != null ? (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(7,6,12,0.85)', alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
            <ActivityIndicator color={colors.spark} size="large" />
            <Text style={{ fontFamily: fonts.displayBold, color: colors.text, fontSize: 18, marginTop: space.md }}>{`Putting your Spark together · ${Math.round(joining * 100)}%`}</Text>
            <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 13, marginTop: 6, textAlign: 'center' }}>Keep this tab open. It takes about as long as the Spark itself.</Text>
          </View>
        ) : null}
        <SparkRecorder visible={recording} cue={cue} onClose={() => setRecording(false)} onDone={(v) => { setRecording(false); setProj((pr) => Studio.addClips(pr, [{ ...Studio.makeClip({ uri: v.uri, type: v.type, duration: v.seconds }), oneTake: v.oneTake }])); setStudioKey((k) => k + 1); }} />
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
              {draft ? (
                <BigOption icon="film" title="Continue your draft" text={`${draft.project.clips.length} ${draft.project.clips.length === 1 ? 'clip' : 'clips'} · ${Math.round(Studio.totalLen(draft.project))} s · saved ${new Date(draft.savedAt).toLocaleDateString()}`}
                  colors={['#42e8c0', '#7c5cfc']} onPress={() => { setProj(draft.project); setStudioKey((k) => k + 1); setStep('studio'); }} />
              ) : null}
              <Label>Your video · up to 60 seconds</Label>
              {Platform.OS === 'web' ? <BigOption icon="videocam" title="Record in Soulink" text="Record in clips with a timer · one clip gets the ✅ One take badge" colors={['#ff6b9d', '#ff9a5a']} onPress={() => setRecording(true)} />
                : <BigOption icon="videocam" title="Record a video" text="Opens your camera · up to 60 seconds" colors={['#ff6b9d', '#ff9a5a']} onPress={recordWithCamera} />}
              <BigOption icon="folder-open" title="Videos and photos" text={`Pick one or several · each video up to 3 min and ${MAX_MB} MB`} colors={['#7c5cfc', '#b08fff']} onPress={gallery} />
              <Text style={{ fontFamily: fonts.body, color: colors.dim, fontSize: 12, textAlign: 'center', marginTop: 4 }}>Next: Soulink Studio. Put clips and photos on a timeline, split, trim, speed, text, stickers, music, voiceover, looks and more.</Text>
            </>
          ) : null}

          {step === 'details' && (video || (build && proj)) ? (
            <>
              {build ? (
                <View style={{ padding: space.lg, borderRadius: 20, overflow: 'hidden', alignItems: 'center' }}>
                  <LinearGradient colors={['rgba(124,92,252,0.32)', 'rgba(255,107,157,0.22)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                  <Ionicons name="film" size={34} color={colors.text} />
                  <Text style={{ fontFamily: fonts.displayBold, color: colors.text, fontSize: 17, marginTop: 8 }}>{`${proj.clips.length} ${proj.clips.length === 1 ? 'clip' : 'clips'} · ${Math.round(Studio.totalLen(proj))} s${proj.filter && proj.filter !== 'none' ? ' · Soul Look' : ''}`}</Text>
                  <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 }}>When you post, Soulink puts your clips, look and sound together into one Spark. It goes live in a minute or two and we'll tell you.</Text>
                </View>
              ) : <SparkVideo uri={video.uri} musicUri={music?.uri} voiceUri={voice?.uri} local height={420} edit={edit} />}
              <Pressable onPress={() => setStep('studio')} style={{ alignSelf: 'center', flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingHorizontal: 14, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.border }}>
                <Ionicons name="color-wand-outline" size={16} color={colors.aura} /><Text style={{ marginLeft: 6, fontFamily: fonts.semibold, color: colors.text, fontSize: 13 }}>Back to editing</Text>
              </Pressable>
              {video?.oneTake ? <Text style={{ fontFamily: fonts.semibold, color: colors.mint, fontSize: 13, marginTop: 6 }}>✅ One take: recorded in Soulink</Text> : null}

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
                {busy ? (uploading != null ? <Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: 15 }}>{`Uploading · ${Math.round(uploading * 100)}%`}</Text> : <ActivityIndicator color="#fff" />) : <Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: 16 }}>Post Spark 🎬</Text>}
              </Pressable>
              {busy ? <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 8 }}>Uploading your video… this can take a minute.</Text> : null}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <MusicPicker visible={musicOpen} onClose={() => setMusicOpen(false)} onPick={(m) => { setMusic(m); setEdit((e) => ({ ...e, musicStart: m.start || 0 })); setProj((pr) => (pr ? { ...pr, music: { ...m, start: m.start || 0, volume: 1 } } : pr)); }} clip={60} title="Music for your Spark" />
      <SparkRecorder visible={recording} cue={cue} onClose={() => setRecording(false)} onDone={(v) => { setRecording(false); openStudio([Studio.makeClip({ uri: v.uri, type: v.type, duration: v.seconds })], v.oneTake); }} />
    </SafeAreaView>
  );
}
