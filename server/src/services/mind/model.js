// Soul DNA v5: building a person's mind model from their game answers.
// Every answer is EVIDENCE about some traits. Evidence is weighed by how the person answered (gut-reaction timing,
// changing their mind, how firm they said they are), so the model knows not only "where" someone is on a trait
// but how SURE it is. Two quiet consistency checks lower the weight of answers that contradict each other.
// Besides traits, the model keeps what can't be averaged: what you want (intent), your deal-breaker chips, your
// loyalty lines (with how firm each one is) and your value picks — these are compared directly between two people.
import { CHIP_KEYS, CHIP_SET, FIRM, SCENARIOS, SCENARIO_MAP, TRAITS, planFor } from './scenarios.js';

const PRIOR = { m: 50, w: 0.6 }; // knowing nothing = the middle, with very little weight
export const CHOICE_KINDS = ['pick', 'react', 'vs', 'loyal', 'check', 'day'];
export const DIAL_KINDS = ['vs', 'loyal'];

/** How much one answer counts, from how it was given. Quick, confident picks = gut truth; long hesitation or
 *  changing the answer = inner conflict, so it counts a bit less. Very fast taps may be random. */
export function answerWeight(a) {
  if (a == null || typeof a !== 'object') return 1; // plain option index: normal weight
  let w = 1;
  const ms = Number(a.ms) || 0;
  if (ms > 0 && ms < 700) w *= 0.8;          // too quick to have read it
  else if (ms >= 700 && ms <= 5000) w *= 1.15; // gut reaction
  else if (ms > 15000) w *= 0.8;               // long hesitation
  if (Number(a.ch) > 0) w *= 0.8;              // changed their mind before moving on
  return w;
}
export const optionOf = (a) => (a == null ? null : typeof a === 'object' ? a.o : a);
const firmOf = (a) => (a && typeof a === 'object' && Number.isInteger(a.f) ? a.f : null);

/** Does a check item agree with the item it repeats? (same side for values; strictness within 1 for loyalty) */
export function checkAgrees(check, answers) {
  const orig = SCENARIO_MAP[check.checks];
  const oc = optionOf(answers[check.id]); const oo = optionOf(answers[orig?.id]);
  if (oc == null || oo == null || !orig) return null;
  if (orig.kind === 'vs') return oc === oo;
  const sc = check.options[oc]?.s; const so = orig.options[oo]?.s;
  return sc == null || so == null ? null : Math.abs(sc - so) <= 1;
}

/** Answers → mind model { v: 5, traits: { trait: { m, c } }, spread, answered, completeness, intent, life, lines, picks, tags, consistent } */
export function buildMind(answers = {}) {
  const ev = {}; // trait → [sum w, sum w·v, sum w·v²]
  for (const t of Object.keys(TRAITS)) ev[t] = [PRIOR.w, PRIOR.w * PRIOR.m, PRIOR.w * PRIOR.m * PRIOR.m];
  const add = (set, w, mirror = false) => {
    for (const [t, v0] of Object.entries(set || {})) {
      if (!ev[t]) continue;
      const v = mirror ? 100 - v0 : v0;
      ev[t][0] += w; ev[t][1] += w * v; ev[t][2] += w * v * v;
    }
  };
  // consistency checks first: answers that contradict their repeat count less
  const shaky = new Set(); let checks = 0; let agreed = 0;
  for (const sc of SCENARIOS.filter((s) => s.kind === 'check' && answers[s.id] !== undefined)) {
    const ok = checkAgrees(sc, answers);
    if (ok == null) continue;
    checks += 1;
    if (ok) agreed += 1; else { shaky.add(sc.id); shaky.add(sc.checks); }
  }
  let answered = 0; let other = 0;
  const intent = {}; const life = { me: [], must: [], never: [], played: false }; const lines = []; const picks = {}; const tags = {};
  for (const [id, a] of Object.entries(answers)) {
    const sc = SCENARIO_MAP[id]; if (!sc) continue;
    const w0 = answerWeight(a) * (shaky.has(id) ? 0.6 : 1);
    if (sc.kind === 'mostleast') {
      const m = sc.options[a?.m]; const l = sc.options[a?.l];
      if (!m || !l) continue;
      answered += 1;
      add(m.set, w0); add(l.set, w0 * 0.8, true);
      tags[`most_${m.tag}`] = (tags[`most_${m.tag}`] || 0) + 1;
      continue;
    }
    if (sc.kind === 'me') {
      const s = (a?.s || []).filter((k) => CHIP_KEYS.includes(k));
      life.me = s; life.played = true; answered += 1;
      for (const k of s) add(CHIP_SET[k], 0.8);
      continue;
    }
    if (sc.kind === 'boxes') {
      life.must = (a?.must || []).filter((k) => CHIP_KEYS.includes(k));
      life.never = (a?.never || []).filter((k) => CHIP_KEYS.includes(k) && !life.must.includes(k));
      life.played = true; answered += 1;
      add({ gt_social: life.must.includes('nightlife') || life.never.includes('nightlife') ? 85 : 35 }, 0.6);
      continue;
    }
    const o = optionOf(a);
    if (o === -1) { other += 1; answered += 1; continue; } // a typed answer: kept, no evidence
    const opt = sc.options[o]; if (!opt) continue;
    answered += 1;
    const f = DIAL_KINDS.includes(sc.kind) ? firmOf(a) : null;
    const w = w0 * (f != null ? FIRM.weight[f] : 1);
    add(opt.set, w);
    if (sc.firm && f != null) add({ [sc.firm]: FIRM.level[f] }, 1.2);
    picks[id] = { o, ...(f != null ? { f } : {}) };
    if (sc.kind === 'pick' && opt.key) intent[id.replace('it_', '')] = opt.key;
    if (sc.kind === 'loyal') lines.push({ id, s: opt.s, f: f ?? 0 });
    if (opt.tag) tags[opt.tag] = (tags[opt.tag] || 0) + 1;
  }
  const traits = {}; const spread = {};
  for (const [t, [w, s, s2]] of Object.entries(ev)) {
    const m = s / w;
    const evidence = w - PRIOR.w;
    traits[t] = { m: Math.round(m), c: Math.round((evidence / (evidence + 1.5)) * 100) / 100 };
    if (evidence > 1.2) spread[t] = Math.round(Math.sqrt(Math.max(0, s2 / w - m * m)));
  }
  const conf = Object.values(traits).map((x) => x.c);
  const completeness = Math.round((conf.reduce((x, y) => x + y, 0) / conf.length) * 100 * (checks && agreed < checks ? 0.9 : 1));
  return { v: 5, traits, spread, answered, other, completeness, intent, life, lines, picks, tags, consistent: agreed === checks };
}

// ---------- which items a person plays ----------
/** Everyone plays the same games, in order (the loyalty version follows what they're looking for). */
export const corePlan = (answers = {}) => planFor(typeof answers === 'object' ? answers : {});
export const CORE_SIZE = planFor({}).length;
export const MAX_PLAN = CORE_SIZE;

/** How much an item would teach us, given what we're unsure about (sum of uncertainty on the traits it touches). */
function infoGain(sc, mind, focus) {
  const touched = new Set(sc.options.flatMap((x) => Object.keys(x.set || {})));
  if (!touched.size) return 0;
  let g = 0;
  for (const t of touched) g += (1 - (mind.traits[t]?.c ?? 0)) * (focus?.[t] ?? 1);
  return g / Math.sqrt(touched.size);
}

/** Up to n unanswered single-tap items aimed at what the model is still unsure about (used when connecting). */
export function nextScenarios(mind, answers, n, focus = null, exclude = []) {
  const done = new Set([...Object.keys(answers || {}), ...exclude]);
  return SCENARIOS.filter((s) => ['react', 'day'].includes(s.kind) && !done.has(s.id))
    .map((s) => ({ id: s.id, g: infoGain(s, mind, focus) }))
    .sort((a, b) => b.g - a.g).slice(0, n).map((x) => x.id);
}

/** v4 asked extra questions part by part; the games are short and fixed, so nothing is added any more. */
export const extendPart = () => [];
export const extendPlan = () => [];

/** Inconsistent answers, said gently. */
export function tensions(mind) {
  const LABEL = { v_honesty: 'honesty', jealousy: 'jealousy', rec_forgive: 'forgiving', r_heat: 'how heated you get', integ: 'temptation', gt_family: 'family decisions', gt_money: 'money decisions', v_freedom: 'freedom' };
  const out = Object.entries(mind.spread || {}).filter(([t, sd]) => sd >= 28 && LABEL[t]).slice(0, 2)
    .map(([t]) => `Your answers about ${LABEL[t]} point different ways. It may depend on the person or the moment.`);
  if (mind.consistent === false) out.push('A couple of your answers pointed different ways, so Soul DNA is a little less sure about them.');
  return out.slice(0, 3);
}
