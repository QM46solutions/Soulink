// Sponsored cards: FeedAd (between Home posts), SparkAd (between Sparks), ArgueAd (a sponsored topic on the Argue page).
// Always labelled "Sponsored". Shown by the Soulink team's Ads Manager.
import { createElement, useEffect } from 'react';
import { Image, Platform, Pressable, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { mediaUrl as serverUrl } from '../lib/api';
import { markSeen, openAd } from '../lib/ads';
import { colors, fonts, gradients, space } from '../lib/theme';

const mediaUrl = (u) => (/^(blob:|data:|file:)/.test(u || '') ? u : serverUrl(u)); // local picks in the Ads Manager preview

function Media({ ad, height, radius = 0 }) {
  if (!ad.mediaUrl) return null;
  const src = mediaUrl(ad.mediaUrl);
  if (ad.mediaKind === 'video') {
    if (Platform.OS !== 'web') return <View style={{ height, backgroundColor: '#000', borderRadius: radius }} />;
    return createElement('video', { src, autoPlay: true, muted: true, loop: true, playsInline: true, preload: 'metadata',
      style: { width: '100%', height, objectFit: 'cover', display: 'block', borderRadius: radius, background: '#000' } });
  }
  return <Image source={{ uri: src }} style={{ width: '100%', height, borderRadius: radius, backgroundColor: '#14121f' }} resizeMode="cover" />;
}

function Brand({ ad, light }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
      {ad.logoUrl ? <Image source={{ uri: mediaUrl(ad.logoUrl) }} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff' }} />
        : (
          <View style={{ width: 34, height: 34, borderRadius: 17, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            <LinearGradient colors={['#f5c842', '#ff6b9d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: 15 }}>{ad.brand.slice(0, 1).toUpperCase()}</Text>
          </View>
        )}
      <View style={{ marginLeft: 8, flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.semibold, color: light ? '#fff' : colors.text }}>{ad.brand}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 11.5, color: light ? 'rgba(255,255,255,0.8)' : colors.muted }}>Sponsored</Text>
      </View>
    </View>
  );
}

function Cta({ ad, style }) {
  if (!ad.ctaUrl) return null;
  return (
    <Pressable onPress={() => openAd(ad)} style={[{ height: 42, borderRadius: 21, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }, style]}>
      <LinearGradient colors={gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: 14 }}>{ad.ctaLabel || 'Learn more'}</Text>
      <Ionicons name="chevron-forward" size={16} color="#fff" style={{ marginLeft: 4 }} />
    </Pressable>
  );
}

/** Between Home posts: looks like a post, clearly marked Sponsored. */
export function FeedAd({ ad }) {
  useEffect(() => markSeen(ad), [ad]);
  return (
    <View style={{ marginBottom: space.lg, marginHorizontal: space.md, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.glass, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: space.md }}>
        <Brand ad={ad} />
        <MaterialCommunityIcons name="star-four-points" size={16} color={colors.gold} />
      </View>
      <Pressable onPress={() => openAd(ad)} disabled={!ad.ctaUrl}><Media ad={ad} height={360} /></Pressable>
      <View style={{ padding: space.md }}>
        <Text style={{ fontFamily: fonts.bold, color: colors.text, fontSize: 16, lineHeight: 22 }}>{ad.headline}</Text>
        {ad.body ? <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 }}>{ad.body}</Text> : null}
        <Cta ad={ad} style={{ marginTop: space.md }} />
      </View>
    </View>
  );
}

/** Between Sparks: a tall card like a Spark with the brand and button on top of the video. */
export function SparkAd({ ad }) {
  useEffect(() => markSeen(ad), [ad]);
  return (
    <View style={{ marginBottom: space.xl, paddingHorizontal: space.md }}>
      <View style={{ height: 520, borderRadius: 20, overflow: 'hidden', backgroundColor: '#000' }}>
        {ad.mediaUrl ? <Media ad={ad} height={520} /> : <LinearGradient colors={['#2a1d5c', '#7c5cfc', '#ff6b9d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 520 }} />}
        <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 110 }} pointerEvents="none" />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 230 }} pointerEvents="none" />
        <View style={{ position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'center' }}><Brand ad={ad} light /></View>
        <View style={{ position: 'absolute', left: 14, right: 14, bottom: 14 }}>
          <Text style={{ fontFamily: fonts.displayBold, color: '#fff', fontSize: 20, lineHeight: 26 }}>{ad.headline}</Text>
          {ad.body ? <Text numberOfLines={3} style={{ fontFamily: fonts.body, color: 'rgba(255,255,255,0.88)', fontSize: 14, lineHeight: 20, marginTop: 4 }}>{ad.body}</Text> : null}
          <Cta ad={ad} style={{ marginTop: space.md }} />
        </View>
      </View>
    </View>
  );
}

/** A sponsored topic on the Argue page: tap to argue it. */
export function ArgueAd({ ad, onUse }) {
  useEffect(() => markSeen(ad), [ad]);
  return (
    <View style={{ marginTop: space.lg, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(245,200,66,0.45)', overflow: 'hidden' }}>
      <LinearGradient colors={['rgba(245,200,66,0.14)', 'rgba(255,107,157,0.1)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ padding: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}><Brand ad={ad} /></View>
        <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1, color: colors.gold, marginTop: space.md }}>TODAY'S SPONSORED ARGUE</Text>
        <Text style={{ fontFamily: fonts.displayBold, color: colors.text, fontSize: 19, lineHeight: 25, marginTop: 4 }}>{ad.argueTopic}</Text>
        {(ad.headline && ad.headline !== ad.argueTopic) || ad.body ? <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 13.5, lineHeight: 19, marginTop: 4 }}>{[ad.headline !== ad.argueTopic ? ad.headline : null, ad.body].filter(Boolean).join(' · ')}</Text> : null}
        <View style={{ flexDirection: 'row', marginTop: space.md, gap: 10 }}>
          <Pressable onPress={() => onUse?.(ad.argueTopic)} style={{ flex: 1, height: 42, borderRadius: 21, borderWidth: 1.5, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
            <MaterialCommunityIcons name="scale-balance" size={17} color={colors.gold} />
            <Text style={{ marginLeft: 6, fontFamily: fonts.bold, color: colors.text, fontSize: 14 }}>Argue this</Text>
          </Pressable>
          {ad.ctaUrl ? <Cta ad={ad} style={{ flex: 1 }} /> : null}
        </View>
      </View>
    </View>
  );
}
