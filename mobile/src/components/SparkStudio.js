// Spark Studio (phone app): edit your video like Reels before posting.
// Trim · Speed · Crop / zoom · Text (with timing) · Stickers · Music · Voiceover · Fade · Cover. Nothing is
// re-encoded on the phone: the edits are saved with the Spark and applied whenever it plays (the original stays sharp).
// Colour filters are picked on the website for now; on phones they come with the server-built videos (docs/MOBILE-PLAN.md).
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { createAudioPlayer, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { SPEEDS, STICKERS, TEXT_COLORS, TEXT_STYLES, fadeAt, fmt } from '../lib/sparkEdit';
import MusicPicker from './MusicPicker';
import { RangeSlider, Slider } from './Slider';
import SparkOverlays from './SparkOverlays';
import { colors, fonts, gradients, space } from '../lib/theme';

const TOOLS = [
  ['trim', 'Trim', 'content-cut'], ['speed', 'Speed', 'speedometer'], ['zoom', 'Crop', 'crop'], ['text', 'Text', 'format-text'],
  ['stickers', 'Stickers', 'sticker-emoji'], ['music', 'Music', 'music-note'], ['voice', 'Voice', 'microphone'],
  ['fade', 'Fade', 'gradient-vertical'], ['cover', 'Cover', 'image-frame'],
];

function Pill({ label, on, onPress }) {
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 16, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginRight: 8, marginBottom: 8, borderWidth: 1.5,
      borderColor: on ? colors.spark : 'rgba(255,255,255,0.18)', backgroundColor: on ? 'rgba(255,107,157,0.18)' : 'rgba(255,255,255,0.06)' }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: on ? colors.text : colors.muted }}>{label}</Text>
    </Pressable>
  );
}
const Label = ({ children }) => <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, marginBottom: 8, marginTop: 4 }}>{children}</Text>;
const Big = ({ icon, label, color = colors.aura, onPress, danger }) => (
  <Pressable onPress={onPress} style={{ height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: danger ? colors.danger : color, backgroundColor: danger ? colors.danger : 'transparent', alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
    <MaterialCommunityIcons name={icon} size={22} color={danger ? '#fff' : color} /><Text style={{ marginLeft: 8, fontFamily: fonts.semibold, color: danger ? '#fff' : colors.text, fontSize: 15 }}>{label}</Text>
  </Pressable>
);

export default function SparkStudio({ video, edit, onChange, music, onMusic, voice, onVoice, onBack, onNext, cue }) {
  const { height: winH } = useWindowDimensions();
  const e = edit;
  const set = (patch) => onChange({ ...e, ...patch });
  const [tool, setTool] = useState('trim');
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(0);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null); // text being typed: { t, color, style, size, i? }
  const [musicOpen, setMusicOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [micError, setMicError] = useState(null);
  const t0 = e.trim?.[0] ?? 0; const t1 = e.trim?.[1] ?? duration;
  const rate = Number(e.speed || 1);
  const musicUri = music?.uri || null; const voiceUri = voice?.uri || null;

  const player = useVideoPlayer(video.uri, (p) => { p.loop = false; p.timeUpdateEventInterval = 0.1; });
  const audio = useRef(null); const vo = useRef(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // music and voiceover previews
  useEffect(() => { audio.current = musicUri ? createAudioPlayer({ uri: musicUri }) : null; return () => { audio.current?.remove(); audio.current = null; }; }, [musicUri]);
  useEffect(() => { vo.current = voiceUri ? createAudioPlayer({ uri: voiceUri }) : null; return () => { vo.current?.remove(); vo.current = null; }; }, [voiceUri]);
  // video length (and a first trim of up to 60 s)
  useEffect(() => {
    const ready = () => {
      const d = player.duration;
      if (d && isFinite(d)) { setDuration(d); if (!e.trim) set({ trim: [0, Math.min(d, 60)] }); }
    };
    ready();
    const s = player.addListener('statusChange', ({ status }) => { if (status === 'readyToPlay') ready(); });
    return () => s.remove();
  }, [player]); // eslint-disable-line react-hooks/exhaustive-deps
  // speed + volumes (with the fade)
  useEffect(() => {
    player.playbackRate = rate;
    const k = 1 - fadeAt(e.fade, now, t0, t1);
    player.muted = recording;
    player.volume = Math.min(1, (musicUri || voiceUri ? (e.videoVolume ?? 0.3) : (e.videoVolume ?? 1)) * k);
    if (audio.current) audio.current.volume = (e.musicVolume ?? 1) * k;
    if (vo.current) vo.current.volume = (e.voiceVolume ?? 1) * k;
  }, [rate, musicUri, voiceUri, e.videoVolume, e.musicVolume, e.voiceVolume, e.fade, now, recording]); // eslint-disable-line react-hooks/exhaustive-deps

  const syncAudio = () => {
    const rel = Math.max(0, player.currentTime - t0) / rate;
    audio.current?.seekTo((e.musicStart || 0) + rel);
    vo.current?.seekTo(rel);
  };
  const pause = () => { player.pause(); audio.current?.pause(); vo.current?.pause(); setPlaying(false); };
  const play = () => {
    if (player.currentTime < t0 || player.currentTime >= t1 - 0.05) player.currentTime = t0;
    player.play(); syncAudio(); audio.current?.play(); if (!recording) vo.current?.play();
    setPlaying(true);
  };
  const stopRecording = async () => {
    if (!recording) return;
    setRecording(false); pause();
    try {
      await recorder.stop();
      if (recorder.uri) {
        onVoice?.({ uri: recorder.uri, type: 'audio/m4a', name: 'voice.m4a' });
        if (e.videoVolume == null || e.videoVolume === 1) set({ videoVolume: 0.3 });
      }
    } catch { setMicError('The recording could not be saved. Try again.'); }
  };
  // keep inside the trim; a voiceover stops at the end of the trim
  useEffect(() => {
    const s = player.addListener('timeUpdate', ({ currentTime: t }) => {
      setNow(t);
      if (t >= t1 - 0.02 && t1) {
        if (recording) { stopRecording(); player.currentTime = t0; return; }
        player.currentTime = t0; syncAudio(); vo.current?.play();
      }
    });
    const end = player.addListener('playToEnd', () => { if (recording) { stopRecording(); return; } player.currentTime = t0; player.play(); syncAudio(); });
    return () => { s.remove(); end.remove(); };
  }, [player, t0, t1, recording]); // eslint-disable-line react-hooks/exhaustive-deps

  const startRecording = async () => {
    setMicError(null);
    const perm = await requestRecordingPermissionsAsync().catch(() => ({ granted: false }));
    if (!perm.granted) { setMicError('Allow the microphone for Soulink in your phone settings to record a voiceover.'); return; }
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      pause(); player.currentTime = t0; audio.current?.pause();
      recorder.record(); setRecording(true);
      player.play(); setPlaying(true);
    } catch { setMicError("Couldn't start the microphone. Try again."); }
  };
  const seek = (t) => { pause(); player.currentTime = t; setNow(t); };

  const addText = () => { setSelected(null); setDraft({ t: '', color: '#ffffff', style: 'classic', size: 30 }); };
  const saveText = () => {
    const d = draft; setDraft(null);
    if (!d?.t.trim()) return;
    const item = { t: d.t.trim().slice(0, 80), color: d.color, style: d.style, size: d.size, x: d.x ?? 0.5, y: d.y ?? 0.4, ...(d.from != null ? { from: d.from, to: d.to } : {}) };
    const texts = [...(e.texts || [])];
    if (d.i != null) texts[d.i] = item; else texts.push(item);
    set({ texts: texts.slice(0, 10) });
  };
  const onSelect = (sel) => {
    if (sel?.kind === 'texts' && selected?.kind === 'texts' && selected.i === sel.i) { setDraft({ ...e.texts[sel.i], i: sel.i }); setTool('text'); return; }
    setSelected(sel);
  };
  const picked = (m) => { onMusic(m); set({ musicStart: m.start || 0, musicVolume: 1, videoVolume: 0.3 }); };

  const len = Math.max(0, t1 - t0) / rate;
  const tooLong = t1 - t0 > 60.5;
  const previewH = Math.min(winH * 0.5, 520);
  const previewW = previewH * 9 / 16;
  const shade = fadeAt(e.fade, now, t0, t1);
  const zoom = e.zoom || { s: 1, x: 0.5, y: 0.5 };

  return (
    <View style={{ flex: 1, backgroundColor: '#07060c' }}>
      <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg }}>
        <Pressable onPress={() => { pause(); onBack(); }} hitSlop={12} accessibilityLabel="Back"><Ionicons name="arrow-back" size={26} color={colors.text} /></Pressable>
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 17, color: colors.text }}>Edit</Text>
        <Pressable onPress={() => { pause(); onNext({ duration }); }} disabled={tooLong}
          style={{ height: 36, paddingHorizontal: 18, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', opacity: tooLong ? 0.4 : 1 }}>
          <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: 14 }}>Next</Text>
        </Pressable>
      </View>

      {/* the preview, 9:16 like it will look in Sparks */}
      <View style={{ alignItems: 'center' }}>
        <Pressable onPress={() => { if (selected) { setSelected(null); return; } if (recording) return; playing ? pause() : play(); }}
          style={{ width: previewW, height: previewH, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' }}>
          <View style={{ flex: 1, ...(zoom.s > 1.001 ? { transform: [{ translateX: (0.5 - zoom.x) * (zoom.s - 1) * previewW * 0.5 }, { translateY: (0.5 - zoom.y) * (zoom.s - 1) * previewH * 0.5 }, { scale: zoom.s }] } : {}) }}>
            <VideoView player={player} style={{ flex: 1 }} contentFit="cover" nativeControls={false} allowsPictureInPicture={false} />
          </View>
          {shade > 0.001 ? <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', opacity: shade }} /> : null}
          <SparkOverlays edit={e} editable selected={selected} onSelect={onSelect} onChange={onChange} time={playing ? now : null} />
          {recording ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,60,90,0.9)' }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', marginRight: 6 }} />
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>Recording your voice</Text>
            </View>
          ) : null}
          {!playing && !selected ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="play" size={30} color="#fff" style={{ marginLeft: 3 }} /></View>
            </View>
          ) : null}
          <View pointerEvents="none" style={{ position: 'absolute', bottom: 8, right: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.55)' }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: tooLong ? colors.danger : '#fff' }}>{fmt(Math.max(0, now - t0) / rate)} / {fmt(len)}</Text>
          </View>
        </Pressable>
      </View>

      {/* tools */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: space.md }} contentContainerStyle={{ paddingHorizontal: space.md }}>
        {TOOLS.map(([k, label, icon]) => {
          const on = tool === k;
          return (
            <Pressable key={k} onPress={() => { setTool(k); setDraft(null); }} style={{ alignItems: 'center', width: 64 }} accessibilityLabel={label}>
              <View style={{ width: 46, height: 46, borderRadius: 23, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: on ? undefined : 'rgba(255,255,255,0.08)' }}>
                {on ? <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} /> : null}
                <MaterialCommunityIcons name={icon} size={22} color={on ? '#fff' : colors.aura} />
              </View>
              <Text style={{ fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 12, color: on ? colors.text : colors.muted, marginTop: 4 }}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: space.lg, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        {tool === 'trim' ? (
          <>
            <Label>{tooLong ? 'Trim to 60 seconds or less' : `Keep ${fmt(t0)} – ${fmt(t1)} · ${Math.round(t1 - t0)} s`}</Label>
            {duration ? (
              <RangeSlider start={t0} end={t1} min={0} max={duration} minGap={1} maxGap={60}
                onChange={(s, en, which) => { set({ trim: [s, en] }); seek(which === 'start' ? s : Math.max(s, en - 0.1)); }}>
                <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(124,92,252,0.25)', borderRadius: 10 }} />
              </RangeSlider>
            ) : <Text style={{ color: colors.muted, fontFamily: fonts.body }}>Loading the video…</Text>}
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.dim, marginTop: 8 }}>Drag the pink handles to choose the part you want. The preview jumps there.</Text>
          </>
        ) : null}

        {tool === 'speed' ? (
          <>
            <Label>Playback speed</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{SPEEDS.map((sp) => <Pill key={sp} label={`${sp}×`} on={(e.speed || '1') === sp} onPress={() => set({ speed: sp })} />)}</View>
          </>
        ) : null}

        {tool === 'zoom' ? (
          <>
            <Label>{`Zoom · ${zoom.s.toFixed(1)}×`}</Label>
            <Slider value={zoom.s} min={1} max={3} onChange={(n) => set({ zoom: { ...zoom, s: n < 1.03 ? 1 : n } })} />
            <Label>Focus left ↔ right</Label>
            <Slider value={zoom.x} min={0} max={1} onChange={(n) => set({ zoom: { ...zoom, x: n } })} />
            <Label>Focus up ↕ down</Label>
            <Slider value={zoom.y} min={0} max={1} onChange={(n) => set({ zoom: { ...zoom, y: n } })} />
            <Pressable onPress={() => set({ zoom: { s: 1, x: 0.5, y: 0.5 } })} style={{ alignSelf: 'flex-start', marginTop: 6 }}><Text style={{ fontFamily: fonts.semibold, color: colors.aura, fontSize: 14 }}>Reset</Text></Pressable>
          </>
        ) : null}

        {tool === 'text' ? (
          draft ? (
            <>
              <TextInput value={draft.t} onChangeText={(t) => setDraft({ ...draft, t })} autoFocus placeholder="Type something…" placeholderTextColor={colors.dim} maxLength={80}
                style={{ height: 50, borderRadius: 14, paddingHorizontal: 14, backgroundColor: 'rgba(38,35,56,0.96)', color: colors.text, fontFamily: fonts.semibold, fontSize: 16 }} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space.md }}>
                {TEXT_COLORS.map((c) => <Pressable key={c} onPress={() => setDraft({ ...draft, color: c })} accessibilityLabel={`Colour ${c}`} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, marginRight: 8, marginBottom: 8, borderWidth: draft.color === c ? 3 : 1, borderColor: draft.color === c ? '#fff' : 'rgba(255,255,255,0.3)' }} />)}
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{TEXT_STYLES.map((st) => <Pill key={st.key} label={st.label} on={draft.style === st.key} onPress={() => setDraft({ ...draft, style: st.key })} />)}</View>
              <Label>Size</Label>
              <Slider value={draft.size} min={14} max={64} onChange={(n) => setDraft({ ...draft, size: Math.round(n) })} />
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.sm }}>
                <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.muted }}>{draft.from != null ? `On screen ${fmt(draft.from)} – ${fmt(draft.to)}` : 'On screen the whole Spark'}</Text>
                <Pill label={draft.from != null ? 'Whole Spark' : 'Set timing'} on={false}
                  onPress={() => setDraft(draft.from != null ? { ...draft, from: undefined, to: undefined } : { ...draft, from: Math.max(t0, Math.min(now, t1 - 1)), to: Math.min(t1, Math.max(now, t0) + 3) })} />
              </View>
              {draft.from != null && duration ? (
                <RangeSlider start={draft.from} end={draft.to} min={t0} max={t1} minGap={0.5} height={44} onChange={(st, en, which) => { setDraft({ ...draft, from: st, to: en }); seek(which === 'start' ? st : en); }}>
                  <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(124,92,252,0.25)', borderRadius: 10 }} />
                </RangeSlider>
              ) : null}
              <View style={{ flexDirection: 'row', marginTop: space.md, gap: 10 }}>
                <Pressable onPress={() => setDraft(null)} style={{ flex: 1, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: fonts.semibold, color: colors.text }}>Cancel</Text></Pressable>
                <Pressable onPress={saveText} style={{ flex: 1, height: 48, borderRadius: 24, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                  <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                  <Text style={{ fontFamily: fonts.bold, color: '#fff' }}>{draft.i != null ? 'Save' : 'Add'}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Big icon="format-text" label="Add text" onPress={addText} />
              <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.dim, marginTop: 10, lineHeight: 18 }}>Drag text on the video to move it. Tap it once to select (✕ removes it), tap again to edit.</Text>
            </>
          )
        ) : null}

        {tool === 'stickers' ? (
          <>
            <Label>Tap to add · drag on the video to move · tap one to remove it</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {STICKERS.map((st) => <Pressable key={st} onPress={() => set({ stickers: [...(e.stickers || []), { e: st, x: 0.5, y: 0.55, size: 70 }].slice(0, 15) })} style={{ width: '12.5%', alignItems: 'center', paddingVertical: 8 }}><Text style={{ fontSize: 30 }}>{st}</Text></Pressable>)}
            </View>
          </>
        ) : null}

        {tool === 'music' ? (
          musicUri ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.md }}>
                <MaterialCommunityIcons name="music-circle" size={34} color={colors.spark} />
                <Text numberOfLines={1} style={{ flex: 1, marginLeft: 8, fontFamily: fonts.semibold, color: colors.text, fontSize: 15 }}>{music.name}</Text>
                <Pressable onPress={() => { pause(); setMusicOpen(true); }} style={{ marginRight: 12 }}><Text style={{ fontFamily: fonts.semibold, color: colors.aura }}>Change</Text></Pressable>
                <Pressable onPress={() => { pause(); onMusic(null); set({ musicStart: 0, musicVolume: 1, videoVolume: 1 }); }} accessibilityLabel="Remove music"><Ionicons name="trash-outline" size={22} color={colors.muted} /></Pressable>
              </View>
              <Label>{`Song starts at ${fmt(e.musicStart || 0)}`}</Label>
              <Slider value={e.musicStart || 0} min={0} max={Math.max(1, (music.duration || 180) - 5)} color={colors.spark} onChange={(n) => set({ musicStart: n })} onDone={() => { if (playing) syncAudio(); }} />
              <Label>{`Original sound · ${Math.round((e.videoVolume ?? 0.3) * 100)}%`}</Label>
              <Slider value={e.videoVolume ?? 0.3} min={0} max={1} onChange={(n) => set({ videoVolume: n })} />
              <Label>{`Music · ${Math.round((e.musicVolume ?? 1) * 100)}%`}</Label>
              <Slider value={e.musicVolume ?? 1} min={0} max={1} color={colors.spark} onChange={(n) => set({ musicVolume: n })} />
            </>
          ) : (
            <>
              <Big icon="music-note-plus" label="Add music" color={colors.spark} onPress={() => { pause(); setMusicOpen(true); }} />
              <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.dim, marginTop: 10, lineHeight: 18 }}>Pick where the song starts and mix it with your video's own sound. Only use music you're allowed to share.</Text>
            </>
          )
        ) : null}

        {tool === 'voice' ? (
          <>
            {recording ? <Big icon="stop" label={`Stop · ${fmt(Math.max(0, now - t0) / rate)}`} danger onPress={stopRecording} />
              : <Big icon="microphone" label={voiceUri ? 'Record again' : 'Record a voiceover'} color={colors.spark} onPress={startRecording} />}
            {micError ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.danger, marginTop: 8 }}>{micError}</Text> : null}
            {voiceUri && !recording ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.md, marginBottom: 6 }}>
                  <MaterialCommunityIcons name="account-voice" size={22} color={colors.mint} />
                  <Text style={{ flex: 1, marginLeft: 8, fontFamily: fonts.semibold, color: colors.text }}>Your voiceover</Text>
                  <Pressable onPress={() => { pause(); onVoice?.(null); set({ voiceVolume: 1 }); }} accessibilityLabel="Remove voiceover"><Ionicons name="trash-outline" size={22} color={colors.muted} /></Pressable>
                </View>
                <Label>{`Voice · ${Math.round((e.voiceVolume ?? 1) * 100)}%`}</Label>
                <Slider value={e.voiceVolume ?? 1} min={0} max={1} color={colors.mint} onChange={(n) => set({ voiceVolume: n })} />
                <Label>{`Original sound · ${Math.round((e.videoVolume ?? 0.3) * 100)}%`}</Label>
                <Slider value={e.videoVolume ?? 0.3} min={0} max={1} onChange={(n) => set({ videoVolume: n })} />
              </>
            ) : null}
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.dim, marginTop: 10, lineHeight: 18 }}>The video plays while you talk over it, from the start of your trim to the end. Headphones help keep it clean.</Text>
          </>
        ) : null}

        {tool === 'fade' ? (
          <>
            <Label>{`Fade in · ${(e.fade?.in || 0).toFixed(1)} s`}</Label>
            <Slider value={e.fade?.in || 0} min={0} max={3} onChange={(n) => set({ fade: { ...(e.fade || {}), in: n < 0.1 ? 0 : n } })} />
            <Label>{`Fade out · ${(e.fade?.out || 0).toFixed(1)} s`}</Label>
            <Slider value={e.fade?.out || 0} min={0} max={3} onChange={(n) => set({ fade: { ...(e.fade || {}), out: n < 0.1 ? 0 : n } })} />
          </>
        ) : null}

        {tool === 'cover' ? (
          <>
            <Label>Choose the frame people see before they tap play</Label>
            <Slider value={e.cover ?? t0} min={t0} max={Math.max(t0 + 0.1, t1)} onChange={(n) => { set({ cover: n }); seek(n); }} />
          </>
        ) : null}

        {cue ? <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.dim, marginTop: space.lg, lineHeight: 18 }}>{cue}</Text> : null}
      </ScrollView>
      <MusicPicker visible={musicOpen} onClose={() => setMusicOpen(false)} onPick={picked} clip={60} title="Music for your Spark" />
    </View>
  );
}
