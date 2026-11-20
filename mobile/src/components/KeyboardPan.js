// Keeps the field you're typing in visible on every screen of the phone app (like Android's classic "pan" mode).
// Newer Android draws the app edge to edge, so the window no longer shrinks when the keyboard opens and a field low
// on the screen ends up under it. This watches the keyboard and the field that has focus: if the keyboard would
// cover the field, the whole screen slides up just enough (plus a small margin), and slides back when it closes.
// Screens that already make room themselves (chat, bottom sheets, forms with a keyboard-aware scroll) need no slide,
// so they're left alone. Moving to another field while the keyboard is open re-checks.
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Keyboard, Platform, TextInput } from 'react-native';

const MARGIN = 20;

export default function KeyboardPan({ children }) {
  const shift = useRef(new Animated.Value(0)).current;
  const cur = useRef(0);
  const kb = useRef(null); // { top, height } while the keyboard is open
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const apply = (to) => {
      if (Math.abs(to - cur.current) < 2) return;
      cur.current = to;
      Animated.timing(shift, { toValue: -to, duration: 170, useNativeDriver: true }).start();
    };
    const check = () => {
      const k = kb.current; if (!k) return;
      const input = TextInput.State?.currentlyFocusedInput?.();
      if (!input || typeof input.measureInWindow !== 'function') return;
      input.measureInWindow((x, y, w, h) => {
        if (!h && !y) return;
        // on-screen position (already moved by the current slide); a tall box keeps its last ~2 lines in view
        // the field already sits clear of the keyboard (the screen made room itself, e.g. chat): leave it
        if (y + Math.min(h, 120) <= k.top + 1 && cur.current === 0) return;
        const bottom = y + Math.min(h, 120) + MARGIN;
        const next = Math.max(0, Math.min(k.height, cur.current + (bottom - k.top)));
        // never push the field's top off the screen
        apply(Math.min(next, Math.max(0, cur.current + y - 60)));
      });
    };
    let poll = null;
    const onShow = (e) => {
      const top = e?.endCoordinates?.screenY; const height = e?.endCoordinates?.height;
      if (!top || !height) return;
      kb.current = { top: Math.min(top, Dimensions.get('screen').height), height };
      setTimeout(check, Platform.OS === 'ios' ? 260 : 140); // let screens that make room themselves settle first
      clearInterval(poll); poll = setInterval(check, 350);    // another field may get focus while it's open
    };
    const onHide = () => { kb.current = null; clearInterval(poll); poll = null; apply(0); };
    const a = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', onShow);
    const b = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', onHide);
    return () => { a.remove(); b.remove(); clearInterval(poll); };
  }, [shift]);
  return <Animated.View style={{ flex: 1, transform: [{ translateY: shift }] }}>{children}</Animated.View>;
}
