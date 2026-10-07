// Post a Spark 🎬: 1) pick a category  2) record in Soulink (one take) or choose a video  3) the category's extras + caption.
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { notice } from '../../lib/confirm';
import { CATEGORIES, DIETS, FIT_LEVELS, FIT_TYPES, NEWS_TOPICS, catOf, fitChallengeOfWeek, postSpark, rollDice, scriptOfWeek } from '../../lib/sparks';
import SparkVideo from '../../components/SparkVideo';
import SparkCatBadge from '../../components/SparkCatBadge';
import SparkRecorder from '../../components/SparkRecorder';
import { pickAudio } from '../../components/PostMusic';
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
  const [step, setStep] = useState('category'); // category | video | details
  const [category, setCategory] = useState(null);
  const [mode, setMode] = useState(null); // acting: dice | script | scene | dub
  const [dice, setDice] = useState(null);
  const [video, setVideo] = useState(null); // { uri, type, oneTake }
  const [recording, setRecording] = useState(false);
  const [music, setMusic] = useState(null); // { uri, name, type }
  const [caption, setCaption] = useState('');
  const [place, setPlace] = useState('');
  const [sound, setSound] = useState('place');
  const [cook, setCook] = useState({ dish: '', minutes: '', diet: null, ingredients: '', steps: '' });
  const [scene, setScene] = useState('');
  const [fit, setFit] = useState({ type: null, level: null, minutes: '', moves: '', useChallenge: false });
  const [news, setNews] = useState({ headline: '', topic: null, source: '' });
  const [busy, setBusy] = useState(false);
  const cat = category ? catOf(category) : null;
  const script = scriptOfWeek();

  const pickCategory = (k) => { setCategory(k); setStep('video'); if (k === 'acting' && !mode) setMode('dice'); if (k === 'acting') setDice(rollDice()); };
  const gallery = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], videoMaxDuration: 60, quality: 0.8 });
    const a = r.canceled ? null : r.assets?.[0];
    if (!a) return;
    if (a.duration && a.duration > 61000) { notice('Too long', 'Sparks are up to 60 seconds. Trim the video and try again.'); return; }
    if (a.fileSize && a.fileSize > MAX_MB * 1024 * 1024) { notice('Too big', `Videos up to ${MAX_MB} MB. Tip: record in Soulink for a smaller file.`); return; }
    setVideo({ uri: a.uri, type: a.mimeType || 'video/mp4', oneTake: false }); setStep('details');
  };
  const addMusic = async () => { const f = await pickAudio(); if (f) setMusic(f); };
  const cue = category === 'acting' ? (mode === 'dice' && dice ? `🎲 ${dice.emotion} · ${dice.situation} · ${dice.character}` : mode === 'script' ? `📜 ${script.title}\n“${script.lines}”` : null)
    : category === 'fitness' && fit.useChallenge ? `💪 ${fitChallengeOfWeek()}` : null;

  const details = () => {
    if (category === 'travel') return { sound: music ? 'music' : sound };
    if (category === 'cooking') {
      const lines = (t) => t.split('\n').map((x) => x.trim()).filter(Boolean);
      return { ...(cook.dish.trim() ? { dish: cook.dish.trim() } : {}), ...(Number(cook.minutes) ? { minutes: Math.round(Number(cook.minutes)) } : {}), ...(cook.diet ? { diet: cook.diet } : {}),
        ingredients: lines(cook.ingredients).slice(0, 25), steps: lines(cook.steps).slice(0, 15) };
    }
    if (category === 'acting') return { mode, ...(mode === 'dice' && dice ? { prompt: { emotion: dice.emotion, situation: dice.situation, character: dice.character } } : {}), ...(mode === 'script' ? { scriptTitle: script.title } : {}), ...(scene.trim() ? { scene: scene.trim() } : {}) };
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
    if (category === 'travel' && !place.trim()) { notice('Add the place', 'Travel Sparks show where you are. Type the place.'); return; }
    if (category === 'news' && !news.headline.trim()) { notice('Add a headline', 'Say in one line what happened.'); return; }
    if (category === 'acting' && mode === 'dub' && !music) { notice('Add the audio', 'For a dub, add the dialogue or song you are acting to.'); return; }
    setBusy(true);
    try {
      await postSpark({ videoUri: video.uri, videoType: video.type, music, category, caption, place: place.trim(), details: details(), oneTake: video.oneTake, musicTitle: music?.name?.replace(/\.[a-z0-9]{2,4}$/i, '') });
      router.replace('/sparks');
    } catch (e) { notice('Not posted', e.message); } finally { setBusy(false); }
  };
  const back = () => (step === 'category' ? router.back() : step === 'video' ? setStep('category') : (setStep('video'), setVideo(null)));

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg }}>
        <Pressable onPress={back} hitSlop={12} accessibilityLabel="Back"><Ionicons name={step === 'category' ? 'close' : 'arrow-back'} size={26} color={colors.text} /></Pressable>
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 17, color: colors.text }}>{cat ? `${cat.label} Spark` : 'New Spark'}</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {step === 'category' ? (
            <>
              <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 14, marginBottom: space.lg, textAlign: 'center' }}>What are you sharing today? Each category has its own tools.</Text>
              {CATEGORIES.map((c) => <BigOption key={c.key} badge={<SparkCatBadge cat={c} size={50} />} title={c.label} text={c.line} colors={c.colors} onPress={() => pickCategory(c.key)} />)}
            </>
          ) : null}

          {step === 'video' ? (
            <>
              {category === 'acting' ? (
                <>
                  <Label>How do you want to act?</Label>
                  <Pills value={mode} onPick={(m) => setMode(m || 'dice')} options={[['dice', '🎲 Improv Dice'], ['script', '📜 Script of the week'], ['scene', '🎬 Movie scene'], ['dub', '🎙️ Dub']]} />
                  {mode === 'dice' && dice ? (
                    <View style={{ marginTop: space.md, padding: space.lg, borderRadius: 20, overflow: 'hidden' }}>
                      <LinearGradient colors={['rgba(124,92,252,0.35)', 'rgba(255,107,157,0.25)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                      <Text style={{ fontFamily: fonts.displayBold, color: colors.text, fontSize: 20, textAlign: 'center' }}>{dice.emotion}</Text>
                      <Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 15, textAlign: 'center', marginTop: 4 }}>{dice.situation}</Text>
                      <Text style={{ fontFamily: fonts.semibold, color: colors.aura, fontSize: 15, textAlign: 'center', marginTop: 2 }}>{dice.character}</Text>
                      <Pressable onPress={() => setDice(rollDice())} style={{ alignSelf: 'center', marginTop: space.md, flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="dice" size={20} color={colors.gold} /><Text style={{ marginLeft: 6, fontFamily: fonts.semibold, color: colors.gold }}>Roll again</Text>
                      </Pressable>
                      <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 8 }}>Take 10 seconds to think, then act it in one take.</Text>
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
              {Platform.OS === 'web' ? <BigOption icon="videocam" title="Record in Soulink" text="One take, no edits: gets the ✅ One take badge" colors={['#ff6b9d', '#ff9a5a']} onPress={() => setRecording(true)} /> : null}
              <BigOption icon="folder-open" title="Choose from your phone" text={`A video up to 60 s and ${MAX_MB} MB`} colors={['#7c5cfc', '#b08fff']} onPress={gallery} />
            </>
          ) : null}

          {step === 'details' && video ? (
            <>
              <SparkVideo uri={video.uri} musicUri={music?.uri} local height={420} />
              {video.oneTake ? <Text style={{ fontFamily: fonts.semibold, color: colors.mint, fontSize: 13, marginTop: 6 }}>✅ One take: recorded in Soulink</Text> : null}

              {category === 'travel' ? (
                <>
                  <Label>📍 Where is this?</Label>
                  <CityField value={place} onChange={setPlace} autoLocate={false} />
                  <Label>Sound</Label>
                  <Pills value={music ? 'music' : sound} onPick={(k) => { if (k === 'music') addMusic(); else { setMusic(null); setSound(k || 'place'); } }}
                    options={[['place', '🌊 Real sound of the place'], ['music', '🎵 Add a song from my phone'], ['none', '🔇 No sound']]} />
                </>
              ) : null}

              {category === 'cooking' ? (
                <>
                  <Label>🍳 Recipe card</Label>
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
                  <Label>{mode === 'dub' ? 'The dialogue / song (required)' : 'Movie sound or song (optional)'}</Label>
                  <Pills value={music ? 'yes' : null} onPick={(k) => (k ? addMusic() : setMusic(null))} options={[['yes', music ? `🎵 ${music.name}` : '🎵 Add audio from my phone']]} />
                </>
              ) : null}

              {category === 'fitness' ? (
                <>
                  <Label>💪 Workout card</Label>
                  <Pills value={fit.type} onPick={(k) => setFit({ ...fit, type: k })} options={FIT_TYPES} />
                  <View style={{ marginTop: space.sm }}><Pills value={fit.level} onPick={(k) => setFit({ ...fit, level: k })} options={FIT_LEVELS} /></View>
                  <Field value={fit.minutes} onChangeText={(v) => setFit({ ...fit, minutes: v.replace(/[^0-9]/g, '') })} placeholder="How many minutes?" keyboardType="number-pad" maxLength={3} style={{ marginTop: space.sm }} />
                  <Field value={fit.moves} onChangeText={(v) => setFit({ ...fit, moves: v })} placeholder={'Moves, one per line (optional)\nSquats × 15\nPlank 30 s'} multiline style={{ marginTop: space.sm, minHeight: 100 }} />
                  <Label>Workout music (optional)</Label>
                  <Pills value={music ? 'yes' : null} onPick={(k) => (k ? addMusic() : setMusic(null))} options={[['yes', music ? `🎵 ${music.name}` : '🎵 Add a song from my phone']]} />
                </>
              ) : null}

              {category === 'news' ? (
                <>
                  <Label>📰 Headline (required)</Label>
                  <Field value={news.headline} onChangeText={(v) => setNews({ ...news, headline: v })} placeholder="What happened, in one line" maxLength={120} />
                  <Label>Topic</Label>
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
              {music ? <Text style={{ fontFamily: fonts.body, color: colors.dim, fontSize: 12, marginTop: 6 }}>With music added, your video plays muted under the song. Only use music you're allowed to share.</Text> : null}

              <Pressable onPress={post} disabled={busy} style={{ marginTop: space.xl, height: 52, borderRadius: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                <LinearGradient colors={cat?.colors || gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: 16 }}>Post Spark 🎬</Text>}
              </Pressable>
              {busy ? <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 8 }}>Uploading your video… this can take a minute.</Text> : null}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <SparkRecorder visible={recording} cue={cue} onClose={() => setRecording(false)} onDone={(v) => { setRecording(false); setVideo(v); setStep('details'); }} />
    </SafeAreaView>
  );
}
