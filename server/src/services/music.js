// Music for posts, Moments and Sparks: search songs from JioSaavn, Deezer and free (Creative Commons) music.
// Nothing is downloaded or stored: a post keeps a reference like "saavn:abc123" and /music/play/<ref> sends the
// player to a fresh stream link each time (Deezer's 30-second clip links expire, so they are looked up again).
//   JioSaavn – Indian catalogue (Telugu, Hindi, Tamil…), full songs. Unofficial (JioSaavn has no public API),
//              so it can stop working; the other sources keep going if it does.
//   Deezer   – global catalogue, 30-second clips, free public API (no key).
//   Free     – Openverse (Jamendo, Freesound, Wikimedia…): Creative Commons music, safe to share.
import forge from 'node-forge';

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
export const MUSIC_SOURCES = ['saavn', 'deezer', 'free'];
const off = () => process.env.NODE_ENV === 'test' || process.env.MUSIC_SEARCH === 'off';

async function getJson(url, ms = 12000) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`);
  return r.json();
}
const decode = (s) => String(s || '').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
const https = (u) => (u ? String(u).replace(/^http:\/\//, 'https://') : null);

// ---------- JioSaavn ----------
const SAAVN = 'https://www.jiosaavn.com/api.php?_format=json&_marker=0&api_version=4&ctx=web6dot0';
export function saavnMediaUrl(encrypted) {
  // JioSaavn hides the song link with DES (a long-known public key); 160 kbps AAC plays everywhere
  if (!encrypted) return null;
  const d = forge.cipher.createDecipher('DES-ECB', forge.util.createBuffer('38346591'));
  d.start({ iv: forge.util.createBuffer('00000000') });
  d.update(forge.util.createBuffer(forge.util.decode64(encrypted)));
  if (!d.finish()) return null;
  const link = d.output.getBytes();
  return /^https?:\/\//.test(link) ? https(link.replace('_96', '_160')) : null;
}
export function saavnTrack(s) {
  const mi = s?.more_info || {};
  const artists = mi.artistMap?.primary_artists?.map((a) => decode(a.name)).filter(Boolean).join(', ') || decode(mi.music || s?.subtitle || '');
  const enc = mi.encrypted_media_url || s?.encrypted_media_url;
  if (!s?.id || !enc) return null;
  return {
    ref: `saavn:${s.id}`, source: 'saavn', title: decode(s.title || s.song), artist: artists,
    cover: https(String(s.image || '').replace(/150x150|50x50/, '500x500')) || null,
    duration: Number(mi.duration || s.duration) || null, full: true,
    previewUrl: saavnMediaUrl(enc),
  };
}
async function searchSaavn(q, limit) {
  const j = await getJson(`${SAAVN}&__call=search.getResults&q=${encodeURIComponent(q)}&p=1&n=${limit}`);
  return (j.results || []).map(saavnTrack).filter((t) => t && t.previewUrl);
}
async function resolveSaavn(id) {
  const j = await getJson(`${SAAVN}&__call=song.getDetails&pids=${encodeURIComponent(id)}`);
  const s = j.songs?.[0] || j[id] || Object.values(j || {}).find((x) => x && x.id === id);
  return saavnTrack(s)?.previewUrl || null;
}

// ---------- Deezer ----------
export function deezerTrack(t) {
  if (!t?.id || !t.preview) return null;
  return {
    ref: `deezer:${t.id}`, source: 'deezer', title: decode(t.title), artist: decode(t.artist?.name),
    cover: t.album?.cover_medium || t.album?.cover || null, duration: 30, full: false, previewUrl: https(t.preview),
  };
}
async function searchDeezer(q, limit) {
  const j = q ? await getJson(`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=${limit}`) : await getJson(`https://api.deezer.com/chart/0/tracks?limit=${limit}`);
  return (j.data || []).map(deezerTrack).filter(Boolean);
}
async function resolveDeezer(id) {
  const j = await getJson(`https://api.deezer.com/track/${encodeURIComponent(id)}`);
  return https(j.preview) || null;
}

// ---------- Free (Openverse, Creative Commons) ----------
export function freeTrack(a) {
  if (!a?.id || !a.url) return null;
  const lic = a.license ? `CC ${String(a.license).toUpperCase()}` : 'CC';
  return {
    ref: `free:${a.id}`, source: 'free', title: decode(a.title) || 'Untitled', artist: [decode(a.creator), lic].filter(Boolean).join(' · '),
    cover: a.thumbnail || null, duration: a.duration ? Math.round(a.duration / 1000) : null, full: true, previewUrl: https(a.url),
  };
}
async function searchFree(q, limit) {
  const j = await getJson(`https://api.openverse.org/v1/audio/?q=${encodeURIComponent(q || 'happy music')}&page_size=${limit}&category=music&license_type=commercial`); // only licences that allow use in an app (CC0, BY, BY-SA)
  return (j.results || []).map(freeTrack).filter(Boolean);
}
async function resolveFree(id) {
  const j = await getJson(`https://api.openverse.org/v1/audio/${encodeURIComponent(id)}/`);
  return https(j.url) || null;
}

// ---------- public ----------
const searchCache = new Map(); // "source|q" -> { at, tracks }
export async function searchMusic(source, q, limit = 20) {
  if (!MUSIC_SOURCES.includes(source)) throw new Error('Unknown music source');
  if (off()) return [];
  const query = String(q || '').trim().slice(0, 100);
  const k = `${source}|${query.toLowerCase()}`;
  const hit = searchCache.get(k);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.tracks;
  const fn = { saavn: searchSaavn, deezer: searchDeezer, free: searchFree }[source];
  const tracks = await fn(source === 'saavn' && !query ? 'latest telugu songs' : query, Math.min(30, Math.max(1, limit)));
  tracks.forEach((t) => streamCache.set(t.ref, { at: Date.now(), url: t.previewUrl }));
  searchCache.set(k, { at: Date.now(), tracks });
  if (searchCache.size > 500) searchCache.delete(searchCache.keys().next().value);
  return tracks;
}

export const REF_RE = /^(saavn|deezer|free):[A-Za-z0-9_-]{1,64}$/;
const streamCache = new Map(); // ref -> { at, url }
/** A fresh playable link for a stored reference (Deezer links last a few hours, so keep them 1 hour). */
export async function streamUrl(ref) {
  if (!REF_RE.test(ref)) return null;
  const hit = streamCache.get(ref);
  if (hit && Date.now() - hit.at < 60 * 60_000) return hit.url;
  const [source, id] = ref.split(':');
  const url = await { saavn: resolveSaavn, deezer: resolveDeezer, free: resolveFree }[source](id);
  if (url) { streamCache.set(ref, { at: Date.now(), url }); if (streamCache.size > 3000) streamCache.delete(streamCache.keys().next().value); }
  return url;
}
export const playPath = (ref) => `/music/play/${ref}`;
