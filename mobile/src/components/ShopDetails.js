// "Details" strip under a Soul Shop product: close-up images from the product sheet.
// Tap one to open it full screen; pinch, double-tap or scroll to zoom, drag to look around.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, PanResponder, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, space } from '../lib/theme';
import { touchScreen } from './Product3DViewer';

const web = Platform.OS === 'web';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (t) => Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);

function ZoomImage({ source, w, h }) {
  const [z, setZ] = useState({ s: 1, x: 0, y: 0 });
  const cur = useRef(z); cur.current = z;
  const g = useRef({}); const box = useRef(null);
  const fix = (s, x, y) => { const lx = ((s - 1) * w) / 2; const ly = ((s - 1) * h) / 2; return { s, x: clamp(x, -lx, lx), y: clamp(y, -ly, ly) }; };
  useEffect(() => setZ({ s: 1, x: 0, y: 0 }), [source]);
  const pr = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      const now = Date.now();
      if (now - (g.current.tap || 0) < 280) { setZ((c) => (c.s > 1.2 ? { s: 1, x: 0, y: 0 } : { s: 2.5, x: 0, y: 0 })); g.current.tap = 0; }
      else g.current.tap = now;
      g.current.start = { ...cur.current }; g.current.pinch = null;
    },
    onPanResponderMove: (e, s) => {
      const t = e.nativeEvent.touches || [];
      if (t.length >= 2) {
        if (!g.current.pinch) { g.current.pinch = { d: dist(t), s: cur.current.s }; return; }
        const ns = clamp(g.current.pinch.s * (dist(t) / g.current.pinch.d), 1, 4);
        setZ((c) => fix(ns, c.x, c.y)); return;
      }
      if (g.current.pinch) { g.current.pinch = null; g.current.start = { ...cur.current, ox: s.dx, oy: s.dy }; return; }
      const st = g.current.start;
      setZ(fix(cur.current.s, st.x + s.dx - (st.ox || 0), st.y + s.dy - (st.oy || 0)));
    },
  }), [w, h]);
  useEffect(() => {
    if (!web || !box.current?.addEventListener) return undefined;
    const el = box.current;
    const onWheel = (ev) => { ev.preventDefault(); const c = cur.current; const ns = clamp(c.s * Math.exp(-ev.deltaY * 0.002), 1, 4); setZ(fix(ns, c.x, c.y)); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [w, h]);
  return (
    <View ref={box} {...pr.panHandlers} style={[{ width: w, height: h, overflow: 'hidden' }, web ? { touchAction: 'none', cursor: z.s > 1 ? 'grab' : 'zoom-in' } : null]}>
      <View pointerEvents="none" style={{ width: w, height: h, transform: [{ translateX: z.x }, { translateY: z.y }, { scale: z.s }] }}>
        <Image source={source} style={{ width: w, height: h }} contentFit="contain" transition={120} />
      </View>
    </View>
  );
}

export default function ShopDetails({ items, accent = colors.aura }) {
  const [open, setOpen] = useState(-1);
  const { width, height } = useWindowDimensions();
  if (!items?.length) return null;
  const vw = Math.min(width, 900); const vh = Math.min(height - 150, vw * 1.1);
  const it = items[open];
  return (
    <View style={{ marginTop: space.lg }}>
      <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.4, color: accent, marginHorizontal: space.lg }}>DETAILS</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: 10 }}>
        {items.map((d, i) => (
          <Pressable key={d.label} onPress={() => setOpen(i)} accessibilityRole="imagebutton" accessibilityLabel={`${d.label}, open close-up`}
            style={({ pressed }) => ({ width: 112, marginRight: 10, transform: [{ scale: pressed ? 0.96 : 1 }], ...(web ? { cursor: 'pointer' } : {}) })}>
            <View style={{ width: 112, height: 112, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(176,143,255,0.2)', backgroundColor: '#0e0c16' }}>
              <Image source={d.image} style={{ width: 112, height: 112 }} contentFit="cover" transition={150} />
            </View>
            <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.muted, marginTop: 6, textAlign: 'center' }}>{d.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={open >= 0} transparent animationType="fade" onRequestClose={() => setOpen(-1)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: 'rgba(5,4,10,0.98)', alignItems: 'center', justifyContent: 'center' }}>
          {it ? <ZoomImage source={it.image} w={vw} h={vh} /> : null}
          <View style={{ position: 'absolute', top: 48, left: 16, right: 16, flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.text }}>{it?.label}</Text>
            <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted, marginRight: 14 }}>{open + 1} / {items.length}</Text>
            <Pressable onPress={() => setOpen(-1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close"
              style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <MaterialCommunityIcons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>
          <View style={{ position: 'absolute', bottom: 40, flexDirection: 'row', alignItems: 'center' }}>
            {[['chevron-left', -1, 'Previous'], ['chevron-right', 1, 'Next']].map(([ic, d, lab]) => (
              <Pressable key={ic} onPress={() => setOpen((o) => (o + d + items.length) % items.length)} accessibilityRole="button" accessibilityLabel={lab}
                style={{ width: 46, height: 46, borderRadius: 23, marginHorizontal: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.1)' }}>
                <MaterialCommunityIcons name={ic} size={26} color={colors.text} />
              </Pressable>
            ))}
          </View>
          <Text style={{ position: 'absolute', bottom: 16, fontFamily: fonts.body, fontSize: 11, color: colors.dim }}>
            {touchScreen ? 'Pinch or double-tap to zoom · drag to look around' : 'Scroll or double-click to zoom · drag to look around'}
          </Text>
        </View>
      </Modal>
    </View>
  );
}
