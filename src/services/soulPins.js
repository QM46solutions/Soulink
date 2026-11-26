// Fixed scores for special pairs, chosen by the Soulink team (no Soul DNA maths for that pair + relation).
// Every other pair, and these people with anyone else, are scored normally.
import { many } from '../db.js';
import { DIMS, RELATIONS } from './soulDna.js';

export const PINS = [
  { users: ['akhii', 'nikhil.cheedella'], relation: 'lifepartner', score: 93 },
];

let cache = null; let cachedAt = 0;
async function resolved() {
  if (cache && Date.now() - cachedAt < 5 * 60_000) return cache; // re-check usernames every 5 minutes
  const names = [...new Set(PINS.flatMap((p) => p.users))];
  const rows = names.length ? await many(`SELECT id, username FROM users WHERE username IN (${names.map((_, i) => `$${i + 1}`).join(', ')})`, names) : [];
  const idOf = Object.fromEntries(rows.map((r) => [r.username, String(r.id).toLowerCase()]));
  const all = PINS.map((p) => ({ ...p, ids: p.users.map((u) => idOf[u]) }));
  const ready = all.filter((p) => p.ids.every(Boolean));
  if (ready.length === all.length) { cache = ready; cachedAt = Date.now(); } // someone not signed up yet: look again next time
  return ready;
}

/** All pins with user ids (for code that checks many pairs at once). */
export const loadPins = () => resolved();
/** { relation: score } fixed for this pair, from a loadPins() table (empty if none). */
export function pinsIn(table, aId, bId) {
  const a = String(aId).toLowerCase(); const b = String(bId).toLowerCase();
  const out = {};
  for (const p of table) if (p.ids.includes(a) && p.ids.includes(b) && a !== b) out[p.relation] = p.score;
  return out;
}
/** { relation: score } fixed for this pair (empty if none). */
export async function pinsFor(aId, bId) { return pinsIn(await resolved(), aId, bId); }

/** Full compat result for a pinned pair + relation (same shape as soulDna.compat). */
export function pinnedCompat(relation, score) {
  const rel = RELATIONS[relation];
  const keys = Object.keys(rel.weights).sort((x, y) => rel.weights[y] - rel.weights[x]);
  const dims = keys.map((k, i) => ({ key: k, label: DIMS[k].label, emoji: DIMS[k].emoji, score: Math.min(99, score + 4 - (i % 5) * 2), weight: rel.weights[k] }))
    .sort((x, y) => y.score - x.score);
  return {
    relation, relationLabel: rel.label, emoji: rel.emoji,
    overall: score, natural: score, relationship: score,
    type: 'Made for each other', typeKey: 'similar', typeLine: 'A rare match: you want the same life, and you know how to build it together.',
    dims, strengths: dims.slice(0, 3), friction: [], dealbreakers: [], pinned: true,
  };
}

/** Apply pins to a compatAll() result (headline numbers per relation). */
export function applyPinsAll(all, pins) {
  for (const [relation, score] of Object.entries(pins)) {
    const c = pinnedCompat(relation, score);
    all[relation] = { overall: c.overall, natural: c.natural, relationship: c.relationship, type: c.type, label: c.relationLabel, emoji: c.emoji };
  }
  return all;
}
