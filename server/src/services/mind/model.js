// Soul DNA v4: building a person's mind model from their scenario answers.
// Every answer is EVIDENCE about some traits. Evidence is weighed by how the person answered (gut-reaction
// timing, changing their mind), so the model knows not only "where" someone is on a trait but how SURE it is.
// The questions each person gets are chosen for them: a random mix across all 9 layers first, then a few more
// scenarios aimed at whatever the model is still unsure about (adaptive).
import { LAYERS, SCENARIOS, SCENARIO_MAP, TRAITS } from './scenarios.js';

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const PRIOR = { m: 50, w: 0.6 }; // knowing nothing = the middle, with very little weight

/** How much one answer counts, from how it was given. Quick, confident picks = gut truth; long hesitation or
 *  changing the answer = inner conflict, so it counts a bit less. Very fast taps may be random. */
export function answerWeight(a) {
  if (a == null || typeof a !== 'object') return 1; // old style answer (just the option): normal weight
  let w = 1;
  const ms = Number(a.ms) || 0;
  if (ms > 0 && ms < 900) w *= 0.8;          // too quick to have read it
  else if (ms >= 900 && ms <= 5000) w *= 1.15; // gut reaction
  else if (ms > 15000) w *= 0.8;               // long hesitation
  if (Number(a.ch) > 0) w *= 0.8;              // changed their mind before moving on
  return w;
}
export const optionOf = (a) => (a == null ? null : typeof a === 'object' ? a.o : a);

/** Answers → mind model { v: 4, traits: { trait: { m, c } }, spread, answered, other, completeness } */
export function buildMind(answers = {}) {
  const ev = {}; // trait → [sum w, sum w·v, sum w·v²]
  for (const t of Object.keys(TRAITS)) ev[t] = [PRIOR.w, PRIOR.w * PRIOR.m, PRIOR.w * PRIOR.m * PRIOR.m];
  let answered = 0; let other = 0;
  for (const [id, a] of Object.entries(answers)) {
    const sc = SCENARIO_MAP[id]; if (!sc) continue;
    const o = optionOf(a);
    if (o === -1) { other += 1; answered += 1; continue; } // "Anything else": kept, no evidence
    const opt = sc.options[o]; if (!opt) continue;
    answered += 1;
    const w = answerWeight(a);
    for (const [t, v] of Object.entries(opt.set)) {
      if (!ev[t]) continue;
      ev[t][0] += w; ev[t][1] += w * v; ev[t][2] += w * v * v;
    }
  }
  const traits = {}; const spread = {};
  for (const [t, [w, s, s2]] of Object.entries(ev)) {
    const m = s / w;
    const evidence = w - PRIOR.w;
    traits[t] = { m: Math.round(m), c: Math.round((evidence / (evidence + 1.5)) * 100) / 100 };
    if (evidence > 1.2) spread[t] = Math.round(Math.sqrt(Math.max(0, s2 / w - m * m)));
  }
  const conf = Object.values(traits).map((x) => x.c);
  return { v: 4, traits, spread, answered, other, completeness: Math.round((conf.reduce((a, b) => a + b, 0) / conf.length) * 100) };
}

// ---------- which scenarios a person gets ----------
const QUOTA = { intention: 3, values: 4, reading: 3, reaction: 4, recovery: 3, decide: 3, givetake: 5, loyalty: 3, vibe: 4 }; // 32
export const CORE_SIZE = Object.values(QUOTA).reduce((a, b) => a + b, 0);
export const MAX_PLAN = CORE_SIZE + 8;

function seeded(key) {
  let h = 2166136261; for (const ch of String(key)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  let s = (h >>> 0) % 2147483646 + 1;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}
const shuffle = (list, rnd) => { const a = [...list]; for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** The person's own first set: a random mix (stable per person) covering every layer. */
export function corePlan(seedKey) {
  const rnd = seeded(seedKey);
  const plan = [];
  for (const { key } of LAYERS) plan.push(...shuffle(SCENARIOS.filter((s) => s.layer === key), rnd).slice(0, QUOTA[key]).map((s) => s.id));
  return shuffle(plan, rnd); // layers mixed, so it feels like a story, not a form
}

/** How much a scenario would teach us, given what we're unsure about (sum of uncertainty on the traits it touches). */
function infoGain(sc, mind, focus) {
  const touched = new Set(sc.options.flatMap((o) => Object.keys(o.set)));
  let g = 0;
  for (const t of touched) g += (1 - (mind.traits[t]?.c ?? 0)) * (focus?.[t] ?? 1);
  return g / Math.sqrt(touched.size);
}

/** Up to n more scenarios aimed at what the model is still unsure about (focus: trait → importance). */
export function nextScenarios(mind, answers, n, focus = null, exclude = []) {
  const done = new Set([...Object.keys(answers || {}), ...exclude]);
  return SCENARIOS.filter((s) => !done.has(s.id))
    .map((s) => ({ id: s.id, g: infoGain(s, mind, focus) }))
    .sort((a, b) => b.g - a.g).slice(0, n).map((x) => x.id);
}

/** After the core set: add a few targeted scenarios while important traits are still uncertain. */
export function extendPlan(plan, answers) {
  if (plan.length >= MAX_PLAN) return [];
  const mind = buildMind(answers);
  const weak = Object.entries(mind.traits).filter(([, x]) => x.c < 0.4).length;
  if (weak < 3) return [];
  return nextScenarios(mind, answers, Math.min(6, MAX_PLAN - plan.length), null, plan);
}

/** Inconsistent answers, said gently. */
export function tensions(mind) {
  const LABEL = { v_honesty: 'honesty', jealousy: 'jealousy', rec_forgive: 'forgiving', r_heat: 'how heated you get', integ: 'temptation', gt_family: 'family decisions', gt_money: 'money decisions', v_freedom: 'freedom' };
  return Object.entries(mind.spread).filter(([t, sd]) => sd >= 28 && LABEL[t]).slice(0, 3)
    .map(([t]) => `Your answers about ${LABEL[t]} point different ways. It may depend on the person or the moment.`);
}
