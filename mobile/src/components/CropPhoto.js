// Crop a profile photo: the picked photo sits behind a round window; drag it to position and use − / + to zoom.
// "Use photo" cuts exactly what is inside the circle (square, 640×640) so every profile picture is framed the
// same way. Works on phone and web (the phone's own crop screen isn't available in the browser).
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, PanResponder, Platform, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Button } from './ui';
import { colors, fonts, space } from '../lib/theme';

const FRAME = 290;
const MAX_ZOOM = 4;

export default function CropPhoto({ uri, onCancel, onDone }) {
  const [size, setSize] = useState(null); // original pixel size
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const start = useRef({ x: 0, y: 0 });
  const live = useRef({ zoom: 1, pos: { x: 0, y: 0 } });

  useEffect(() => {
    setSize(null); setZoom(1); setPos({ x: 0, y: 0 });
    if (uri) Image.getSize(uri, (w, h) => setSize({ w, h }), () => setSize({ w: FRAME, h: FRAME }));
  }, [uri]);

  const base = size ? Math.max(FRAME / size.w, FRAME / size.h) : 1; // "cover" the circle at zoom 1
  const clamp = (p, z) => {
    if (!size) return p;
    const mx = Math.max(0, (size.w * base * z - FRAME) / 2);
    const my = Math.max(0, (size.h * base * z - FRAME) / 2);
    return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) };
  };
  live.current = { zoom, pos };

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { start.current = live.current.pos; },
    onPanResponderMove: (_, g) => setPos(clamp({ x: start.current.x + g.dx, y: start.current.y + g.dy }, live.current.zoom)),
  }), [size]); // eslint-disable-line react-hooks/exhaustive-deps

  const zoomTo = (z) => { const nz = Math.min(MAX_ZOOM, Math.max(1, Math.round(z * 10) / 10)); setZoom(nz); setPos((p) => clamp(p, nz)); };

  const done = async () => {
    if (!size) return;
    setBusy(true);
    try {
      const k = base * zoom; // display px per original px
      const side = Math.min(size.w, size.h, FRAME / k);
      let originX = size.w / 2 - pos.x / k - side / 2;
      let originY = size.h / 2 - pos.y / k - side / 2;
      originX = Math.max(0, Math.min(size.w - side, originX));
      originY = Math.max(0, Math.min(size.h - side, originY));
      const out = await manipulateAsync(uri, [
        { crop: { originX: Math.round(originX), originY: Math.round(originY), width: Math.round(side), height: Math.round(side) } },
        { resize: { width: 640, height: 640 } },
      ], { compress: 0.85, format: SaveFormat.JPEG });
      onDone(out.uri);
    } catch { onDone(uri); } finally { setBusy(false); }
  };

  const W = size ? size.w * base * zoom : FRAME;
  const H = size ? size.h * base * zoom : FRAME;
  const btn = (icon, onPress, off) => (
    <Pressable onPress={onPress} disabled={off} hitSlop={8} style={({ hovered }) => ({ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: hovered ? colors.aura : colors.border, backgroundColor: colors.glass, alignItems: 'center', justifyContent: 'center', opacity: off ? 0.35 : 1 })}>
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );

  return (
    <Modal visible={!!uri} transparent animationType="none" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(8,7,13,0.96)', alignItems: 'center', justifyContent: 'center', padding: space.xl }}>
        <View style={{ width: '100%', maxWidth: 400, alignItems: 'center' }}>
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 22, color: colors.text }}>Crop your photo</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted, marginTop: 4, marginBottom: space.xl, textAlign: 'center' }}>Drag to move · use − and + to zoom</Text>

        <View {...pan.panHandlers} style={{ width: FRAME, height: FRAME, overflow: 'hidden', borderRadius: 24, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', cursor: 'grab' }}>
          {size ? (
            <Image source={{ uri }} draggable={false} style={{ width: W, height: H, position: 'absolute', left: (FRAME - W) / 2 + pos.x, top: (FRAME - H) / 2 + pos.y }} />
          ) : <ActivityIndicator color={colors.aura} />}
          {/* dark corners + round window */}
          {Platform.OS === 'web'
            ? <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: FRAME, height: FRAME, borderRadius: FRAME / 2, borderWidth: 2, borderColor: colors.aura, boxShadow: '0 0 0 400px rgba(8,7,13,0.62)' }} />
            : (
              <>
                <View pointerEvents="none" style={{ position: 'absolute', left: -200, top: -200, width: FRAME + 400, height: FRAME + 400, borderRadius: FRAME / 2 + 200, borderWidth: 200, borderColor: 'rgba(8,7,13,0.62)' }} />
                <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: FRAME, height: FRAME, borderRadius: FRAME / 2, borderWidth: 2, borderColor: colors.aura }} />
              </>
            )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.lg }}>
          {btn('remove', () => zoomTo(zoom - 0.2), zoom <= 1)}
          <Text style={{ width: 70, textAlign: 'center', fontFamily: fonts.semibold, color: colors.text }}>{Math.round(zoom * 100)}%</Text>
          {btn('add', () => zoomTo(zoom + 0.2), zoom >= MAX_ZOOM)}
          <View style={{ width: space.md }} />
          {btn('refresh', () => { setZoom(1); setPos({ x: 0, y: 0 }); }, false)}
        </View>

        <View style={{ flexDirection: 'row', alignSelf: 'stretch', marginTop: space.xl }}>
          <Button title="Cancel" variant="secondary" style={{ flex: 1, marginRight: space.sm }} onPress={onCancel} />
          <Button title="Use photo" style={{ flex: 1 }} onPress={done} loading={busy} disabled={!size} />
        </View>
        </View>
      </View>
    </Modal>
  );
}
