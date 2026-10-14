// Ads run by the Soulink team: sponsored cards between Home posts, Spark ads between Sparks, sponsored Argue topics.
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Linking, Platform } from 'react-native';
import { api } from './api';

const seen = new Set(); // count each ad once per app session

export function useAds(placement, n = 3) {
  const [ads, setAds] = useState([]);
  // fetched every time the screen comes into view, so a new ad shows without reloading the app
  useFocusEffect(useCallback(() => {
    let alive = true;
    api(`/ads?placement=${placement}&n=${n}`).then((r) => { if (alive) setAds(r.ads || []); }).catch(() => {});
    return () => { alive = false; };
  }, [placement, n]));
  return ads;
}

export function markSeen(ad) {
  if (!ad || ad.id === 'preview' || seen.has(ad.id)) return;
  seen.add(ad.id);
  api(`/ads/${ad.id}/seen`, { method: 'POST' }).catch(() => {});
}

export function openAd(ad) {
  if (ad.id !== 'preview') api(`/ads/${ad.id}/click`, { method: 'POST' }).catch(() => {});
  if (!ad.ctaUrl) return;
  if (Platform.OS === 'web') window.open(ad.ctaUrl, '_blank', 'noopener');
  else Linking.openURL(ad.ctaUrl).catch(() => {});
}

/** Put an ad after every `every` items (cycling through the ads). Ads are { __ad, key }. */
export function withAds(items, ads, every, first = every) {
  if (!ads?.length || !items?.length) return items || [];
  const out = []; let k = 0;
  const start = Math.min(first, items.length); // a short feed still gets one ad, at the end
  items.forEach((it, i) => {
    out.push(it);
    const n = i + 1;
    if (n >= start && (n - start) % every === 0) { out.push({ __ad: ads[k % ads.length], key: `ad-${n}` }); k += 1; }
  });
  return out;
}
