// Soul DNA v4: a model of how a person thinks, acts and reacts, and how two such minds fit.
// This file is the front door the rest of the server uses; the logic lives in ./mind/:
//   mind/scenarios.js  the scenario bank and the traits it measures (9 layers)
//   mind/model.js      answers → mind model (with confidence, gut-reaction timing, adaptive question choice)
//   mind/match.js      two minds → compatibility, a different logic per relation type (life partner = a simulation)
//   mind/summary.js    the mind model in plain words ("how you think")
// Everything runs on the server only: the app never receives the traits, weights or rules.
import { LAYERS, SCENARIOS, SCENARIO_MAP } from './mind/scenarios.js';
import { buildMind, corePlan, CORE_SIZE, extendPart, extendPlan, nextScenarios, optionOf } from './mind/model.js';
import { compat as compatMinds, compatAll as compatAllMinds, DIMS, FOCUS, RELATIONS, RELATION_KEYS, relationOf } from './mind/match.js';
import { classicTraits, howTheyThink, selfView as selfViewMind } from './mind/summary.js';

export { DIMS, RELATIONS, RELATION_KEYS, relationOf, CORE_SIZE, corePlan, extendPart, extendPlan };
export const DNA_VERSION = 4;

// The quiz, as the rest of the app knows it: every scenario is a "choice" question in a section (= layer)
export const SECTIONS = LAYERS;
export const QUESTIONS = SCENARIOS.map((s) => ({ id: s.id, section: s.layer, type: 'choice', text: s.text, options: s.options }));
export const QUESTION_IDS = QUESTIONS.map((q) => q.id);
const QMAP = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

/** An answer: the option index, or { o: option index | -1 for "Anything else", t: typed text, ms: time to answer, ch: times changed } */
export function validAnswer(q, v) {
  if (!q) return false;
  const o = optionOf(v);
  if (!Number.isInteger(o)) return false;
  if (o === -1) return typeof v === 'object' && typeof v.t === 'string' && v.t.trim().length > 0 && v.t.length <= 300;
  if (o < 0 || o >= q.options.length) return false;
  if (typeof v === 'object') {
    if (v.ms != null && !(Number.isFinite(v.ms) && v.ms >= 0 && v.ms < 3_600_000)) return false;
    if (v.ch != null && !(Number.isInteger(v.ch) && v.ch >= 0 && v.ch < 50)) return false;
  }
  return true;
}
/** Answers kept (valid ones only), with any typed "Anything else" text trimmed. */
export function cleanAnswers(answers) {
  const out = {};
  for (const [id, v] of Object.entries(answers || {})) {
    if (!validAnswer(QMAP[id], v)) continue;
    out[id] = typeof v === 'object' ? { o: v.o, ...(v.o === -1 ? { t: String(v.t).trim().slice(0, 300) } : {}), ...(v.ms != null ? { ms: Math.round(v.ms) } : {}), ...(v.ch ? { ch: v.ch } : {}) } : v;
  }
  return out;
}
export const answeredCount = (answers) => Object.keys(answers || {}).filter((id) => QMAP[id]).length;
/** Enough answered to build a Soul DNA: the whole personal plan (at least the core size). */
export const isComplete = (answers, plan) => {
  const ids = plan?.length ? plan : null;
  return ids ? ids.every((id) => answers?.[id] !== undefined) && answeredCount(answers) >= Math.min(CORE_SIZE, ids.length) : answeredCount(answers) >= CORE_SIZE;
};

/** The quiz as sent to the app: text and choices only, never what a choice means. */
export const publicQuestions = (ids = QUESTION_IDS) => ids.filter((id) => QMAP[id]).map((id) => {
  const q = QMAP[id];
  return { id: q.id, section: q.section, type: 'choice', text: q.text, options: q.options.map((o) => o.label), allowOther: true };
});

// ---------- the mind model ----------
/** Answers → Soul DNA (kept as buildAxes: the name the rest of the server uses). */
export const buildAxes = (answers) => buildMind(answers);
export const traitsFromAxes = (dna) => classicTraits(dna);
export const selfView = (dna) => selfViewMind(dna);
export const theirMind = (dna) => howTheyThink(dna, false);
export const compat = (A, B, relation) => compatMinds(A, B, relation);
export const compatAll = (A, B) => compatAllMinds(A, B);

/**
 * Request-time questions: up to `n` scenarios for `asker` about what the app can't judge yet for this pair and this
 * relation (traits that matter for the relation where either person's model is unsure).
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

/** Deterministic full answer set (demo accounts and tests). Different k → a different person. */
export function sampleAnswers(k = 0) {
  const out = {};
  QUESTIONS.forEach((q, i) => { out[q.id] = (i + k) % q.options.length; });
  return out;
}
