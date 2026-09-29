// Speak instead of typing. In browsers (Chrome, Safari) it uses the built-in speech-to-text.
// On phones the keyboard's own mic does the same, so we show a tip there.
import { useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../lib/theme';

const Recognition = Platform.OS === 'web' && typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

export default function MicButton({ onText }) {
  const [listening, setListening] = useState(false);
  const [tip, setTip] = useState(null);
  const rec = useRef(null);

  const toggle = () => {
    if (!Recognition) { setTip('Tap the 🎤 on your keyboard to speak'); setTimeout(() => setTip(null), 3500); return; }
    if (listening) { rec.current?.stop(); return; }
    const r = new Recognition();
    r.lang = 'en-IN';
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      const text = Array.from(e.results).slice(e.resultIndex).filter((x) => x.isFinal).map((x) => x[0].transcript).join(' ');
      if (text.trim()) onText(text.trim());
    };
    r.onend = () => setListening(false);
    r.onerror = () => { setListening(false); setTip('Mic not available. Allow the microphone, or type instead.'); setTimeout(() => setTip(null), 3500); };
    rec.current = r;
    r.start();
    setListening(true);
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <Pressable onPress={toggle} accessibilityLabel={listening ? 'Stop listening' : 'Speak'}
        style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999, borderWidth: 1.5,
          borderColor: listening ? colors.spark : hovered ? colors.aura : colors.border, backgroundColor: listening ? 'rgba(255,107,157,0.15)' : 'rgba(26,24,40,0.6)' })}>
        <Ionicons name={listening ? 'stop-circle' : 'mic'} size={18} color={listening ? colors.spark : colors.aura} />
        <Text style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 14, marginLeft: 6 }}>{listening ? 'Listening… tap to stop' : 'Speak instead'}</Text>
      </Pressable>
      {tip ? <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 12, marginTop: 6 }}>{tip}</Text> : null}
    </View>
  );
}
