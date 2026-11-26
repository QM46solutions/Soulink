// "Spread around" / Boost: pay to show a Spark or a post to more people for 1, 3 or 7 days, by city and age.
// Shared by routes/sparks.js and routes/posts.js (kept here so the two don't import each other).
export const SPREAD_PLANS = [
  { days: 1, priceInr: 49, reach: '1-2K people' },
  { days: 3, priceInr: 129, reach: '4-6K people' },
  { days: 7, priceInr: 249, reach: '10-15K people' },
];
export const spreadView = (sp) => sp ? ({
  id: sp.id, days: sp.days, city: sp.city || null, ageMin: sp.age_min, ageMax: sp.age_max, priceInr: Math.round(sp.amount_paise / 100),
  test: sp.status === 'test', live: sp.status !== 'stopped' && new Date(sp.ends_at) > new Date(),
  startsAt: sp.starts_at, endsAt: sp.ends_at, impressions: Number(sp.impressions || 0),
}) : null;
/** the viewer's age in whole years (null if no birth date) */
export const ageOf = (u) => (u?.birth_date ? Math.floor((Date.now() - new Date(u.birth_date)) / 31557600000) : null);
