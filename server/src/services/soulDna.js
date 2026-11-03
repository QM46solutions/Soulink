// Soul DNA v5: a model of how a person thinks, acts and reacts, and how two such minds fit — built from 7 short
// games (plus 3 taps about what you want) instead of a long quiz.
// This file is the front door the rest of the server uses; the logic lives in ./mind/:
//   mind/scenarios.js  the games: items, what each choice means (traits), deal-breaker chips
//   mind/model.js      answers → mind model (confidence, gut-reaction timing, firmness, consistency checks)
//   mind/match.js      two minds → compatibility, a different logic per relation type (life partner = a simulation)
//   mind/summary.js    the mind model in plain words ("how you think")
// Everything runs on the server only: the app never receives the traits, weights or rules.
import { CHIPS, CHIP_KEYS, FIRM, LAYERS, SCENARIOS, planFor } from './mind/scenarios.js';
import { CHOICE_KINDS, DIAL_KINDS, buildMind, corePlan, CORE_SIZE, extendPart, extendPlan, nextScenarios, optionOf } from './mind/model.js';
import { compat as compatMinds, compatAll as compatAllMinds, DIMS, FOCUS, RELATIONS, RELATION_KEYS, relationOf, setRarity } from './mind/match.js';
import { classicTraits, howTheyThink, selfView as selfViewMind } from './mind/summary.js';

export { DIMS, RELATIONS, RELATION_KEYS, relationOf, CORE_SIZE, corePlan, extendPart, extendPlan, planFor, setRarity, CHIPS };
export const DNA_VERSION = 5;
/** Soul DNA versions that can still be matched (a v4 Soul DNA keeps working until its owner plays the games). */
export const DNA_VERSIONS = [4, 5];

export const SECTIONS = LAYERS;
export const QUESTIONS = SCENARIOS.map((s) => ({ ...s, section: s.layer, type: CHOICE_KINDS.includes(s.kind) ? 'choice' : s.kind }));
export const QUESTION_IDS = QUESTIONS.map((q) => q.id);
const QMAP = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

/** Game 1 photos come from Unsplash (free for commercial use), resized by their CDN to a small 4:3 tile. */
const photoUrl = (id) => `https://images.unsplash.com/photo-${id}?w=480&h=360&fit=crop&q=70&fm=jpg&auto=format`;
const okTiming = (v) => (v.ms == null || (Number.isFinite(v.ms) && v.ms >= 0 && v.ms < 3_600_000)) && (v.ch == null || (Number.isInteger(v.ch) && v.ch >= 0 && v.ch < 50));
const chipList = (x) => Array.isArray(x) && x.length <= CHIP_KEYS.length && x.every((k) => CHIP_KEYS.includes(k)) && new Set(x).size === x.length;

/** One answer, checked against its item's kind (see mind/scenarios.js for the shapes). */
export function validAnswer(q, v) {
  if (!q) return false;
  if (q.kind === 'mostleast') {
    if (!v || typeof v !== 'object') return false;
    const n = q.options.length;
    return Number.isInteger(v.m) && Number.isInteger(v.l) && v.m !== v.l && v.m >= 0 && v.l >= 0 && v.m < n && v.l < n && okTiming(v);
  }
  if (q.kind === 'me') return !!v && typeof v === 'object' && chipList(v.s);
  if (q.kind === 'boxes') return !!v && typeof v === 'object' && chipList(v.must || []) && chipList(v.never || []) && !(v.must || []).some((k) => (v.never || []).includes(k));
  const o = optionOf(v);
  if (!Number.isInteger(o) || o < 0 || o >= q.options.length) return false;
  if (typeof v === 'object') {
    if (!okTiming(v)) return false;
    if (DIAL_KINDS.includes(q.kind) && !(Number.isInteger(v.f) && v.f >= 0 && v.f < FIRM.level.length)) return false;
  } else if (DIAL_KINDS.includes(q.kind)) return false; // the firmness dial is part of the answer
  return true;
}
/** Answers kept (valid ones only), normalised. */
export function cleanAnswers(answers) {
  const out = {};
  for (const [id, v] of Object.entries(answers || {})) {
    const q = QMAP[id];
    if (!validAnswer(q, v)) continue;
    const t = typeof v === 'object' ? { ...(v.ms != null ? { ms: Math.round(v.ms) } : {}), ...(v.ch ? { ch: v.ch } : {}) } : {};
    if (q.kind === 'mostleast') out[id] = { m: v.m, l: v.l, ...t };
    else if (q.kind === 'me') out[id] = { s: [...v.s] };
    else if (q.kind === 'boxes') out[id] = { must: [...(v.must || [])], never: [...(v.never || [])] };
    else out[id] = typeof v === 'object' ? { o: v.o, ...(DIAL_KINDS.includes(q.kind) ? { f: v.f } : {}), ...t } : v;
  }
  return out;
}
/** Only answers to today's games (older Soul DNA answers are dropped once someone starts playing). */
export const knownAnswers = (answers) => Object.fromEntries(Object.entries(answers || {}).filter(([id]) => QMAP[id]));
export const answeredCount = (answers, plan = planFor(answers)) => plan.filter((id) => answers?.[id] !== undefined).length;
/** Every game of the person's own plan played. */
export const isComplete = (answers, plan = planFor(answers || {})) => plan.every((id) => answers?.[id] !== undefined);

/** The games as sent to the app: text, emoji and kind only, never what a choice means. */
export const publicQuestions = (ids = QUESTION_IDS) => ids.filter((id) => QMAP[id]).map((id) => {
  const q = QMAP[id];
  return {
    id: q.id, section: q.section, kind: q.kind, type: q.type, text: q.text,
    options: q.options.map((x) => x.label), emojis: q.options.map((x) => x.emoji || ''),
    ...(q.options.some((x) => x.photo) ? { photos: q.options.map((x) => (x.photo ? photoUrl(x.photo) : null)) } : {}),
    ...(q.screen ? { screen: q.screen } : {}), ...(q.variant ? { variant: q.variant } : {}),
    ...(DIAL_KINDS.includes(q.kind) ? { dial: FIRM.labels } : {}),
    ...(q.kind === 'me' || q.kind === 'boxes' ? { chips: CHIPS } : {}),
  };
});

// ---------- the mind model ----------
/** Answers → Soul DNA (kept as buildAxes: the name the rest of the server uses). Only the person's own plan counts. */
export const buildAxes = (answers) => {
  const plan = new Set(planFor(answers || {}));
  return buildMind(Object.fromEntries(Object.entries(answers || {}).filter(([id]) => plan.has(id))));
};
export const traitsFromAxes = (dna) => classicTraits(dna);
export const selfView = (dna) => selfViewMind(dna);
export const theirMind = (dna) => howTheyThink(dna, false);
export const compat = (A, B, relation) => compatMinds(A, B, relation);
export const compatAll = (A, B) => compatAllMinds(A, B);

/**
 * Request-time questions: up to `n` single-tap items for `asker` about what the app can't judge yet for this pair
 * and this relation. Everyone plays every game now, so this is usually empty.
 */
export function pairQuestions(askerAnswers, A, B, relation, n = 3) {
  const focus = FOCUS[relation] || FOCUS.friendship;
  const unsure = {};
  for (const [t, w] of Object.entries(focus)) {
    const u = Math.max(1 - (A.traits?.[t]?.c ?? 0), 1 - (B.traits?.[t]?.c ?? 0));
    if (u > 0.45) unsure[t] = w * u;
  }
  if (!Object.keys(unsure).length) return [];
  return nextScenarios(A, askerAnswers, n, Object.fromEntries(Object.keys(focus).map((t) => [t, unsure[t] ?? 0.05])));
}

/** Deterministic full answer set (demo accounts and tests). Different k → a different person. Covers both loyalty versions. */
export function sampleAnswers(k = 0) {
  const out = {};
  QUESTIONS.forEach((q, i) => {
    const n = q.options.length;
    if (q.kind === 'mostleast') { const m = (i + k) % n; out[q.id] = { m, l: (m + 2) % n }; }
    else if (q.kind === 'me') out[q.id] = { s: CHIP_KEYS.filter((_, j) => (j + k) % 3 === 0) };
    else if (q.kind === 'boxes') out[q.id] = { must: [], never: [] };
    else if (DIAL_KINDS.includes(q.kind)) out[q.id] = { o: (i + k) % n, f: (i + k) % 3 === 2 ? 1 : (i + k) % 3 };
    else out[q.id] = (i + k) % n;
  });
  return out;
}
