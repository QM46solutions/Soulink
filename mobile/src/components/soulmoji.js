// Soulmoji: stickers made from YOUR face. Type a feeling ("so done with Monday") and Soulink picks the
// mood, then draws your face photo with that mood's colours, effects and a caption. Only your own
// verified face photo is ever used. (v1 draws the effects around your photo; fully AI-redrawn
// expressions arrive with the cloud move.)
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { mediaUrl } from '../lib/api';
import { colors, fonts, space } from '../lib/theme';

export const MOODS = {
  happy:    { label: 'Happy',    emoji: '😊', ring: ['#ffd36e', '#ff9f43'], tint: null,                       deco: ['✨', '✨'], motion: 'bounce' },
  laugh:    { label: 'LOL',      emoji: '😂', ring: ['#ffe066', '#ff6b9d'], tint: null,                       deco: ['😂', '💦'], motion: 'shake' },
  love:     { label: 'Love',     emoji: '😍', ring: ['#ff6b9d', '#ff2e63'], tint: 'rgba(255,46,99,0.12)',     deco: ['💖', '💕'], motion: 'pulse' },
  sad:      { label: 'Sad',      emoji: '🥺', ring: ['#6ea8ff', '#4a5cff'], tint: 'rgba(74,92,255,0.22)',     deco: ['💧', '🌧️'], motion: 'droop' },
  cry:      { label: 'Crying',   emoji: '😭', ring: ['#4fc3f7', '#2d6bff'], tint: 'rgba(45,107,255,0.25)',    deco: ['💧', '💧'], motion: 'shake' },
  angry:    { label: 'Angry',    emoji: '😤', ring: ['#ff5c5c', '#c0392b'], tint: 'rgba(255,40,40,0.25)',     deco: ['💢', '🔥'], motion: 'shake' },
  shocked:  { label: 'Shocked',  emoji: '😱', ring: ['#b08fff', '#42e8c0'], tint: null,                       deco: ['❗', '⚡'], motion: 'pop' },
  tired:    { label: 'So done',  emoji: '😴', ring: ['#8b88a0', '#4a4760'], tint: 'rgba(20,18,40,0.35)',     deco: ['💤', '☕'], motion: 'droop' },
  cool:     { label: 'Cool',     emoji: '😎', ring: ['#42e8c0', '#7c5cfc'], tint: null,                       deco: ['🕶️', '✨'], motion: 'bounce' },
  party:    { label: 'Party',    emoji: '🥳', ring: ['#f5c842', '#ff6b9d'], tint: null,                       deco: ['🎉', '🎊'], motion: 'bounce' },
  thinking: { label: 'Hmm',      emoji: '🤔', ring: ['#b08fff', '#7c5cfc'], tint: null,                       deco: ['💭', '❓'], motion: 'tilt' },
  shy:      { label: 'Shy',      emoji: '😳', ring: ['#ffb3c7', '#ff6b9d'], tint: 'rgba(255,107,157,0.18)',   deco: ['🌸', '💗'], motion: 'tilt' },
};
export const MOOD_KEYS = Object.keys(MOODS);

// Reads a typed feeling and picks a mood (instant, on the phone)
const RULES = [
  ['laugh', /(lol|lmao|rofl|haha|hehe|😂|🤣|dying|funny|joke)/i],
  ['love', /(love|miss you|❤|😍|cute|crush|adore|dil|pyaar|jaan)/i],
  ['cry', /(crying|cry|sob|😭|heartbroken|broke my heart)/i],
  ['sad', /(sad|down|upset|hurt|lonely|🥺|miss|low)/i],
  ['angry', /(angry|mad|furious|annoyed|irritat|hate|😡|😤|rage|gussa)/i],
  ['tired', /(tired|sleepy|exhausted|so done|monday|zzz|bored|sleep|neend)/i],
  ['shocked', /(omg|wow|what\?|shock|seriously|no way|😱|😮|unbelievable|kya)/i],
  ['party', /(party|birthday|bday|celebrat|yay|congrats|won|win|🎉|🥳|result)/i],
  ['cool', /(cool|chill|boss|swag|vibe|😎|sorted|easy)/i],
  ['thinking', /(hmm|think|wonder|confus|not sure|🤔|maybe|idk)/i],
  ['shy', /(shy|blush|embarrass|awkward|😳|oops)/i],
  ['happy', /(happy|good|great|nice|awesome|😊|glad|thanks|thank you|mast)/i],
];
export function detectMood(text) {
  const t = (text || '').trim();
  if (!t) return 'happy';
  for (const [mood, re] of RULES) if (re.test(t)) return mood;
  return 'happy';
}

function useMotion(kind, play) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!play) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: kind === 'shake' ? 120 : 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(a, { toValue: -1, duration: kind === 'shake' ? 240 : 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: kind === 'shake' ? 120 : 700, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.delay(kind === 'shake' ? 900 : 300),
    ]));
    loop.start();
    return () => loop.stop();
  }, [a, kind, play]);
  const t = [];
  if (kind === 'shake') t.push({ rotate: a.interpolate({ inputRange: [-1, 1], outputRange: ['-8deg', '8deg'] }) });
  if (kind === 'tilt') t.push({ rotate: a.interpolate({ inputRange: [-1, 1], outputRange: ['-6deg', '6deg'] }) });
  if (kind === 'bounce' || kind === 'pop') t.push({ translateY: a.interpolate({ inputRange: [-1, 1], outputRange: [3, -6] }) });
  if (kind === 'pulse' || kind === 'pop') t.push({ scale: a.interpolate({ inputRange: [-1, 1], outputRange: [0.96, 1.06] }) });
  if (kind === 'droop') t.push({ translateY: a.interpolate({ inputRange: [-1, 1], outputRange: [-2, 4] }) });
  return t;
}

/** The sticker: your face in a mood-coloured ring, a big mood emoji, little effects, and a caption. */
export function SoulmojiSticker({ faceUrl, mood = 'happy', caption, size = 132, animate = true }) {
  const m = MOODS[mood] || MOODS.happy;
  const transform = useMotion(m.motion, animate);
  const uri = mediaUrl(faceUrl) || faceUrl;
  const inner = size - 10;
  return (
    <View style={{ alignItems: 'center', width: size + 24 }}>
      <Animated.View style={{ width: size, height: size, transform }}>
        <LinearGradient colors={m.ring} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: size / 2, padding: 5 }}>
          <View style={{ width: inner, height: inner, borderRadius: inner / 2, overflow: 'hidden', backgroundColor: colors.card }}>
            {uri ? <Image source={{ uri }} style={{ width: inner, height: inner }} contentFit="cover" /> : null}
            {m.tint ? <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: m.tint }} /> : null}
          </View>
        </LinearGradient>
        <Text style={{ position: 'absolute', top: -size * 0.04, left: -size * 0.06, fontSize: size * 0.2 }}>{m.deco[0]}</Text>
        <Text style={{ position: 'absolute', top: size * 0.08, right: -size * 0.1, fontSize: size * 0.16 }}>{m.deco[1]}</Text>
        <Text style={{ position: 'absolute', bottom: -size * 0.06, right: -size * 0.04, fontSize: size * 0.34 }}>{m.emoji}</Text>
      </Animated.View>
      {caption ? (
        <View style={{ marginTop: 8, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: '#fff', maxWidth: size + 24, transform: [{ rotate: '-3deg' }] }}>
          <Text style={{ color: '#141221', fontFamily: fonts.display, fontSize: Math.max(12, size * 0.11), textAlign: 'center' }} numberOfLines={2}>{caption}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Soulmoji maker, shown above the chat box (inside the phone screen, not a pop-up).
 * Type a feeling → live preview → Send. Or tap any mood.
 */
export function SoulmojiPanel({ faceUrl, onSend, onClose }) {
  const [text, setText] = useState('');
  const [picked, setPicked] = useState(null);
  const mood = picked || detectMood(text);
  const caption = text.trim().slice(0, 40) || MOODS[mood].label;
  const moods = useMemo(() => MOOD_KEYS, []);
  if (!faceUrl) {
    return (
      <View style={{ padding: space.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: 'rgba(14,12,22,0.98)', alignItems: 'center' }}>
        <Text style={{ color: colors.text, fontFamily: fonts.semibold, textAlign: 'center' }}>Soulmojis are made from your face</Text>
        <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', marginTop: 4 }}>Add a profile photo (Edit profile) to start making them.</Text>
        <Text onPress={onClose} style={{ color: colors.aura, fontFamily: fonts.semibold, marginTop: space.md }}>Close</Text>
      </View>
    );
  }
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: 'rgba(14,12,22,0.98)', paddingTop: space.md, paddingBottom: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg }}>
        <Text style={{ flex: 1, color: colors.text, fontFamily: fonts.displayBold, fontSize: 16 }}>Soulmoji</Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close Soulmoji"><Ionicons name="close" size={22} color={colors.muted} /></Pressable>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, marginTop: space.sm }}>
        <SoulmojiSticker faceUrl={faceUrl} mood={mood} caption={caption} size={96} />
        <View style={{ flex: 1, marginLeft: space.md }}>
          <View style={{ borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.inputBg, paddingHorizontal: 14 }}>
            <TextInput value={text} onChangeText={(t) => { setText(t); setPicked(null); }} placeholder="Type a feeling… e.g. so done with Monday"
              placeholderTextColor={colors.dim} maxLength={40} style={{ color: colors.text, fontFamily: fonts.medium, fontSize: 15, minHeight: 46, outlineStyle: 'none' }}
              onSubmitEditing={() => onSend({ mood, caption })} returnKeyType="send" autoFocus />
          </View>
          <Pressable onPress={() => onSend({ mood, caption })} style={({ hovered }) => ({ marginTop: space.sm, borderRadius: 999, overflow: 'hidden', transform: [{ scale: hovered ? 1.02 : 1 }] })}>
            <LinearGradient colors={['#7c5cfc', '#ff6b9d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 10, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontFamily: fonts.bold }}>Send {MOODS[mood].emoji}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.md }}>
        {moods.map((k) => (
          <Pressable key={k} onPress={() => onSend({ mood: k, caption: text.trim().slice(0, 40) || MOODS[k].label })} onHoverIn={() => setPicked(k)}
            style={({ hovered }) => ({ alignItems: 'center', marginHorizontal: 4, padding: 4, borderRadius: 16, backgroundColor: hovered || mood === k ? 'rgba(124,92,252,0.18)' : 'transparent' })}>
            <SoulmojiSticker faceUrl={faceUrl} mood={k} size={52} animate={false} />
            <Text style={{ color: colors.muted, fontFamily: fonts.medium, fontSize: 11, marginTop: 2 }}>{MOODS[k].label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
