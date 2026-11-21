// Soul DNA v7 (no database): 8 categories of activities, first session + check-ins, answer shapes per kind,
// results as tendencies, partner needs, and a v6 Soul DNA carrying on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUESTIONS, SECTIONS, buildAxes, cleanAnswers, compat, compatAll, isComplete, pairQuestions, planFor, publicQuestions,
  sampleAnswers, selfView, theirMind, validAnswer, checkinPlan, baseOf, setRarity,
} from '../src/services/soulDna.js';
import { ANCHORS } from '../src/services/mind/scenarios.js';

const Q = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));
const calm = () => ({
  so2: { v: 3 }, co2: { o: 1 }, cf1: { o: 0 }, cf3: { v: 3 }, tb1: { o: 0 }, tb2: { v: 2 }, va0: { r: [0, 3, 1, 2] },
  li1: { v: 1 }, in1: { s: [0, 8, 11] }, li5: { food: 0, drinks: 0, smoke: 0, pets: 1, faith: 1 }, re5: { talk: 'must' },
});

test('8 fixed categories, an 11-activity first session that varies by person but always has the 4 anchors', () => {
  assert.equal(SECTIONS.length, 8);
  for (const s of SECTIONS) assert.ok(QUESTIONS.filter((q) => q.section === s.key).length >= 3, s.key);
  const plans = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((x) => planFor(`user-${x}`));
  for (const p of plans) {
    assert.equal(p.length, 11);
    for (const id of ANCHORS) assert.ok(p.includes(id), id);
    assert.equal(new Set(p.map((id) => Q[id].section)).size, 8, 'every category in the first session');
  }
  assert.ok(new Set(plans.map((p) => p.join())).size >= 3, 'different people get different activities');
  assert.deepEqual(planFor('same'), planFor('same'), 'stable for one person');
});

test('the removed v6 questions are gone; the phone never sees scoring', () => {
  for (const id of ['it_look', 'g_nature', 'fx_me', 'fx_box']) assert.equal(Q[id], undefined, id);
  assert.ok(!QUESTIONS.some((q) => /looking for on Soulink|Which of these are you/i.test(q.text)));
  const raw = JSON.stringify(publicQuestions());
  assert.equal(raw.includes('"set"') || raw.includes('r_fight') || raw.includes('intent_') || raw.includes('"trait"'), false);
  const needs = publicQuestions(['re5'])[0];
  assert.ok(needs.chips.some((c) => c.group === 'treat') && needs.chips.some((c) => c.group === 'life'));
});

test('answers are checked per kind; It depends / Skip is allowed except on quick taps, kids and partner needs', () => {
  const ok = { so2: { v: 4 }, va0: { r: [3, 2, 1, 0] }, li2: { s: [0, 1, 2] }, in1: { s: [1, 2, 3] }, va1: { o: 0, f: 2, ms: 2000 },
    li5: { food: -1, drinks: 1, smoke: 0, pets: 2, faith: 0 }, re5: { kids: 'never', word: 'must' }, cf1: { skip: true, d: 1 } };
  for (const [id, v] of Object.entries(ok)) assert.ok(validAnswer(Q[id], v), id);
  const bad = { so2: { v: 5 }, va0: { r: [0, 0, 1, 2] }, li2: { s: [0, 1] }, in1: { s: [1, 2, 3, 4] }, va1: { o: 0 },
    li5: { food: 0 }, re5: { word: 'never' }, re3: { skip: true }, cf3: 2 };
  for (const [id, v] of Object.entries(bad)) assert.equal(validAnswer(Q[id], v), false, id);
  assert.equal(validAnswer(Q.re5, { skip: true }), false);
  assert.equal(Object.keys(cleanAnswers({ ...ok, nope: { o: 1 } })).length, Object.keys(ok).length);
});

test('a slider, a rank and a skip move traits the way they say; picture picks are interests only', () => {
  const early = buildAxes({ li1: { v: 0 } }).traits.chrono; const owl = buildAxes({ li1: { v: 4 } }).traits.chrono;
  assert.ok(early.m < 35 && owl.m > 65, `${early.m} ${owl.m}`);
  const fam = buildAxes({ va0: { r: [0, 1, 2, 3] } }).traits; // family first, love last
  assert.ok(fam.v_family.m > fam.v_love.m + 20);
  const skipped = buildAxes({ cf1: { skip: true } }).traits.r_fix; const talked = buildAxes({ cf1: { o: 0 } }).traits.r_fix;
  assert.equal(skipped.c, 0); assert.ok(talked.c > 0.3 && talked.m > 65);
  const tiles = buildAxes({ in1: { s: [0, 1, 2] } });
  assert.deepEqual(tiles.interestsDna.slice(0, 3), ['Music', 'Movies', 'Cricket']);
  assert.ok(Object.values(tiles.traits).every((x) => x.c === 0));
  const gut = buildAxes({ tb1: { o: 2, ms: 1800 } }).traits.att_anx; const slow = buildAxes({ tb1: { o: 2, ms: 25000, ch: 2 } }).traits.att_anx;
  assert.ok(gut.c > slow.c);
});

test('results are tendencies with how sure Soul DNA is; one answer is an early read', () => {
  const one = selfView(buildAxes({ cf1: { o: 0 } })).categories.find((c) => c.key === 'conflict');
  assert.equal(one.level, 'early'); assert.match(one.line, /talking things through/);
  const many = selfView(buildAxes(sampleAnswers(2))).categories;
  assert.equal(many.length, 8);
  assert.ok(many.every((c) => c.level && c.line), JSON.stringify(many.filter((c) => !c.line)));
  assert.ok(many.some((c) => c.level === 'sure'));
});

test('a v6 Soul DNA carries on: its traits and answers count until newer answers replace them', () => {
  const v6 = { v: 6, traits: { r_fix: { m: 20, c: 0.8 }, chrono: { m: 85, c: 0.7 }, v_family: { m: 80, c: 0.7 } },
    intent: { look: 'serious', kids: 'want' }, life: { me: ['pets', 'kids'], must: ['faith'], never: ['smoke'], played: true }, lines: [{ id: 'lf2', s: 3, f: 1 }], picks: { va1: { o: 1, f: 2 } } };
  const base = baseOf(v6);
  const kept = buildAxes({}, base);
  assert.equal(kept.v, 7);
  assert.ok(kept.traits.chrono.m > 70 && kept.traits.chrono.c > 0.4, JSON.stringify(kept.traits.chrono));
  assert.equal(kept.intent.kids, 'want'); assert.deepEqual(kept.life.never, ['smoke']); assert.ok(kept.lines.some((l) => l.id === 'lf2'));
  assert.ok(selfView(kept).categories.find((c) => c.key === 'lifestyle').earlier);
  const newer = buildAxes({ li1: { v: 0 }, cf1: { o: 0 } }, base);
  assert.ok(newer.traits.chrono.m < 50, `${newer.traits.chrono.m}`);
  assert.ok(newer.traits.r_fix.m > 55, `${newer.traits.r_fix.m}`);
  assert.equal(selfView(newer).categories.find((c) => c.key === 'lifestyle').earlier, false);
  assert.deepEqual(baseOf(newer), base, 'a v7 Soul DNA hands the same base on');
  assert.ok(Number.isInteger(compat(v6, buildAxes(calm()), 'dating').overall));
});

test('partner needs: a crossed Never is a deal-breaker for couples; a Must is checked against how they are', () => {
  const noPets = buildAxes({ ...calm(), re5: { pets: 'never' } });
  const petLover = buildAxes(calm());
  assert.ok(compat(noPets, petLover, 'dating').dealbreakers.some((x) => /pets/.test(x)));
  assert.equal(compat(noPets, petLover, 'friendship').dealbreakers.length, 0);
  const noKids = buildAxes({ ...calm(), re5: { kids: 'never' } }); const wants = buildAxes({ ...calm(), re3: { o: 0 } });
  assert.ok(compat(noKids, wants, 'lifepartner').dealbreakers.some((x) => /kids/.test(x)));
  const wantsNonSmoker = buildAxes({ ...calm(), re5: { no_smoke: 'must' } });
  const smoker = buildAxes({ ...calm(), li5: { food: 2, drinks: 2, smoke: 2, pets: 2, faith: 2 } });
  const s = compat(wantsNonSmoker, smoker, 'dating');
  assert.ok([...s.watch, ...s.dealbreakers].some((w) => /smoke/i.test(w)), JSON.stringify(s.watch));
  const avoider = buildAxes({ ...calm(), cf1: { o: 1 }, cf4: { r: [3, 0, 1, 2] }, cf2: { o: 2 }, cf5: { o: 2 }, re5: {} });
  const c = compat(buildAxes(calm()), avoider, 'dating');
  assert.ok([...c.watch, ...c.dealbreakers].some((x) => /talks things through/i.test(x)), JSON.stringify(c.watch));
});

test('check-ins: 3 unseen activities from different categories; a category update brings back its own', () => {
  const answers = sampleAnswers(1); const first = Object.fromEntries(planFor('x').map((id) => [id, answers[id]]));
  const mind = buildAxes(first);
  const ids = checkinPlan(mind, first, 3);
  assert.equal(ids.length, 3);
  assert.ok(ids.every((id) => first[id] === undefined));
  assert.equal(new Set(ids.map((id) => Q[id].section)).size, 3);
  const conflict = checkinPlan(mind, first, 3, 'conflict');
  assert.ok(conflict.length >= 3 && conflict.every((id) => Q[id].section === 'conflict'));
  assert.ok(conflict.includes('cf1'), 'answered ones come back to change');
  assert.ok(isComplete(first, planFor('x')) && !isComplete({}, planFor('x')));
});

test('asking a couple: life stage and kids first, single-tap items only', () => {
  const A = buildAxes(calm()); const B = buildAxes(calm());
  const qs = pairQuestions(calm(), A, B, 'lifepartner', 3);
  assert.deepEqual(qs.slice(0, 2), ['re2', 're3']);
  assert.ok(qs.every((id) => ['react', 'more'].includes(Q[id].kind)));
  assert.ok(!pairQuestions(calm(), A, B, 'friendship', 3).includes('re2'));
});

test('similar people match well; every relation gets a score; an old v4 Soul DNA still matches', () => {
  setRarity({});
  const A = buildAxes(calm()); const B = buildAxes({ ...calm(), so2: { v: 2 } });
  assert.ok(compat(A, B, 'lifepartner').overall >= 65, `${compat(A, B, 'lifepartner').overall}`);
  const X = buildAxes(sampleAnswers(0)); const Y = buildAxes(sampleAnswers(3));
  assert.ok(Object.values(compatAll(X, Y)).every((x) => Number.isInteger(x.overall)));
  assert.ok(selfView(A).summary.length >= 2 && theirMind(B).length >= 2);
  const old = { v: 4, traits: Object.fromEntries(Object.keys(A.traits).map((t) => [t, { m: 55, c: 0.6 }])), spread: {}, completeness: 60 };
  assert.ok(Number.isInteger(compat(old, A, 'dating').overall));
});
