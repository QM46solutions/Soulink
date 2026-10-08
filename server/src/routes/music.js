// Music search for posts, Moments and Sparks.
//  GET /music/search?source=saavn|deezer|free&q=   (login) -> { tracks: [{ ref, source, title, artist, cover, duration, full, previewUrl }] }
//  GET /music/play/:ref                            (public, for <audio>) -> redirect to a fresh stream link
import { Router } from 'express';
import { z } from 'zod';
import { ah, HttpError } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { MUSIC_SOURCES, REF_RE, searchMusic, streamUrl } from '../services/music.js';

const r = Router();

r.get('/play/:ref', ah(async (req, res) => {
  const ref = String(req.params.ref || '');
  if (!REF_RE.test(ref)) throw new HttpError(404, 'No such song', 'no_song');
  let url = null;
  try { url = await streamUrl(ref); } catch { /* source not answering */ }
  if (!url) throw new HttpError(404, "This song isn't available right now", 'song_unavailable');
  res.set('Cache-Control', 'no-store');
  res.redirect(302, url);
}));

r.get('/search', requireAuth, ah(async (req, res) => {
  const { source, q } = z.object({ source: z.enum(MUSIC_SOURCES).default('saavn'), q: z.string().max(100).default('') }).parse(req.query);
  try { res.json({ tracks: await searchMusic(source, q) }); }
  catch (e) {
    const name = { saavn: 'JioSaavn', deezer: 'Deezer', free: 'Free music' }[source];
    throw new HttpError(502, `${name} isn't answering right now. Try another tab or again in a minute.`, 'music_unavailable');
  }
}));

export default r;
