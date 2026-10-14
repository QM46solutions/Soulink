// Ads run by the Soulink team: sponsored cards between Home posts, Spark ads between Sparks, sponsored Argue topics.
import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { api } from './api';

const seen = new Set(); // count each ad once per app session

export function useAds(placement, n = 3) {
  const [ads, setAds] = useState([]);
  useEffect(() => {
    let alive = true;
    api(`/ads?placement=${placement}&n=${n}`).then((r) => { if (alive) setAds(r.ads || []); }).catch(() => {});
    return () => { alive = false; };
  }, [placement, n]);
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
  items.forEach((it, i) => {
    out.push(it);
    const n = i + 1;
    if (n >= first && (n - first) % every === 0 && n < items.length) { out.push({ __ad: ads[k % ads.length], key: `ad-${n}` }); k += 1; }
  });
  return out;
}
