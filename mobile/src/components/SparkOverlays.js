// Text and stickers on top of a Spark. In the studio they can be dragged around and tapped to edit / remove.
import { useRef, useState } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { textStyleOf } from '../lib/sparkEdit';

function Draggable({ x, y, box, onMove, onTap, selected, children }) {
  const start = useRef({ x, y }); const moved = useRef(false);
  const pos = useRef({ x, y }); pos.current = { x, y };
  const cfg = useRef({}); cfg.current = { box, onMove, onTap };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { start.current = { ...pos.current }; moved.current = false; },
    onPanResponderMove: (e, g) => {
      if (Math.abs(g.dx) + Math.abs(g.dy) > 4) moved.current = true;
      const { box: b, onMove: mv } = cfg.current;
      mv?.(Math.max(0.04, Math.min(0.96, start.current.x + g.dx / b.width)), Math.max(0.04, Math.min(0.96, start.current.y + g.dy / b.height)));
    },
    onPanResponderRelease: () => { if (!moved.current) cfg.current.onTap?.(); },
    onPanResponderTerminationRequest: () => false,
  })).current;
  return (
    <View {...pan.panHandlers} style={{ position: 'absolute', left: x * box.width, top: y * box.height, transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
      borderWidth: selected ? 1.5 : 0, borderColor: 'rgba(255,255,255,0.8)', borderStyle: 'dashed', borderRadius: 8, padding: selected ? 4 : 5.5, cursor: 'grab' }}>
      {children}
    </View>
  );
}

/** edit: { texts, stickers }. editable: drag + tap. */
export default function SparkOverlays({ edit, editable, selected, onSelect, onChange }) {
  const [box, setBox] = useState(null);
  const texts = edit?.texts || []; const stickers = edit?.stickers || [];
  if (!texts.length && !stickers.length && !editable) return null;
  const scale = box ? box.width / 360 : 1; // sizes are designed for a 360-wide frame
  const set = (kind, i, patch) => onChange?.({ ...edit, [kind]: (edit[kind] || []).map((it, k) => (k === i ? { ...it, ...patch } : it)) });
  const remove = (kind, i) => { onChange?.({ ...edit, [kind]: (edit[kind] || []).filter((_, k) => k !== i) }); onSelect?.(null); };
  return (
    <View pointerEvents={editable ? 'box-none' : 'none'} onLayout={(e) => setBox(e.nativeEvent.layout)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      {box ? texts.map((t, i) => {
        const sel = selected?.kind === 'texts' && selected.i === i;
        const node = <Text style={[textStyleOf(t.style, t.color, t.size * scale), { maxWidth: box.width * 0.9 }]}>{t.t}</Text>;
        return editable ? (
          <Draggable key={`t${i}`} x={t.x} y={t.y} box={box} selected={sel} onMove={(x, y) => set('texts', i, { x, y })} onTap={() => onSelect?.(sel ? null : { kind: 'texts', i })}>
            {node}
            {sel ? <Pressable onPress={() => remove('texts', i)} hitSlop={8} style={{ position: 'absolute', top: -12, right: -12, width: 24, height: 24, borderRadius: 12, backgroundColor: '#ff5c7a', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={15} color="#fff" /></Pressable> : null}
          </Draggable>
        ) : <View key={`t${i}`} style={{ position: 'absolute', left: t.x * box.width, top: t.y * box.height, transform: [{ translateX: '-50%' }, { translateY: '-50%' }] }}>{node}</View>;
      }) : null}
      {box ? stickers.map((s, i) => {
        const sel = selected?.kind === 'stickers' && selected.i === i;
        const node = <Text style={{ fontSize: s.size * scale, lineHeight: s.size * scale * 1.15 }}>{s.e}</Text>;
        return editable ? (
          <Draggable key={`s${i}`} x={s.x} y={s.y} box={box} selected={sel} onMove={(x, y) => set('stickers', i, { x, y })} onTap={() => onSelect?.(sel ? null : { kind: 'stickers', i })}>
            {node}
            {sel ? <Pressable onPress={() => remove('stickers', i)} hitSlop={8} style={{ position: 'absolute', top: -12, right: -12, width: 24, height: 24, borderRadius: 12, backgroundColor: '#ff5c7a', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={15} color="#fff" /></Pressable> : null}
          </Draggable>
        ) : <View key={`s${i}`} style={{ position: 'absolute', left: s.x * box.width, top: s.y * box.height, transform: [{ translateX: '-50%' }, { translateY: '-50%' }] }}>{node}</View>;
      }) : null}
    </View>
  );
}
