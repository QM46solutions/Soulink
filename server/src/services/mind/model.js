// Soul DNA v7: building a person's mind model from their activity answers.
// Every answer is EVIDENCE about some traits. Evidence is weighed by how the person answered (gut-reaction timing,
// changing their mind, how firm they said they are, anchors a bit more, picture picks less), so the model knows not
// only "where" someone is on a trait but how SURE it is. "It depends" and Skip add nothing: that trait stays unsure.
// Besides traits, the model keeps what can't be averaged: kids and life stage, lifestyle quick taps, what they need
// in a partner, trust lines and value cards — these are compared directly between two people.
// A Soul DNA made with the v6 games carries on as `base`: its traits count as earlier evidence alongside newer
// answers, and its direct answers stay until newer ones replace them, so nobody loses their results.
import {
  ANCHOR_WEIGHT, FIRM, HABIT_KEYS, KIND_WEIGHT, LAYERS, NEED_MAP, ORDER_VALUE, ORDER_WEIGHT, RANK_WEIGHT,
  SCENARIOS, SCENARIO_MAP, TRAITS, habitKeys,
} from './scenarios.js';

export const DNA_V = 7;
const PRIOR = { m: 50, w: 0.6 }; // knowing nothing = the middle, with very little weight
const BASE_W = 1.6;              // how much an older (v6) Soul DNA counts, per unit of its confidence
export const CHOICE_KINDS = ['react', 'more'];

/** How much one answer counts, from how it was given. Quick, confident picks = gut truth; long hesitation or
 *  changing the answer = inner conflict, so it counts a bit less. Very fast taps may be random. */
export function answerWeight(a) {
  if (a == null || typeof a !== 'object') return 1;
  let w = 1;
  const ms = Number(a.ms) || 0;
  if (ms > 0 && ms < 700) w *= 0.8;
  else if (ms >= 700 && ms <= 5000) w *= 1.15;
  else if (ms > 15000) w *= 0.8;
  if (Number(a.ch) > 0) w *= 0.8;
  return w;
}
export const optionOf = (a) => (a == null ? null : typeof a === 'object' ? a.o : a);

/** The part of an older Soul DNA that carries on in a newer one (a v7 Soul DNA passes on the base it carries). */
export const baseOf = (dna) => {
  if (!dna?.traits) return null;
  if (dna.v === DNA_V) return dna.base || null;
  return { v: dna.v, traits: dna.traits, intent: dna.intent || {}, life: dna.life || null, lines: dna.lines || [], picks: dna.picks || {} };
};

/** Answers (+ an older Soul DNA) → mind model
 *  { v: 7, traits: { trait: { m, c } }, spread, answered, skipped, completeness, layers: { key: { n, earlier } },
 *    intent, life, habits, needs, lines, picks, interestsDna, base } */
export function buildMind(answers = {}, base = null) {
  const ev = {};
  for (const t of Object.keys(TRAITS)) ev[t] = [PRIOR.w, PRIOR.w * PRIOR.m, PRIOR.w * PRIOR.m * PRIOR.m];
  const add = (set, w) => {
    for (const [t, v] of Object.entries(set || {})) {
      if (!ev[t] || !(w > 0) || !Number.isFinite(v)) continue; // a malformed answer adds no evidence
      ev[t][0] += w; ev[t][1] += w * v; ev[t][2] += w * v * v;
    }
  };
  const layerN = Object.fromEntries(LAYERS.map((l) => [l.key, 0]));
  let answered = 0; let skipped = 0;
  const intent = {}; let kidsPrivate = false; const lines = []; const picks = {}; const interests = {};
  let habits = null; let needs = null;
  const tag = (t, w) => { if (t) interests[t] = (interests[t] || 0) + w; };

  for (const [id, a] of Object.entries(answers || {})) {
    const sc = SCENARIO_MAP[id]; if (!sc || a == null) continue;
    answered += 1;
    if (a.skip) { skipped += 1; continue; } // "It depends" / Skip: kept, no evidence
    layerN[sc.layer] += 1;
    const w0 = answerWeight(a) * (sc.anchor ? ANCHOR_WEIGHT : 1) * (KIND_WEIGHT[sc.kind] ?? 1);
    switch (sc.kind) {
      case 'react': case 'more': {
        const opt = sc.options[optionOf(a)]; if (!opt) break;
        const f = sc.firm && Number.isInteger(a.f) ? a.f : null;
        add(opt.set, w0 * (f != null ? FIRM.weight[f] : 1));
        if (sc.firm && f != null) add({ [sc.firm]: FIRM.level[f] }, 1.2);
        picks[id] = { o: optionOf(a), ...(f != null ? { f } : {}) };
        if (id === 're3') { if (opt.key === 'private') kidsPrivate = true; else intent.kids = opt.key; }
        if (id === 're2') intent.stage = opt.key;
        if (opt.s != null) lines.push({ id, s: opt.s, f: 0 });
        tag(opt.tag, 1);
        break;
      }
      case 'slider': {
        const k = Math.max(0, Math.min(4, Number(a.v))) / 4;
        const [L, R] = sc.options;
        const set = {};
        for (const t of new Set([...Object.keys(L.set), ...Object.keys(R.set)])) set[t] = Math.round((L.set[t] ?? 50) + ((R.set[t] ?? 50) - (L.set[t] ?? 50)) * k);
        add(set, w0 * (k === 0.5 ? 0.7 : 1)); // the middle stop says less
        picks[id] = { v: a.v };
        break;
      }
      case 'rank': {
        (a.r || []).forEach((k, pos) => {
          const opt = sc.options[k]; if (!opt) return;
          if (opt.t) add({ [opt.t]: ORDER_VALUE[pos] }, w0);
          else add(opt.set, w0 * ORDER_WEIGHT[pos]);
          tag(opt.tag, ORDER_WEIGHT[pos]);
        });
        picks[id] = { r: [...(a.r || [])] };
        break;
      }
      case 'day': (a.s || []).forEach((k, slot) => add(sc.slots[slot]?.options[k]?.set, w0)); break;
      case 'tiles':
        (a.s || []).forEach((k, r) => tag(sc.options[k]?.tag, RANK_WEIGHT[r] ?? 0.7));
        picks[id] = { s: [...(a.s || [])] };
        break;
      case 'habits': habits = Object.fromEntries(HABIT_KEYS.map((k) => [k, Number.isInteger(a[k]) ? a[k] : -1])); break;
      case 'needs': needs = Object.fromEntries(Object.entries(a).filter(([k]) => NEED_MAP[k])); break;
      default: break;
    }
  }

  // an older Soul DNA: its traits count as earlier evidence; its direct answers stay until newer ones replace them
  // (in a category with newer answers it counts much less: those answers replace it, as "Update answers" promises)
  if (base?.traits) for (const [t, x] of Object.entries(base.traits)) if (ev[t] && x?.c > 0) add({ [t]: x.m }, x.c * BASE_W * (layerN[TRAITS[t]] ? 0.35 : 1));
  const traits = {}; const spread = {};
  for (const [t, [w, s, s2]] of Object.entries(ev)) {
    const m = s / w; const evidence = w - PRIOR.w;
    traits[t] = { m: Math.round(m), c: Math.round((evidence / (evidence + 1.1)) * 100) / 100 };
    if (evidence > 1.2) spread[t] = Math.round(Math.sqrt(Math.max(0, s2 / w - m * m)));
  }
  const conf = Object.values(traits).map((x) => x.c);
  const completeness = Math.round((conf.reduce((x, y) => x + y, 0) / conf.length) * 100);

  const intentOut = { ...(base?.intent || {}), ...intent };
  if (kidsPrivate) delete intentOut.kids;
  // what a partner's Must / Never is checked against (v6 chip keys, so older and newer Soul DNA compare)
  const baseLife = base?.life || null;
  const me = habits ? habitKeys(habits) : [...(baseLife?.me || []).filter((k) => k !== 'kids')];
  if (intentOut.kids === 'want') me.push('kids');
  const must = []; const never = [];
  for (const [k, lvl] of Object.entries(needs || {})) { if (lvl === 'must') must.push(k); else if (lvl === 'never' && NEED_MAP[k]?.group === 'life') never.push(k); }
  const life = needs || habits || !baseLife
    ? { me: [...new Set(me)], must, never, played: !!(needs || habits), v: 7, food: habits?.food ?? null }
    : { ...baseLife, me: [...new Set(me)] };
  const layers = Object.fromEntries(LAYERS.map((l) => [l.key, { n: layerN[l.key], earlier: !layerN[l.key] && !!base }]));
  const interestsDna = Object.entries(interests).sort((x, y) => y[1] - x[1]).map(([t]) => t).slice(0, 6);

  return {
    v: DNA_V, traits, spread, answered, skipped, completeness, layers,
    intent: intentOut, life, habits, needs,
    lines: [...lines, ...(base?.lines || []).filter((l) => !lines.some((x) => x.id === l.id))],
    picks: { ...(base?.picks || {}), ...picks }, interestsDna, consistent: true,
    ...(base ? { base } : {}),
  };
}

/** How much an activity would teach us now (uncertainty on the traits it touches). */
function infoGain(sc, mind) {
  const opts = [...(sc.options || []), ...(sc.slots || []).flatMap((x) => x.options)];
  const touched = new Set(opts.flatMap((x) => [...Object.keys(x.set || {}), ...(x.t ? [x.t] : [])]));
  if (!touched.size) return 0.4; // interests, quick taps, partner needs: worth asking once
  let g = 0;
  for (const t of touched) g += 1 - (mind?.traits?.[t]?.c ?? 0);
  return g / Math.sqrt(touched.size);
}
const layerSure = (mind, key) => {
  const ts = Object.entries(TRAITS).filter(([, l]) => l === key).map(([t]) => mind?.traits?.[t]?.c ?? 0);
  return ts.length ? ts.reduce((x, y) => x + y, 0) / ts.length : 0;
};

/** Check-in: up to n activities this person hasn't seen, from the categories Soul DNA is least sure about (one per
 *  category first, so a check-in mixes). `only`: one category (its "Not quite" / Update answers: answered ones too). */
export function checkinPlan(mind, answers, n = 3, only = null) {
  const done = new Set(Object.keys(answers || {}));
  if (only) {
    const mine = SCENARIOS.filter((s) => s.layer === only);
    const seen = mine.filter((s) => done.has(s.id)).map((s) => s.id);
    const fresh = mine.filter((s) => !done.has(s.id)).map((s) => s.id);
    return [...seen, ...fresh].slice(0, Math.max(n, Math.min(seen.length, 4)));
  }
  const pool = SCENARIOS.filter((s) => !done.has(s.id))
    .map((s) => ({ id: s.id, layer: s.layer, g: infoGain(s, mind) * (1.4 - layerSure(mind, s.layer)) }))
    .sort((a, b) => b.g - a.g);
  const out = []; const used = new Set();
  for (const x of pool) { if (out.length >= n) break; if (used.has(x.layer)) continue; used.add(x.layer); out.push(x.id); }
  for (const x of pool) { if (out.length >= n) break; if (!out.includes(x.id)) out.push(x.id); }
  return out;
}

/** Up to n unanswered single-tap items (choose / pick-more without a dial) aimed at what the model is unsure about
 *  for a pair (asked when connecting). `first`: asked first if unanswered (life stage and kids, for couples). */
export function nextScenarios(mind, answers, n, focus = null, first = []) {
  const done = new Set(Object.keys(answers || {}));
  const lead = first.filter((id) => !done.has(id) && SCENARIO_MAP[id]);
  const rest = SCENARIOS.filter((s) => (s.kind === 'react' || (s.kind === 'more' && !s.firm)) && !done.has(s.id) && !lead.includes(s.id))
    .map((s) => {
      const touched = new Set(s.options.flatMap((x) => Object.keys(x.set || {})));
      let g = 0; for (const t of touched) g += (1 - (mind?.traits?.[t]?.c ?? 0)) * (focus?.[t] ?? 0);
      return { id: s.id, g: touched.size ? g / Math.sqrt(touched.size) : 0 };
    })
    .filter((x) => x.g > 0.05).sort((a, b) => b.g - a.g).map((x) => x.id);
  return [...lead, ...rest].slice(0, n);
}

/** Answers that point different ways, said gently. */
export function tensions(mind) {
  const LABEL = { v_honesty: 'honesty', jealousy: 'jealousy', rec_forgive: 'forgiving', r_heat: 'how heated you get', integ: 'temptation', gt_family: 'family decisions', gt_money: 'money decisions', v_freedom: 'freedom' };
  return Object.entries(mind.spread || {}).filter(([t, sd]) => sd >= 28 && LABEL[t]).slice(0, 2)
    .map(([t]) => `Your answers about ${LABEL[t]} point different ways. It may depend on the person or the moment.`);
}
