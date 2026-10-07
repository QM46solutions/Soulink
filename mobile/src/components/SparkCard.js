// One Spark in the Sparks tab: author, category, the video, and the category's extras
// (📍 place for travel, recipe card + "I tried it" for cooking, the acting prompt / script, workout card + "I did it" for fitness,
// headline + topic + source for news).
import { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { confirm, notice } from '../lib/confirm';
import { DIETS, FIT_LEVELS, FIT_TYPES, NEWS_TOPICS, catOf } from '../lib/sparks';
import SparkVideo from './SparkVideo';
import { BottomSheet } from './PostSheets';
import { Avatar, VerifiedBadge } from './ui';
import { colors, fonts, space } from '../lib/theme';

const ago = (iso) => { const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); if (m < 60) return `${m}m`; const h = Math.round(m / 60); return h < 24 ? `${h}h` : `${Math.round(h / 24)}d`; };
const Chip = ({ icon, text, color = colors.text, onPress }) => (
  <Pressable onPress={onPress} disabled={!onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.5)', marginRight: 6, marginBottom: 6 }}>
    {icon ? <Ionicons name={icon} size={13} color={color} style={{ marginRight: 4 }} /> : null}
    <Text numberOfLines={1} style={{ color, fontFamily: fonts.semibold, fontSize: 12, maxWidth: 220 }}>{text}</Text>
  </Pressable>
);

export default function SparkCard({ spark, onDeleted }) {
  const cat = catOf(spark.category);
  const d = spark.details || {};
  const [reacted, setReacted] = useState(spark.reacted);
  const [reactions, setReactions] = useState(spark.reactions);
  const [iTried, setITried] = useState(spark.iTried);
  const [tried, setTried] = useState(spark.tried);
  const [recipe, setRecipe] = useState(false);

  const react = async () => {
    setReacted(!reacted); setReactions((n) => n + (reacted ? -1 : 1));
    try { const r = await api(`/sparks/${spark.id}/react`, { method: 'POST' }); setReacted(r.reacted); setReactions(r.reactions); } catch { setReacted(reacted); setReactions(spark.reactions); }
  };
  const tryIt = async () => {
    try { const r = await api(`/sparks/${spark.id}/tried`, { method: 'POST' }); setITried(r.iTried); setTried(r.tried); } catch (e) { notice('Oops', e.message); }
  };
  const del = async () => {
    if (await confirm('Delete this Spark?', undefined, { confirmText: 'Delete', destructive: true })) { await api(`/sparks/${spark.id}`, { method: 'DELETE' }).catch(() => {}); onDeleted?.(spark.id); }
  };
  const openUrl = (url) => { if (Platform.OS === 'web') window.open(url, '_blank', 'noopener'); else Linking.openURL(url); };
  const openPlace = () => openUrl(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spark.place)}`);
  const label = (list, k) => list.find(([x]) => x === k)?.[1];
  const fitLine = spark.category === 'fitness' ? [label(FIT_TYPES, d.type), label(FIT_LEVELS, d.level), d.minutes ? `⏱ ${d.minutes} min` : null].filter(Boolean).join('  ·  ') : null;
  const tryable = spark.category === 'cooking' || spark.category === 'fitness';
  const hasSheet = spark.category === 'cooking' || (spark.category === 'fitness' && d.moves?.length);
  const actingLine = d.mode === 'dice' && d.prompt ? `🎲 ${d.prompt.emotion} · ${d.prompt.situation} · ${d.prompt.character}`
    : d.mode === 'script' && d.scriptTitle ? `📜 Script: ${d.scriptTitle}` : d.scene ? `🎬 Recreating: ${d.scene}` : d.mode === 'dub' ? '🎙️ Dub' : null;

  return (
    <View style={{ marginBottom: space.xl, paddingHorizontal: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: space.sm, paddingHorizontal: 4 }}>
        <Pressable onPress={() => router.push(`/user/${spark.author.username}`)} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Avatar uri={spark.author.avatarUrl} name={spark.author.username} size={34} />
          <View style={{ marginLeft: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontFamily: fonts.semibold, color: colors.text }}>{spark.author.displayName || spark.author.username}</Text>
              {spark.author.verified ? <VerifiedBadge /> : null}
            </View>
            <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: colors.muted }}>{ago(spark.createdAt)} · {spark.views} {spark.views === 1 ? 'view' : 'views'}</Text>
          </View>
        </Pressable>
        <View style={{ borderRadius: 999, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 4 }}>
          <LinearGradient colors={cat.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.9 }} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: '#fff' }}>{cat.emoji} {cat.label}</Text>
        </View>
        {spark.mine ? <Pressable onPress={del} hitSlop={10} style={{ marginLeft: 10 }} accessibilityLabel="Delete Spark"><Ionicons name="trash-outline" size={19} color={colors.muted} /></Pressable> : null}
      </View>

      <View>
        <SparkVideo uri={spark.videoUrl} musicUri={spark.music?.url} onFirstPlay={() => api(`/sparks/${spark.id}/view`, { method: 'POST' }).catch(() => {})} />
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 10, right: 10, top: 10, flexDirection: 'row', flexWrap: 'wrap' }}>
          {spark.oneTake ? <Chip icon="checkmark-circle" text="One take" color={colors.mint} /> : null}
          {spark.place ? <Chip icon="location" text={spark.place} onPress={openPlace} /> : null}
          {spark.music ? <Chip icon="musical-notes" text={spark.music.title} /> : null}
        </View>
      </View>

      {actingLine ? <Text style={{ fontFamily: fonts.semibold, color: colors.aura, fontSize: 13, marginTop: 8, paddingHorizontal: 4 }}>{actingLine}</Text> : null}
      {fitLine ? <Text style={{ fontFamily: fonts.semibold, color: colors.mint, fontSize: 13, marginTop: 8, paddingHorizontal: 4 }}>{fitLine}</Text> : null}
      {spark.category === 'fitness' && d.challenge ? <Text style={{ fontFamily: fonts.semibold, color: colors.gold, fontSize: 13, marginTop: 4, paddingHorizontal: 4 }}>🏆 Challenge: {d.challenge}</Text> : null}
      {spark.category === 'news' && (d.headline || d.topic) ? (
        <View style={{ marginTop: 8, paddingHorizontal: 4 }}>
          {d.topic ? <Text style={{ fontFamily: fonts.mono, color: colors.spark, fontSize: 11, letterSpacing: 1 }}>{(label(NEWS_TOPICS, d.topic) || '').toUpperCase()}</Text> : null}
          {d.headline ? <Text style={{ fontFamily: fonts.displayBold, color: colors.text, fontSize: 17, lineHeight: 23, marginTop: 2 }}>{d.headline}</Text> : null}
        </View>
      ) : null}
      {spark.caption ? <Text style={{ fontFamily: fonts.body, color: colors.text, fontSize: 14, lineHeight: 20, marginTop: 6, paddingHorizontal: 4 }}>{spark.caption}</Text> : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingHorizontal: 4 }}>
        <Pressable onPress={react} style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 36, borderRadius: 18, borderWidth: 1.5,
          borderColor: reacted ? cat.colors[0] : hovered ? colors.aura : colors.border, backgroundColor: reacted ? `${cat.colors[0]}26` : 'transparent', marginRight: 8 })}>
          <Text style={{ fontSize: 17, marginRight: 6 }}>{cat.react.emoji}</Text>
          <Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 13 }}>{cat.react.label} · {reactions}</Text>
        </Pressable>
        {hasSheet ? (
          <Pressable onPress={() => setRecipe(true)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border, marginRight: 8 }}>
            <Ionicons name={spark.category === 'cooking' ? 'reader' : 'list'} size={15} color={colors.gold} style={{ marginRight: 5 }} />
            <Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 13 }}>{spark.category === 'cooking' ? 'Recipe' : 'Moves'}</Text>
          </Pressable>
        ) : null}
        {tryable ? (
          <Pressable onPress={tryIt} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: iTried ? colors.mint : colors.border, backgroundColor: iTried ? 'rgba(66,232,192,0.14)' : 'transparent' }}>
            <Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 13 }}>{spark.category === 'fitness' ? (iTried ? '✅ I did it' : '🏃 I did it') : (iTried ? '✅ I tried it' : '🧑‍🍳 I tried it')} · {tried}</Text>
          </Pressable>
        ) : null}
        {spark.category === 'news' && d.source ? (
          <Pressable onPress={() => openUrl(d.source)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border }}>
            <Ionicons name="open-outline" size={15} color={colors.aura} style={{ marginRight: 5 }} />
            <Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 13 }}>Source</Text>
          </Pressable>
        ) : null}
      </View>

      {spark.category === 'cooking' ? (
        <BottomSheet visible={recipe} onClose={() => setRecipe(false)} title={d.dish ? `🍳 ${d.dish}` : '🍳 Recipe'}>
          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ padding: space.lg }}>
            <Text style={{ fontFamily: fonts.semibold, color: colors.muted, fontSize: 13 }}>
              {[d.minutes ? `⏱ ${d.minutes} min` : null, d.diet ? DIETS.find(([k]) => k === d.diet)?.[1] : null].filter(Boolean).join('   ')}
            </Text>
            {d.ingredients?.length ? <Text style={{ fontFamily: fonts.bold, color: colors.text, fontSize: 15, marginTop: space.md }}>Ingredients</Text> : null}
            {(d.ingredients || []).map((x, k) => <Text key={k} style={{ fontFamily: fonts.body, color: colors.text, fontSize: 14, marginTop: 4 }}>•  {x}</Text>)}
            {d.steps?.length ? <Text style={{ fontFamily: fonts.bold, color: colors.text, fontSize: 15, marginTop: space.md }}>Steps</Text> : null}
            {(d.steps || []).map((x, k) => <Text key={k} style={{ fontFamily: fonts.body, color: colors.text, fontSize: 14, marginTop: 6, lineHeight: 20 }}>{k + 1}.  {x}</Text>)}
            {!d.ingredients?.length && !d.steps?.length ? <Text style={{ fontFamily: fonts.body, color: colors.muted, marginTop: space.md }}>No recipe card on this one.</Text> : null}
          </ScrollView>
        </BottomSheet>
      ) : null}
      {spark.category === 'fitness' && d.moves?.length ? (
        <BottomSheet visible={recipe} onClose={() => setRecipe(false)} title="💪 Workout">
          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ padding: space.lg }}>
            {fitLine ? <Text style={{ fontFamily: fonts.semibold, color: colors.muted, fontSize: 13 }}>{fitLine}</Text> : null}
            {d.moves.map((x, k) => <Text key={k} style={{ fontFamily: fonts.body, color: colors.text, fontSize: 15, marginTop: 8 }}>{k + 1}.  {x}</Text>)}
          </ScrollView>
        </BottomSheet>
      ) : null}
    </View>
  );
}
