// Settings > Account privacy > Hidden words: comments with offensive words, or words you add, are hidden from
// everyone except the person who wrote them (they aren't told).
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../lib/api';
import { Note, Section, Toggle } from '../../components/SettingsUI';
import { Button, ErrorText, Input, s } from '../../components/ui';
import { colors, fonts, space } from '../../lib/theme';

export default function HiddenWords() {
  const [p, setP] = useState(null);
  const [word, setWord] = useState('');
  const [error, setError] = useState(null);
  useEffect(() => { api('/privacy').then((r) => setP(r.privacy)).catch((e) => setError(e.message)); }, []);
  const save = async (patch) => {
    const prev = p; setP({ ...p, ...patch }); setError(null);
    try { setP((await api('/privacy', { method: 'PUT', body: patch })).privacy); } catch (e) { setP(prev); setError(e.message); }
  };
  const add = () => {
    const words = word.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean);
    if (!words.length) return;
    save({ hiddenWords: [...new Set([...p.hiddenWords, ...words])] }); setWord('');
  };
  if (!p) return <ScrollView style={s.screen}><ErrorText>{error}</ErrorText></ScrollView>;
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <ErrorText>{error}</ErrorText>
      <Section>Offensive words</Section>
      <Toggle title="Hide offensive comments" text="Comments with common abuse in English, Hindi and Telugu are hidden on your posts and Sparks." value={p.hideOffensive} onChange={(v) => save({ hideOffensive: v })} />
      <Section>Your own words</Section>
      <View style={{ paddingHorizontal: space.lg }}>
        <Input label="Add words or emojis" value={word} onChangeText={setWord} autoCapitalize="none" maxLength={200} hint="Separate with commas" onSubmitEditing={add} returnKeyType="done" />
        <Button title="Add" small onPress={add} disabled={!word.trim()} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space.md }}>
          {p.hiddenWords.map((w) => (
            <Pressable key={w} onPress={() => save({ hiddenWords: p.hiddenWords.filter((x) => x !== w) })} accessibilityLabel={`Remove ${w}`}
              style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, marginRight: 8, marginBottom: 8 }}>
              <Text style={{ fontFamily: fonts.medium, color: colors.text, fontSize: 13 }}>{w}</Text>
              <Ionicons name="close" size={14} color={colors.muted} style={{ marginLeft: 6 }} />
            </Pressable>
          ))}
        </View>
      </View>
      <Note>Hidden comments are seen only by the person who wrote them. They aren't told it was hidden.</Note>
    </ScrollView>
  );
}
