// Soul DNA v7: a model of how a person thinks, acts and reacts, and how two such minds fit — built from 8 fixed
// categories, each with a bank of short, playful activities: an 11-activity first session, then optional check-ins.
// This file is the front door the rest of the server uses; the logic lives in ./mind/:
//   mind/scenarios.js  the categories, the activity bank, what each answer means (traits), the first-session plan
//   mind/model.js      answers (+ an older Soul DNA) → mind model (confidence, timing, firmness, check-in picks)
//   mind/match.js      two minds → compatibility, a different logic per relation type (life partner = a simulation)
//   mind/summary.js    the mind model in plain words: tendencies per category, with how sure Soul DNA is
// Everything runs on the server only: the app never receives the traits, weights or rules.
import { COUPLE_FIRST, FIRM, HABITS, HABIT_KEYS, LAYERS, NEEDS, NEED_LEVELS, NEED_MAP, NO_SKIP, SCENARIOS, planFor, FIRST_SIZE } from './mind/scenarios.js';
import { CHOICE_KINDS, DNA_V, baseOf, buildMind, checkinPlan, nextScenarios, optionOf } from './mind/model.js';
import { compat as compatMinds, compatAll as compatAllMinds, DIMS, FOCUS, RELATIONS, RELATION_KEYS, relationOf, setRarity } from './mind/match.js';
import { categories, classicTraits, howTheyThink, selfView as selfViewMind } from './mind/summary.js';

export { DIMS, RELATIONS, RELATION_KEYS, relationOf, planFor, setRarity, baseOf, checkinPlan, categories };
export const DNA_VERSION = DNA_V;
/** Soul DNA versions that can still be matched (an older Soul DNA keeps working; its owner is invited to refresh). */
export const DNA_VERSIONS = [4, 5, 6, 7];
export const CORE_SIZE = FIRST_SIZE;

export const SECTIONS = LAYERS;
export const QUESTIONS = SCENARIOS.map((s) => ({ ...s, section: s.layer, type: CHOICE_KINDS.includes(s.kind) ? 'choice' : s.kind }));
export const QUESTION_IDS = QUESTIONS.map((q) => q.id);
const QMAP = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

const okTiming = (v) => (v.ms == null || (Number.isFinite(v.ms) && v.ms >= 0 && v.ms < 3_600_000)) && (v.ch == null || (Number.isInteger(v.ch) && v.ch >= 0 && v.ch < 50));
const idx = (x, n) => Number.isInteger(x) && x >= 0 && x < n;
const distinct = (xs) => new Set(xs).size === xs.length;

/** One answer, checked against its activity's kind (see mind/scenarios.js for the shapes). */
export function validAnswer(q, v) {
  if (!q || v == null || typeof v !== 'object' || Array.isArray(v)) return false;
  if (!okTiming(v)) return false;
  if (v.skip === true) return !NO_SKIP.has(q.kind) && !q.noSkip;
  switch (q.kind) {
    case 'react': return idx(v.o, q.options.length);
    case 'more': return idx(v.o, 2) && (!q.firm || idx(v.f, FIRM.level.length));
    case 'slider': return idx(v.v, 5);
    case 'rank': return Array.isArray(v.r) && v.r.length === q.options.length && v.r.every((k) => idx(k, q.options.length)) && distinct(v.r);
    case 'day': return Array.isArray(v.s) && v.s.length === q.slots.length && v.s.every((k, i) => idx(k, q.slots[i].options.length));
    case 'tiles': return Array.isArray(v.s) && v.s.length >= 1 && v.s.length <= (q.max || 3) && v.s.every((k) => idx(k, q.options.length)) && distinct(v.s);
    case 'habits': return HABITS.every((h) => v[h.key] === -1 || idx(v[h.key], h.options.length));
    case 'needs': return Object.entries(v).every(([k, lvl]) => ['ms', 'ch'].includes(k) || (NEED_MAP[k] && NEED_LEVELS.includes(lvl) && !(lvl === 'never' && NEED_MAP[k].group !== 'life')));
    default: return false;
  }
}
/** Answers kept (valid ones only), normalised to their shape. */
export function cleanAnswers(answers) {
  const out = {};
  for (const [id, v] of Object.entries(answers || {})) {
    const q = QMAP[id];
    if (!validAnswer(q, v)) continue;
    const t = { ...(v.ms != null ? { ms: Math.round(v.ms) } : {}), ...(v.ch ? { ch: v.ch } : {}) };
    if (v.skip) { out[id] = { skip: true, ...(v.d ? { d: 1 } : {}), ...t }; continue; }
    switch (q.kind) {
      case 'react': out[id] = { o: v.o, ...t }; break;
      case 'more': out[id] = { o: v.o, ...(q.firm ? { f: v.f } : {}), ...t }; break;
      case 'slider': out[id] = { v: v.v, ...t }; break;
      case 'rank': out[id] = { r: [...v.r], ...t }; break;
      case 'day': case 'tiles': out[id] = { s: [...v.s], ...t }; break;
      case 'habits': out[id] = Object.fromEntries(HABIT_KEYS.map((k) => [k, v[k]])); break;
      case 'needs': out[id] = Object.fromEntries(Object.entries(v).filter(([k]) => NEED_MAP[k])); break;
      default: break;
    }
  }
  return out;
}
/** Only answers to today's activities (older Soul DNA answers live on in the Soul DNA itself, as its base). */
export const knownAnswers = (answers) => Object.fromEntries(Object.entries(answers || {}).filter(([id]) => QMAP[id]));
export const answeredCount = (answers, plan) => plan.filter((id) => answers?.[id] !== undefined).length;
/** The whole first session played. */
export const isComplete = (answers, plan) => plan.every((id) => answers?.[id] !== undefined);

/** The activities as sent to the app: text, choices and kind only, never what a choice means. */
export const publicQuestions = (ids = QUESTION_IDS) => ids.filter((id) => QMAP[id]).map((id) => {
  const q = QMAP[id];
  return {
    id: q.id, section: q.section, kind: q.kind, type: q.type, text: q.text,
    options: q.options.map((x) => x.label),
    ...(q.look ? { look: q.look } : {}),
    ...(q.anchor ? { anchor: true } : {}),
    ...(NO_SKIP.has(q.kind) || q.noSkip ? { noSkip: true } : {}),
    ...(q.firm ? { dial: FIRM.labels } : {}),
    ...(q.kind === 'tiles' ? { max: q.max || 3, icons: q.options.map((x) => x.icon) } : {}),
    ...(q.kind === 'day' ? { slots: q.slots.map((s) => ({ name: s.name, options: s.options.map((x) => x.label) })) } : {}),
    ...(q.kind === 'habits' ? { groups: HABITS } : {}),
    ...(q.kind === 'needs' ? { chips: NEEDS.map((n) => ({ key: n.key, label: n.label, group: n.group })) } : {}),
  };
});

// ---------- the mind model ----------
/** Answers (+ an older Soul DNA it carries on from) → Soul DNA (kept as buildAxes: the name the server uses). */
export const buildAxes = (answers, base = null) => buildMind(knownAnswers(answers || {}), base);
export const traitsFromAxes = (dna) => classicTraits(dna);
export const selfView = (dna) => selfViewMind(dna);
export const theirMind = (dna) => howTheyThink(dna, false);
export const compat = (A, B, relation) => compatMinds(A, B, relation);
export const compatAll = (A, B) => compatAllMinds(A, B);

/**
 * Request-time questions: up to `n` single-tap activities for `asker` about what the app can't judge yet for this
 * pair and relation. A first dating / life-partner request asks about life stage and kids first.
 */
export function pairQuestions(askerAnswers, A, B, relation, n = 3) {
  const focus = FOCUS[relation] || FOCUS.friendship;
  const couple = relation === 'dating' || relation === 'lifepartner';
  const unsure = {};
  for (const [t, w] of Object.entries(focus)) {
    const u = Math.max(1 - (A.traits?.[t]?.c ?? 0), 1 - (B.traits?.[t]?.c ?? 0));
    if (u > 0.45) unsure[t] = w * u;
  }
  const first = couple && !A.intent?.stage ? COUPLE_FIRST.filter((id) => !(id === 're3' && A.intent?.kids)) : [];
  return nextScenarios(A, askerAnswers, n, unsure, first);
}

/** Deterministic full answer set (demo accounts and tests). Different k → a different person. Every activity. */
export function sampleAnswers(k = 0) {
  const out = {};
  QUESTIONS.forEach((q, i) => {
    const n = q.options.length; const j = i + k;
    switch (q.kind) {
      case 'react': out[q.id] = { o: j % n }; break;
      case 'more': out[q.id] = { o: j % 2, ...(q.firm ? { f: j % 3 } : {}) }; break;
      case 'slider': out[q.id] = { v: j % 5 }; break;
      case 'rank': { const r = [0, 1, 2, 3].map((x) => (x + j) % 4); out[q.id] = { r }; break; }
      case 'day': out[q.id] = { s: q.slots.map((s, x) => (j + x) % s.options.length) }; break;
      case 'tiles': out[q.id] = { s: [j % n, (j + 5) % n, (j + 11) % n] }; break;
      case 'habits': out[q.id] = Object.fromEntries(HABITS.map((h, x) => [h.key, (j + x) % h.options.length])); break;
      case 'needs': out[q.id] = { word: 'must', talk: 'nice', ...(k % 2 ? { no_smoke: 'must' } : {}) }; break;
      default: break;
    }
  });
  return out;
}
export const optionIndex = optionOf;
