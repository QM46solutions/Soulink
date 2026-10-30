// Soul DNA v4 (no database): the mind model, gut-reaction timing, adaptive questions, relation logic, simulation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUESTIONS, buildAxes, compat, compatAll, corePlan, CORE_SIZE, extendPlan, pairQuestions, sampleAnswers, selfView, theirMind, validAnswer } from '../src/services/soulDna.js';

const Q = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));
const answers = (over = {}, k = 0) => ({ ...sampleAnswers(k), ...over });

test('each person gets their own mix of scenarios, across every layer', () => {
  const a = corePlan('user-a'); const b = corePlan('user-b');
  assert.equal(a.length, CORE_SIZE); assert.deepEqual(corePlan('user-a'), a);
  assert.notDeepEqual(a, b);
  assert.equal(new Set(a.map((id) => Q[id].section)).size, 9);
});

test('quick confident answers count more than hesitant or changed ones', () => {
  const id = 'ra1';
  const gut = buildAxes({ [id]: { o: 2, ms: 2000 } }).traits.r_fight;
  const slow = buildAxes({ [id]: { o: 2, ms: 25000, ch: 2 } }).traits.r_fight;
  assert.ok(gut.c > slow.c);
  assert.ok(buildAxes({ [id]: { o: -1, t: 'I would cry' } }).traits.r_fight.c === 0, '"anything else" adds no evidence');
  assert.equal(validAnswer(Q[id], { o: -1, t: 'x' }), true);
  assert.equal(validAnswer(Q[id], { o: 7 }), false);
});

test('the model asks more where it is unsure', () => {
  const plan = corePlan('u');
  const few = Object.fromEntries(plan.map((id) => [id, 0]));
  assert.ok(Array.isArray(extendPlan(plan, few)));
});

test('two different people who know how to give and take still match as life partners', () => {
  // A holds firm on money, bends on family; B the other way round
  const A = buildAxes({ gt1: 0, gt9: 1, gt2: 2, gt7: 2 }); const B = buildAxes({ gt1: 2, gt9: 0, gt2: 0, gt7: 0 });
  const c = compat(A, B, 'lifepartner');
  assert.ok(c.leads.some((l) => l.who === 'you') && c.leads.some((l) => l.who === 'them'));
  assert.ok(c.story.length >= 2, 'life-partner score comes from the simulation, with reasons');
});

test('casual vs serious is a dealbreaker for dating and life partner, not for friends', () => {
  const A = buildAxes({ in1: 0, in4: 0, lo4: 0, in5: 0 }); const B = buildAxes({ in1: 2, in4: 3, lo4: 2, in5: 2 });
  assert.ok(compat(A, B, 'dating').dealbreakers.length >= 1);
  assert.ok(compat(A, B, 'dating').overall <= 40);
  assert.equal(compat(A, B, 'friendship').dealbreakers.length, 0);
});

test('the same pair scores differently per relation; everyone gets "how they think" in words', () => {
  const A = buildAxes(sampleAnswers(0)); const B = buildAxes(sampleAnswers(3));
  const all = Object.values(compatAll(A, B)).map((x) => x.overall);
  assert.ok(Math.max(...all) - Math.min(...all) >= 10);
  assert.ok(compat(A, A, 'friendship').overall >= 90);
  assert.ok(selfView(A).summary.length >= 3 && theirMind(B).length >= 3);
});

test('request-time questions target what is still unknown for the pair', () => {
  const A = buildAxes({ in1: 0 }); const B = buildAxes(sampleAnswers(2));
  const ids = pairQuestions({ in1: 0 }, A, B, 'lifepartner', 3);
  assert.ok(ids.length >= 1 && ids.length <= 3);
  assert.ok(!ids.includes('in1'));
});

test('extra scenarios come part by part, from the same part, once', async () => {
  const { extendPart } = await import('../src/services/soulDna.js');
  const { SCENARIO_MAP } = await import('../src/services/mind/scenarios.js');
  const plan = corePlan('part-test');
  // the plan is grouped by part
  const parts = plan.map((id) => SCENARIO_MAP[id].layer);
  assert.deepEqual(parts, [...parts].sort((a, b) => parts.indexOf(a) - parts.indexOf(b)));
  const layer = parts[0];
  const mine = plan.filter((id) => SCENARIO_MAP[id].layer === layer);
  const unsure = Object.fromEntries(mine.map((id) => [id, { o: -1, t: 'not sure' }])); // typed answers: no evidence
  assert.deepEqual(extendPart(plan, Object.fromEntries(mine.slice(1).map((id) => [id, unsure[id]])), layer), []); // part not finished
  const more = extendPart(plan, unsure, layer);
  assert.ok(more.length >= 1 && more.length <= 2);
  assert.ok(more.every((id) => SCENARIO_MAP[id].layer === layer && !plan.includes(id)));
  assert.deepEqual(extendPart([...plan, ...more], unsure, layer), []); // only once per part
});
