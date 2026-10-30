// What people are into, learned from what they do INSIDE Soulink, only when they have switched on
// Settings › Permissions › "Use my activity for Soul DNA" (users.consent_tracking). Nothing from other apps,
// websites or the phone. Stored as small "interest" events (topics only, never the text), kept 90 days.
import { many, query } from '../db.js';

// topic ← words that point to it (in captions, hashtags and searches). Same topics as the profile interests.
const VOCAB = {
  music: ['music', 'song', 'songs', 'singer', 'singing', 'concert', 'guitar', 'playlist', 'beats'],
  movies: ['movie', 'movies', 'film', 'cinema', 'tollywood', 'bollywood', 'series', 'netflix', 'acting'],
  cricket: ['cricket', 'ipl', 'kohli', 'dhoni', 'bat', 'wicket'],
  fitness: ['gym', 'fitness', 'workout', 'yoga', 'run', 'running', 'protein', 'exercise'],
  travel: ['travel', 'trip', 'trek', 'trekking', 'beach', 'mountains', 'goa', 'roadtrip', 'wanderlust'],
  food: ['food', 'biryani', 'recipe', 'cooking', 'cook', 'foodie', 'chai', 'dosa', 'restaurant'],
  gaming: ['gaming', 'game', 'games', 'bgmi', 'pubg', 'valorant', 'playstation', 'xbox'],
  books: ['book', 'books', 'reading', 'novel', 'poetry', 'author'],
  tech: ['tech', 'coding', 'code', 'ai', 'developer', 'software', 'gadget', 'startup'],
  art: ['art', 'painting', 'sketch', 'drawing', 'design', 'artist'],
  fashion: ['fashion', 'outfit', 'style', 'ootd', 'shopping', 'saree', 'sneakers'],
  photography: ['photo', 'photography', 'camera', 'portrait', 'shot'],
  spirituality: ['temple', 'spiritual', 'meditation', 'god', 'prayer', 'devotional'],
  startups: ['startup', 'startups', 'business', 'founder', 'entrepreneur', 'investing'],
  dance: ['dance', 'dancing', 'choreography', 'bharatanatyam', 'kuchipudi'],
};
const WORD = Object.fromEntries(Object.entries(VOCAB).flatMap(([topic, words]) => words.map((w) => [w, topic])));
const SPARK_TOPIC = { travel: 'travel', cooking: 'food', acting: 'movies', fitness: 'fitness', news: null };

export function topicsOf(text) {
  const out = new Set();
  for (const w of String(text || '').toLowerCase().replace(/[#@]/g, ' ').split(/[^a-z0-9]+/)) if (WORD[w]) out.add(WORD[w]);
  return [...out];
}
export const sparkTopic = (category) => SPARK_TOPIC[category] || null;

/** Record what someone showed interest in (only with their consent). kind: like | react | view | search */
export function track(user, kind, text, extra = []) {
  if (!user?.consent_tracking) return;
  const topics = [...new Set([...topicsOf(text), ...extra.filter(Boolean)])].slice(0, 6);
  if (!topics.length) return;
  query("INSERT INTO behavior_events (user_id, type, meta) VALUES ($1, N'interest', $2)", [user.id, JSON.stringify({ k: kind, t: topics })]).catch(() => {});
}

const WEIGHT = { like: 2, react: 2, search: 1.5, view: 0.5 };
/** Map(lower-case user id → interests): profile interests + what they showed interest in (last 90 days). */
export async function interestsFor(ids) {
  const out = new Map();
  if (!ids.length) return out;
  const list = [...new Set(ids.map((x) => String(x).toLowerCase()))];
  for (let i = 0; i < list.length; i += 400) {
    const part = list.slice(i, i + 400);
    const ph = part.map((_, j) => `$${j + 1}`).join(', ');
    const users = await many(`SELECT id, interests, consent_tracking FROM users WHERE id IN (${ph})`, part);
    const events = await many(`SELECT user_id, meta FROM behavior_events WHERE type=N'interest' AND created_at > DATEADD(day, -90, SYSDATETIMEOFFSET()) AND user_id IN (${ph})`, part).catch(() => []);
    const counts = new Map();
    for (const e of events) {
      let m; try { m = typeof e.meta === 'string' ? JSON.parse(e.meta) : e.meta; } catch { continue; }
      const key = String(e.user_id).toLowerCase(); const c = counts.get(key) || {};
      for (const t of m?.t || []) c[t] = (c[t] || 0) + (WEIGHT[m.k] ?? 1);
      counts.set(key, c);
    }
    for (const u of users) {
      const key = String(u.id).toLowerCase();
      let own = []; try { own = (typeof u.interests === 'string' ? JSON.parse(u.interests || '[]') : u.interests) || []; } catch { own = []; }
      const learned = u.consent_tracking ? Object.entries(counts.get(key) || {}).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t) : [];
      out.set(key, [...new Set([...own.map((x) => String(x).toLowerCase()), ...learned])]);
    }
  }
  return out;
}
