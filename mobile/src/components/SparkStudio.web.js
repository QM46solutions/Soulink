// Spark Studio (web, works on the laptop and online): edit your video like Reels before posting.
// Trim · Speed · Filters · Adjust · Crop / zoom · Text (with timing) · Stickers · Music · Voiceover · Fade · Cover. Nothing is re-encoded on the phone:
// the edits are saved with the Spark and applied whenever it plays (fast, and the original stays sharp).
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ADJUSTS, FILTERS, SPEEDS, STICKERS, TEXT_COLORS, TEXT_STYLES, adjustCss, fadeAt, fmt, videoCss, zoomCss } from '../lib/sparkEdit';
import MusicPicker from './MusicPicker';
import { RangeSlider, Slider } from './Slider';
import SparkOverlays from './SparkOverlays';
import { colors, fonts, gradients, space } from '../lib/theme';

const TOOLS = [
  ['trim', 'Trim', 'content-cut'], ['speed', 'Speed', 'speedometer'], ['filter', 'Filters', 'auto-fix'], ['adjust', 'Adjust', 'tune-variant'],
  ['zoom', 'Crop', 'crop'], ['text', 'Text', 'format-text'], ['stickers', 'Stickers', 'sticker-emoji'], ['music', 'Music', 'music-note'],
  ['voice', 'Voice', 'microphone'], ['fade', 'Fade', 'gradient-vertical'], ['cover', 'Cover', 'image-frame'],
];

// a few still frames along the video, for the trim strip and the filter / cover previews
async function grabFrames(src, n = 8) {
  const v = document.createElement('video');
  v.src = src; v.muted = true; v.playsInline = true; v.crossOrigin = 'anonymous'; v.preload = 'auto';
  await new Promise((r, j) => { v.onloadeddata = r; v.onerror = j; setTimeout(r, 6000); });
  const d = v.duration && isFinite(v.duration) ? v.duration : 0;
  const c = document.createElement('canvas'); const w = 90; const h = 160; c.width = w; c.height = h;
  const g = c.getContext('2d'); const out = [];
  for (let i = 0; i < n; i += 1) {
    const t = d ? Math.min(d - 0.05, (d * (i + 0.5)) / n) : 0;
    await new Promise((r) => { v.onseeked = r; v.currentTime = t; setTimeout(r, 1500); });
    const vw = v.videoWidth || w; const vh = v.videoHeight || h; const s = Math.max(w / vw, h / vh);
    g.drawImage(v, (w - vw * s) / 2, (h - vh * s) / 2, vw * s, vh * s);
    try { out.push(c.toDataURL('image/jpeg', 0.6)); } catch { break; }
  }
  return { frames: out, duration: d };
}

function Pill({ label, on, onPress }) {
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 16, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 8, borderWidth: 1.5,
      borderColor: on ? colors.spark : 'rgba(255,255,255,0.18)', backgroundColor: on ? 'rgba(255,107,157,0.18)' : 'rgba(255,255,255,0.06)' }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: on ? colors.text : colors.muted }}>{label}</Text>
    </Pressable>
  );
}
const Label = ({ children }) => <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginBottom: 8 }}>{children}</Text>;

// a voiceover recorder (the browser's microphone)
function pickAudioType() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']) if (MediaRecorder.isTypeSupported?.(t)) return t;
  return '';
}

export default function SparkStudio({ video, edit, onChange, music, onMusic, voice, onVoice, onBack, onNext, cue }) {
  const { height: winH } = useWindowDimensions();
  const v = useRef(null); const a = useRef(null); const vo = useRef(null);
  const rec = useRef(null);
  const [recording, setRecording] = useState(false);
  const [micError, setMicError] = useState(null);
  const [tool, setTool] = useState('trim');
  const [duration, setDuration] = useState(0);
  const [frames, setFrames] = useState([]);
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(0);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null); // text being typed: { t, color, style, size, i? }
  const [musicLen, setMusicLen] = useState(0);
  const e = edit;
  const set = (patch) => onChange({ ...e, ...patch });
  const t0 = e.trim?.[0] ?? 0; const t1 = e.trim?.[1] ?? duration;
  const rate = Number(e.speed || 1);
  const musicUri = music?.uri || null;
  const voiceUri = voice?.uri || null;

  useEffect(() => {
    let alive = true;
    grabFrames(video.uri).then((r) => { if (!alive) return; setFrames(r.frames); if (r.duration) setDuration(r.duration); }).catch(() => {});
    return () => { alive = false; };
  }, [video.uri]);
  const onMeta = () => {
    const d = v.current?.duration;
    if (d && isFinite(d)) {
      setDuration(d);
      if (!e.trim) set({ trim: [0, Math.min(d, 60)] }); // longer videos start trimmed to the first 60 s
    }
  };
  useEffect(() => {
    const el = v.current; if (!el) return;
    el.playbackRate = rate;
    const k = 1 - fadeAt(e.fade, now, t0, t1);
    el.muted = recording;
    el.volume = Math.min(1, (musicUri || voiceUri ? (e.videoVolume ?? 0.3) : (e.videoVolume ?? 1)) * k);
    if (a.current) a.current.volume = (e.musicVolume ?? 1) * k;
    if (vo.current) vo.current.volume = (e.voiceVolume ?? 1) * k;
  }, [rate, musicUri, voiceUri, e.videoVolume, e.musicVolume, e.voiceVolume, e.fade, now, recording]); // eslint-disable-line react-hooks/exhaustive-deps
  const syncMusic = () => {
    if (!v.current) return;
    const rel = Math.max(0, v.current.currentTime - t0) / rate;
    if (a.current) a.current.currentTime = (e.musicStart || 0) + rel;
    if (vo.current) vo.current.currentTime = rel;
  };
  const pause = () => { v.current?.pause(); a.current?.pause(); vo.current?.pause(); setPlaying(false); };
  const play = async () => {
    const el = v.current; if (!el) return;
    if (el.currentTime < t0 || el.currentTime >= t1 - 0.05) el.currentTime = t0;
    try {
      await el.play(); syncMusic();
      if (a.current) await a.current.play().catch(() => {});
      if (vo.current && !recording) await vo.current.play().catch(() => {});
      setPlaying(true);
    } catch { setPlaying(false); }
  };
  const stopRecording = () => { const r = rec.current; if (r && r.state !== 'inactive') r.stop(); };
  const onTime = () => {
    const el = v.current; if (!el) return;
    setNow(el.currentTime);
    if (el.currentTime >= t1) {
      if (recording) { stopRecording(); pause(); el.currentTime = t0; return; }
      el.currentTime = t0; syncMusic(); vo.current?.play().catch(() => {});
    }
  };
  // Voiceover: the video plays (muted) from the start of the trim while you talk; it stops at the end
  const startRecording = async () => {
    setMicError(null);
    const type = pickAudioType();
    if (type == null || !navigator.mediaDevices?.getUserMedia) { setMicError("This browser can't record sound. Try Chrome or Safari."); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { setMicError('Allow the microphone for Soulink to record a voiceover.'); return; }
    const chunks = [];
    const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    r.ondataavailable = (ev) => { if (ev.data?.size) chunks.push(ev.data); };
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      setRecording(false); rec.current = null;
      const mime = (r.mimeType || type || 'audio/webm').split(';')[0];
      if (!chunks.length) return;
      const blob = new Blob(chunks, { type: mime });
      onVoice?.({ uri: URL.createObjectURL(blob), type: mime, name: `voice.${mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm'}` });
      if (e.videoVolume == null || e.videoVolume === 1) set({ videoVolume: 0.3 });
    };
    rec.current = r;
    pause();
    if (v.current) v.current.currentTime = t0;
    a.current?.pause();
    setRecording(true);
    r.start(250);
    try { await v.current?.play(); setPlaying(true); } catch { /* keeps recording */ }
  };
  useEffect(() => () => stopRecording(), []); // eslint-disable-line react-hooks/exhaustive-deps
  const seek = (t) => { pause(); if (v.current) v.current.currentTime = t; setNow(t); };

  const addText = () => { setSelected(null); setDraft({ t: '', color: '#ffffff', style: 'classic', size: 30 }); };
  const saveText = () => {
    const d = draft; setDraft(null);
    if (!d?.t.trim()) return;
    const item = { t: d.t.trim().slice(0, 80), color: d.color, style: d.style, size: d.size, x: d.x ?? 0.5, y: d.y ?? 0.4,
      ...(d.from != null ? { from: d.from, to: d.to } : {}) };
    const texts = [...(e.texts || [])];
    if (d.i != null) texts[d.i] = item; else texts.push(item);
    set({ texts: texts.slice(0, 10) });
  };
  const addSticker = (em) => set({ stickers: [...(e.stickers || []), { e: em, x: 0.5, y: 0.55, size: 70 }].slice(0, 15) });
  const [musicOpen, setMusicOpen] = useState(false);
  const chooseMusic = () => { pause(); setMusicOpen(true); };
  const picked = (m) => { onMusic(m); set({ musicStart: m.start || 0, musicVolume: 1, videoVolume: 0.3 }); };
  // tap a text on the video while it's selected → edit it
  const onSelect = (sel) => {
    if (sel?.kind === 'texts' && selected?.kind === 'texts' && selected.i === sel.i) { const t = e.texts[sel.i]; setDraft({ ...t, i: sel.i }); setTool('text'); return; }
    setSelected(sel);
  };

  const len = Math.max(0, t1 - t0) / rate;
  const tooLong = t1 - t0 > 60.5;
  const previewH = Math.min(winH * 0.56, 520);
  const previewW = previewH * 9 / 16;
  const shade = fadeAt(e.fade, now, t0, t1);
  const adj = e.adjust || {};
  const zoom = e.zoom || { s: 1, x: 0.5, y: 0.5 };

  return (
    <View style={{ flex: 1, backgroundColor: '#07060c' }}>
      <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg }}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityLabel="Back"><Ionicons name="arrow-back" size={26} color={colors.text} /></Pressable>
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 17, color: colors.text }}>Edit</Text>
        <Pressable onPress={() => { pause(); onNext({ duration }); }} disabled={tooLong}
          style={{ height: 36, paddingHorizontal: 18, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', opacity: tooLong ? 0.4 : 1 }}>
          <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: 14 }}>Next</Text>
        </Pressable>
      </View>

      {/* the preview, 9:16 like it will look in Sparks */}
      <View style={{ alignItems: 'center' }}>
        <Pressable onPress={() => { if (selected) { setSelected(null); return; } playing ? pause() : play(); }}
          style={{ width: previewW, height: previewH, borderRadius: 18, overflow: 'hidden', backgroundColor: '#000' }}>
          <video ref={v} src={video.uri} playsInline preload="auto" onLoadedMetadata={onMeta} onTimeUpdate={onTime}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: videoCss(e), ...zoomCss(e.zoom) }} />
          {musicUri ? <audio ref={a} src={musicUri} preload="auto" onLoadedMetadata={(ev) => setMusicLen(ev.currentTarget.duration || 0)} /> : null}
          {voiceUri ? <audio ref={vo} src={voiceUri} preload="auto" /> : null}
          {shade > 0.001 ? <div style={{ position: 'absolute', inset: 0, background: '#000', opacity: shade, pointerEvents: 'none' }} /> : null}
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
            <Pressable key={k} onPress={() => { setTool(k); setDraft(null); }} style={{ alignItems: 'center', width: 62 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: on ? undefined : 'rgba(255,255,255,0.08)' }}>
                {on ? <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} /> : null}
                <MaterialCommunityIcons name={icon} size={22} color={on ? '#fff' : colors.aura} />
              </View>
              <Text style={{ fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 11.5, color: on ? colors.text : colors.muted, marginTop: 4 }}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* the panel for the chosen tool */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {tool === 'trim' ? (
          <>
            <Label>{tooLong ? 'Trim to 60 seconds or less' : `Keep ${fmt(t0)} – ${fmt(t1)} · ${Math.round(t1 - t0)} s`}</Label>
            {duration ? (
              <RangeSlider start={t0} end={t1} min={0} max={duration} minGap={1} maxGap={60}
                onChange={(s, en, which) => { set({ trim: [s, en] }); seek(which === 'start' ? s : Math.max(s, en - 0.1)); }}>
                <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row' }}>
                  {frames.map((f, i) => <img key={i} src={f} alt="" style={{ flex: 1, width: `${100 / frames.length}%`, height: '100%', objectFit: 'cover' }} />)}
                </View>
              </RangeSlider>
            ) : <Text style={{ color: colors.muted, fontFamily: fonts.body }}>Loading the video…</Text>}
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.dim, marginTop: 8 }}>Drag the pink handles to choose the part you want.</Text>
          </>
        ) : null}

        {tool === 'speed' ? (
          <>
            <Label>Playback speed</Label>
            <View style={{ flexDirection: 'row' }}>{SPEEDS.map((sp) => <Pill key={sp} label={`${sp}×`} on={(e.speed || '1') === sp} onPress={() => set({ speed: sp })} />)}</View>
          </>
        ) : null}

        {tool === 'filter' ? (
          <>
            <Label>Filters</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {FILTERS.map((f) => {
                const on = (e.filter || 'none') === f.key;
                return (
                  <Pressable key={f.key} onPress={() => set({ filter: f.key })} style={{ alignItems: 'center', marginRight: 10 }}>
                    <View style={{ width: 64, height: 96, borderRadius: 10, overflow: 'hidden', borderWidth: 2, borderColor: on ? colors.spark : 'transparent', backgroundColor: '#222' }}>
                      {frames[Math.floor(frames.length / 2)] ? <img src={frames[Math.floor(frames.length / 2)]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: f.css }} /> : null}
                    </View>
                    <Text style={{ fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 12, color: on ? colors.text : colors.muted, marginTop: 4 }}>{f.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        {tool === 'text' ? (
          draft ? (
            <>
              <TextInput value={draft.t} onChangeText={(t) => setDraft({ ...draft, t })} autoFocus placeholder="Type something…" placeholderTextColor={colors.dim} maxLength={80}
                style={{ height: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: 'rgba(38,35,56,0.96)', color: colors.text, fontFamily: fonts.semibold, fontSize: 16, outlineStyle: 'none' }} />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space.md }}>
                {TEXT_COLORS.map((c) => <Pressable key={c} onPress={() => setDraft({ ...draft, color: c })} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, marginRight: 8, marginBottom: 8, borderWidth: draft.color === c ? 3 : 1, borderColor: draft.color === c ? '#fff' : 'rgba(255,255,255,0.3)' }} />)}
              </View>
              <View style={{ flexDirection: 'row', marginTop: 4 }}>{TEXT_STYLES.map((st) => <Pill key={st.key} label={st.label} on={draft.style === st.key} onPress={() => setDraft({ ...draft, style: st.key })} />)}</View>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.muted, marginTop: space.md }}>Size</Text>
              <Slider value={draft.size} min={14} max={64} onChange={(n) => setDraft({ ...draft, size: Math.round(n) })} />
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.sm }}>
                <Text style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 12, color: colors.muted }}>
                  {draft.from != null ? `On screen ${fmt(draft.from)} – ${fmt(draft.to)}` : 'On screen the whole Spark'}
                </Text>
                <Pill label={draft.from != null ? 'Whole Spark' : 'Set timing'} on={false}
                  onPress={() => setDraft(draft.from != null ? { ...draft, from: undefined, to: undefined } : { ...draft, from: Math.max(t0, Math.min(now, t1 - 1)), to: Math.min(t1, Math.max(now, t0) + 3) })} />
              </View>
              {draft.from != null && duration ? (
                <RangeSlider start={draft.from} end={draft.to} min={t0} max={t1} minGap={0.5} height={40}
                  onChange={(st, en, which) => { setDraft({ ...draft, from: st, to: en }); seek(which === 'start' ? st : en); }}>
                  <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row', opacity: 0.6 }}>
                    {frames.map((f, i) => <img key={i} src={f} alt="" style={{ flex: 1, width: `${100 / frames.length}%`, height: '100%', objectFit: 'cover' }} />)}
                  </View>
                </RangeSlider>
              ) : null}
              <View style={{ flexDirection: 'row', marginTop: space.sm, gap: 10 }}>
                <Pressable onPress={() => setDraft(null)} style={{ flex: 1, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: fonts.semibold, color: colors.text }}>Cancel</Text></Pressable>
                <Pressable onPress={saveText} style={{ flex: 1, height: 44, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                  <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                  <Text style={{ fontFamily: fonts.bold, color: '#fff' }}>{draft.i != null ? 'Save' : 'Add'}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Pressable onPress={addText} style={{ height: 50, borderRadius: 25, borderWidth: 1.5, borderColor: colors.aura, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
                <MaterialCommunityIcons name="format-text" size={22} color={colors.aura} /><Text style={{ marginLeft: 8, fontFamily: fonts.semibold, color: colors.text, fontSize: 15 }}>Add text</Text>
              </Pressable>
              <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.dim, marginTop: 10, lineHeight: 18 }}>Drag text on the video to move it. Tap it once to select (✕ removes it), tap again to edit.</Text>
            </>
          )
        ) : null}

        {tool === 'stickers' ? (
          <>
            <Label>Tap to add · drag on the video to move · tap one to remove it</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {STICKERS.map((s) => <Pressable key={s} onPress={() => addSticker(s)} style={{ width: '12.5%', alignItems: 'center', paddingVertical: 8 }}><Text style={{ fontSize: 30 }}>{s}</Text></Pressable>)}
            </View>
          </>
        ) : null}

        {tool === 'music' ? (
          musicUri ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.md }}>
                <MaterialCommunityIcons name="music-circle" size={34} color={colors.spark} />
                <Text numberOfLines={1} style={{ flex: 1, marginLeft: 8, fontFamily: fonts.semibold, color: colors.text, fontSize: 15 }}>{music.name}</Text>
                <Pressable onPress={chooseMusic} style={{ marginRight: 12 }}><Text style={{ fontFamily: fonts.semibold, color: colors.aura }}>Change</Text></Pressable>
                <Pressable onPress={() => { pause(); onMusic(null); set({ musicStart: 0, musicVolume: 1, videoVolume: 1 }); }}><Ionicons name="trash-outline" size={20} color={colors.muted} /></Pressable>
              </View>
              <Label>{`Song starts at ${fmt(e.musicStart || 0)}`}</Label>
              <Slider value={e.musicStart || 0} min={0} max={Math.max(1, musicLen - 5)} color={colors.spark} onChange={(n) => set({ musicStart: n })} onDone={() => { if (playing) syncMusic(); }} />
              <Label>{`Original sound · ${Math.round((e.videoVolume ?? 0.3) * 100)}%`}</Label>
              <Slider value={e.videoVolume ?? 0.3} min={0} max={1} onChange={(n) => set({ videoVolume: n })} />
              <Label>{`Music · ${Math.round((e.musicVolume ?? 1) * 100)}%`}</Label>
              <Slider value={e.musicVolume ?? 1} min={0} max={1} color={colors.spark} onChange={(n) => set({ musicVolume: n })} />
            </>
          ) : (
            <>
              <Pressable onPress={chooseMusic} style={{ height: 50, borderRadius: 25, borderWidth: 1.5, borderColor: colors.spark, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
                <MaterialCommunityIcons name="music-note-plus" size={22} color={colors.spark} /><Text style={{ marginLeft: 8, fontFamily: fonts.semibold, color: colors.text, fontSize: 15 }}>Add music</Text>
              </Pressable>
              <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.dim, marginTop: 10, lineHeight: 18 }}>Pick where the song starts and mix it with your video's own sound. Only use music you're allowed to share.</Text>
            </>
          )
        ) : null}

        {tool === 'adjust' ? (
          <>
            {ADJUSTS.map(([k, label]) => (
              <View key={k}>
                <Label>{`${label} · ${adj[k] ? (adj[k] > 0 ? '+' : '') + Math.round(adj[k] * 100) : 0}`}</Label>
                <Slider value={adj[k] || 0} min={-1} max={1} onChange={(n) => set({ adjust: { ...adj, [k]: Math.abs(n) < 0.04 ? 0 : n } })} />
              </View>
            ))}
            <Pressable onPress={() => set({ adjust: { b: 0, c: 0, s: 0, w: 0 } })} style={{ alignSelf: 'flex-start', marginTop: 6 }}>
              <Text style={{ fontFamily: fonts.semibold, color: colors.aura, fontSize: 13 }}>Reset</Text>
            </Pressable>
            {frames[0] ? (
              <View style={{ flexDirection: 'row', marginTop: space.md }}>
                <img src={frames[Math.floor(frames.length / 2)]} alt="" style={{ width: 54, height: 84, borderRadius: 8, objectFit: 'cover', filter: videoCss({ filter: e.filter }) }} />
                <Ionicons name="arrow-forward" size={18} color={colors.dim} style={{ alignSelf: 'center', marginHorizontal: 8 }} />
                <img src={frames[Math.floor(frames.length / 2)]} alt="" style={{ width: 54, height: 84, borderRadius: 8, objectFit: 'cover', filter: [videoCss({ filter: e.filter }), adjustCss(adj)].filter((x) => x && x !== 'none').join(' ') || 'none' }} />
              </View>
            ) : null}
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
            <Pressable onPress={() => set({ zoom: { s: 1, x: 0.5, y: 0.5 } })} style={{ alignSelf: 'flex-start', marginTop: 6 }}>
              <Text style={{ fontFamily: fonts.semibold, color: colors.aura, fontSize: 13 }}>Reset</Text>
            </Pressable>
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.dim, marginTop: 8, lineHeight: 18 }}>Zoom in to crop out the edges, then move the focus to what matters. Sideways videos fill the 9:16 frame automatically.</Text>
          </>
        ) : null}

        {tool === 'voice' ? (
          <>
            {recording ? (
              <Pressable onPress={() => { stopRecording(); pause(); }} style={{ height: 54, borderRadius: 27, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
                <Ionicons name="stop" size={20} color="#fff" /><Text style={{ marginLeft: 8, fontFamily: fonts.bold, color: '#fff', fontSize: 15 }}>Stop · {fmt(Math.max(0, now - t0) / rate)}</Text>
              </Pressable>
            ) : (
              <Pressable onPress={startRecording} style={{ height: 54, borderRadius: 27, borderWidth: 1.5, borderColor: colors.spark, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
                <MaterialCommunityIcons name="microphone" size={22} color={colors.spark} />
                <Text style={{ marginLeft: 8, fontFamily: fonts.semibold, color: colors.text, fontSize: 15 }}>{voiceUri ? 'Record again' : 'Record a voiceover'}</Text>
              </Pressable>
            )}
            {micError ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.danger, marginTop: 8 }}>{micError}</Text> : null}
            {voiceUri && !recording ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.md, marginBottom: 6 }}>
                  <MaterialCommunityIcons name="account-voice" size={22} color={colors.mint} />
                  <Text style={{ flex: 1, marginLeft: 8, fontFamily: fonts.semibold, color: colors.text }}>Your voiceover</Text>
                  <Pressable onPress={() => { pause(); onVoice?.(null); set({ voiceVolume: 1 }); }} accessibilityLabel="Remove voiceover"><Ionicons name="trash-outline" size={20} color={colors.muted} /></Pressable>
                </View>
                <Label>{`Voice · ${Math.round((e.voiceVolume ?? 1) * 100)}%`}</Label>
                <Slider value={e.voiceVolume ?? 1} min={0} max={1} color={colors.mint} onChange={(n) => set({ voiceVolume: n })} />
                <Label>{`Original sound · ${Math.round((e.videoVolume ?? 0.3) * 100)}%`}</Label>
                <Slider value={e.videoVolume ?? 0.3} min={0} max={1} onChange={(n) => set({ videoVolume: n })} />
              </>
            ) : null}
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.dim, marginTop: 10, lineHeight: 18 }}>The video plays while you talk over it, from the start of your trim to the end. Headphones help keep it clean.</Text>
          </>
        ) : null}

        {tool === 'fade' ? (
          <>
            <Label>{`Fade in · ${(e.fade?.in || 0).toFixed(1)} s`}</Label>
            <Slider value={e.fade?.in || 0} min={0} max={3} onChange={(n) => set({ fade: { ...(e.fade || {}), in: n < 0.1 ? 0 : n } })} />
            <Label>{`Fade out · ${(e.fade?.out || 0).toFixed(1)} s`}</Label>
            <Slider value={e.fade?.out || 0} min={0} max={3} onChange={(n) => set({ fade: { ...(e.fade || {}), out: n < 0.1 ? 0 : n } })} />
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.dim, marginTop: 8, lineHeight: 18 }}>The picture and the sound fade together, from black at the start and to black at the end.</Text>
          </>
        ) : null}

        {tool === 'cover' ? (
          <>
            <Label>Choose the frame people see before they tap play</Label>
            <Slider value={e.cover ?? t0} min={t0} max={Math.max(t0 + 0.1, t1)} onChange={(n) => { set({ cover: n }); seek(n); }} />
          </>
        ) : null}

        {cue ? <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.dim, marginTop: space.lg, lineHeight: 18 }}>{cue}</Text> : null}
      </ScrollView>
      <MusicPicker visible={musicOpen} onClose={() => setMusicOpen(false)} onPick={picked} clip={60} title="Music for your Spark" />
    </View>
  );
}
