// Soulmoji: YOUR photo with a changed expression. Take one Soulmoji selfie (checked against your Face ID),
// then pick a mood or type a feeling ("so done with Monday"): the server edits the expression on that photo
// (smile, laugh, frown, shock, tears, blush...) and you send it in chat. Older v1 stickers still display.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api, mediaUrl, uploadImage } from '../lib/api';
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
    <View style={{ alignItems: 'center', width: size + 56 }}>
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
        <View style={{ marginTop: 8, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, backgroundColor: '#fff', maxWidth: size + 56, transform: [{ rotate: '-3deg' }] }}>
          <Text style={{ color: '#141221', fontFamily: fonts.displayBold, fontSize: Math.max(11, Math.round(size * 0.095)), lineHeight: Math.max(14, Math.round(size * 0.12)), textAlign: 'center' }} numberOfLines={3}>{caption}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Soulmoji v2 message: your own photo with the expression changed, plus the mood and caption. */
export function SoulmojiPhoto({ imageUrl, mood = 'happy', caption, size = 176 }) {
  const m = MOODS[mood] || MOODS.happy;
  return (
    <View style={{ width: size }}>
      <LinearGradient colors={m.ring} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: 26, padding: 3 }}>
        <Image source={{ uri: mediaUrl(imageUrl) || imageUrl }} style={{ flex: 1, borderRadius: 23, backgroundColor: colors.card }} contentFit="cover" transition={150} />
      </LinearGradient>
      <View style={{ position: 'absolute', left: 8, top: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(8,7,13,0.7)' }}>
        <Text style={{ fontSize: 12 }}>{m.emoji}</Text>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: '#fff', marginLeft: 4 }}>{m.label}</Text>
      </View>
      {caption && caption !== m.label ? (
        <Text numberOfLines={2} style={{ marginTop: 6, fontFamily: fonts.displayBold, fontSize: 14, color: colors.text, textAlign: 'center' }}>{caption}</Text>
      ) : null}
    </View>
  );
}

/**
 * Soulmoji maker, shown above the chat box (inside the phone screen).
 * First time: take your Soulmoji selfie (checked against your Face ID so it's really you).
 * Then: pick a mood (or type a feeling) → Soulink changes the expression on YOUR photo → Send.
 */
export function SoulmojiPanel({ onSend, onClose }) {
  const [face, setFace] = useState(undefined); // undefined = loading, null = no selfie yet
  const [ai, setAi] = useState(false);       // true when the laptop's Soulmoji AI is installed
  const [text, setText] = useState('');
  const [picked, setPicked] = useState(null);
  const [renders, setRenders] = useState({}); // mood -> imageUrl
  const [busy, setBusy] = useState(null);     // 'upload' | 'render'
  const [error, setError] = useState(null);
  const mood = picked || detectMood(text);
  const caption = text.trim().slice(0, 40) || MOODS[mood].label;
  const moods = useMemo(() => MOOD_KEYS, []);

  useEffect(() => { api('/soulmoji/face').then((r) => { setFace(r.faceUrl); setAi(!!r.ai); }).catch(() => setFace(null)); }, []);

  // Render the chosen mood on your photo (the server keeps a copy, so each mood is made once)
  useEffect(() => {
    if (!face || renders[mood]) return undefined;
    let live = true;
    setBusy('render'); setError(null);
    api('/soulmoji/render', { method: 'POST', body: { mood }, timeoutMs: 200000 })
      .then((r) => { if (live) setRenders((c) => ({ ...c, [mood]: r.imageUrl })); })
      .catch((e) => { if (live) setError(e.message); })
      .finally(() => { if (live) setBusy(null); });
    return () => { live = false; };
  }, [face, mood]); // eslint-disable-line react-hooks/exhaustive-deps

  const takeSelfie = async (fromGallery) => {
    setError(null);
    try {
      if (Platform.OS !== 'web') {
        const perm = fromGallery ? await ImagePicker.requestMediaLibraryPermissionsAsync() : await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { setError(fromGallery ? 'Allow photo access to choose a selfie' : 'Allow camera access to take your selfie'); return; }
      }
      const opts = { mediaTypes: ['images'], quality: 0.9, cameraType: ImagePicker.CameraType.front };
      const r = fromGallery ? await ImagePicker.launchImageLibraryAsync(opts) : await ImagePicker.launchCameraAsync(opts);
      if (r.canceled || !r.assets?.[0]) return;
      setBusy('upload');
      const small = await manipulateAsync(r.assets[0].uri, [{ resize: { width: 1600 } }], { compress: 0.95, format: SaveFormat.JPEG });
      const out = await uploadImage('/soulmoji/face', small.uri);
      setRenders({}); setFace(out.faceUrl);
    } catch (e) { setError(e.message); } finally { setBusy(null); }
  };

  const shell = (children) => (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: 'rgba(14,12,22,0.98)', paddingTop: space.md, paddingBottom: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg }}>
        <Text style={{ flex: 1, color: colors.text, fontFamily: fonts.displayBold, fontSize: 16 }}>Soulmoji</Text>
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close Soulmoji"><Ionicons name="close" size={22} color={colors.muted} /></Pressable>
      </View>
      {children}
      {error ? <Text style={{ color: colors.danger, fontFamily: fonts.medium, fontSize: 13, textAlign: 'center', marginTop: space.sm, paddingHorizontal: space.lg }}>{error}</Text> : null}
    </View>
  );

  if (face === undefined) return shell(<ActivityIndicator color={colors.aura} style={{ marginVertical: space.xl }} />);

  if (!face) {
    return shell(
      <View style={{ alignItems: 'center', paddingHorizontal: space.xl, paddingTop: space.md }}>
        <View style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: colors.aura, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="happy-outline" size={40} color={colors.aura} />
        </View>
        <Text style={{ color: colors.text, fontFamily: fonts.displayBold, fontSize: 17, marginTop: space.md, textAlign: 'center' }}>Take your Soulmoji selfie</Text>
        <Text style={{ color: colors.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginTop: 4, textAlign: 'center' }}>
          One clear photo, looking straight at the camera. Soulink then changes the expression on it (smile, laugh, sad, shocked…) and you send it in chat. Only your own face works.
        </Text>
        {busy === 'upload' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.lg }}><ActivityIndicator color={colors.aura} /><Text style={{ color: colors.muted, marginLeft: 8, fontFamily: fonts.medium }}>Checking it's you…</Text></View>
        ) : (
          <View style={{ flexDirection: 'row', alignSelf: 'stretch', marginTop: space.lg }}>
            <Pressable onPress={() => takeSelfie(false)} style={({ hovered }) => ({ flex: 1, borderRadius: 999, overflow: 'hidden', marginRight: space.sm, transform: [{ scale: hovered ? 1.02 : 1 }] })}>
              <LinearGradient colors={['#7c5cfc', '#ff6b9d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 46, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
                <Ionicons name="camera" size={17} color="#fff" style={{ marginRight: 6 }} /><Text style={{ color: '#fff', fontFamily: fonts.bold }}>Take selfie</Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={() => takeSelfie(true)} style={({ hovered }) => ({ flex: 1, height: 46, borderRadius: 999, borderWidth: 1, borderColor: hovered ? colors.aura : colors.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' })}>
              <Ionicons name="images-outline" size={17} color={colors.text} style={{ marginRight: 6 }} /><Text style={{ color: colors.text, fontFamily: fonts.semibold }}>From gallery</Text>
            </Pressable>
          </View>
        )}
      </View>,
    );
  }

  const img = renders[mood];
  return shell(
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, marginTop: space.sm }}>
        <View style={{ width: 132, height: 132, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
          {img ? <Image source={{ uri: mediaUrl(img) }} style={{ width: 132, height: 132 }} contentFit="cover" transition={120} /> : null}
          {busy === 'render' ? (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,7,13,0.45)' }}>
              <ActivityIndicator color="#fff" /><Text style={{ color: '#fff', fontFamily: fonts.medium, fontSize: 11, marginTop: 4, textAlign: 'center', paddingHorizontal: 6 }}>{ai ? 'AI is changing your expression…' : 'Changing your expression…'}</Text>
            </View>
          ) : null}
          <View style={{ position: 'absolute', left: 6, top: 6, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(8,7,13,0.7)' }}>
            <Text style={{ color: '#fff', fontFamily: fonts.semibold, fontSize: 11 }}>{MOODS[mood].emoji} {MOODS[mood].label}</Text>
          </View>
        </View>
        <View style={{ flex: 1, marginLeft: space.md }}>
          <View style={{ borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.inputBg, paddingHorizontal: 14 }}>
            <TextInput value={text} onChangeText={(t) => { setText(t); setPicked(null); }} placeholder="Type a feeling… e.g. so done with Monday"
              placeholderTextColor={colors.dim} maxLength={40} style={{ color: colors.text, fontFamily: fonts.medium, fontSize: 15, minHeight: 46, outlineStyle: 'none' }}
              onSubmitEditing={() => img && onSend({ mood, caption, imageUrl: img })} returnKeyType="send" />
          </View>
          <Pressable disabled={!img} onPress={() => onSend({ mood, caption, imageUrl: img })} style={({ hovered }) => ({ marginTop: space.sm, borderRadius: 999, overflow: 'hidden', opacity: img ? 1 : 0.5, transform: [{ scale: hovered && img ? 1.02 : 1 }] })}>
            <LinearGradient colors={['#7c5cfc', '#ff6b9d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 10, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontFamily: fonts.bold }}>Send {MOODS[mood].emoji}</Text>
            </LinearGradient>
          </Pressable>
          <Text onPress={() => setFace(null)} style={{ color: colors.muted, fontFamily: fonts.medium, fontSize: 12, textAlign: 'center', marginTop: 6 }}>Retake my selfie</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.md, paddingTop: space.md }}>
        {moods.map((k) => (
          <Pressable key={k} onPress={() => setPicked(k)}
            style={({ hovered }) => ({ alignItems: 'center', width: 64, marginHorizontal: 2, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: mood === k ? colors.soul : 'transparent', backgroundColor: hovered || mood === k ? 'rgba(124,92,252,0.18)' : 'transparent' })}>
            <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' }}>
              {renders[k] ? <Image source={{ uri: mediaUrl(renders[k]) }} style={{ width: 44, height: 44 }} contentFit="cover" /> : <Text style={{ fontSize: 22 }}>{MOODS[k].emoji}</Text>}
            </View>
            <Text style={{ color: mood === k ? colors.text : colors.muted, fontFamily: fonts.medium, fontSize: 11, marginTop: 3 }}>{MOODS[k].label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </>,
  );
}
