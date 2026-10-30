// Soul Filters: find new people. POST /discover/search with filters → ranked people cards.
// Free: age, gender, area, distance, verified, intent, interests, college/company, languages, recently active.
// Premium (free while config.premiumFreeTrial): minimum Soul Score, Soul type, personality (introvert/extrovert,
// practical/dreamer). Saved per user so the filters are remembered.
import { Router } from 'express';
import { z } from 'zod';
import { many, one } from '../db.js';
import { config } from '../config.js';
import { ah, HttpError } from '../lib/errors.js';
import { ageFrom } from '../lib/auth.js';
import { requireAuth } from '../middleware/auth.js';
import { userCard } from '../services/social.js';
import { SOUL_TYPES, TRAITS } from '../services/soulQuiz.js';
import { compatAll, relationOf } from '../services/soulDna.js';
import { loadDna } from '../services/soulStore.js';
import { distanceKm, placeCoords } from '../services/places.js';
import { INTENT_KEYS } from '../services/connections.js';

export const MIN_MATCH = 75; // Discover shows people who match above this Soul Score

const r = Router();
r.use(requireAuth);

export const LANGUAGES = ['Telugu', 'Hindi', 'English', 'Urdu', 'Tamil', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Odia'];
const PREMIUM_KEYS = ['minScore', 'soulTypes', 'nature', 'mentality'];

const filtersSchema = z.object({
  ageMin: z.number().int().min(18).max(80).optional(),
  ageMax: z.number().int().min(18).max(80).optional(),
  genders: z.array(z.enum(['male', 'female', 'non_binary'])).max(3).optional(),
  area: z.string().trim().max(60).optional(),
  distanceKm: z.number().int().min(1).max(500).optional(),
  verifiedOnly: z.boolean().optional(),
  intents: z.array(z.enum(INTENT_KEYS)).max(7).optional(),
  interests: z.array(z.string().max(30)).max(15).optional(),
  minShared: z.number().int().min(1).max(10).optional(),
  sameCollege: z.boolean().optional(),
  sameCompany: z.boolean().optional(),
  languages: z.array(z.string().max(30)).max(10).optional(),
  active: z.enum(['today', 'week']).optional(),
  minScore: z.number().int().min(30).max(99).optional(),
  soulTypes: z.array(z.string().max(40)).max(16).optional(),
  nature: z.enum(['introvert', 'extrovert']).optional(),
  mentality: z.enum(['practical', 'dreamer']).optional(),
  sort: z.enum(['match', 'nearest', 'active', 'newest']).optional(),
}).strict();

const list = (v) => (Array.isArray(v) ? v : (() => { try { return JSON.parse(v || '[]'); } catch { return []; } })());
const premiumAllowed = (u) => config.premiumFreeTrial || !!u.is_premium;
const norm = (s) => String(s || '').trim().toLowerCase();
// Area coordinates: the saved phone location, or else the typed area (cached per area name)
const cityCache = new Map();
function coordsOf(u) {
  if (u.lat != null && u.lon != null) return { lat: Number(u.lat), lon: Number(u.lon) };
  if (!u.city) return null;
  if (!cityCache.has(u.city)) cityCache.set(u.city, placeCoords(u.city));
  return cityCache.get(u.city);
}

// What the filter screen needs to draw itself
r.get('/options', ah(async (req, res) => {
  res.json({
    soulTypes: SOUL_TYPES, languages: LANGUAGES, intents: INTENT_KEYS,
    premium: { keys: PREMIUM_KEYS, unlocked: premiumAllowed(req.user), freeTrial: config.premiumFreeTrial },
    saved: req.user.discover_filters || {},
    me: { hasLocation: !!coordsOf(req.user), college: req.user.college, company: req.user.company },
  });
}));

r.put('/filters', ah(async (req, res) => {
  const f = filtersSchema.parse(req.body || {});
  await one('UPDATE users SET discover_filters=$2 OUTPUT INSERTED.id WHERE id=$1', [req.user.id, f]);
  res.json({ ok: true, saved: f });
}));

r.post('/search', ah(async (req, res) => {
  const f = filtersSchema.parse(req.body || {});
  const me = req.user;
  if (!premiumAllowed(me) && PREMIUM_KEYS.some((k) => f[k] !== undefined && !(Array.isArray(f[k]) && !f[k].length))) {
    throw new HttpError(402, 'Soul match filters are part of Soulink Premium.', 'premium_required');
  }

  // 1) cheap filters in SQL
  const where = ['u.onboarding_done = 1', 'u.deactivated_at IS NULL', 'u.show_in_discover = 1', 'u.id <> $1',
    'NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=$1))',
    'NOT EXISTS (SELECT 1 FROM connections c WHERE (c.user_a=u.id AND c.user_b=$1) OR (c.user_b=u.id AND c.user_a=$1))'];
  const params = [me.id];
  const add = (sqlText, v) => { params.push(v); where.push(sqlText.replace('?', `$${params.length}`)); };
  const today = new Date();
  const yearsAgo = (n) => { const d = new Date(today); d.setFullYear(d.getFullYear() - n); return d.toISOString().slice(0, 10); };
  if (f.ageMin) add('u.birth_date <= ?', yearsAgo(f.ageMin));
  if (f.ageMax) add('u.birth_date > ?', yearsAgo(f.ageMax + 1));
  if (f.genders?.length) where.push(`u.gender IN (${f.genders.map((g) => { params.push(g); return `$${params.length}`; }).join(', ')})`);
  if (f.verifiedOnly) where.push('u.face_verified = 1');
  if (f.area) add("u.city LIKE ?", `%${f.area.split(',')[0].trim().replace(/[[%_]/g, (c) => `[${c}]`)}%`);
  if (f.sameCollege) { if (!me.college) return res.json({ people: [], note: 'Add your college in Edit profile to use this filter.' }); add('u.college = ?', me.college); }
  if (f.sameCompany) { if (!me.company) return res.json({ people: [], note: 'Add your company in Edit profile to use this filter.' }); add('u.company = ?', me.company); }
  if (f.active === 'today') where.push("u.last_active_at >= DATEADD(day, -1, SYSDATETIMEOFFSET())");
  if (f.active === 'week') where.push("u.last_active_at >= DATEADD(day, -7, SYSDATETIMEOFFSET())");
  if (f.soulTypes?.length) where.push(`u.soul_type IN (${f.soulTypes.map((t) => { params.push(t); return `$${params.length}`; }).join(', ')})`);
  if (f.minScore || f.nature || f.mentality) where.push('u.soul_ready = 1');

  const rows = await many(
    `SELECT TOP 400 u.*, ${TRAITS.map((t) => `sp.${t} AS t_${t}`).join(', ')}
       FROM users u LEFT JOIN soul_profiles sp ON sp.user_id = u.id
      WHERE ${where.join(' AND ')}
      ORDER BY u.last_active_at DESC`, params,
  );

  // 2) the rest in code: intent, interests, languages, distance, personality, Soul Score
  // Soul DNA v2: each person's best match across Dating / Friendship / Business / Buddy
  const dnaMap = me.soul_ready ? await loadDna([me.id, ...rows.map((u) => u.id)]) : new Map();
  const mine = dnaMap.get(String(me.id).toLowerCase()) || null;
  const myInterests = list(me.interests);
  const here = coordsOf(me);
  if (f.distanceKm && !here) return res.json({ people: [], note: 'Turn on location (or pick your area) to use the distance filter.' });

  let people = rows.map((u) => {
    const theirs = u.soul_ready && u.t_nature != null ? Object.fromEntries(TRAITS.map((t) => [t, u[`t_${t}`]])) : null;
    const interests = list(u.interests);
    const shared = myInterests.filter((i) => interests.includes(i));
    const there = coordsOf(u);
    const km = here && there ? Math.round(distanceKm(here, there) * 10) / 10 : null;
    return {
      u, theirs, shared, km,
      openTo: list(u.open_to), languages: list(u.languages),
      ...(() => {
        const other = mine ? dnaMap.get(String(u.id).toLowerCase()) : null;
        if (!other) return { score: null, bestRelation: null };
        // Score only what both people are actually open to (and what the viewer filtered on), not the best of
        // every relation type: someone open only to friendship is never shown as a strong dating match.
        const theirsOpen = new Set(list(u.open_to).map(relationOf));
        const wanted = [...new Set((f.intents?.length ? f.intents : list(me.open_to)).map(relationOf))].filter((rel) => theirsOpen.has(rel));
        if (!wanted.length) return { score: null, bestRelation: null };
        const all = compatAll(mine, other);
        const [bestRelation, best] = Object.entries(all).filter(([rel]) => wanted.includes(rel)).sort((x, y) => y[1].overall - x[1].overall)[0];
        return { score: best.overall, bestRelation, bestLabel: best.label, bestEmoji: best.emoji };
      })(),
    };
  });
  if (f.interests?.length) people = people.filter((p) => list(p.u.interests).some((i) => f.interests.includes(i)));
  if (f.minShared) people = people.filter((p) => p.shared.length >= f.minShared);
  if (f.languages?.length) people = people.filter((p) => p.languages.some((l) => f.languages.map(norm).includes(norm(l))));
  if (f.distanceKm) people = people.filter((p) => p.km != null && p.km <= f.distanceKm);
  // Discover only shows strong matches: Soul Score above 75% (needs both people's Soul DNA)
  people = people.filter((p) => p.score != null && p.score > MIN_MATCH);
  if (f.minScore) people = people.filter((p) => p.score >= f.minScore);
  if (f.nature) people = people.filter((p) => p.theirs && (f.nature === 'extrovert' ? p.theirs.nature >= 55 : p.theirs.nature <= 45));
  if (f.mentality) people = people.filter((p) => p.theirs && (f.mentality === 'dreamer' ? p.theirs.mentality >= 55 : p.theirs.mentality <= 45));

  const sort = f.sort || (mine ? 'match' : 'active');
  const by = {
    match: (a, b) => (b.score ?? -1) - (a.score ?? -1),
    nearest: (a, b) => (a.km ?? 1e9) - (b.km ?? 1e9),
    active: (a, b) => new Date(b.u.last_active_at || 0) - new Date(a.u.last_active_at || 0),
    newest: (a, b) => new Date(b.u.created_at) - new Date(a.u.created_at),
  }[sort];
  people.sort(by);

  res.json({
    sort,
    total: people.length,
    people: people.slice(0, 50).map((p) => ({
      ...userCard(p.u),
      age: p.u.birth_date ? ageFrom(p.u.birth_date) : null,
      city: p.u.city,
      km: p.km,
      soulScore: p.score,
      matchAs: p.bestRelation ? { relation: p.bestRelation, label: p.bestLabel, emoji: p.bestEmoji } : null,
      sharedInterests: p.shared,
      openTo: p.openTo,
      college: p.u.college, company: p.u.company,
      activeRecently: p.u.last_active_at ? Date.now() - new Date(p.u.last_active_at).getTime() < 86400000 : false,
    })),
  });
}));

export default r;
