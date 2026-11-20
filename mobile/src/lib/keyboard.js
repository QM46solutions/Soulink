// Keeps what you're typing in view when the keyboard opens (phone app; the browser does this itself).
//   useKeepFocusedVisible(scrollRef): when the keyboard opens, finds the text field you're in, measures where it is
//   on screen, and if the keyboard would cover it, scrolls the screen up just enough (plus a small margin).
//   Measuring (not guessing) makes it right whether or not Android has already made the screen shorter.
//   KeyboardScroll: a ScrollView that does that, inside a KeyboardAvoidingView so there's room to scroll, for any
//   screen with text fields. header: true on screens under the app's top bar.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MARGIN = 24;

export function useKeepFocusedVisible(scrollRef, { margin = MARGIN } = {}) {
  const offset = useRef(0);
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    const check = (kbTop) => {
      const input = TextInput.State?.currentlyFocusedInput?.();
      const sv = scrollRef.current;
      if (!input || !sv || typeof input.measureInWindow !== 'function') return;
      input.measureInWindow((x, y, w, h) => {
        if (!h && !y) return;
        // a tall box (a long caption): keep its last ~2 lines in view, not all of it
        const bottom = y + Math.min(h, 120) + margin;
        if (bottom > kbTop) sv.scrollTo?.({ y: Math.max(0, offset.current + (bottom - kbTop)), animated: true });
      });
    };
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      const kbTop = e?.endCoordinates?.screenY;
      if (!kbTop) return;
      // wait for the screen to settle (KeyboardAvoidingView / Android resizing), then measure
      setTimeout(() => check(kbTop), Platform.OS === 'ios' ? 280 : 120);
    });
    return () => show.remove();
  }, [scrollRef, margin]);
  return {
    onScroll: (e) => { offset.current = e.nativeEvent.contentOffset.y; },
    scrollEventThrottle: 16,
  };
}

/** A ScrollView for screens with text fields: room for the keyboard + the field you're in stays visible. */
export const KeyboardScroll = forwardRef(function KeyboardScroll({ header = false, offset: extraOffset = 0, style, wrapStyle, onScroll, children, ...props }, ref) {
  const inner = useRef(null);
  useImperativeHandle(ref, () => inner.current);
  const keep = useKeepFocusedVisible(inner);
  const top = useSafeAreaInsets().top;
  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={(header ? top + 46 : 0) + extraOffset} style={[{ flex: 1 }, wrapStyle]}>
      <ScrollView
        ref={inner}
        keyboardShouldPersistTaps="handled"
        style={style}
        {...props}
        onScroll={(e) => { keep.onScroll(e); onScroll?.(e); }}
        scrollEventThrottle={16}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
});

// Is the on-screen keyboard open? Phones: the keyboard's own show / hide events; browser (iPhone Safari): the
// visible area got much shorter. Used to drop the bottom safe-area gap while the keyboard covers that edge anyway.
export function useKeyboardShown() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !window.visualViewport) return undefined;
      const vv = window.visualViewport;
      const f = () => setOpen(document.documentElement.classList.contains('sl-keyboard') || window.innerHeight - vv.height > 150);
      vv.addEventListener('resize', f); f();
      return () => vv.removeEventListener('resize', f);
    }
    const a = Keyboard.addListener('keyboardDidShow', () => setOpen(true));
    const b = Keyboard.addListener('keyboardDidHide', () => setOpen(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  return open;
}

// Bottom room a sheet / bar needs above the phone's navigation bar or home indicator (none while typing)
export function useBottomInset() {
  const { bottom } = useSafeAreaInsets();
  const kb = useKeyboardShown();
  return kb ? 0 : bottom;
}
