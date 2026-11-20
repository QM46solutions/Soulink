// Frame a post's photos before posting. Posts show as squares, so each photo sits behind a square window:
// drag to choose the part that shows, pinch (or − / +, or the mouse wheel) to zoom. What's inside the frame is
// exactly what the post will show: "Done" cuts that square out (1080 × 1080) before anything is uploaded.
// Several photos are framed one after another (Back / Next). The original is kept, so framing again later starts
// from the full photo at the framing you chose, not from the cut-down copy.
// items: [{ uri, src?, frame? }]; onDone(items) gives each back as { uri: <cut copy>, src: <original>, frame }.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, PanResponder, Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { colors, fonts, gradients, space, btnH } from '../lib/theme';

const MAX_ZOOM = 5;
const OUT = 1080;

function Framer({ src, frame0, side, onChange }) {
  const [size, setSize] = useState(null); // the photo's own pixel size
  const [zoom, setZoom] = useState(frame0?.zoom || 1);
  const [pos, setPos] = useState(frame0?.pos || { x: 0, y: 0 });
  const [moving, setMoving] = useState(false);
  const live = useRef({ zoom, pos, size: null });
  const g = useRef({});

  useEffect(() => {
    setSize(null);
    Image.getSize(src, (w, h) => setSize({ w, h }), () => setSize({ w: side, h: side }));
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  const base = size ? Math.max(side / size.w, side / size.h) : 1; // zoom 1 = the photo just covers the frame
  const clamp = (p, z) => {
    const sz = live.current.size; if (!sz) return p;
    const b = Math.max(side / sz.w, side / sz.h);
    const mx = Math.max(0, (sz.w * b * z - side) / 2); const my = Math.max(0, (sz.h * b * z - side) / 2);
    return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) };
  };
  live.current = { zoom, pos, size };
  useEffect(() => { if (size) onChange({ zoom, pos, size, base }); }, [zoom, pos, size]); // eslint-disable-line react-hooks/exhaustive-deps

  const dist = (t) => Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      g.current = { pos: live.current.pos, zoom: live.current.zoom, d: 0, dx: 0, dy: 0 };
      const t = e.nativeEvent.touches; if (t?.length >= 2) g.current.d = dist(t);
      setMoving(true);
    },
    onPanResponderMove: (e, s) => {
      const t = e.nativeEvent.touches;
      if (t?.length >= 2) { // pinch: zoom by how far the fingers moved apart
        if (!g.current.d) { g.current = { ...g.current, d: dist(t), zoom: live.current.zoom, pos: live.current.pos, dx: s.dx, dy: s.dy }; return; }
        const z = Math.min(MAX_ZOOM, Math.max(1, g.current.zoom * (dist(t) / g.current.d)));
        setZoom(z); setPos((p) => clamp(p, z));
        return;
      }
      if (g.current.d) { g.current = { pos: live.current.pos, zoom: live.current.zoom, d: 0, dx: s.dx, dy: s.dy }; return; } // a finger lifted: carry on moving from here
      setPos(clamp({ x: g.current.pos.x + s.dx - g.current.dx, y: g.current.pos.y + s.dy - g.current.dy }, live.current.zoom));
    },
    onPanResponderRelease: () => setMoving(false),
    onPanResponderTerminate: () => setMoving(false),
  }), [side]); // eslint-disable-line react-hooks/exhaustive-deps

  const zoomTo = (z) => { const nz = Math.min(MAX_ZOOM, Math.max(1, z)); setZoom(nz); setPos((p) => clamp(p, nz)); };
  const wheel = Platform.OS === 'web' ? { onWheel: (e) => { e.preventDefault?.(); zoomTo(live.current.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)); } } : {};

  return (
    <View style={{ alignItems: 'center' }}>
      <View {...pan.panHandlers} {...wheel} style={{ width: side, height: side, borderRadius: 20, overflow: 'hidden', backgroundColor: '#000', cursor: 'grab' }}>
        {size ? (
          <Image source={{ uri: src }} style={{ position: 'absolute', width: size.w * base, height: size.h * base,
            left: (side - size.w * base) / 2, top: (side - size.h * base) / 2,
            transform: [{ translateX: pos.x }, { translateY: pos.y }, { scale: zoom }] }} />
        ) : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.aura} /></View>}
        {/* thirds, to line things up (stronger while you move it) */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: moving ? 0.9 : 0.35 }}>
          {[1, 2].map((k) => <View key={`v${k}`} style={{ position: 'absolute', top: 0, bottom: 0, left: (side * k) / 3, width: 1, backgroundColor: 'rgba(255,255,255,0.55)' }} />)}
          {[1, 2].map((k) => <View key={`h${k}`} style={{ position: 'absolute', left: 0, right: 0, top: (side * k) / 3, height: 1, backgroundColor: 'rgba(255,255,255,0.55)' }} />)}
        </View>
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 20, borderWidth: 2, borderColor: 'rgba(176,143,255,0.85)' }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.lg }}>
        <Pressable onPress={() => zoomTo(zoom / 1.25)} hitSlop={8} accessibilityLabel="Zoom out" style={round}><Ionicons name="remove" size={22} color={colors.text} /></Pressable>
        <View style={{ width: 120, height: 4, borderRadius: 2, marginHorizontal: space.md, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
          <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${((zoom - 1) / (MAX_ZOOM - 1)) * 100}%`, height: 4 }} />
        </View>
        <Pressable onPress={() => zoomTo(zoom * 1.25)} hitSlop={8} accessibilityLabel="Zoom in" style={round}><Ionicons name="add" size={22} color={colors.text} /></Pressable>
        <Pressable onPress={() => { setZoom(1); setPos({ x: 0, y: 0 }); }} hitSlop={8} accessibilityLabel="Reset framing" style={[round, { marginLeft: space.md }]}><Ionicons name="refresh" size={19} color={colors.text} /></Pressable>
      </View>
    </View>
  );
}
const round = { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(176,143,255,0.3)' };

/** Cuts the framed square out of the original photo. */
async function cut(src, f, side) {
  const { zoom, pos, size } = f;
  const k = Math.max(side / size.w, side / size.h) * zoom; // screen px per photo px
  const box = Math.min(size.w, size.h, side / k);
  const x = Math.max(0, Math.min(size.w - box, size.w / 2 - pos.x / k - box / 2));
  const y = Math.max(0, Math.min(size.h - box, size.h / 2 - pos.y / k - box / 2));
  const outSide = Math.min(OUT, Math.round(box));
  const r = await manipulateAsync(src, [
    { crop: { originX: Math.round(x), originY: Math.round(y), width: Math.round(box), height: Math.round(box) } },
    { resize: { width: outSide, height: outSide } },
  ], { compress: 0.88, format: SaveFormat.JPEG });
  return r.uri;
}

export default function FramePhoto({ visible, items = [], startAt = 0, onCancel, onDone }) {
  const { width, height } = useWindowDimensions();
  const side = Math.round(Math.min(width - 32, height - 300, 480));
  const [i, setI] = useState(startAt);
  const frames = useRef({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (visible) { setI(startAt); frames.current = {}; } }, [visible, startAt]);
  if (!visible || !items.length) return null;
  const it = items[i]; const src = it.src || it.uri;
  const last = i === items.length - 1;

  const finish = async () => {
    setBusy(true);
    try {
      const out = [];
      for (let k = 0; k < items.length; k += 1) {
        const x = items[k]; const s0 = x.src || x.uri; const f = frames.current[k];
        if (!f) { out.push(x); continue; }
        // untouched (centre, no zoom) and never framed before: the post shows the same middle square anyway
        const untouched = f.zoom === 1 && !f.pos.x && !f.pos.y && !x.frame;
        out.push(untouched ? x : { ...x, uri: await cut(s0, f, side), src: s0, frame: { zoom: f.zoom, pos: f.pos } });
      }
      onDone(out);
    } catch { onDone(items); } finally { setBusy(false); }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.void }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg }}>
            <Pressable onPress={onCancel} hitSlop={10} accessibilityLabel="Cancel framing"><Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.muted }}>Cancel</Text></Pressable>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.displayBold, fontSize: 17, color: colors.text }}>Frame your photo</Text>
              {items.length > 1 ? <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.dim, marginTop: 1 }}>{i + 1} of {items.length}</Text> : null}
            </View>
            <View style={{ width: 52 }} />
          </View>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Framer key={i} src={src} frame0={it.frame} side={side} onChange={(f) => { frames.current[i] = f; }} />
            <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: space.lg, paddingHorizontal: space.xl }}>
              Drag to choose what shows. Pinch to zoom. Your post shows exactly this square.
            </Text>
          </View>
          <View style={{ flexDirection: 'row', padding: space.lg, gap: 10 }}>
            {i > 0 ? (
              <Pressable onPress={() => setI(i - 1)} style={({ pressed }) => ({ flex: 1, height: btnH(50), borderRadius: 25, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.aura, opacity: pressed ? 0.8 : 1 })}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.text }}>Back</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => (last ? finish() : setI(i + 1))} disabled={busy} accessibilityLabel={last ? 'Done framing' : 'Next photo'}
              style={({ pressed }) => ({ flex: 2, height: btnH(50), borderRadius: 25, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}>
              <LinearGradient colors={gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>{last ? 'Done' : 'Next photo'}</Text>}
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
