// Soulink Studio: the Sparks editor (phone app and web). One screen, like Reels / CapCut, in Soulink's own look:
//  · a big 9:16 preview: drag text and stickers, pinch to resize, twist to rotate (two fingers)
//  · a timeline under it with the playhead in the middle: clips (videos + photos), text & stickers, music & voice
//  · tools that change with what's selected: a clip (split, trim, speed, duplicate, move, delete), a layer
//    (edit, timing, size, delete) or nothing (add, text, stickers, music, voice, look, crop, fade, cover)
//  · undo / redo for every change, and the edit is kept as a draft while you work (lib/studio.js)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import { createAudioPlayer } from 'expo-audio';
import * as S from '../lib/studio';
import { FILTERS, STICKERS, TEXT_COLORS, TEXT_STYLES, textStyleOf, videoCss } from '../lib/sparkEdit';
import { probeClip, useVoice } from '../lib/studioMedia';
import MusicPicker from './MusicPicker';
import { RangeSlider, Slider } from './Slider';
import { colors, fonts, gradients, space } from '../lib/theme';

const PPS = 46;            // timeline: pixels per second
const CLIP_H = 58; const LAYER_H = 26; const AUDIO_H = 22;
const WEB = Platform.OS === 'web';
const INK = '#07060c';
const fill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
const short = (s) => { const t = Math.max(0, s || 0); return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`; };

// ---------- small pieces ----------
function Grad({ style, children, colorsList = gradients.button }) {
  return <View style={[{ overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}><LinearGradient colors={colorsList} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={fill} />{children}</View>;
}
function IconBtn({ icon, label, onPress, disabled, size = 22, active }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}
      style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1, backgroundColor: active ? 'rgba(124,92,252,0.3)' : 'transparent' }}>
      <MaterialCommunityIcons name={icon} size={size} color={colors.text} />
    </Pressable>
  );
}
function Tool({ icon, label, onPress, tint = colors.aura, danger, disabled }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={{ alignItems: 'center', width: 66, opacity: disabled ? 0.35 : 1 }}>
      <View style={{ width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: danger ? 'rgba(255,92,122,0.16)' : 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: danger ? 'rgba(255,92,122,0.4)' : 'rgba(255,255,255,0.1)' }}>
        <MaterialCommunityIcons name={icon} size={22} color={danger ? colors.danger : tint} />
      </View>
      <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 11.5, color: colors.muted, marginTop: 5 }}>{label}</Text>
    </Pressable>
  );
}
function Pill({ label, on, onPress }) {
  return (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 15, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 8, marginBottom: 8, borderWidth: 1.5,
      borderColor: on ? colors.spark : 'rgba(255,255,255,0.16)', backgroundColor: on ? 'rgba(255,107,157,0.18)' : 'rgba(255,255,255,0.05)' }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: on ? colors.text : colors.muted }}>{label}</Text>
    </Pressable>
  );
}
const Label = ({ children }) => <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.muted, marginBottom: 6, marginTop: 6 }}>{children}</Text>;
const Hint = ({ children }) => <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.dim, lineHeight: 18, marginTop: 8 }}>{children}</Text>;

// ---------- a text or sticker on the preview: drag; two fingers = pinch to size, twist to rotate ----------
function Layer({ o, box, selected, onSelect, onChange }) {
  const st = useRef({}); const live = useRef(o); live.current = o;
  const cb = useRef({}); cb.current = { onSelect, onChange, box };
  const two = (t) => { const [a, b] = t; const dx = b.pageX - a.pageX; const dy = b.pageY - a.pageY; return { d: Math.hypot(dx, dy) || 1, a: (Math.atan2(dy, dx) * 180) / Math.PI }; };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true, onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { const c = live.current; st.current = { x: c.x, y: c.y, scale: c.scale || 1, rot: c.rot || 0, moved: false, pinch: null }; },
    onPanResponderMove: (e, g) => {
      const touches = e.nativeEvent.touches || [];
      const { box: b, onChange: ch } = cb.current;
      if (touches.length >= 2) {
        const now = two(touches);
        if (!st.current.pinch) st.current.pinch = { ...now, scale: live.current.scale || 1, rot: live.current.rot || 0 };
        const p = st.current.pinch; st.current.moved = true;
        let rot = p.rot + (now.a - p.a); if (Math.abs(rot % 90) < 4) rot = Math.round(rot / 90) * 90; // gently snaps straight
        ch({ scale: Math.max(0.3, Math.min(4, p.scale * (now.d / p.d))), rot: ((rot + 540) % 360) - 180 });
        return;
      }
      if (st.current.pinch) return; // lifting one finger after a pinch: don't jump
      if (Math.abs(g.dx) + Math.abs(g.dy) > 3) st.current.moved = true;
      ch({ x: Math.max(0.02, Math.min(0.98, st.current.x + g.dx / b.width)), y: Math.max(0.02, Math.min(0.98, st.current.y + g.dy / b.height)) });
    },
    onPanResponderRelease: () => { if (!st.current.moved) cb.current.onSelect(); },
  })).current;
  const k = box.width / 360; const size = (o.size || (o.kind === 'text' ? 30 : 70)) * (o.scale || 1) * k;
  return (
    <View {...pan.panHandlers} accessibilityLabel={o.kind === 'text' ? `Text: ${o.t}` : `Sticker ${o.e}`}
      style={{ position: 'absolute', left: o.x * box.width, top: o.y * box.height, transform: [{ translateX: '-50%' }, { translateY: '-50%' }, { rotate: `${o.rot || 0}deg` }],
        padding: 6, borderRadius: 10, borderWidth: selected ? 1.5 : 0, borderColor: '#fff', borderStyle: 'dashed', ...(WEB ? { cursor: 'grab', userSelect: 'none' } : {}) }}>
      {o.kind === 'text'
        ? <Text style={[textStyleOf(o.style, o.color, size), { maxWidth: box.width * 0.9 }]}>{o.t}</Text>
        : <Text style={{ fontSize: size, lineHeight: size * 1.15 }}>{o.e}</Text>}
    </View>
  );
}

// ---------- the editor ----------
export default function SoulStudio({ initial, onBack, onNext, onAddMedia, onDraft, cue, nextLabel = 'Next' }) {
  const { width: winW, height: winH } = useWindowDimensions();
  const [h, setH] = useState(() => S.history(initial || S.emptyProject()));
  const p = h.present;
  const change = useCallback((fn, key) => setH((cur) => S.commit(cur, S.fitOverlays(typeof fn === 'function' ? fn(cur.present) : fn), key)), []);
  const [t, setT] = useState(0);                 // the playhead (seconds of the finished Spark)
  const [playing, setPlaying] = useState(false);
  const [sel, setSel] = useState(null);          // { kind: 'clip'|'layer'|'music'|'voice', id }
  const [panel, setPanel] = useState(null);      // the open tool sheet
  const [draftText, setDraftText] = useState(null);
  const [musicOpen, setMusicOpen] = useState(false);
  const [info, setInfo] = useState({});          // clip id -> { thumbs }
  const [box, setBox] = useState(null);
  const voice = useVoice();
  const len = S.totalLen(p);
  const starts = useMemo(() => S.clipStarts(p), [p]);
  const here = S.locate(p, Math.min(t, Math.max(0, len - 0.001)));
  const selClip = sel?.kind === 'clip' ? p.clips.find((c) => c.id === sel.id) : null;
  const selLayer = sel?.kind === 'layer' ? p.overlays.find((o) => o.id === sel.id) : null;

  // keep a draft while editing (a second after the last change)
  useEffect(() => { const id = setTimeout(() => onDraft?.(p), 1000); return () => clearTimeout(id); }, [p, onDraft]);

  // each new clip: its real length and small frames for the timeline
  useEffect(() => {
    p.clips.forEach((c) => {
      const key = `${c.uri}`;
      if (info[key]) return;
      setInfo((m) => ({ ...m, [key]: { loading: true, thumbs: [] } }));
      probeClip(c.uri, c.kind).then((r) => {
        setInfo((m) => ({ ...m, [key]: { thumbs: r.thumbs || [] } }));
        if (r.duration) setH((cur) => ({ ...cur, present: cur.present.clips.reduce((acc, x) => (x.uri === c.uri && !x.src ? S.setSourceLength(acc, x.id, r.duration) : acc), cur.present) }));
      });
    });
  }, [p.clips]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- playback: one video player, swapped clip by clip; photos are timed ----------
  const player = useVideoPlayer(null, (pl) => { pl.loop = false; pl.timeUpdateEventInterval = 0.05; });
  const eng = useRef({ uri: null, index: -1, pendingSeek: null, playing: false });
  const music = useRef(null); const vo = useRef(null);
  const live = useRef({}); live.current = { p, t, len, starts };

  useEffect(() => { music.current = p.music?.uri ? createAudioPlayer({ uri: p.music.uri }) : null; return () => { try { music.current?.remove(); } catch { /* gone */ } music.current = null; }; }, [p.music?.uri]);
  useEffect(() => { vo.current = p.voice?.uri ? createAudioPlayer({ uri: p.voice.uri }) : null; return () => { try { vo.current?.remove(); } catch { /* gone */ } vo.current = null; }; }, [p.voice?.uri]);
  // the mix: original sound lower when there's music or a voiceover
  useEffect(() => {
    const backing = !!(p.music || p.voice);
    player.volume = Math.max(0, Math.min(1, p.videoVolume ?? (backing ? 0.3 : 1)));
    player.muted = voice.recording;
    if (music.current) music.current.volume = p.music?.volume ?? 1;
    if (vo.current) vo.current.volume = p.voice?.volume ?? 1;
  }, [p.videoVolume, p.music, p.voice, voice.recording, player]);

  /** show the timeline at time tl: the right clip, at the right second */
  const showAt = useCallback((tl, play) => {
    const { p: pp } = live.current;
    const hit = S.locate(pp, tl); if (!hit) return;
    const c = hit.clip; const e = eng.current;
    e.index = hit.index;
    if (c.kind === 'video') {
      if (e.uri !== c.uri) { e.uri = c.uri; e.pendingSeek = hit.source; player.replace({ uri: c.uri }); }
      else { try { player.currentTime = hit.source; } catch { e.pendingSeek = hit.source; } }
      player.playbackRate = c.speed || 1;
      if (play) player.play(); else player.pause();
    } else { player.pause(); }
  }, [player]);
  useEffect(() => {
    const s = player.addListener('statusChange', ({ status }) => {
      const e = eng.current;
      if (status === 'readyToPlay' && e.pendingSeek != null) { try { player.currentTime = e.pendingSeek; } catch { /* next time */ } e.pendingSeek = null; if (e.playing) player.play(); }
    });
    return () => s.remove();
  }, [player]);
  const syncAudio = (tl) => {
    try { music.current?.seekTo((live.current.p.music?.start || 0) + tl); } catch { /* not ready */ }
    try { vo.current?.seekTo(tl); } catch { /* not ready */ }
  };
  const pause = useCallback(() => {
    eng.current.playing = false; setPlaying(false); player.pause();
    try { music.current?.pause(); vo.current?.pause(); } catch { /* gone */ }
  }, [player]);
  const playFrom = (tl) => {
    if (!len) return;
    const from = tl >= len - 0.05 ? 0 : tl;
    eng.current.playing = true; setPlaying(true); setT(from);
    showAt(from, true); syncAudio(from);
    try { music.current?.play(); if (!voice.recording) vo.current?.play(); } catch { /* gone */ }
  };
  const seek = (tl) => { const x = Math.max(0, Math.min(len, tl)); if (eng.current.playing) pause(); setT(x); showAt(x, false); };
  // video clips report their time; the timeline follows, and moves on to the next clip at the end
  useEffect(() => {
    const s = player.addListener('timeUpdate', ({ currentTime: cur }) => {
      const e = eng.current; if (!e.playing) return;
      const { p: pp, starts: st } = live.current; const c = pp.clips[e.index];
      if (!c || c.kind !== 'video') return;
      const tl = st[e.index] + Math.max(0, cur - c.in) / (c.speed || 1);
      if (cur >= c.out - 0.04) { nextRef.current(e.index); return; }
      setT(tl);
    });
    const end = player.addListener('playToEnd', () => { if (eng.current.playing) nextRef.current(eng.current.index); });
    return () => { s.remove(); end.remove(); };
  }, [player]); // eslint-disable-line react-hooks/exhaustive-deps
  // photos (and moving on): a light timer while playing
  useEffect(() => {
    if (!playing) return undefined;
    let last = Date.now();
    const id = setInterval(() => {
      const e = eng.current; const { p: pp, starts: st } = live.current; const c = pp.clips[e.index];
      const now = Date.now(); const dt = (now - last) / 1000; last = now;
      if (!c || c.kind !== 'photo') return;
      setT((x) => { const nx = x + dt; if (nx >= st[e.index] + S.clipLen(c) - 0.02) { setTimeout(() => nextRef.current(e.index), 0); return st[e.index] + S.clipLen(c); } return nx; });
    }, 50);
    return () => clearInterval(id);
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps
  // the listeners above always call the latest version of this (it needs the current recording state)
  const nextRef = useRef(null);
  const next = (i) => {
    const { p: pp, starts: st } = live.current;
    if (i + 1 < pp.clips.length) { const tl = st[i + 1]; setT(tl); showAt(tl, true); return; }
    // the end: a voiceover stops here; otherwise back to the start, paused
    if (voice.recording) stopVoice();
    pause(); setT(0); showAt(0, false);
  };
  nextRef.current = next;
  useEffect(() => { if (p.clips.length && !eng.current.playing) showAt(Math.min(t, Math.max(0, len - 0.01)), false); }, [p.clips]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- timeline scrolling (the playhead stays in the middle) ----------
  // the timeline follows the playhead; a scroll that isn't the one we just made is a finger (or mouse): seek there
  const tl = useRef(null); const madeX = useRef(0);
  useEffect(() => { madeX.current = t * PPS; tl.current?.scrollTo({ x: madeX.current, animated: false }); }, [t]);
  const onScroll = (e) => { const x = e.nativeEvent.contentOffset.x; if (Math.abs(x - madeX.current) < 1.5) return; madeX.current = x; seek(x / PPS); };

  // ---------- actions ----------
  const add = async () => {
    pause();
    const clips = await onAddMedia?.(); if (!clips?.length) return;
    const at = here ? here.index + 1 : p.clips.length;
    change((cur) => S.addClips(cur, clips, Math.min(at, cur.clips.length)));
  };
  const split = () => { pause(); change((cur) => S.splitAt(cur, t)); };
  const delClip = (id) => { pause(); change((cur) => S.removeClip(cur, id)); setSel(null); setPanel(null); };
  const startText = (o) => { pause(); setPanel('text'); setDraftText(o ? { ...o } : { kind: 'text', t: '', color: '#ffffff', style: 'classic', size: 30 }); };
  const saveText = () => {
    const d = draftText; setDraftText(null); setPanel(null);
    if (!d?.t?.trim()) return;
    if (d.id) change((cur) => S.updateOverlay(cur, d.id, { t: d.t.trim().slice(0, 80), color: d.color, style: d.style }));
    else change((cur) => S.addOverlay(cur, { ...d, t: d.t.trim().slice(0, 80) }));
  };
  const addSticker = (e) => { change((cur) => S.addOverlay(cur, { kind: 'sticker', e, size: 70, y: 0.55 })); setPanel(null); };
  const pickedMusic = (m) => change((cur) => ({ ...cur, music: { ...m, start: m.start || 0, volume: 1 }, videoVolume: cur.videoVolume === 1 ? 0.3 : cur.videoVolume }));
  const startVoice = async () => { pause(); if (await voice.start()) playFrom(0); };
  const stopVoice = async () => { const v = await voice.stop(); pause(); if (v) change((cur) => ({ ...cur, voice: { ...v, volume: 1 }, videoVolume: cur.videoVolume === 1 ? 0.3 : cur.videoVolume })); };
  const goNext = () => { pause(); onNext?.(p); };
  const errors = S.problems(p);

  // ---------- layout: preview gets what's left after the bars ----------
  const BOTTOM = 266; const TOP = 52; const TRANSPORT = 44;
  const prevH = Math.max(260, Math.min(winH - TOP - TRANSPORT - BOTTOM - 24, (Math.min(winW, 520) - 48) * 16 / 9));
  const prevW = prevH * 9 / 16;
  const cur = here?.clip;
  const thumbsOf = (c) => info[c.uri]?.thumbs || [];
  const layersShown = p.overlays.filter((o) => sel?.id === o.id || S.overlayShown(o, t));
  // timeline lanes for text & stickers: a bar goes in the first lane where it doesn't overlap another
  const lanes = useMemo(() => {
    const ends = []; const out = {};
    for (const o of p.overlays) {
      const a = o.from ?? 0; const b = o.to ?? len;
      let k = ends.findIndex((e) => e <= a + 0.01); if (k < 0) { k = ends.length; ends.push(b); } else ends[k] = b;
      out[o.id] = k;
    }
    return { of: out, count: Math.max(1, ends.length) };
  }, [p.overlays, len]);
  const zoom = p.zoom || { s: 1, x: 0.5, y: 0.5 };

  // ---------- the tool sheets ----------
  const sheet = () => {
    if (panel === 'text' && draftText) {
      return (
        <>
          <TextInput value={draftText.t} onChangeText={(v) => setDraftText({ ...draftText, t: v })} autoFocus placeholder="Type something…" placeholderTextColor={colors.dim} maxLength={80}
            style={{ height: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: 'rgba(38,35,56,0.96)', color: colors.text, fontFamily: fonts.semibold, fontSize: 16, ...(WEB ? { outlineStyle: 'none' } : {}) }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, flexGrow: 0 }}>
            {TEXT_COLORS.map((c) => <Pressable key={c} onPress={() => setDraftText({ ...draftText, color: c })} accessibilityLabel={`Colour ${c}`} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c, marginRight: 8, borderWidth: draftText.color === c ? 3 : 1, borderColor: draftText.color === c ? '#fff' : 'rgba(255,255,255,0.3)' }} />)}
          </ScrollView>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>{TEXT_STYLES.map((s) => <Pill key={s.key} label={s.label} on={draftText.style === s.key} onPress={() => setDraftText({ ...draftText, style: s.key })} />)}</View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <Pressable onPress={() => { setDraftText(null); setPanel(null); }} style={{ flex: 1, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: fonts.semibold, color: colors.text }}>Cancel</Text></Pressable>
            <Pressable onPress={saveText} style={{ flex: 1 }}><Grad style={{ height: 44, borderRadius: 22 }}><Text style={{ fontFamily: fonts.bold, color: '#fff' }}>{draftText.id ? 'Save' : 'Add text'}</Text></Grad></Pressable>
          </View>
        </>
      );
    }
    if (panel === 'stickers') {
      return (<><Label>Tap one to add it · drag it on the video · pinch to resize, twist to rotate</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{STICKERS.map((e) => <Pressable key={e} onPress={() => addSticker(e)} style={{ width: '12.5%', alignItems: 'center', paddingVertical: 7 }}><Text style={{ fontSize: 28 }}>{e}</Text></Pressable>)}</View></>);
    }
    if (panel === 'trim' && selClip) {
      if (selClip.kind === 'photo') {
        return (<><Label>{`Show this photo for ${(selClip.out - selClip.in).toFixed(1)} s`}</Label>
          <Slider value={selClip.out - selClip.in} min={0.5} max={15} onChange={(n) => change((c) => S.trimClip(c, selClip.id, 0, Math.round(n * 10) / 10), `trim-${selClip.id}`)} /></>);
      }
      const max = selClip.src || selClip.out;
      return (<><Label>{`Keep ${short(selClip.in)} – ${short(selClip.out)} of this clip · ${S.clipLen(selClip).toFixed(1)} s in your Spark`}</Label>
        <RangeSlider start={selClip.in} end={selClip.out} min={0} max={max} minGap={S.MIN_CLIP} onChange={(a, b, which) => { change((c) => S.trimClip(c, selClip.id, a, b), `trim-${selClip.id}`); const st = starts[p.clips.indexOf(selClip)] || 0; seek(st + (which === 'start' ? 0 : Math.max(0, (b - a) / (selClip.speed || 1) - 0.05))); }}>
          <View pointerEvents="none" style={{ ...fill, flexDirection: 'row', borderRadius: 10, overflow: 'hidden', opacity: 0.55 }}>{thumbsOf(selClip).map((th, i) => <Image key={i} source={th} style={{ flex: 1 }} contentFit="cover" />)}</View>
        </RangeSlider>
        <Hint>Drag the handles to keep the part you want. Split cuts a clip at the white line.</Hint></>);
    }
    if (panel === 'speed' && selClip) {
      return (<><Label>Speed for this clip</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{S.SPEEDS.map((sp) => <Pill key={sp} label={`${sp}×`} on={(selClip.speed || 1) === sp} onPress={() => change((c) => S.setSpeed(c, selClip.id, sp))} />)}</View>
        <Hint>0.3× and 0.5× give slow motion; 2× and 3× speed it up. Each clip can have its own speed.</Hint></>);
    }
    if (panel === 'timing' && selLayer) {
      const from = selLayer.from ?? 0; const to = selLayer.to ?? len;
      return (<><Label>{selLayer.from == null ? 'On screen for the whole Spark' : `On screen ${short(from)} – ${short(to)}`}</Label>
        <RangeSlider start={from} end={to} min={0} max={Math.max(0.6, len)} minGap={0.5} height={46} onChange={(a, b, which) => { change((c) => S.updateOverlay(c, selLayer.id, { from: a, to: b }), `time-${selLayer.id}`); seek(which === 'start' ? a : b); }}>
          <View pointerEvents="none" style={{ ...fill, backgroundColor: 'rgba(245,200,66,0.25)', borderRadius: 10 }} />
        </RangeSlider>
        {selLayer.from != null ? <Pressable onPress={() => change((c) => S.updateOverlay(c, selLayer.id, { from: undefined, to: undefined }))} style={{ marginTop: 6 }}><Text style={{ fontFamily: fonts.semibold, color: colors.aura }}>Show for the whole Spark</Text></Pressable> : null}</>);
    }
    if (panel === 'size' && selLayer) {
      return (<><Label>{`Size · ${Math.round((selLayer.scale || 1) * 100)}%`}</Label>
        <Slider value={selLayer.scale || 1} min={0.3} max={4} onChange={(n) => change((c) => S.updateOverlay(c, selLayer.id, { scale: n }), `size-${selLayer.id}`)} />
        <Label>{`Rotate · ${Math.round(selLayer.rot || 0)}°`}</Label>
        <Slider value={selLayer.rot || 0} min={-180} max={180} onChange={(n) => change((c) => S.updateOverlay(c, selLayer.id, { rot: Math.abs(n) < 4 ? 0 : n }), `rot-${selLayer.id}`)} />
        <Hint>On a phone you can also pinch and twist with two fingers right on the video.</Hint></>);
    }
    if (panel === 'music') {
      return p.music ? (<>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialCommunityIcons name="music-circle" size={30} color={colors.spark} />
          <Text numberOfLines={1} style={{ flex: 1, marginLeft: 8, fontFamily: fonts.semibold, color: colors.text, fontSize: 14.5 }}>{p.music.title || p.music.name}</Text>
          <Pressable onPress={() => { pause(); setMusicOpen(true); }} style={{ marginRight: 14 }}><Text style={{ fontFamily: fonts.semibold, color: colors.aura }}>Change</Text></Pressable>
          <Pressable onPress={() => { pause(); change((c) => ({ ...c, music: null, videoVolume: c.voice ? c.videoVolume : 1 })); }} accessibilityLabel="Remove music"><Ionicons name="trash-outline" size={21} color={colors.muted} /></Pressable>
        </View>
        <Label>{`Song starts at ${short(p.music.start)}`}</Label>
        <Slider value={p.music.start || 0} min={0} max={Math.max(1, (p.music.duration || 180) - 5)} color={colors.spark} onChange={(n) => change((c) => ({ ...c, music: { ...c.music, start: n } }), 'music-start')} onDone={() => syncAudio(t)} />
        <Label>{`Music ${Math.round((p.music.volume ?? 1) * 100)}% · your video ${Math.round((p.videoVolume ?? 1) * 100)}%`}</Label>
        <Slider value={p.music.volume ?? 1} min={0} max={1} color={colors.spark} onChange={(n) => change((c) => ({ ...c, music: { ...c.music, volume: n } }), 'music-vol')} />
        <Slider value={p.videoVolume ?? 1} min={0} max={1} onChange={(n) => change((c) => ({ ...c, videoVolume: n }), 'video-vol')} />
      </>) : (<><Pressable onPress={() => { pause(); setMusicOpen(true); }}><Grad style={{ height: 48, borderRadius: 24, flexDirection: 'row' }} colorsList={[colors.spark, colors.soul]}><MaterialCommunityIcons name="music-note-plus" size={20} color="#fff" /><Text style={{ fontFamily: fonts.bold, color: '#fff', marginLeft: 8 }}>Add music</Text></Grad></Pressable>
        <Hint>Pick a song, choose where it starts and mix it with your video's own sound.</Hint></>);
    }
    if (panel === 'voice') {
      return (<>
        {voice.recording
          ? <Pressable onPress={stopVoice}><View style={{ height: 48, borderRadius: 24, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}><Ionicons name="stop" size={18} color="#fff" /><Text style={{ fontFamily: fonts.bold, color: '#fff', marginLeft: 8 }}>{`Stop · ${short(t)}`}</Text></View></Pressable>
          : <Pressable onPress={startVoice}><Grad style={{ height: 48, borderRadius: 24, flexDirection: 'row' }} colorsList={[colors.mint, colors.soul]}><Ionicons name="mic" size={18} color="#fff" /><Text style={{ fontFamily: fonts.bold, color: '#fff', marginLeft: 8 }}>{p.voice ? 'Record again' : 'Record a voiceover'}</Text></Grad></Pressable>}
        {voice.error ? <Text style={{ fontFamily: fonts.body, color: colors.danger, marginTop: 8 }}>{voice.error}</Text> : null}
        {p.voice && !voice.recording ? (<>
          <Label>{`Voice ${Math.round((p.voice.volume ?? 1) * 100)}% · your video ${Math.round((p.videoVolume ?? 1) * 100)}%`}</Label>
          <Slider value={p.voice.volume ?? 1} min={0} max={1} color={colors.mint} onChange={(n) => change((c) => ({ ...c, voice: { ...c.voice, volume: n } }), 'voice-vol')} />
          <Slider value={p.videoVolume ?? 1} min={0} max={1} onChange={(n) => change((c) => ({ ...c, videoVolume: n }), 'video-vol')} />
          <Pressable onPress={() => change((c) => ({ ...c, voice: null, videoVolume: c.music ? c.videoVolume : 1 }))}><Text style={{ fontFamily: fonts.semibold, color: colors.muted, marginTop: 6 }}>Remove voiceover</Text></Pressable>
        </>) : <Hint>Your Spark plays from the start while you talk over it. Headphones keep it clean.</Hint>}
      </>);
    }
    if (panel === 'look') {
      return (<>
        <Label>Soul Looks</Label>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
          {FILTERS.map((f) => (
            <Pressable key={f.key} onPress={() => change((c) => ({ ...c, filter: f.key }))} style={{ marginRight: 10, alignItems: 'center' }}>
              <View style={{ width: 58, height: 82, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: p.filter === f.key ? colors.spark : 'transparent' }}>
                {cur ? <Image source={thumbsOf(cur)[0] || null} style={{ flex: 1, ...(WEB ? { filter: f.css } : {}) }} contentFit="cover" /> : null}
              </View>
              <Text style={{ fontFamily: fonts.medium, fontSize: 11.5, color: p.filter === f.key ? colors.text : colors.muted, marginTop: 4 }}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {!WEB ? <Hint>Looks show in the preview on the web today; on phones they're built into the finished video when the Soulink video builder is switched on.</Hint> : null}
      </>);
    }
    if (panel === 'crop') {
      return (<><Label>{`Zoom · ${zoom.s.toFixed(1)}×`}</Label>
        <Slider value={zoom.s} min={1} max={3} onChange={(n) => change((c) => ({ ...c, zoom: { ...zoom, s: n < 1.03 ? 1 : n } }), 'zoom')} />
        <Label>Focus left ↔ right</Label><Slider value={zoom.x} min={0} max={1} onChange={(n) => change((c) => ({ ...c, zoom: { ...zoom, x: n } }), 'zoom-x')} />
        <Label>Focus up ↕ down</Label><Slider value={zoom.y} min={0} max={1} onChange={(n) => change((c) => ({ ...c, zoom: { ...zoom, y: n } }), 'zoom-y')} /></>);
    }
    if (panel === 'fade') {
      return (<><Label>{`Fade in · ${(p.fade?.in || 0).toFixed(1)} s`}</Label>
        <Slider value={p.fade?.in || 0} min={0} max={3} onChange={(n) => change((c) => ({ ...c, fade: { ...c.fade, in: n < 0.1 ? 0 : n } }), 'fade-in')} />
        <Label>{`Fade out · ${(p.fade?.out || 0).toFixed(1)} s`}</Label>
        <Slider value={p.fade?.out || 0} min={0} max={3} onChange={(n) => change((c) => ({ ...c, fade: { ...c.fade, out: n < 0.1 ? 0 : n } }), 'fade-out')} /></>);
    }
    if (panel === 'cover') {
      return (<><Label>{`Cover frame at ${short(p.cover)}`}</Label>
        <Slider value={p.cover || 0} min={0} max={Math.max(0.1, len)} onChange={(n) => { change((c) => ({ ...c, cover: n }), 'cover'); seek(n); }} />
        <Hint>This frame is what people see before they tap play.</Hint></>);
    }
    return null;
  };

  // the tools: what's selected decides
  const dock = () => {
    if (selClip) return [
      <Tool key="sp" icon="content-cut" label="Split" onPress={split} />,
      <Tool key="tr" icon="arrow-expand-horizontal" label={selClip.kind === 'photo' ? 'Duration' : 'Trim'} onPress={() => setPanel('trim')} />,
      selClip.kind === 'video' ? <Tool key="spd" icon="speedometer" label="Speed" onPress={() => setPanel('speed')} /> : null,
      <Tool key="dup" icon="content-copy" label="Duplicate" onPress={() => change((c) => S.duplicateClip(c, selClip.id))} />,
      <Tool key="l" icon="chevron-left" label="Move left" disabled={p.clips[0]?.id === selClip.id} onPress={() => change((c) => S.moveClip(c, selClip.id, -1))} />,
      <Tool key="r" icon="chevron-right" label="Move right" disabled={p.clips[p.clips.length - 1]?.id === selClip.id} onPress={() => change((c) => S.moveClip(c, selClip.id, 1))} />,
      <Tool key="del" icon="delete-outline" label="Delete" danger onPress={() => delClip(selClip.id)} />,
    ];
    if (selLayer) return [
      selLayer.kind === 'text' ? <Tool key="ed" icon="pencil" label="Edit" onPress={() => startText(selLayer)} /> : null,
      <Tool key="tm" icon="timer-outline" label="Timing" onPress={() => setPanel('timing')} />,
      <Tool key="sz" icon="resize" label="Size & turn" onPress={() => setPanel('size')} />,
      <Tool key="dup" icon="content-copy" label="Duplicate" onPress={() => { const { id, ...rest } = selLayer; change((c) => S.addOverlay(c, { ...rest, x: Math.min(0.9, rest.x + 0.05), y: Math.min(0.9, rest.y + 0.05) })); }} />,
      <Tool key="del" icon="delete-outline" label="Delete" danger onPress={() => { change((c) => S.removeOverlay(c, selLayer.id)); setSel(null); setPanel(null); }} />,
    ];
    return [
      <Tool key="add" icon="plus-box-multiple" label="Add clip" tint={colors.spark} onPress={add} />,
      <Tool key="tx" icon="format-text" label="Text" onPress={() => startText()} />,
      <Tool key="st" icon="sticker-emoji" label="Stickers" onPress={() => setPanel('stickers')} />,
      <Tool key="mu" icon="music-note" label="Music" tint={colors.spark} onPress={() => setPanel('music')} />,
      <Tool key="vo" icon="microphone" label="Voice" tint={colors.mint} onPress={() => setPanel('voice')} />,
      <Tool key="lk" icon="auto-fix" label="Soul Looks" tint={colors.gold} onPress={() => setPanel('look')} />,
      <Tool key="cr" icon="crop" label="Crop" onPress={() => setPanel('crop')} />,
      <Tool key="fd" icon="gradient-vertical" label="Fade" onPress={() => setPanel('fade')} />,
      <Tool key="cv" icon="image-frame" label="Cover" onPress={() => setPanel('cover')} />,
    ];
  };

  const half = Math.min(winW, 560) / 2;
  const fadeShade = (() => { const f = p.fade || {}; if (f.in && t < f.in) return 1 - t / f.in; if (f.out && len - t < f.out) return 1 - (len - t) / f.out; return 0; })();

  return (
    <View style={{ flex: 1, backgroundColor: INK }}>
      {/* top bar: back · undo / redo · next */}
      <View style={{ height: TOP, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md }}>
        <IconBtn icon="arrow-left" label="Back" onPress={() => { pause(); onBack?.(p); }} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 15, color: colors.text, letterSpacing: 0.3 }}>Soulink Studio</Text>
        </View>
        <IconBtn icon="undo-variant" label="Undo" disabled={!h.past.length} onPress={() => { pause(); setH(S.undo); }} />
        <IconBtn icon="redo-variant" label="Redo" disabled={!h.future.length} onPress={() => { pause(); setH(S.redo); }} />
        <Pressable onPress={goNext} disabled={!!errors.length} accessibilityRole="button" accessibilityLabel={nextLabel} style={{ marginLeft: 6, opacity: errors.length ? 0.4 : 1 }}>
          <Grad style={{ height: 36, paddingHorizontal: 18, borderRadius: 18 }}><Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: 14 }}>{nextLabel}</Text></Grad>
        </Pressable>
      </View>

      {/* the preview */}
      <View style={{ alignItems: 'center' }}>
        <View onLayout={(e) => setBox(e.nativeEvent.layout)} style={{ width: prevW, height: prevH, borderRadius: 20, overflow: 'hidden', backgroundColor: '#000' }}>
          <Pressable onPress={() => { if (sel) { setSel(null); setPanel(null); return; } if (voice.recording) return; playing ? pause() : playFrom(t); }} style={fill} accessibilityLabel={playing ? 'Pause' : 'Play'}>
            <View style={{ flex: 1, ...(WEB ? { filter: videoCss(p) } : {}), ...(zoom.s > 1.001 ? { transform: [{ translateX: (0.5 - zoom.x) * (zoom.s - 1) * prevW * 0.5 }, { translateY: (0.5 - zoom.y) * (zoom.s - 1) * prevH * 0.5 }, { scale: zoom.s }] } : {}) }}>
              <VideoView playsInline player={player} style={[fill, { opacity: cur?.kind === 'video' ? 1 : 0 }]} contentFit="cover" nativeControls={false} allowsPictureInPicture={false} />
              {cur?.kind === 'photo' ? <Image source={{ uri: cur.uri }} style={fill} contentFit="cover" /> : null}
            </View>
          </Pressable>
          {fadeShade > 0.001 ? <View pointerEvents="none" style={[fill, { backgroundColor: '#000', opacity: fadeShade }]} /> : null}
          {box ? <View pointerEvents="box-none" style={fill}>
            {layersShown.map((o) => <Layer key={o.id} o={o} box={box} selected={sel?.id === o.id} onSelect={() => { pause(); setSel(sel?.id === o.id && o.kind === 'text' ? sel : { kind: 'layer', id: o.id }); if (sel?.id === o.id && o.kind === 'text') startText(o); }} onChange={(patch) => change((c) => S.updateOverlay(c, o.id, patch), `layer-${o.id}`)} />)}
          </View> : null}
          {!p.clips.length ? (
            <Pressable onPress={add} style={[fill, { alignItems: 'center', justifyContent: 'center' }]}>
              <Grad style={{ width: 64, height: 64, borderRadius: 32 }}><Ionicons name="add" size={34} color="#fff" /></Grad>
              <Text style={{ fontFamily: fonts.semibold, color: colors.text, marginTop: 12 }}>Add videos or photos</Text>
            </Pressable>
          ) : null}
          {voice.recording ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,60,90,0.92)' }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', marginRight: 6 }} /><Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>Recording your voice</Text>
            </View>
          ) : null}
          {cue ? <View pointerEvents="none" style={{ position: 'absolute', left: 10, right: 10, bottom: 10, padding: 8, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.45)' }}><Text numberOfLines={3} style={{ fontFamily: fonts.body, fontSize: 12, color: '#fff' }}>{cue}</Text></View> : null}
        </View>
      </View>

      {/* play · time · split */}
      <View style={{ height: TRANSPORT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg, gap: 14 }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.muted, width: 92, textAlign: 'right' }}>{`${short(t)} / ${short(len)}`}</Text>
        <Pressable onPress={() => (playing ? pause() : playFrom(t))} disabled={!len || voice.recording} accessibilityLabel={playing ? 'Pause' : 'Play'}
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={playing ? 'pause' : 'play'} size={20} color="#fff" style={{ marginLeft: playing ? 0 : 2 }} />
        </Pressable>
        <View style={{ width: 92 }}>{len > S.MAX_LEN + 0.5 ? <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.danger }}>{`Over ${S.MAX_LEN} s`}</Text> : null}</View>
      </View>

      {/* bottom: timeline + tools, or a tool sheet */}
      <View style={{ height: BOTTOM }}>
        {panel ? (
          <View style={{ flex: 1, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: 'rgba(24,21,40,0.98)', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingTop: 10 }}>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => { setPanel(null); setDraftText(null); }} hitSlop={10} accessibilityLabel="Done"><Text style={{ fontFamily: fonts.bold, color: colors.aura, fontSize: 14 }}>Done</Text></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">{sheet()}</ScrollView>
          </View>
        ) : (
          <>
            <View style={{ height: 164 }}>
              <ScrollView ref={tl} horizontal showsHorizontalScrollIndicator={false} scrollEventThrottle={16} onScroll={onScroll}
                onScrollBeginDrag={() => { if (eng.current.playing) pause(); }}
                contentContainerStyle={{ paddingHorizontal: half, paddingTop: 10 }}>
                <View>
                  {/* ruler */}
                  <View style={{ height: 16, flexDirection: 'row' }}>
                    {Array.from({ length: Math.ceil(len) + 1 }, (_, s) => <View key={s} style={{ position: 'absolute', left: s * PPS }}><Text style={{ fontFamily: fonts.mono, fontSize: 9, color: colors.dim }}>{s % 2 === 0 ? short(s) : '·'}</Text></View>)}
                  </View>
                  {/* clips */}
                  <View style={{ flexDirection: 'row', height: CLIP_H, alignItems: 'center' }}>
                    {p.clips.map((c, i) => {
                      const w = Math.max(18, S.clipLen(c) * PPS); const on = sel?.id === c.id; const th = thumbsOf(c);
                      const n = Math.max(1, Math.round(w / 34));
                      return (
                        <Pressable key={c.id} onPress={() => { pause(); setPanel(null); setSel(on ? null : { kind: 'clip', id: c.id }); if (!on) seek(starts[i] + 0.01); }} accessibilityLabel={`Clip ${i + 1}, ${S.clipLen(c).toFixed(1)} seconds`}
                          style={{ width: w - 2, height: CLIP_H, marginRight: 2, borderRadius: 10, overflow: 'hidden', backgroundColor: '#1d1a30', borderWidth: on ? 2.5 : 0, borderColor: colors.spark }}>
                          <View style={{ flex: 1, flexDirection: 'row' }}>
                            {Array.from({ length: n }, (_, k) => th.length ? <Image key={k} source={th[Math.min(th.length - 1, Math.floor((k / n) * th.length))]} style={{ flex: 1 }} contentFit="cover" /> : <View key={k} style={{ flex: 1, backgroundColor: k % 2 ? '#24203a' : '#1d1a30' }} />)}
                          </View>
                          <View pointerEvents="none" style={{ position: 'absolute', left: 4, bottom: 3, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.55)' }}>
                            <MaterialCommunityIcons name={c.kind === 'photo' ? 'image' : 'video'} size={10} color="#fff" />
                            <Text style={{ fontFamily: fonts.semibold, fontSize: 9.5, color: '#fff', marginLeft: 3 }}>{`${S.clipLen(c).toFixed(1)}s${c.kind === 'video' && c.speed !== 1 ? ` · ${c.speed}×` : ''}`}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                    <Pressable onPress={add} accessibilityLabel="Add clip" style={{ width: 44, height: 44, borderRadius: 12, marginLeft: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' }}><Ionicons name="add" size={24} color="#fff" /></Pressable>
                  </View>
                  {/* text & stickers */}
                  <View style={{ height: Math.min(2, lanes.count) * LAYER_H + 4, marginTop: 4, width: Math.max(1, len * PPS) }}>
                    {p.overlays.map((o, i) => {
                      const from = o.from ?? 0; const to = o.to ?? len; const on = sel?.id === o.id;
                      return (
                        <Pressable key={o.id} onPress={() => { pause(); setPanel(null); setSel(on ? null : { kind: 'layer', id: o.id }); if (!on && o.from != null) seek(o.from); }}
                          style={{ position: 'absolute', left: from * PPS, top: Math.min(1, lanes.of[o.id] || 0) * LAYER_H, width: Math.max(26, (to - from) * PPS), height: LAYER_H - 2, borderRadius: 7, paddingHorizontal: 6, justifyContent: 'center',
                            backgroundColor: o.kind === 'text' ? 'rgba(245,200,66,0.85)' : 'rgba(176,143,255,0.85)', borderWidth: on ? 2 : 0, borderColor: '#fff' }}>
                          <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 11, color: '#14121f' }}>{o.kind === 'text' ? `T  ${o.t}` : o.e}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {/* sound */}
                  <View style={{ height: AUDIO_H + 2, flexDirection: 'row', width: Math.max(1, len * PPS) }}>
                    {p.music ? <Pressable onPress={() => { pause(); setPanel('music'); }} style={{ flex: 1, height: AUDIO_H - 6, borderRadius: 6, marginTop: 3, paddingHorizontal: 6, justifyContent: 'center', backgroundColor: 'rgba(255,107,157,0.7)' }}><Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 10.5, color: '#fff' }}>{`♪ ${p.music.title || p.music.name || 'Music'}`}</Text></Pressable> : null}
                    {p.voice ? <Pressable onPress={() => { pause(); setPanel('voice'); }} style={{ flex: 1, height: AUDIO_H - 6, borderRadius: 6, marginTop: 3, marginLeft: p.music ? 3 : 0, paddingHorizontal: 6, justifyContent: 'center', backgroundColor: 'rgba(66,232,192,0.7)' }}><Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 10.5, color: '#06201a' }}>🎙 Voiceover</Text></Pressable> : null}
                  </View>
                </View>
              </ScrollView>
              {/* the playhead */}
              <View pointerEvents="none" style={{ position: 'absolute', top: 6, bottom: 6, left: half - 1, width: 2, borderRadius: 1, backgroundColor: '#fff' }} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.sm, alignItems: 'center', paddingTop: 6 }} style={{ flexGrow: 0 }}>
              {dock()}
              {sel ? <Tool icon="check" label="Done" onPress={() => setSel(null)} /> : null}
            </ScrollView>
            {errors.length && p.clips.length ? <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.danger, textAlign: 'center', marginTop: 2 }}>{errors[0]}</Text> : null}
          </>
        )}
      </View>
      <MusicPicker visible={musicOpen} onClose={() => setMusicOpen(false)} onPick={(m) => { pickedMusic(m); setPanel('music'); }} clip={60} title="Music for your Spark" />
    </View>
  );
}
