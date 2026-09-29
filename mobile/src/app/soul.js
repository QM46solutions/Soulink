// Create your Soul DNA: 10 quick questions, one per screen. Tapping an answer moves on by itself.
// Ends with the Soul type reveal. Connecting with people unlocks after this.
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { BrandHeader, BrandScreen } from '../components/BrandScreen';
import { GradientText, PillTag } from '../components/brand';
import { Button, ErrorText } from '../components/ui';
import { colors, fonts, gradients, space } from '../lib/theme';

function Bar({ value }) {
  return (
    <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden', marginHorizontal: space.md }}>
      <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${value * 100}%`, height: 4 }} />
    </View>
  );
}

function Option({ label, onPress, chosen }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button"
      style={({ hovered, pressed }) => ({
        minHeight: 56, borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 20, paddingVertical: 14, marginBottom: space.md, justifyContent: 'center',
        borderColor: chosen ? colors.soul : hovered ? colors.aura : colors.border,
        backgroundColor: chosen ? 'rgba(124,92,252,0.22)' : pressed ? 'rgba(124,92,252,0.12)' : colors.inputBg,
        transform: [{ scale: hovered && !chosen ? 1.01 : 1 }],
      })}>
      <Text style={{ color: colors.text, fontFamily: fonts.medium, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

export default function SoulQuiz() {
  const { setUser } = useAuth();
  const [questions, setQuestions] = useState(null);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [chosen, setChosen] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => { api('/soul/quiz').then((r) => setQuestions(r.questions)).catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    if (!result) return;
    Animated.timing(glow, { toValue: 1, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [result, glow]);

  const submit = async (all) => {
    setSaving(true); setError(null);
    try {
      const r = await api('/soul/quiz', { method: 'POST', body: { answers: all } });
      setResult({ ...r.soul, user: r.user });
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const pick = (optionIndex) => {
    if (chosen !== null) return;
    setChosen(optionIndex);
    const next = [...answers.filter((a) => a.questionId !== questions[i].id), { questionId: questions[i].id, optionIndex }];
    setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
        setAnswers(next); setChosen(null);
        if (i + 1 < questions.length) setI(i + 1); else submit(next);
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      });
    }, 260);
  };

  const back = () => { if (result) return; if (i > 0) setI(i - 1); else router.back(); };

  if (result) {
    const scale = glow.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
    return (
      <BrandScreen>
        <BrandHeader size={36} title="Your Soul DNA is live" />
        <Animated.View style={{ alignItems: 'center', opacity: glow, transform: [{ scale }] }}>
          <View style={{ width: 150, height: 150, borderRadius: 75, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            <LinearGradient colors={[...gradients.button]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.35 }} />
            <MaterialCommunityIcons name="dna" size={80} color={colors.text} />
          </View>
          <PillTag style={{ alignSelf: 'center', marginTop: space.xl }}>You are</PillTag>
          <GradientText style={{ fontFamily: fonts.display, fontSize: 32, lineHeight: 40, textAlign: 'center', marginTop: space.md }}>{result.type}</GradientText>
          <Text style={{ fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.muted, textAlign: 'center', marginTop: space.sm, paddingHorizontal: space.md }}>{result.tagline}</Text>
        </Animated.View>
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.dim, textAlign: 'center', marginTop: space.xl }}>
          Your Soul DNA grows smarter as you use Soulink.
        </Text>
        <Button title="Start connecting" style={{ marginTop: space.lg }} onPress={() => { setUser(result.user); router.back(); }} />
      </BrandScreen>
    );
  }

  const q = questions?.[i];
  return (
    <BrandScreen back onBack={back}
      right={questions ? <><Bar value={(i + (chosen !== null ? 1 : 0)) / questions.length} /><Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.muted, width: 40, textAlign: 'right' }}>{i + 1}/{questions.length}</Text></> : null}>
      <BrandHeader size={36} title="Create your Soul DNA" subtitle="Tap what feels most like you. No right answers." />
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!questions || saving ? (
        <View style={{ alignItems: 'center', marginTop: space.xl }}>
          <ActivityIndicator color={colors.aura} size="large" />
          {saving ? <Text style={{ color: colors.muted, fontFamily: fonts.body, marginTop: space.md }}>Decoding your soul…</Text> : null}
          {error && saving === false && answers.length === questions?.length ? <Button title="Try again" onPress={() => submit(answers)} style={{ marginTop: space.lg, alignSelf: 'stretch' }} /> : null}
        </View>
      ) : (
        <Animated.View style={{ opacity: fade }}>
          <Text style={{ fontFamily: fonts.displayBold, fontSize: 22, lineHeight: 30, color: colors.text, textAlign: 'center', marginBottom: space.xl }}>{q.text}</Text>
          {q.options.map((label, idx) => (
            <Option key={label} label={label} chosen={chosen === idx || (chosen === null && answers.find((a) => a.questionId === q.id)?.optionIndex === idx)} onPress={() => pick(idx)} />
          ))}
        </Animated.View>
      )}
    </BrandScreen>
  );
}
