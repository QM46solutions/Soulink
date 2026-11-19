// Interactive product viewer for Soul Shop.
// Shows a product as a sequence of frames taken evenly round it (rows = camera heights, if there are several).
// Drag left/right to turn it, up/down to change height (only when there is more than one row), pinch or
// mouse wheel / trackpad to zoom, Reset to go back to the start. loop=false means the frames cover only part
// of a turn (e.g. front to back): turning stops at each end and a small marker shows where you are.
// Plain images + touch handling only: works on Android, iPhone and the web with no new native code.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Platform, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Asset } from 'expo-asset';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../lib/theme';

const web = Platform.OS === 'web';
const MAX_ZOOM = 3;
const wrap = (n, m) => ((n % m) + m) % m;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (t) => Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
const mid = (t) => ({ x: (t[0].pageX + t[1].pageX) / 2, y: (t[0].pageY + t[1].pageY) / 2 });
// top-left of the viewer in page coordinates, from a touch (page position minus position inside the viewer)
const originOf = (ne) => (Number.isFinite(ne?.pageX) && Number.isFinite(ne?.locationX) ? { x: ne.pageX - ne.locationX, y: ne.pageY - ne.locationY } : null);
/** True on phones and tablets (also phone browsers), so hints say "pinch" rather than "scroll". */
export const touchScreen = !web || (typeof window !== 'undefined' && ('ontouchstart' in window || (navigator?.maxTouchPoints || 0) > 0));

/**
 * rows: array of camera heights (low → high), each an array of frames going round the product.
 * poster: still image used while loading and as the fallback.
 */
function Product3DViewer({ rows, poster, size = 320, height: hgt, startRow: sr = 1, loop = true, label = 'product', onInteract }, ref) {
  const frames = rows[0].length;
  const startRow = clamp(sr, 0, rows.length - 1);
  const H = hgt || size;
  const lastYaw = frames - 1;
  const fitYaw = (y) => (loop ? y : clamp(y, 0, lastYaw));
  const [view, setView] = useState({ yaw: 0, row: startRow, zoom: 1, tx: 0, ty: 0 });
  const [state, setState] = useState('loading');          // loading | ready | failed
  const [progress, setProgress] = useState(0);
  const v = useRef(view); v.current = view;
  const g = useRef({});                                    // live gesture bookkeeping
  const box = useRef(null);
  const spin = useRef(null);

  // ---- loading: the starting height first (so it can be used straight away), then the rest in the background
  useEffect(() => {
    let dead = false;
    const order = [startRow, ...rows.map((_, i) => i).filter((i) => i !== startRow)];
    (async () => {
      try {
        const first = rows[order[0]];
        let done = 0;
        await Promise.all(first.map((m) => Asset.fromModule(m).downloadAsync().then(() => { done += 1; if (!dead) setProgress(done / first.length); })));
        if (web) await Image.prefetch(first.map((m) => Asset.fromModule(m).uri)).catch(() => {});
        if (dead) return;
        setState('ready');
        for (const r of order.slice(1)) {
          await Promise.all(rows[r].map((m) => Asset.fromModule(m).downloadAsync().catch(() => {})));
          if (web) await Image.prefetch(rows[r].map((m) => Asset.fromModule(m).uri)).catch(() => {});
          if (dead) return;
        }
      } catch (e) {
        if (!dead) setState('failed');
      }
    })();
    return () => { dead = true; };
  }, [rows, startRow]);

  const stopSpin = () => { if (spin.current) { cancelAnimationFrame(spin.current); spin.current = null; } };
  useEffect(() => stopSpin, []);

  const clampPan = (zoom, tx, ty) => ({ tx: clamp(tx, -((zoom - 1) * size) / 2, ((zoom - 1) * size) / 2), ty: clamp(ty, -((zoom - 1) * H) / 2, ((zoom - 1) * H) / 2) });
  // zoom keeping the point under the fingers / cursor still (px, py measured from the centre)
  const zoomAt = useCallback((next, px = 0, py = 0) => {
    const c = v.current; const z = clamp(next, 1, MAX_ZOOM); const k = z / c.zoom;
    const p = clampPan(z, px - (px - c.tx) * k, py - (py - c.ty) * k);
    setView({ ...c, zoom: z, ...p });
  }, [size, H]);

  const reset = useCallback(() => { stopSpin(); setView({ yaw: 0, row: startRow, zoom: 1, tx: 0, ty: 0 }); }, [startRow]);
  useImperativeHandle(ref, () => ({ reset }), [reset]);

  const turnPx = loop ? size * 1.3 : size * 1.1;   // full turn (or the whole range) for ~1.1-1.3 viewer widths
  const tiltPx = size * 0.55;                // bottom to top height over ~half the viewer height

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: (_, s) => Math.abs(s.dx) + Math.abs(s.dy) > 4,
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
    onPanResponderGrant: (e) => {
      stopSpin(); onInteract?.(true);
      const c = v.current; const ne = e.nativeEvent;
      g.current = { yaw: c.yaw, row: c.row, pinch: null, lastX: 0, lastT: Date.now(), vx: 0, rect: originOf(ne) || g.current.rect };
    },
    onPanResponderMove: (e, s) => {
      const t = e.nativeEvent.touches || [];
      const c = v.current;
      if (t.length >= 2) {                     // pinch: zoom + move with two fingers
        if (!g.current.pinch) {
          const m = mid(t); g.current.rect = originOf(e.nativeEvent) || g.current.rect;
          g.current.pinch = { d: dist(t), zoom: c.zoom, m, tx: c.tx, ty: c.ty };
          return;
        }
        const p = g.current.pinch; const m = mid(t);
        const z = clamp(p.zoom * (dist(t) / p.d), 1, MAX_ZOOM);
        const k = z / p.zoom;
        const rect = g.current.rect || { x: 0, y: 0 };
        const px = p.m.x - rect.x - size / 2; const py = p.m.y - rect.y - H / 2;
        const nx = px - (px - p.tx) * k + (m.x - p.m.x); const ny = py - (py - p.ty) * k + (m.y - p.m.y);
        setView({ ...c, zoom: z, ...clampPan(z, nx, ny) });
        return;
      }
      if (g.current.pinch) {                   // lifted one finger: restart a turn from here
        g.current = { ...g.current, pinch: null, yaw: c.yaw, row: c.row, ox: s.dx, oy: s.dy };
      }
      const dx = s.dx - (g.current.ox || 0); const dy = s.dy - (g.current.oy || 0);
      const now = Date.now(); const dt = Math.max(1, now - g.current.lastT);
      g.current.vx = (s.dx - g.current.lastX) / dt; g.current.lastX = s.dx; g.current.lastT = now;
      setView({ ...c, yaw: fitYaw(g.current.yaw - (dx / turnPx) * frames), row: clamp(g.current.row + (dy / tiltPx) * (rows.length - 1), 0, rows.length - 1) });
    },
    onPanResponderRelease: () => {
      onInteract?.(false);
      // gentle coast after a flick
      let vel = -(g.current.vx || 0) * (frames / turnPx) * 16;
      if (g.current.pinch || Math.abs(vel) < 0.05) return;
      const step = () => {
        vel *= 0.92;
        if (Math.abs(vel) < 0.02) { spin.current = null; return; }
        setView((c) => ({ ...c, yaw: fitYaw(c.yaw + vel) }));
        spin.current = requestAnimationFrame(step);
      };
      spin.current = requestAnimationFrame(step);
    },
    onPanResponderTerminate: () => onInteract?.(false),
  }), [frames, rows.length, size, H, loop, turnPx, tiltPx, onInteract]);

  // remember where the viewer sits on screen (for zooming around the fingers)

  // mouse wheel / trackpad pinch on the web
  useEffect(() => {
    if (!web || !box.current?.addEventListener) return undefined;
    const el = box.current;
    const onWheel = (ev) => {
      ev.preventDefault(); stopSpin();
      const r = el.getBoundingClientRect();
      const px = ev.clientX - r.left - r.width / 2; const py = ev.clientY - r.top - r.height / 2;
      zoomAt(v.current.zoom * Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0018)), px, py);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt, state]);

  const fi = loop ? wrap(Math.round(view.yaw), frames) : clamp(Math.round(view.yaw), 0, lastYaw);
  const ri = clamp(Math.round(view.row), 0, rows.length - 1);
  const moved = fi !== 0 || ri !== startRow || view.zoom > 1.01;
  const source = state === 'ready' ? rows[ri][fi] : poster;

  const a11y = {
    accessible: true,
    accessibilityRole: 'adjustable',
    accessibilityLabel: `3D view of the ${label}`,
    accessibilityHint: 'Swipe up or down to turn it',
    accessibilityValue: loop ? { text: `${fi * (360 / frames)} degrees` } : { min: 0, max: lastYaw, now: fi, text: fi === 0 ? 'front' : fi === lastYaw ? 'back' : 'side' },
    accessibilityActions: [{ name: 'increment' }, { name: 'decrement' }],
    onAccessibilityAction: (ev) => setView((c) => ({ ...c, yaw: fitYaw(Math.round(c.yaw) + (ev.nativeEvent.actionName === 'increment' ? 3 : -3)) })),
  };

  return (
    <View style={{ width: size, height: H }}>
      <View ref={box} {...(state === 'ready' ? responder.panHandlers : {})} {...a11y}
        style={[{ width: size, height: H, overflow: 'hidden', borderRadius: 18, backgroundColor: '#17151d' }, web ? { touchAction: 'none', cursor: state === 'ready' ? 'grab' : 'default', userSelect: 'none' } : null]}>
        <View pointerEvents="none" style={{ width: size, height: H, transform: [{ translateX: view.tx }, { translateY: view.ty }, { scale: view.zoom }] }}>
          <Image source={source} style={{ width: size, height: H }} contentFit="cover" transition={0} cachePolicy="memory-disk"
            onError={() => { if (state === 'ready') setState('failed'); }} />
        </View>
      </View>

      {state === 'loading' ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 6, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 28, borderRadius: 14, backgroundColor: 'rgba(8,7,13,0.7)' }}>
            <ActivityIndicator size="small" color={colors.aura} />
            <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.muted, marginLeft: 8 }}>LOADING 3D VIEW · {Math.round(progress * 100)}%</Text>
          </View>
        </View>
      ) : null}
      {state === 'failed' ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 6, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 28, borderRadius: 14, backgroundColor: 'rgba(8,7,13,0.7)' }}>
            <MaterialCommunityIcons name="image-off-outline" size={14} color={colors.muted} />
            <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.muted, marginLeft: 6 }}>3D view couldn't load. Showing the front.</Text>
          </View>
        </View>
      ) : null}

      {state === 'ready' && !loop ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 12, top: 12, flexDirection: 'row', alignItems: 'center', height: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: 'rgba(8,7,13,0.72)' }}>
          <Text style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1, color: fi === 0 ? colors.text : colors.muted }}>FRONT</Text>
          <View style={{ width: 54, height: 3, borderRadius: 2, marginHorizontal: 7, backgroundColor: 'rgba(255,255,255,0.18)' }}>
            <View style={{ position: 'absolute', top: -2.5, left: (fi / lastYaw) * 46, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.aura }} />
          </View>
          <Text style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1, color: fi === lastYaw ? colors.text : colors.muted }}>BACK</Text>
        </View>
      ) : null}
      {state === 'ready' && moved ? (
        <Pressable onPress={reset} hitSlop={8} accessibilityRole="button" accessibilityLabel="Reset view"
          style={({ pressed, hovered }) => ({ position: 'absolute', right: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', height: 30, paddingHorizontal: 11, borderRadius: 15, backgroundColor: hovered || pressed ? 'rgba(124,92,252,0.35)' : 'rgba(8,7,13,0.65)', borderWidth: 1, borderColor: 'rgba(176,143,255,0.35)', ...(web ? { cursor: 'pointer' } : {}) })}>
          <MaterialCommunityIcons name="restore" size={15} color={colors.text} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.text, marginLeft: 5 }}>Reset</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default forwardRef(Product3DViewer);
