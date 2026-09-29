// Soul Filters: shared lists and helpers for the Discover screen and the filter screen.
import { intentOf } from './intents';

export const INTERESTS = ['Music', 'Movies', 'Cricket', 'Fitness', 'Travel', 'Food', 'Gaming', 'Books', 'Tech', 'Art', 'Fashion', 'Photography', 'Spirituality', 'Startups', 'Dance'];
export const LANGUAGES = ['Telugu', 'Hindi', 'English', 'Urdu', 'Tamil', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Odia'];
export const GENDERS = [{ v: 'female', l: 'Women' }, { v: 'male', l: 'Men' }, { v: 'non_binary', l: 'Non-binary' }];
export const DISTANCES = [2, 5, 10, 25, 50];
export const SCORES = [50, 60, 70, 80, 90];
export const SORTS = [
  { v: 'match', l: 'Best match', icon: 'sparkles' },
  { v: 'nearest', l: 'Nearest', icon: 'navigate' },
  { v: 'active', l: 'Active', icon: 'pulse' },
  { v: 'newest', l: 'New', icon: 'leaf' },
];
export const PREMIUM_KEYS = ['minScore', 'soulTypes', 'nature', 'mentality'];

const has = (v) => v !== undefined && v !== null && v !== false && !(Array.isArray(v) && !v.length);

/** Removes empty values so the server gets only real filters. */
export const clean = (f) => Object.fromEntries(Object.entries(f || {}).filter(([, v]) => has(v)));

/** Short chips describing the active filters: [{ key, label }] (sort is not a filter). */
export function summary(f = {}) {
  const out = [];
  if (f.intents?.length) out.push({ key: 'intents', label: f.intents.map((i) => `${intentOf(i).emoji} ${intentOf(i).label}`).join(', ') });
  if (f.ageMin || f.ageMax) out.push({ key: 'age', label: `Age ${f.ageMin || 18}–${f.ageMax || '60+'}` });
  if (f.genders?.length) out.push({ key: 'genders', label: f.genders.map((g) => GENDERS.find((x) => x.v === g)?.l).join(', ') });
  if (f.area) out.push({ key: 'area', label: f.area.split(',')[0] });
  if (f.distanceKm) out.push({ key: 'distanceKm', label: `Within ${f.distanceKm} km` });
  if (f.verifiedOnly) out.push({ key: 'verifiedOnly', label: 'Verified only' });
  if (f.active) out.push({ key: 'active', label: f.active === 'today' ? 'Active today' : 'Active this week' });
  if (f.interests?.length) out.push({ key: 'interests', label: f.interests.join(', ') });
  if (f.minShared) out.push({ key: 'minShared', label: `${f.minShared}+ shared interests` });
  if (f.sameCollege) out.push({ key: 'sameCollege', label: 'Same college' });
  if (f.sameCompany) out.push({ key: 'sameCompany', label: 'Same company' });
  if (f.languages?.length) out.push({ key: 'languages', label: f.languages.join(', ') });
  if (f.minScore) out.push({ key: 'minScore', label: `Soul Score ${f.minScore}%+`, premium: true });
  if (f.soulTypes?.length) out.push({ key: 'soulTypes', label: f.soulTypes.join(', '), premium: true });
  if (f.nature) out.push({ key: 'nature', label: f.nature === 'introvert' ? 'Introvert' : 'Extrovert', premium: true });
  if (f.mentality) out.push({ key: 'mentality', label: f.mentality === 'dreamer' ? 'Dreamer' : 'Practical', premium: true });
  return out;
}

/** Removes one summary chip's filter. */
export function without(f, key) {
  const n = { ...f };
  if (key === 'age') { delete n.ageMin; delete n.ageMax; } else delete n[key];
  return n;
}
