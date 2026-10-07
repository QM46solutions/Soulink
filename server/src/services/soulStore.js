// Loading Soul DNA from the database and scoring pairs (predicted from Soul DNA only; chats and meetups stay private).
import { many, one, tx } from '../db.js';
import { buildAxes, compat, compatAll, relationOf, traitsFromAxes } from './soulDna.js';
import { TRAITS, soulTypeOf } from './soulQuiz.js';
import { applyPinsAll, pinsFor } from './soulPins.js';

const parse = (v) => { if (v && typeof v === 'object') return v; try { return JSON.parse(v || 'null'); } catch { return null; } };

/** Completed DNA for a list of user ids → Map(lower-case id → dna) */
export async function loadDna(ids) {
  const list = [...new Set(ids.filter(Boolean).map((x) => String(x).toLowerCase()))];
  const out = new Map();
  if (!list.length) return out;
  for (let i = 0; i < list.length; i += 500) {
    const part = list.slice(i, i + 500);
    const rows = await many(`SELECT user_id, dna FROM soul_dna WHERE completed_at IS NOT NULL AND user_id IN (${part.map((_, j) => `$${j + 1}`).join(', ')})`, part);
    for (const r of rows) { const d = parse(r.dna); if (d?.axes) out.set(String(r.user_id).toLowerCase(), d); }
  }
  return out;
}

/** Which relation two people are about: their connection's intent, else an open request's, else friendship. */
export async function relationBetween(a, b) {
  const c = await one('SELECT TOP 1 intent FROM connections WHERE (user_a=$1 AND user_b=$2) OR (user_a=$2 AND user_b=$1)', [a, b]);
  if (c) return relationOf(c.intent);
  const q = await one(`SELECT TOP 1 intent, accepted_intent FROM connection_requests WHERE ((from_id=$1 AND to_id=$2) OR (from_id=$2 AND to_id=$1)) ORDER BY created_at DESC`, [a, b]);
  return q ? relationOf(q.accepted_intent || q.intent) : 'friendship';
}

/** One number (0-100) for a pair and a request intent; null if either has no Soul DNA yet. */
export async function scoreFor(aId, bId, intent) {
  const m = await loadDna([aId, bId]);
  const pin = (await pinsFor(aId, bId))[relationOf(intent)];
  if (pin != null) return pin;
  const A = m.get(String(aId).toLowerCase()); const B = m.get(String(bId).toLowerCase());
  return A && B ? compat(A, B, relationOf(intent)).overall : null;
}

/** Headline scores for every relation + the one that applies, for profile cards. */
export async function headline(aId, bId) {
  const m = await loadDna([aId, bId]);
  const A = m.get(String(aId).toLowerCase()); const B = m.get(String(bId).toLowerCase());
  const pins = await pinsFor(aId, bId); // special pairs chosen by the Soulink team
  const pinned = Object.keys(pins);
  if (!A || !B) return pinned.length ? { relation: pinned[0], all: applyPinsAll({}, pins) } : null;
  // pins replace only their own relation's score; the default tab and every other score stay as calculated
  const relation = await relationBetween(aId, bId);
  return { relation, all: applyPinsAll(compatAll(A, B), pins) };
}

/** Observed compatibility from check-ins after real chats (both people's latest few). */
/** Saves a finished answer set as the person's Soul DNA (+ classic traits + Soul type). Returns { user, dna, type, tagline }. */
export async function saveCompletedDna(userId, answers) {
  const dna = buildAxes(answers);
  const traits = traitsFromAxes(dna.axes);
  const { type, tagline } = soulTypeOf(traits);
  const user = await tx(async (c) => {
    const has = (await c.query('SELECT 1 AS x FROM soul_dna WHERE user_id=$1', [userId])).rows[0];
    if (has) await c.query('UPDATE soul_dna SET answers=$2, dna=$3, completed_at=SYSDATETIMEOFFSET(), updated_at=SYSDATETIMEOFFSET() WHERE user_id=$1', [userId, JSON.stringify(answers), JSON.stringify(dna)]);
    else await c.query('INSERT INTO soul_dna (user_id, answers, dna, completed_at) VALUES ($1, $2, $3, SYSDATETIMEOFFSET())', [userId, JSON.stringify(answers), JSON.stringify(dna)]);
    // the 8 classic traits are kept for Soul type names and the Discover personality filters
    await c.query('DELETE FROM soul_profiles WHERE user_id=$1', [userId]);
    await c.query(
      `INSERT INTO soul_profiles (user_id, ${TRAITS.join(', ')}, summary, confidence, quiz_answers)
       VALUES ($1, ${TRAITS.map((_, i) => `$${i + 2}`).join(', ')}, $10, $11, $12)`,
      [userId, ...TRAITS.map((t) => traits[t]), tagline, 70, JSON.stringify(answers)],
    );
    return (await c.query('UPDATE users SET soul_ready=1, soul_type=$2, updated_at=SYSDATETIMEOFFSET() OUTPUT INSERTED.* WHERE id=$1', [userId, type])).rows[0];
  });
  return { user, dna, type, tagline };
}
