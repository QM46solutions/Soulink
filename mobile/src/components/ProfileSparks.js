// A person's Sparks on their profile (the tab after Posts). Tall 9:16 tiles, unlike the square photo grid of Posts,
// each with its cover (or a soft Soulink gradient while a cover isn't ready), a play mark and how many watched.
// Tapping one opens their Sparks full screen at that one; swipe up / down for the rest (app/spark/by/[userId].js).
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api, mediaUrl } from '../lib/api';
import { Empty } from './ui';
import { colors, fonts, space } from '../lib/theme';

const short = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K` : String(n || 0));

function SparkTile({ spark, onPress }) {
  const poster = spark.details?.edit?.poster || spark.details?.poster;
  return (
    <Pressable onPress={onPress} accessibilityLabel={`Spark: ${spark.caption || 'no caption'}`}
      style={({ pressed }) => ({ width: '33.333%', aspectRatio: 9 / 16, padding: 2, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ flex: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 1, borderColor: 'rgba(176,143,255,0.18)' }}>
        {poster ? <Image source={{ uri: mediaUrl(poster) }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" transition={150} />
          : <LinearGradient colors={['rgba(124,92,252,0.35)', 'rgba(255,107,157,0.18)', 'rgba(8,7,13,0.9)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />}
        {!poster && spark.caption ? (
          <Text numberOfLines={4} style={{ margin: 8, marginRight: 32, fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16, color: 'rgba(255,255,255,0.9)' }}>{spark.caption}</Text>
        ) : null}
        <View style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(8,7,13,0.55)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="play" size={11} color="#fff" style={{ marginLeft: 1 }} />
        </View>
        <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.65)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 40 }} />
        <View style={{ position: 'absolute', left: 7, bottom: 6, flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="eye-outline" size={12} color="#fff" style={{ marginRight: 3 }} />
          <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: '#fff' }}>{short(spark.views)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function ProfileSparks({ userId, username, isMe, name }) {
  const [sparks, setSparks] = useState(null);
  const load = useCallback(() => { api(`/sparks/user/${userId}`).then((r) => setSparks(r.sparks || [])).catch(() => setSparks([])); }, [userId]);
  useEffect(() => { load(); }, [load]);
  if (sparks === null) return <View style={{ height: 160 }} />;
  if (!sparks.length) {
    return isMe
      ? <Empty icon="film-outline" title="No Sparks yet" text="Short videos you post as Sparks show up here." />
      : <Empty icon="film-outline" title="No Sparks yet" text={`${name || 'They'} hasn't posted any Sparks.`} />;
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 2, paddingBottom: space.xl }}>
      {sparks.map((sp) => (
        <SparkTile key={sp.id} spark={sp} onPress={() => router.push({ pathname: '/spark/by/[userId]', params: { userId, start: sp.id, username: username || '' } })} />
      ))}
    </View>
  );
}
