// One Spark in the Sparks tab: author, category, the video, and the category's extras
// (📍 place for travel, recipe card + "I tried it" for cooking, the acting prompt / script, workout card + "I did it" for fitness,
// headline + topic + source for news).
import { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { confirm, notice } from '../lib/confirm';
import { DIETS, FIT_LEVELS, FIT_TYPES, NEWS_TOPICS, catOf } from '../lib/sparks';
import SparkVideo from './SparkVideo';
import SparkCatBadge from './SparkCatBadge';
import SpreadSheet from './SpreadSheet';
import ActionSheet from './ActionSheet';
import OffenseSheet from './OffenseSheet';
import { BottomSheet, CommentsSheet } from './PostSheets';
import { ACTIVE, Action, LIKE_EMOJI, StateIcon } from './PostCard';
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
  const [spreadOpen, setSpreadOpen] = useState(false);
  const [comments, setComments] = useState(spark.commentCount || 0);
  const [commented, setCommented] = useState(!!spark.commented);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [offended, setOffended] = useState(!!spark.offended);
  const [offenses, setOffenses] = useState(spark.offenseCount || 0);
  const [myReason, setMyReason] = useState(spark.offenseReason || null);
  const [reportOpen, setReportOpen] = useState(false);
  const [shares, setShares] = useState(spark.shareCount || 0);
  const [shared, setShared] = useState(!!spark.shared);
  const [shareMenu, setShareMenu] = useState(false);
  const [ticks, setTicks] = useState({ comment: 0, share: 0, offense: 0 });
  const bump = (k) => setTicks((t) => ({ ...t, [k]: t[k] + 1 }));
  const toggleOffense = async (reason) => {
    try {
      const r = await api(`/sparks/${spark.id}/offense`, { method: 'POST', body: reason ? { reason } : {} });
      setOffended(r.offended); setOffenses(r.offenseCount); setMyReason(r.offended ? reason : null);
      if (r.offended) bump('offense');
      if (r.suspended) setTimeout(() => onDeleted?.(spark.id), 1800);
    } catch (e) { notice('Oops', e.message); }
  };
  const shareOutside = async () => {
    const message = `${spark.author.username} on Soulink Sparks${spark.caption ? `: "${spark.caption.slice(0, 120)}"` : ''}`;
    try {
      if (Platform.OS === 'web') {
        if (navigator.share) await navigator.share({ title: 'Soulink', text: message });
        else { await navigator.clipboard.writeText(message); notice('Copied', 'Paste it anywhere to share.'); }
      } else await Share.share({ message });
      const r = await api(`/sparks/${spark.id}/share`, { method: 'POST', body: {} });
      setShares(r.shareCount); setShared(true); bump('share');
    } catch { /* cancelled */ }
  };

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
            <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: colors.muted }}>{spark.spread ? 'Spread' : ago(spark.createdAt)} · {spark.views} {spark.views === 1 ? 'view' : 'views'}</Text>
          </View>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 3, paddingRight: 10, height: 28, borderRadius: 999, borderWidth: 1, borderColor: `${cat.colors[0]}88`, backgroundColor: `${cat.colors[0]}22` }}>
          <SparkCatBadge cat={cat} size={22} glow={false} />
          <Text style={{ marginLeft: 6, fontFamily: fonts.semibold, fontSize: 12, color: colors.text }}>{cat.label}</Text>
        </View>
        {spark.mine ? <Pressable onPress={del} hitSlop={10} style={{ marginLeft: 10 }} accessibilityLabel="Delete Spark"><Ionicons name="trash-outline" size={19} color={colors.muted} /></Pressable> : null}
      </View>

      <View>
        <SparkVideo uri={spark.videoUrl} musicUri={spark.music?.url} edit={d.edit} onFirstPlay={() => api(`/sparks/${spark.id}/view`, { method: 'POST' }).catch(() => {})} />
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 10, right: 10, top: 10, flexDirection: 'row', flexWrap: 'wrap' }}>
          {spark.spread ? <Chip icon="megaphone" text="Spread" color={colors.gold} /> : null}
          {spark.oneTake ? <Chip icon="checkmark-circle" text="One take" color={colors.mint} /> : null}
          {spark.castingId ? <Chip icon="film" text="Casting audition" color={colors.aura} onPress={() => router.push(`/spark/casting/${spark.castingId}`)} /> : null}
          {spark.stageWeek ? <Chip icon="mic" text="Open Mic" color={colors.gold} onPress={() => router.push('/spark/stage')} /> : null}
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

      {/* the same actions as a post: like (the category's reaction), comment, share, offense — plus Spread around on your own */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 10, paddingHorizontal: 4 }}>
        <Action onPress={react} label={reacted ? 'Remove 👌🏻' : 'Like with 👌🏻'} count={reactions} color={reacted ? '#f2c38b' : undefined}>
          <Text style={{ fontSize: 22, opacity: reacted ? 1 : Platform.OS === 'web' ? 0.85 : 0.55, ...(Platform.OS === 'web' && !reacted ? { filter: 'grayscale(1) brightness(1.6)' } : null) }}>{LIKE_EMOJI}</Text>
        </Action>
        <Action onPress={() => setCommentsOpen(true)} label="Comments" count={comments} color={commented ? ACTIVE.comment : undefined}>
          <StateIcon name="chatbubble" on={commented} color={ACTIVE.comment} effect="shake" tick={ticks.comment} />
        </Action>
        <Action onPress={() => setShareMenu(true)} label="Share" count={shares} color={shared ? ACTIVE.share : undefined}>
          <StateIcon name="paper-plane" on={shared} color={ACTIVE.share} effect="fly" tick={ticks.share} />
        </Action>
        <Action onPress={() => setReportOpen(true)} count={offenses} color={offended ? ACTIVE.offense : undefined}
          label={spark.mine ? `${offenses} offense marks on your Spark` : offended ? 'Remove offense mark' : 'Mark as offensive'}>
          <StateIcon name="alert-circle" on={offended} color={ACTIVE.offense} size={24} effect="stamp" tick={ticks.offense} />
        </Action>
        <View style={{ flex: 1 }} />
          <Pressable onPress={() => (spark.mine ? setSpreadOpen(true) : setShareMenu(true))} accessibilityLabel={spark.mine ? 'Spread around' : 'Spread it around'}
            style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, height: 38, borderRadius: 19, overflow: 'hidden', opacity: hovered ? 0.9 : 1 })}>
            <LinearGradient colors={['#f5c842', '#ff6b9d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <MaterialCommunityIcons name="bullhorn-variant" size={17} color="#14121f" style={{ marginRight: 6 }} />
            <Text style={{ fontFamily: fonts.bold, color: '#14121f', fontSize: 13.5 }}>Spread</Text>
          </Pressable>
      </View>
      {hasSheet || tryable || (spark.category === 'news' && d.source) ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8, alignItems: 'center', marginTop: 8, paddingHorizontal: 4 }}>
          {hasSheet ? (
            <Pressable onPress={() => setRecipe(true)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: colors.border, marginRight: 8 }}>
              <Ionicons name={spark.category === 'cooking' ? 'reader' : 'list'} size={15} color={colors.gold} style={{ marginRight: 5 }} />
              <Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 13 }}>{spark.category === 'cooking' ? 'Recipe' : 'Moves'}</Text>
            </Pressable>
          ) : null}
          {tryable ? (
            <Pressable onPress={tryIt} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: iTried ? colors.mint : colors.border, backgroundColor: iTried ? 'rgba(66,232,192,0.14)' : 'transparent', marginRight: 8 }}>
              <Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 13 }}>{spark.category === 'fitness' ? (iTried ? '✅ I did it' : '🏃 I did it') : (iTried ? '✅ I tried it' : '🧑‍🍳 I tried it')} · {tried}</Text>
            </Pressable>
          ) : null}
          {spark.category === 'news' && d.source ? (
            <Pressable onPress={() => openUrl(d.source)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: colors.border }}>
              <Ionicons name="open-outline" size={15} color={colors.aura} style={{ marginRight: 5 }} />
              <Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 13 }}>Source</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {comments ? (
        <Text onPress={() => setCommentsOpen(true)} style={{ fontFamily: fonts.body, color: colors.muted, paddingHorizontal: 4, marginTop: 6, fontSize: 13 }}>
          View {comments === 1 ? '1 comment' : `all ${comments} comments`}
        </Text>
      ) : null}

      <CommentsSheet visible={commentsOpen} postId={spark.id} base={`/sparks/${spark.id}`} onClose={() => setCommentsOpen(false)} mine={spark.mine}
        onCountChange={(n, mine) => { setComments(n); if (mine) { setCommented(true); bump('comment'); } }} />
      <OffenseSheet visible={reportOpen} offended={offended} reason={myReason} owner={spark.mine} postId={spark.id} base={`/sparks/${spark.id}`} what="Spark"
        onClose={() => setReportOpen(false)} onMark={(reason) => toggleOffense(reason)} onUnmark={() => toggleOffense(null)} />
      <ActionSheet visible={shareMenu} onClose={() => setShareMenu(false)} title={spark.mine ? 'Share this Spark' : 'Spread this Spark around'}
        options={[
          { label: 'Send in a chat', onPress: () => { bump('share'); router.push({ pathname: '/share-post', params: { id: spark.id, kind: 'spark' } }); } },
          { label: 'Share outside Soulink', onPress: shareOutside },
        ]} />
      {spark.mine ? <SpreadSheet visible={spreadOpen} onClose={() => setSpreadOpen(false)} spark={spark} /> : null}
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
