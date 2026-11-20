// Fits a full-page screen to whatever phone it is on, with no per-model sizes: it measures the space the
// screen really has and how tall its content is, and if the content is taller it shrinks the whole page evenly
// (text, spacing, buttons) until it fits. It never goes below MIN_SCALE, so text stays readable: a page that
// would need more than that scrolls instead. While the keyboard is open the size stays as it was (the page
// scrolls), so typing never makes the screen jump smaller.
import { useEffect, useRef, useState } from 'react';
import { Keyboard, ScrollView, View } from 'react-native';
import { useKeepFocusedVisible } from '../lib/keyboard';

const MIN_SCALE = 0.75;

export default function FitContent({ children, contentContainerStyle, center = true, ...scrollProps }) {
  const [box, setBox] = useState({ w: 0, h: 0 }); // the space the screen has (inside its padding)
  const [natural, setNatural] = useState(0); // how tall the content is at full size
  const [scale, setScale] = useState(1);
  const keyboard = useRef(false);
  const scrollRef = useRef(null);
  const keep = useKeepFocusedVisible(scrollRef);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => { keyboard.current = true; });
    const hide = Keyboard.addListener('keyboardDidHide', () => { keyboard.current = false; });
    return () => { show.remove(); hide.remove(); };
  }, []);

  // pick the scale whenever the space or the content changes (not while the keyboard is up)
  useEffect(() => {
    if (!box.h || !natural || keyboard.current) return;
    const k = natural > box.h ? box.h / natural : 1;
    const next = k >= 1 ? 1 : Math.max(MIN_SCALE, Math.floor(k * 100) / 100);
    if (Math.abs(next - scale) > 0.01 || (next === 1 && scale !== 1)) setScale(next);
  }, [box.h, natural]); // eslint-disable-line react-hooks/exhaustive-deps

  const pad = flat(contentContainerStyle);
  const padV = (pad.paddingVertical ?? pad.padding ?? 0) * 2 + (pad.paddingTop ?? 0) + (pad.paddingBottom ?? 0);
  const padH = (pad.paddingHorizontal ?? pad.padding ?? 0) * 2 + (pad.paddingLeft ?? 0) + (pad.paddingRight ?? 0);

  const onLayout = (e) => {
    const { width, height } = e.nativeEvent.layout;
    const w = Math.max(0, width - padH); const h = Math.max(0, height - padV);
    if (Math.abs(w - box.w) > 1 || (Math.abs(h - box.h) > 1 && !keyboard.current)) setBox({ w, h: keyboard.current ? box.h : h });
  };

  const scaled = scale < 1 && box.w > 0;
  return (
    <ScrollView
      {...scrollProps}
      ref={scrollRef}
      onScroll={keep.onScroll}
      scrollEventThrottle={16}
      onLayout={onLayout}
      contentContainerStyle={[{ flexGrow: 1, justifyContent: center ? 'center' : 'flex-start' }, contentContainerStyle]}
    >
      {/* The page is laid out at full size in a wider box, then shrunk to fit; the outer box takes the shrunk height. */}
      <View style={scaled ? { height: natural * scale, width: box.w, alignSelf: 'center', overflow: 'visible' } : null}>
        <View
          onLayout={(e) => { const h = e.nativeEvent.layout.height; if (Math.abs(h - natural) > 1) setNatural(h); }}
          style={scaled ? { width: box.w / scale, transform: [{ scale }], transformOrigin: 'top left' } : null}
        >
          {children}
        </View>
      </View>
    </ScrollView>
  );
}

function flat(style) {
  if (!style) return {};
  if (Array.isArray(style)) return Object.assign({}, ...style.map(flat));
  return style;
}
