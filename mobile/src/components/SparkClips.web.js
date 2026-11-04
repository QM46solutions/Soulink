// Spark Clips (web): put several videos together into ONE Spark, CapCut style, before the Studio.
// Add videos from the phone (several at once) or record more, then for each clip: trim, move it left / right,
// split it at the playhead, duplicate or delete it. Pick a transition between clips. The preview plays them all in
// order. Next joins them into one video (in the browser) and opens Spark Studio for text, music, filters and more.
// Taps only for ordering (Move left / Move right buttons): no dragging the clips around.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { RangeSlider } from './Slider';
import { TRANSITIONS } from '../lib/joinClips';
import { fmt } from '../lib/sparkEdit';
import { colors, fonts, gradients, space } from '../lib/theme';

export const MAX_SPARK = 60; // seconds in one Spark
export const newClipId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const clipsLength = (clips) => clips.reduce((s, c) => s + Math.max(0, (c.end ?? 0) - (c.start ?? 0)), 0);

// a few still frames along a video (for the clip cards and the trim strip), and its length
const frameCache = new Map();
async function framesOf(src, n = 8) {
  if (frameCache.has(src)) return frameCache.get(src);
  const job = (async () => {
    const v = document.createElement('video');
    v.src = src; v.muted = true; v.playsInline = true; v.crossOrigin = 'anonymous'; v.preload = 'auto';
    await new Promise((r, j) => { v.onloadeddata = r; v.onerror = j; setTimeout(r, 6000); });
    const d = v.duration && isFinite(v.duration) ? v.duration : 0;
    const c = document.createElement('canvas'); const w = 72; const h = 128; c.width = w; c.height = h;
    const g = c.getContext('2d'); const out = [];
    for (let i = 0; i < n; i += 1) {
      const t = d ? Math.min(d - 0.05, (d * (i + 0.5)) / n) : 0;
      await new Promise((r) => { v.onseeked = r; v.currentTime = t; setTimeout(r, 1500); });
      const vw = v.videoWidth || w; const vh = v.videoHeight || h; const s = Math.max(w / vw, h / vh);
      g.drawImage(v, (w - vw * s) / 2, (h - vh * s) / 2, vw * s, vh * s);
      try { out.push(c.toDataURL('image/jpeg', 0.6)); } catch { break; }
    }
    return { frames: out, duration: d };
  })();
  frameCache.set(src, job);
  return job;
}

function ToolButton({ icon, label, onPress, disabled, danger }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
      style={({ hovered }) => ({ flex: 1, minWidth: 64, alignItems: 'center', paddingVertical: 8, borderRadius: 14, opacity: disabled ? 0.35 : 1, backgroundColor: hovered ? 'rgba(255,255,255,0.08)' : 'transparent' })}>
      <MaterialCommunityIcons name={icon} size={24} color={danger ? colors.danger : colors.aura} />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.text, marginTop: 4, textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

export default function SparkClips({ clips, onChange, transition, onTransition, onAdd, onRecord, onBack, onNext, joining, progress, cue }) {
  const { height: winH } = useWindowDimensions();
  const v = useRef(null);
  const [sel, setSel] = useState(0);
  const [at, setAt] = useState(0);          // which clip the preview is showing
  const [playing, setPlaying] = useState(false);
  const [now, setNow] = useState(0);        // the preview's time inside that clip (seconds of the original video)
  const [info, setInfo] = useState({});     // uri → { frames, duration }
  const clip = clips[Math.min(sel, clips.length - 1)];
  const total = clipsLength(clips);
  const tooLong = total > MAX_SPARK + 0.5;

  // frames + length for every clip; a new clip starts as its first 60 seconds
  useEffect(() => {
    let alive = true;
    for (const c of clips) {
      if (info[c.uri]) continue;
      framesOf(c.uri).then((r) => {
        if (!alive) return;
        setInfo((m) => ({ ...m, [c.uri]: r }));
        if (c.end == null && r.duration) onChange((list) => list.map((x) => (x.id === c.id && x.end == null ? { ...x, start: 0, end: Math.min(r.duration, MAX_SPARK) } : x)));
      }).catch(() => {});
    }
    return () => { alive = false; };
  }, [clips]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (sel > clips.length - 1) setSel(Math.max(0, clips.length - 1)); }, [clips.length, sel]);

  const show = (i, t) => {
    const c = clips[i]; if (!c) return;
    setAt(i);
    requestAnimationFrame(() => { if (v.current) { v.current.currentTime = t ?? c.start ?? 0; setNow(t ?? c.start ?? 0); } });
  };
  const pause = () => { v.current?.pause(); setPlaying(false); };
  const play = async () => {
    if (!clips.length) return;
    const c = clips[at];
    if (v.current && c && (v.current.currentTime < (c.start ?? 0) || v.current.currentTime >= (c.end ?? 1e9) - 0.05)) v.current.currentTime = c.start ?? 0;
    try { await v.current?.play(); setPlaying(true); } catch { setPlaying(false); }
  };
  const onTime = () => {
    const el = v.current; const c = clips[at]; if (!el || !c) return;
    setNow(el.currentTime);
    if (c.end != null && el.currentTime >= c.end - 0.03) {
      if (playing && at + 1 < clips.length) { setAt(at + 1); } // the next clip starts in onMeta
      else { pause(); el.currentTime = c.start ?? 0; }
    }
  };
  const onMeta = () => {
    const c = clips[at]; if (!v.current || !c) return;
    v.current.currentTime = c.start ?? 0;
    if (playing) v.current.play().catch(() => setPlaying(false));
  };
  // the next clip can be the same file (after Split or Duplicate): no reload then, so jump to its start here
  useEffect(() => {
    const el = v.current; const c = clips[at];
    if (!el || !c || el.readyState < 1) return;
    if (el.currentTime < (c.start ?? 0) - 0.05 || el.currentTime > (c.end ?? 1e9)) el.currentTime = c.start ?? 0;
    if (playing) el.play().catch(() => setPlaying(false));
  }, [at]); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = (i) => { pause(); setSel(i); show(i); };

  // ---------- editing the clip list ----------
  const update = (i, patch) => onChange((list) => list.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const move = (d) => {
    const j = sel + d; if (j < 0 || j >= clips.length) return;
    pause();
    onChange((list) => { const l = [...list]; [l[sel], l[j]] = [l[j], l[sel]]; return l; });
    setSel(j); setAt(j);
  };
  const remove = () => { pause(); onChange((list) => list.filter((_, k) => k !== sel)); setSel(Math.max(0, sel - 1)); setAt(Math.max(0, sel - 1)); };
  const duplicate = () => { pause(); onChange((list) => [...list.slice(0, sel + 1), { ...list[sel], id: newClipId() }, ...list.slice(sel + 1)]); setSel(sel + 1); };
  // split the selected clip where the preview is (it must be showing this clip, at least 0.5 s from either end)
  const canSplit = at === sel && clip && clip.end != null && now - clip.start >= 0.5 && clip.end - now >= 0.5;
  const split = () => {
    if (!canSplit) return;
    pause();
    const t = Math.round(now * 100) / 100;
    onChange((list) => [...list.slice(0, sel), { ...list[sel], end: t }, { ...list[sel], id: newClipId(), start: t }, ...list.slice(sel + 1)]);
  };

  const previewH = Math.min(winH * 0.42, 420);
  const previewW = previewH * 9 / 16;
  const cur = clips[at];
  const before = clips.slice(0, at).reduce((s, c) => s + Math.max(0, (c.end ?? 0) - (c.start ?? 0)), 0);
  const fr = clip ? info[clip.uri] : null;

  if (joining) {
    return (
      <View style={{ flex: 1, backgroundColor: '#07060c', alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
        <ActivityIndicator color={colors.aura} size="large" />
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 20, color: colors.text, marginTop: space.lg, textAlign: 'center' }}>Joining your {clips.length} clips into one Spark</Text>
        <View style={{ width: '100%', maxWidth: 320, height: 8, borderRadius: 4, backgroundColor: colors.border, marginTop: space.lg, overflow: 'hidden' }}>
          <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${Math.round((progress || 0) * 100)}%`, height: 8 }} />
        </View>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.text, marginTop: 10 }}>{Math.round((progress || 0) * 100)}%</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.muted, marginTop: space.md, textAlign: 'center', maxWidth: 340 }}>
          This takes about as long as the Spark itself ({fmt(total)}). Keep this screen open until it’s done.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#07060c' }}>
      <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg }}>
        <Pressable onPress={onBack} hitSlop={12} accessibilityLabel="Back"><Ionicons name="arrow-back" size={26} color={colors.text} /></Pressable>
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 17, color: colors.text }}>Clips · {clips.length}</Text>
        <Pressable onPress={() => { pause(); onNext(); }} disabled={tooLong || !clips.length || clips.some((c) => c.end == null)}
          style={{ height: 36, paddingHorizontal: 16, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', opacity: tooLong || !clips.length ? 0.4 : 1 }}>
          <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          <Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: 14 }}>Next: Edit</Text>
        </Pressable>
      </View>

      {/* the preview plays every clip in order, like the finished Spark */}
      <View style={{ alignItems: 'center' }}>
        <Pressable onPress={() => (playing ? pause() : play())} style={{ width: previewW, height: previewH, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' }}>
          {cur ? <video ref={v} key={cur.uri} src={cur.uri} playsInline preload="auto" onLoadedMetadata={onMeta} onTimeUpdate={onTime}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : null}
          {!playing ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="play" size={28} color="#fff" style={{ marginLeft: 3 }} /></View>
            </View>
          ) : null}
          <View pointerEvents="none" style={{ position: 'absolute', top: 8, left: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.55)' }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 11.5, color: '#fff' }}>Clip {at + 1} of {clips.length}</Text>
          </View>
          <View pointerEvents="none" style={{ position: 'absolute', bottom: 8, right: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.55)' }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: '#fff' }}>{fmt(before + Math.max(0, now - (cur?.start ?? 0)))} / {fmt(total)}</Text>
          </View>
        </Pressable>
      </View>

      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, textAlign: 'center', marginTop: 8, color: tooLong ? colors.danger : colors.muted }}>
        {tooLong ? `Total ${fmt(total)}: trim or remove clips to get to 1:00 or less` : `Total ${fmt(total)} of 1:00 max`}
      </Text>

      {/* the timeline: every clip in order, then add more */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: space.sm }} contentContainerStyle={{ paddingHorizontal: space.md, alignItems: 'center' }}>
        {clips.map((c, i) => {
          const f = info[c.uri]?.frames?.[1] || info[c.uri]?.frames?.[0];
          const on = i === sel;
          return (
            <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
              {i > 0 ? <MaterialCommunityIcons name={transition === 'cut' ? 'drag-vertical-variant' : transition === 'fade' ? 'circle-half-full' : 'flash'} size={16} color={colors.dim} style={{ marginHorizontal: 2 }} /> : null}
              <Pressable onPress={() => choose(i)} accessibilityLabel={`Clip ${i + 1}`} accessibilityState={{ selected: on }}
                style={{ width: 66, height: 104, borderRadius: 12, overflow: 'hidden', borderWidth: on ? 3 : 1, borderColor: on ? colors.spark : colors.border, backgroundColor: '#1a1828' }}>
                {f ? <img src={f} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ActivityIndicator color={colors.dim} style={{ marginTop: 40 }} />}
                <View style={{ position: 'absolute', top: 4, left: 4, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: on ? colors.spark : 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#fff' }}>{i + 1}</Text>
                </View>
                <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 2, backgroundColor: 'rgba(0,0,0,0.6)' }}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: '#fff', textAlign: 'center' }}>{c.end != null ? fmt(c.end - c.start) : '…'}</Text>
                </View>
              </Pressable>
            </View>
          );
        })}
        <Pressable onPress={() => { pause(); onAdd(); }} accessibilityLabel="Add videos"
          style={{ width: 66, height: 104, borderRadius: 12, marginLeft: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.aura, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={26} color={colors.aura} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.text, textAlign: 'center', marginTop: 2 }}>Add{'\n'}videos</Text>
        </Pressable>
        {onRecord ? (
          <Pressable onPress={() => { pause(); onRecord(); }} accessibilityLabel="Record a clip"
            style={{ width: 66, height: 104, borderRadius: 12, marginLeft: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.spark, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="videocam" size={22} color={colors.spark} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.text, textAlign: 'center', marginTop: 4 }}>Record{'\n'}a clip</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* the selected clip */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: space.lg, paddingBottom: 40 }}>
        {clip ? (
          <>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.text }}>
              Clip {sel + 1} of {clips.length}{clip.end != null ? ` · keeping ${fmt(clip.start)} – ${fmt(clip.end)} (${Math.round(clip.end - clip.start)} s)` : ''}
            </Text>
            {fr?.duration && clip.end != null ? (
              <View style={{ marginTop: 10 }}>
                <RangeSlider start={clip.start} end={clip.end} min={0} max={fr.duration} minGap={0.5} height={52}
                  onChange={(s, en, which) => { update(sel, { start: s, end: en }); pause(); setAt(sel); if (v.current) v.current.currentTime = which === 'start' ? s : Math.max(s, en - 0.1); setNow(which === 'start' ? s : en); }}>
                  <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row' }}>
                    {fr.frames.map((f, i) => <img key={i} src={f} alt="" style={{ flex: 1, width: `${100 / fr.frames.length}%`, height: '100%', objectFit: 'cover' }} />)}
                  </View>
                </RangeSlider>
                <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 6 }}>Drag the pink handles to keep only the part you want from this clip.</Text>
              </View>
            ) : <Text style={{ fontFamily: fonts.body, color: colors.muted, marginTop: 8 }}>Loading the clip…</Text>}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space.md, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingVertical: 4 }}>
              <ToolButton icon="arrow-left-bold" label="Move left" onPress={() => move(-1)} disabled={sel === 0} />
              <ToolButton icon="arrow-right-bold" label="Move right" onPress={() => move(1)} disabled={sel >= clips.length - 1} />
              <ToolButton icon="content-cut" label="Split here" onPress={split} disabled={!canSplit} />
              <ToolButton icon="content-copy" label="Duplicate" onPress={duplicate} disabled={clips.length >= 20} />
              <ToolButton icon="trash-can-outline" label="Delete" onPress={remove} disabled={clips.length <= 1} danger />
            </View>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.muted, marginTop: 8 }}>
              Split here: play or seek the preview to the moment you want, then tap Split here to cut this clip in two.
            </Text>
          </>
        ) : null}

        {clips.length > 1 ? (
          <>
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.text, marginTop: space.lg }}>Between clips</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              {TRANSITIONS.map(([k, label]) => {
                const on = transition === k;
                return (
                  <Pressable key={k} onPress={() => onTransition(k)} style={{ paddingHorizontal: 16, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
                    borderColor: on ? colors.spark : 'rgba(255,255,255,0.18)', backgroundColor: on ? 'rgba(255,107,157,0.18)' : 'rgba(255,255,255,0.06)' }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 13.5, color: on ? colors.text : colors.muted }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, marginTop: 6 }}>
              {transition === 'cut' ? 'Cut: one clip straight after the other.' : transition === 'fade' ? 'Fade: a quick fade through black between clips.' : 'Flash: a quick white flash between clips.'}
            </Text>
          </>
        ) : null}
        <Text style={{ fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.dim, marginTop: space.lg }}>
          Next joins your clips into one video. Then add text, music, filters, stickers and more in Spark Studio.
        </Text>
        {cue ? <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.dim, marginTop: space.md, lineHeight: 18 }}>{cue}</Text> : null}
      </ScrollView>
    </View>
  );
}
