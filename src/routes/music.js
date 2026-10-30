// Music search for posts, Moments and Sparks.
//  GET /music/search?source=saavn|deezer|free&q=   (login) -> { tracks: [{ ref, source, title, artist, cover, duration, full, previewUrl }] }
//  GET /music/sources                             which sources are on
//  GET /music/play/:ref                            (public, for <audio>) -> redirect to a fresh stream link
import { Router } from 'express';
import { z } from 'zod';
import { ah, HttpError } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { many } from '../db.js';
import { FREE_MOODS, MUSIC_SOURCES, REF_RE, searchMusic, streamUrl } from '../services/music.js';

const r = Router();

// JioSaavn songs come through an unofficial API without a licence. It stays on for testing on the laptop, but is
// OFF in the online (production) version unless MUSIC_SAAVN=on, to avoid copyright problems (Copyright Act 1957).
export const saavnOn = () => (process.env.MUSIC_SAAVN === 'on' || (process.env.MUSIC_SAAVN !== 'off' && (process.env.NODE_ENV || 'development') !== 'production'));
// Deezer's free API is not licensed for commercial apps: off in production unless MUSIC_DEEZER=on.
export const deezerOn = () => (process.env.MUSIC_DEEZER === 'on' || (process.env.MUSIC_DEEZER !== 'off' && (process.env.NODE_ENV || 'development') !== 'production'));
// Songs uploaded from the phone are almost always someone else's music: off in production unless MUSIC_PHONE=on.
export const phoneMusicOn = () => (process.env.MUSIC_PHONE === 'on' || (process.env.MUSIC_PHONE !== 'off' && (process.env.NODE_ENV || 'development') !== 'production'));
const sourcesOn = () => MUSIC_SOURCES.filter((x) => (x !== 'saavn' || saavnOn()) && (x !== 'deezer' || deezerOn()));

r.get('/sources', (req, res) => res.json({ sources: [...sourcesOn(), ...(phoneMusicOn() ? ['file'] : [])], originalAudio: true }));

r.get('/play/:ref', ah(async (req, res) => {
  const ref = String(req.params.ref || '');
  if (!REF_RE.test(ref)) throw new HttpError(404, 'No such song', 'no_song');
  if ((ref.startsWith('saavn:') && !saavnOn()) || (ref.startsWith('deezer:') && !deezerOn())) throw new HttpError(404, "This song isn't available on Soulink anymore", 'song_unavailable');
  let url = null;
  try { url = await streamUrl(ref); } catch { /* source not answering */ }
  if (!url) throw new HttpError(404, "This song isn't available right now", 'song_unavailable');
  res.set('Cache-Control', 'no-store');
  res.redirect(302, url);
}));

r.get('/search', requireAuth, ah(async (req, res) => {
  const { source, q } = z.object({ source: z.enum(MUSIC_SOURCES).default(saavnOn() ? 'saavn' : 'deezer'), q: z.string().max(100).default('') }).parse(req.query);
  if (!sourcesOn().includes(source)) throw new HttpError(400, 'This music source is turned off', 'music_source_off');
  try { res.json({ tracks: await searchMusic(source, q) }); }
  catch (e) {
    const name = { saavn: 'JioSaavn', deezer: 'Deezer', free: 'Free music' }[source];
    throw new HttpError(502, `${name} isn't answering right now. Try another tab or again in a minute.`, 'music_unavailable');
  }
}));

// GET /music/foryou -> { sections: [{ key, title, tracks }] } — what the picker shows before you type anything, like
// Instagram: what's popular on Soulink right now, then a few moods. Built once every few hours.
const SECTIONS = [
  ['happy', 'Happy & upbeat'], ['romantic', 'Romantic'], ['indian', 'Indian vibes'], ['lofi', 'Lo-fi & chill'],
  ['party', 'Party'], ['cinematic', 'Cinematic'], ['sad', 'Emotional'], ['calm', 'Calm'],
];
let forYou = { at: 0, sections: null };
r.get('/foryou', requireAuth, ah(async (req, res) => {
  const source = sourcesOn()[0];
  if (!source) return res.json({ sections: [] });
  if (!forYou.sections || Date.now() - forYou.at > 6 * 3600_000) {
    const sections = [];
    for (const [key, title] of SECTIONS) {
      try { const tracks = (await searchMusic(source, source === 'free' ? key : title, 10)).slice(0, 8); if (tracks.length) sections.push({ key, title, tracks }); } catch { /* skip this mood */ }
    }
    if (sections.length) forYou = { at: Date.now(), sections };
  }
  // popular on Soulink: songs people used most in the last 30 days (posts, Sparks, Moments)
  let popular = [];
  try {
    const rows = await many(`SELECT TOP 8 u.music_url, MAX(u.music_title) AS title, COUNT(*) AS n FROM (
        SELECT music_url, music_title FROM sparks WHERE music_url LIKE N'/music/play/%' AND deleted_at IS NULL AND created_at > DATEADD(DAY, -30, SYSDATETIMEOFFSET())
        UNION ALL SELECT music_url, music_title FROM posts WHERE music_url LIKE N'/music/play/%' AND deleted_at IS NULL AND created_at > DATEADD(DAY, -30, SYSDATETIMEOFFSET())
      ) u GROUP BY u.music_url ORDER BY COUNT(*) DESC`, []);
    popular = rows.map((x) => ({ ref: x.music_url.replace('/music/play/', ''), title: x.title || 'Song', uses: Number(x.n) }))
      .filter((x) => REF_RE.test(x.ref) && sourcesOn().includes(x.ref.split(':')[0]))
      .map((x) => ({ ref: x.ref, source: x.ref.split(':')[0], title: x.title, artist: `${x.uses} ${x.uses === 1 ? 'post' : 'posts'} on Soulink`, cover: null, duration: null, full: x.ref.split(':')[0] !== 'deezer', previewUrl: `/music/play/${x.ref}` }));
  } catch { /* fine without it */ }
  res.json({ sections: [...(popular.length >= 3 ? [{ key: 'popular', title: 'Popular on Soulink', tracks: popular }] : []), ...(forYou.sections || [])], moods: Object.keys(FREE_MOODS) });
}));

export default r;
