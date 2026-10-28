// Soul DNA v4: how two minds fit. Each relation type has its own logic:
//   friendship   vibe and interests first; differences are fine
//   dating       vibe, chemistry, and wanting the same thing right now
//   life partner a SIMULATION: both minds are run through ~24 real-life situations (a fight, a money crisis,
//                family pressure, temptation, a new baby...). For each one we predict how each person reacts and
//                what happens between them; the score is how well the two get through life together.
//   business / study buddy   decision style, drive, integrity, how you handle friction
// Give and take: in every life area somebody has to bend. Two people who are different but where one leads and
// the other bends do well; the real problem is when BOTH are unbending and want opposite things.
// Confidence matters: a trait the model is unsure about counts less (and can be asked about when connecting).

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const avg = (xs) => { const v = xs.filter((x) => x != null && !Number.isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const wavg = (pairs) => { let w = 0; let s = 0; for (const [v, k] of pairs) if (v != null) { s += v * k; w += k; } return w ? s / w : null; };

export const DIMS = {
  vibe: { label: 'Vibe', emoji: '✨', side: 'natural' },
  interests: { label: 'Interests', emoji: '🎧', side: 'natural' },
  values: { label: 'What wins for you', emoji: '🛡️', side: 'natural' },
  intention: { label: 'Wanting the same thing', emoji: '🎯', side: 'natural' },
  decide: { label: 'Decisions', emoji: '🧭', side: 'natural' },
  reaction: { label: 'When things go wrong', emoji: '⚡', side: 'relationship' },
  recovery: { label: 'Making up', emoji: '🩹', side: 'relationship' },
  givetake: { label: 'Give and take', emoji: '⚖️', side: 'relationship' },
  loyalty: { label: 'Trust and loyalty', emoji: '🔒', side: 'relationship' },
  reading: { label: 'Understanding each other', emoji: '👁️', side: 'relationship' },
};

export const RELATIONS = {
  lifepartner: { label: 'Life partner', emoji: '💍', pair: 'couple', weights: { values: 16, intention: 14, givetake: 18, reaction: 12, recovery: 10, loyalty: 14, reading: 8, vibe: 4, interests: 2, decide: 2 } },
  dating: { label: 'Dating', emoji: '💘', pair: 'couple', weights: { vibe: 22, interests: 14, intention: 16, loyalty: 12, reaction: 12, reading: 10, values: 8, recovery: 6 } },
  friendship: { label: 'Friendship', emoji: '🤝', pair: 'friendship', weights: { vibe: 38, interests: 24, values: 10, loyalty: 10, recovery: 8, reaction: 6, reading: 4 } },
  business: { label: 'Business', emoji: '💼', pair: 'partnership', weights: { decide: 28, values: 20, loyalty: 18, reaction: 14, recovery: 10, vibe: 5, interests: 5 } },
  buddy: { label: 'Study / Work buddy', emoji: '📚', pair: 'duo', weights: { vibe: 26, interests: 18, decide: 20, values: 14, reaction: 12, recovery: 10 } },
};
export const RELATION_KEYS = Object.keys(RELATIONS);
/** Request intent → relation type for scoring (people you already know: family / friend → friendship, colleague → business) */
export const relationOf = (intent) => ({ life_partner: 'lifepartner', dating: 'dating', situationship: 'dating', friendship: 'friendship', vibing: 'friendship', unsure: 'friendship', networking: 'business', buddy: 'buddy', family: 'friendship', known_friend: 'friendship', colleague: 'business', known_other: 'friendship' }[intent] || 'friendship');

// trait helpers: value and confidence, with a gentle pull to the middle when the model is unsure
const T = (P, t) => { const x = P.traits?.[t]; if (!x) return { m: 50, c: 0 }; return x; };
const val = (P, t) => { const { m, c } = T(P, t); return 50 + (m - 50) * (0.6 + 0.4 * c); };
const sureVal = (P, t) => { const { m, c } = T(P, t); return c >= 0.3 ? m : 50 + (m - 50) * 0.6; }; // for dealbreakers
const conf = (P, t) => T(P, t).c;
const sim = (A, B, t, k = 1) => clamp(100 - Math.abs(val(A, t) - val(B, t)) * 1.9 * k);
const pairConf = (A, B, ts) => avg(ts.flatMap((t) => [conf(A, t), conf(B, t)])) ?? 0;

// ---------- layer fits ----------
function vibeFit(A, B, relation) {
  const k = relation === 'friendship' ? 0.9 : 1;
  return wavg([[sim(A, B, 'energy', 0.9 * k), 1.2], [sim(A, B, 'humor', k), 1.2], [sim(A, B, 'curiosity', k), 1], [sim(A, B, 'adventure', k), 1], [sim(A, B, 'depth', k), 1.1]]);
}
function interestsFit(A, B) {
  const a = new Set(A.interests || []); const b = new Set(B.interests || []);
  if (!a.size || !b.size) return null;
  const shared = [...a].filter((x) => b.has(x)).length;
  const j = shared / Math.min(a.size, b.size);
  return clamp(25 + j * 85);
}
const VALUES = ['v_family', 'v_freedom', 'v_security', 'v_ambition', 'v_love', 'v_honesty', 'v_tradition'];
function valuesFit(A, B, relation) {
  const w = relation === 'business' ? { v_ambition: 1.5, v_honesty: 1.5, v_security: 1.2 } : relation === 'lifepartner' ? { v_family: 1.4, v_tradition: 1.2, v_love: 1.2, v_honesty: 1.2 } : {};
  // what each person puts FIRST matters most: compare the top-2 values too
  const top = (P) => VALUES.map((t) => [t, val(P, t)]).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([t]) => t);
  const shared = top(A).filter((t) => top(B).includes(t)).length;
  const base = wavg(VALUES.map((t) => [sim(A, B, t, 1.1), w[t] ?? 1]));
  return clamp(base - 8 + shared * 8);
}
function intentionFit(A, B, relation, deal) {
  const ser = Math.abs(val(A, 'intent_serious') - val(B, 'intent_serious'));
  if (relation === 'dating' || relation === 'lifepartner') {
    const lo = Math.min(sureVal(A, 'intent_serious'), sureVal(B, 'intent_serious')); const hi = Math.max(sureVal(A, 'intent_serious'), sureVal(B, 'intent_serious'));
    if (lo < 32 && hi > 72) deal.push('how serious you want this to be');
  }
  if (relation === 'lifepartner') {
    const lo = Math.min(sureVal(A, 'intent_family'), sureVal(B, 'intent_family')); const hi = Math.max(sureVal(A, 'intent_family'), sureVal(B, 'intent_family'));
    if (lo < 30 && hi > 75) deal.push('wanting a family life');
  }
  return wavg([[clamp(100 - ser * 1.6), 1.6], [sim(A, B, 'intent_pace'), 1], [sim(A, B, 'intent_family', 1.2), relation === 'lifepartner' ? 1.5 : 0.4]]);
}
function decideFit(A, B, relation) {
  const la = val(A, 'dec_lead'); const lb = val(B, 'dec_lead');
  // one leader + one who goes along works; two strong leaders clash a bit (more in business); two followers drift
  const lead = la > 65 && lb > 65 ? 55 : la < 35 && lb < 35 ? 60 : 90;
  return wavg([[lead, relation === 'business' ? 1.5 : 1], [sim(A, B, 'dec_risk', 1.1), 1.2], [sim(A, B, 'dec_head'), 1]]);
}

// reaction styles: what happens when two people's ways of reacting meet
const MODES = ['fight', 'withdraw', 'fix', 'seek'];
function modes(P) {
  const raw = { fight: val(P, 'r_fight'), withdraw: val(P, 'r_withdraw'), fix: val(P, 'r_fix'), seek: val(P, 'r_seek') };
  const pw = Object.fromEntries(MODES.map((m) => [m, Math.max(1, raw[m]) ** 2]));
  const s = Object.values(pw).reduce((a, b) => a + b, 0);
  return Object.fromEntries(MODES.map((m) => [m, pw[m] / s]));
}
const MEET = {
  fix: { fix: 92, seek: 85, withdraw: 66, fight: 58 },
  seek: { fix: 85, seek: 74, withdraw: 30, fight: 42 }, // one chases, the other hides: the classic trap
  withdraw: { fix: 66, seek: 30, withdraw: 52, fight: 28 },
  fight: { fix: 58, seek: 42, withdraw: 28, fight: 18 },
};
function meet(A, B) {
  const a = modes(A); const b = modes(B); let s = 0;
  for (const x of MODES) for (const y of MODES) s += a[x] * b[y] * MEET[x][y];
  const heat = Math.max(val(A, 'r_heat'), val(B, 'r_heat'));
  return clamp(s - Math.max(0, heat - 60) * 0.5);
}
const topMode = (P) => Object.entries(modes(P)).sort((x, y) => y[1] - x[1])[0][0];
function recoveryFit(A, B) {
  const repair = Math.min(avg([val(A, 'rec_apology'), val(A, 'rec_forgive')]), avg([val(B, 'rec_apology'), val(B, 'rec_forgive')]));
  return wavg([[sim(A, B, 'rec_speed'), 1], [clamp(repair * 1.25), 1.5]]);
}
function readingFit(A, B) {
  const trust = Math.min(val(A, 'read_trust'), val(B, 'read_trust'));
  return wavg([[clamp(trust * 1.3), 1], [clamp(Math.max(val(A, 'read_sense'), val(B, 'read_sense')) * 1.1), 0.8], [sim(A, B, 'jealousy'), 0.8]]);
}
function loyaltyFit(A, B, relation, watch) {
  const integ = Math.min(val(A, 'integ'), val(B, 'integ'));
  const loyal = Math.min(val(A, 'loyal'), val(B, 'loyal'));
  // a jealous person with someone relaxed about flirting = trouble, whatever else fits
  const cross = Math.max(val(A, 'jealousy') * val(B, 'boundary'), val(B, 'jealousy') * val(A, 'boundary')) / 100;
  if (integ < 32) watch.push('staying faithful when tempted');
  if (cross > 55) watch.push('jealousy versus being easy-going about flirting');
  const couple = relation === 'dating' || relation === 'lifepartner';
  return wavg([[clamp(integ * 1.25), couple ? 1.5 : 1], [clamp(loyal * 1.2), 1], [clamp(100 - cross * 1.2), couple ? 1.2 : 0.3]]);
}

// give and take, per life area
export const AREAS = {
  money: { label: 'money', firm: 'gt_money', dir: (P) => val(P, 'v_security') },
  family: { label: 'family decisions', firm: 'gt_family', dir: (P) => val(P, 'v_family') },
  home: { label: 'where to live', firm: 'gt_home', dir: (P) => val(P, 'home_dir') },
  social: { label: 'social life', firm: 'gt_social', dir: (P) => val(P, 'energy') },
  career: { label: 'career plans', firm: 'gt_career', dir: (P) => val(P, 'v_ambition') },
};
function areaOutcome(A, B, area) {
  const ar = AREAS[area];
  const fa = val(A, ar.firm); const fb = val(B, ar.firm);
  const gap = Math.abs(ar.dir(A) - ar.dir(B));
  let score; let who;
  if (fa >= 62 && fb >= 62) { score = gap >= 35 ? 15 : gap >= 20 ? 55 : 88; who = gap >= 35 ? 'clash' : 'both'; }
  else if (fa >= 62) { score = 86; who = 'you'; }
  else if (fb >= 62) { score = 86; who = 'them'; }
  else { score = gap >= 45 ? 70 : 84; who = 'together'; }
  return { score, who };
}
function giveTakeFit(A, B) {
  const out = Object.keys(AREAS).map((k) => ({ area: k, label: AREAS[k].label, ...areaOutcome(A, B, k) }));
  return { score: avg(out.map((x) => x.score)), areas: out };
}

// ---------- the life-partner simulation ----------
const SITUATIONS = [
  { label: 'a big fight about something small', w: 1.2, run: (A, B) => avg([meet(A, B), recoveryFit(A, B)]) },
  { label: 'a fight that gets really personal', w: 1.2, run: (A, B) => clamp(meet(A, B) * 0.6 + Math.min(val(A, 'rec_forgive'), val(B, 'rec_forgive')) * 0.5) },
  { label: 'one of you forgetting something important', w: 0.8, run: (A, B) => avg([meet(A, B), Math.min(val(A, 'rec_apology'), val(B, 'rec_apology')) * 1.1]) },
  { label: 'a stressful month at work', w: 1, run: (A, B) => supportFit(A, B) },
  { label: 'a money crisis', w: 1.2, run: (A, B) => avg([areaOutcome(A, B, 'money').score, sim(A, B, 'v_security'), Math.min(val(A, 'loyal'), val(B, 'loyal')) * 1.1, modes(A).fix * 100 + modes(B).fix * 100 > 60 ? 85 : 60]) },
  { label: 'deciding how to spend a bonus', w: 0.6, run: (A, B) => avg([areaOutcome(A, B, 'money').score, sim(A, B, 'dec_risk')]) },
  { label: 'family pressure about how you live', w: 1.2, run: (A, B) => avg([areaOutcome(A, B, 'family').score, sim(A, B, 'v_tradition'), sim(A, B, 'v_family')]) },
  { label: 'festivals and family visits', w: 0.6, run: (A, B) => avg([areaOutcome(A, B, 'family').score, sim(A, B, 'v_tradition')]) },
  { label: 'a job offer in another city', w: 1, run: (A, B) => avg([areaOutcome(A, B, 'home').score, areaOutcome(A, B, 'career').score]) },
  { label: 'where to settle down', w: 0.9, run: (A, B) => avg([areaOutcome(A, B, 'home').score, sim(A, B, 'home_dir', 1.2)]) },
  { label: 'weekends and social life', w: 0.8, run: (A, B) => avg([areaOutcome(A, B, 'social').score, sim(A, B, 'energy')]) },
  { label: 'career taking over your time together', w: 0.9, run: (A, B) => avg([areaOutcome(A, B, 'career').score, sim(A, B, 'v_ambition')]) },
  { label: 'someone flirting with one of you', w: 1.1, run: (A, B) => clamp(Math.min(val(A, 'integ'), val(B, 'integ')) * 1.1 - Math.max(0, Math.max(val(A, 'jealousy') * val(B, 'boundary'), val(B, 'jealousy') * val(A, 'boundary')) / 100 - 40)) },
  { label: 'an ex getting back in touch', w: 0.7, run: (A, B) => avg([Math.min(val(A, 'integ'), val(B, 'integ')) * 1.1, Math.min(val(A, 'v_honesty'), val(B, 'v_honesty')), 100 - Math.abs(val(A, 'jealousy') - val(B, 'jealousy'))]) },
  { label: 'one of you needing space', w: 0.8, run: (A, B) => clamp(100 - Math.max(0, Math.max(val(A, 'r_seek'), val(B, 'r_seek')) - 50) * Math.max(val(A, 'r_withdraw'), val(B, 'r_withdraw')) / 50) },
  { label: 'reading each other’s bad days', w: 0.8, run: (A, B) => avg([val(A, 'read_sense'), val(B, 'read_sense')]) * 1.1 },
  { label: 'trusting each other’s phone and privacy', w: 0.7, run: (A, B) => avg([Math.min(val(A, 'read_trust'), val(B, 'read_trust')) * 1.2, sim(A, B, 'jealousy')]) },
  { label: 'planning a baby', w: 1, run: (A, B) => avg([sim(A, B, 'intent_family', 1.3), sim(A, B, 'v_family'), sim(A, B, 'intent_pace')]) },
  { label: 'a big decision for both of you', w: 0.9, run: (A, B) => decideFit(A, B, 'lifepartner') },
  { label: 'a risky opportunity', w: 0.6, run: (A, B) => sim(A, B, 'dec_risk', 1.2) },
  { label: 'life getting routine', w: 0.6, run: (A, B) => avg([sim(A, B, 'curiosity'), sim(A, B, 'adventure')]) },
  { label: 'deep talks late at night', w: 0.5, run: (A, B) => sim(A, B, 'depth') },
  { label: 'hard times that last for months', w: 1.1, run: (A, B) => avg([Math.min(val(A, 'loyal'), val(B, 'loyal')) * 1.15, Math.min(val(A, 'v_love'), val(B, 'v_love')) * 1.1]) },
  { label: 'growing old together', w: 0.5, run: (A, B) => avg([valuesFit(A, B, 'lifepartner'), sim(A, B, 'v_tradition')]) },
];
function supportFit(A, B) {
  // when one is stressed: does the other give what they need?
  const need = (P) => modes(P); const give = (P) => ({ seek: val(P, 'read_sense'), fix: val(P, 'r_fix'), withdraw: 100 - val(P, 'r_seek') * 0.6, fight: 40 });
  const one = (X, Y) => { const n = need(X); const g = give(Y); return MODES.reduce((s, m) => s + n[m] * g[m], 0); };
  return clamp(avg([one(A, B), one(B, A)]) * 1.05);
}
export function simulate(A, B) {
  const runs = SITUATIONS.map((s) => ({ label: s.label, w: s.w, score: clamp(Math.round(s.run(A, B))) }));
  // a life together is only as easy as its hardest moments allow: 60% the average, 40% the 5 hardest situations
  const worst = [...runs].sort((x, y) => x.score - y.score).slice(0, 5);
  return { score: 0.6 * wavg(runs.map((r) => [r.score, r.w])) + 0.4 * avg(worst.map((r) => r.score)), runs };
}

// ---------- calibration: spreads the raw numbers so a typical pair ≈ 50 and the best ~10% > 75 ----------
export const CALIBRATION = {
  lifepartner: { mid: 64, k: 7 }, dating: { mid: 62.5, k: 4.5 }, friendship: { mid: 64, k: 3.1 },
  business: { mid: 64, k: 6 }, buddy: { mid: 64, k: 4.2 },
};
// an S-curve (not a straight line): same steepness in the middle, but very good / very poor pairs ease towards
// the ends instead of slamming into 1% or 99%
const calibrate = (raw, relation) => {
  if (raw == null) return null;
  const c = CALIBRATION[relation] || CALIBRATION.friendship;
  return clamp(Math.round(100 / (1 + Math.exp(-(raw - c.mid) * c.k * 0.04))), 2, 98);
};

const TYPE_NAMES = {
  similar: { couple: 'Similar souls', friendship: 'Two of a kind', partnership: 'Aligned partners', duo: 'In-sync duo' },
  complement: { couple: 'Complementary couple', friendship: 'Opposites that click', partnership: 'Complementary partners', duo: 'Complementary duo' },
  giveTake: { couple: 'Give-and-take couple', friendship: 'Easy give and take', partnership: 'Clear roles', duo: 'Clear roles' },
  friction: { couple: 'Some friction areas', friendship: 'Some friction areas', partnership: 'Some friction areas', duo: 'Some friction areas' },
  balanced: { couple: 'Balanced couple', friendship: 'Easy-going friendship', partnership: 'Balanced partners', duo: 'Balanced duo' },
  basics: { couple: 'Big differences on the basics', friendship: 'Different worlds', partnership: 'Different directions', duo: 'Different directions' },
};
const TYPE_LINES = {
  similar: 'You think alike and want similar things, so being together feels easy.',
  complement: 'You are different, but your differences fit: where one is weak, the other is strong.',
  giveTake: 'Different minds, but in each area one of you leads and the other bends. That is how it works.',
  friction: 'You may click in some ways, but the way you both react could turn small things into big ones.',
  balanced: 'A steady mix of things in common and things to learn from each other.',
  basics: 'You want different things on something important. Talk about it early.',
};

const WHO_LINE = { you: (l) => `You’d lead on ${l}; they’d go along`, them: (l) => `They’d lead on ${l}; you’d go along`, together: (l) => `You’d decide ${l} together`, both: (l) => `You both feel strongly about ${l} and want the same`, clash: (l) => `Neither of you bends on ${l} and you want opposite things` };
const MODE_LINE = { fight: 'say it straight away, sometimes heatedly', withdraw: 'go quiet and need space', fix: 'try to fix it right away', seek: 'need to talk and be comforted' };

/** Predicted compatibility for one relation type (A = the person looking). */
export function compat(A, B, relation = 'friendship') {
  const rel = RELATIONS[relation] || RELATIONS.friendship;
  const deal = []; const watch = [];
  const gt = giveTakeFit(A, B);
  const raw = {
    vibe: vibeFit(A, B, relation), interests: interestsFit(A, B), values: valuesFit(A, B, relation),
    intention: intentionFit(A, B, relation, deal), decide: decideFit(A, B, relation), reaction: meet(A, B),
    recovery: recoveryFit(A, B), givetake: gt.score, loyalty: loyaltyFit(A, B, relation, watch), reading: readingFit(A, B),
  };
  for (const a of gt.areas) if (a.who === 'clash' && relation === 'lifepartner') deal.push(`both unbending on ${a.label}`);
  // weighted average of the areas, pulled down by the weakest important area (one bad area can sink a match)
  const parts = Object.entries(rel.weights).filter(([k]) => raw[k] != null).map(([k, w]) => [raw[k], w]);
  const mean = wavg(parts);
  const weakest = Math.min(...parts.filter(([, w]) => w >= 8).map(([v]) => v));
  let total = 0.7 * mean + 0.3 * (Number.isFinite(weakest) ? weakest : mean);
  let story = [];
  if (relation === 'lifepartner') {
    const sim2 = simulate(A, B);
    total = 0.6 * sim2.score + 0.4 * total;
    const sorted = [...sim2.runs].sort((x, y) => y.score - x.score);
    story = [...sorted.slice(0, 2).map((r) => ({ good: true, text: `Strong in ${r.label}` })), ...sorted.slice(-2).reverse().map((r) => ({ good: false, text: `Hard for you: ${r.label}` }))];
  }
  // how sure we are: an unsure model is pulled towards the middle (and can be asked more when connecting)
  const sure = pairConf(A, B, Object.keys(A.traits || {}));
  total = 62 + (total - 62) * (0.75 + 0.25 * sure);
  let overall = calibrate(total, relation);
  if (deal.length && (relation === 'lifepartner' || relation === 'dating')) overall = Math.min(overall, 40);
  // the two halves and each area are shown around the overall score (gentler stretch, so they don't all hit 1 or 99)
  const shown = (x) => (x == null ? null : clamp(Math.round(x), 1, 99)); // each area on its own 0-100 fit
  const pick = (keys) => { const x = wavg(keys.filter((k) => rel.weights[k] && raw[k] != null).map((k) => [raw[k], rel.weights[k]])); return x == null ? null : clamp(Math.round(overall + (x - mean) * 1.2), 1, 99); };
  const natural = pick(Object.keys(DIMS).filter((k) => DIMS[k].side === 'natural'));
  const relationship = pick(Object.keys(DIMS).filter((k) => DIMS[k].side === 'relationship'));

  const dims = Object.keys(rel.weights).filter((k) => raw[k] != null)
    .map((k) => ({ key: k, label: DIMS[k].label, emoji: DIMS[k].emoji, score: shown(raw[k]), weight: rel.weights[k] }))
    .sort((x, y) => y.score - x.score);
  const strengths = dims.filter((d) => d.score >= 72).slice(0, 3);
  const friction = dims.filter((d) => d.score < 42).slice(-2).reverse();
  const leads = rel.pair === 'couple' ? gt.areas.map((a) => ({ area: a.area, who: a.who, text: WHO_LINE[a.who](a.label) })) : [];
  const mine = topMode(A); const theirs = topMode(B);
  const reactLine = `When things go wrong, you ${MODE_LINE[mine]}; they ${MODE_LINE[theirs]}.`;

  let kind = 'balanced';
  if (deal.length && rel.pair === 'couple') kind = 'basics';
  else if (natural >= 70 && relationship >= 62) kind = 'similar';
  else if (rel.pair === 'couple' && gt.areas.filter((a) => a.who === 'you' || a.who === 'them').length >= 3 && relationship >= 55) kind = 'giveTake';
  else if (relationship >= 70 && natural < 55) kind = 'complement';
  else if (overall < 50 && (raw.reaction < 50 || friction.length >= 2)) kind = 'friction';
  if (overall < 35 && kind !== 'basics') kind = rel.pair === 'couple' || overall < 25 ? 'friction' : kind;
  if (overall < 25 && kind === 'friction' && rel.pair !== 'couple') kind = 'basics';
  return {
    relation, relationLabel: rel.label, emoji: rel.emoji,
    overall, natural, relationship, sure: Math.round(sure * 100),
    type: TYPE_NAMES[kind][rel.pair], typeKey: kind, typeLine: TYPE_LINES[kind],
    dims, strengths, friction, dealbreakers: deal, watch, leads, story, reactLine,
  };
}

/** Headline numbers for every relation type. */
export function compatAll(A, B) {
  return Object.fromEntries(RELATION_KEYS.map((k) => {
    const c = compat(A, B, k);
    return [k, { overall: c.overall, natural: c.natural, relationship: c.relationship, type: c.type, label: c.relationLabel, emoji: c.emoji }];
  }));
}

/** Which traits matter most for this relation (used to pick request-time questions). */
export const FOCUS = {
  friendship: { energy: 2, humor: 2, curiosity: 1.5, adventure: 1.5, depth: 1.5, loyal: 1, v_honesty: 1 },
  dating: { intent_serious: 2.5, intent_pace: 1.5, energy: 1.5, humor: 1.5, jealousy: 1.5, boundary: 1.5, integ: 1.5, r_seek: 1, r_withdraw: 1 },
  lifepartner: { intent_family: 2.5, intent_serious: 2, gt_money: 2, gt_family: 2.5, gt_home: 2, gt_career: 1.5, gt_social: 1, v_family: 2, v_tradition: 1.5, integ: 2, rec_forgive: 1.5, rec_apology: 1.5, r_fight: 1.2, r_withdraw: 1.2 },
  business: { dec_lead: 2, dec_risk: 2, dec_head: 1.5, v_ambition: 2, integ: 2.5, v_honesty: 2, r_fight: 1 },
  buddy: { v_ambition: 2, curiosity: 1.5, energy: 1.5, dec_head: 1.5, dec_lead: 1 },
};
