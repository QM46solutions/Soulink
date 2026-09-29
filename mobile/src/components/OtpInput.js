// Six separate boxes for a one-time code. One hidden text field does the typing,
// so paste, SMS auto-fill and backspace all work normally.
import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius } from '../lib/theme';

export default function OtpInput({ value, onChange, length = 6, error, autoFocus = true, onComplete }) {
  const ref = useRef(null);
  const [focused, setFocused] = useState(false);
  const digits = value.split('');

  const change = (t) => {
    const clean = t.replace(/\D/g, '').slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
  };

  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityLabel="Enter the 6-digit code" style={st.row}>
      {Array.from({ length }, (_, i) => {
        const active = focused && (i === digits.length || (i === length - 1 && digits.length === length));
        const filled = i < digits.length;
        return (
          <View key={i} style={[st.box, filled && st.boxFilled, active && st.boxActive, error && st.boxError]}>
            <Text style={st.digit}>{digits[i] ?? ''}</Text>
            {active && !filled ? <View style={st.caret} /> : null}
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={change}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        maxLength={length}
        autoFocus={autoFocus}
        caretHidden
        style={st.hidden}
        accessibilityLabel="Code"
      />
    </Pressable>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: {
    flex: 1, maxWidth: 52, aspectRatio: 0.82, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center',
  },
  boxFilled: { borderColor: 'rgba(176,143,255,0.55)', backgroundColor: 'rgba(124,92,252,0.10)' },
  boxActive: { borderColor: colors.soul, borderWidth: 1.5 },
  boxError: { borderColor: colors.danger },
  digit: { color: colors.text, fontFamily: fonts.display, fontSize: 24 },
  caret: { position: 'absolute', width: 2, height: 24, borderRadius: 1, backgroundColor: colors.aura },
  hidden: { position: 'absolute', opacity: 0.01, width: 1, height: 1, left: 0, top: 0 },
});
