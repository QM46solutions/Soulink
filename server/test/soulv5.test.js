// Soul DNA v5 (no database): the games, answer shapes, consistency checks, deal-breakers from the games,
// firmness, rarity, and old (v4) Soul DNA still matching.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CORE_SIZE, QUESTIONS, SECTIONS, buildAxes, compat, compatAll, isComplete, planFor, publicQuestions, sampleAnswers, selfView, setRarity, theirMind, validAnswer } from '../src/services/soulDna.js';

const Q = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));
const person = (over = {}, k = 0) => buildAxes({ ...sampleAnswers(k), ...over });
// a calm, kind, consistent person (the "good" option everywhere) to build pairs from
const calm = () => ({
  it_look: 1, it_time: 1, it_kids: 2,
  pe1: { m: 1, l: 0 }, pe2: { m: 3, l: 1 }, pe3: { m: 0, l: 1 }, pe4: { m: 3, l: 1 }, pe5: { m: 3, l: 0 },
  em1: 0, em2: 2, em3: 0, em4: 0, em5: 1,
  va1: { o: 1, f: 1 }, va2: { o: 1, f: 1 }, va3: { o: 1, f: 1 }, va4: { o: 0, f: 1 }, va5: { o: 1, f: 1 }, va6: { o: 0, f: 1 }, va7: 1,
  lp1: { o: 1, f: 1 }, lp2: { o: 3, f: 1 }, lp3: { o: 0, f: 1 }, lp4: { o: 1, f: 1 }, lp5: { o: 0, f: 1 }, lp6: { o: 0, f: 1 }, lp7: { o: 0, f: 1 }, lp8: 0,
  fx_me: { s: ['veg'] }, fx_box: { must: [], never: ['smoke'] },
  dy1: 1, dy2: 1, dy3: 0, dy4: 1, dy5: 2, cf1: 0, cf2: 3, cf3: 0,
});

test('7 games plus intent, in order; the loyalty version follows what you are looking for', () => {
  assert.equal(SECTIONS.length, 8);
  const partner = planFor({ it_look: 0 }); const friend = planFor({ it_look: 2 });
  assert.equal(partner.length, CORE_SIZE);
  assert.ok(partner.includes('lp1') && !partner.includes('lf1'));
  assert.ok(friend.includes('lf1') && !friend.includes('lp1'));
  const order = partner.map((id) => SECTIONS.findIndex((s) => s.key === Q[id].section));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'games come one after another, never mixed');
  const pub = JSON.stringify(publicQuestions());
  assert.equal(pub.includes('"set"') || pub.includes('att_anx') || pub.includes('"s":'), false, 'no scoring sent to the phone');
});

test('answer shapes are checked per game', () => {
  assert.equal(validAnswer(Q.pe1, { m: 0, l: 2 }), true);
  assert.equal(validAnswer(Q.pe1, { m: 1, l: 1 }), false);
  assert.equal(validAnswer(Q.va1, { o: 0, f: 2 }), true);
  assert.equal(validAnswer(Q.va1, { o: 0 }), false, 'the firmness dial is required');
  assert.equal(validAnswer(Q.va1, 0), false);
  assert.equal(validAnswer(Q.va7, 1), true, 'the check has no dial');
  assert.equal(validAnswer(Q.fx_me, { s: ['smoke', 'veg'] }), true);
  assert.equal(validAnswer(Q.fx_me, { s: ['rockets'] }), false);
  assert.equal(validAnswer(Q.fx_box, { must: ['veg'], never: ['veg'] }), false);
  assert.equal(validAnswer(Q.em1, { o: 9 }), false);
  assert.equal(isComplete(sampleAnswers(0)), true);
  assert.equal(isComplete(sampleAnswers(2)), true, 'the friend version is complete too');
});

test('gut reactions count more than long hesitation', () => {
  const gut = buildAxes({ em1: { o: 2, ms: 2000 } }).traits.att_anx;
  const slow = buildAxes({ em1: { o: 2, ms: 25000, ch: 2 } }).traits.att_anx;
  assert.ok(gut.c > slow.c && gut.m > 60);
});

test('Most me / Least me moves a trait both ways', () => {
  const social = buildAxes({ pe1: { m: 0, l: 3 } }).traits;
  const quiet = buildAxes({ pe1: { m: 3, l: 0 } }).traits;
  assert.ok(social.b_E.m > 60 && quiet.b_E.m < 40);
});

test('a consistency check that disagrees makes Soul DNA less sure', () => {
  const ok = buildAxes({ ...calm(), va7: 1 }); const off = buildAxes({ ...calm(), va7: 0 });
  assert.equal(ok.consistent, true); assert.equal(off.consistent, false);
  assert.ok(off.completeness < ok.completeness);
  assert.ok(selfView(off).tensions.some((t) => t.includes('pointed different ways')));
});

test('a crossed "Never" chip and different intentions are deal-breakers for couples, not friends', () => {
  const A = buildAxes(calm()); // never: smoke
  const B = buildAxes({ ...calm(), fx_me: { s: ['smoke', 'veg'] } });
  assert.ok(compat(A, B, 'dating').dealbreakers.some((x) => x.startsWith('smoking')));
  assert.ok(compat(A, B, 'dating').overall <= 40);
  assert.equal(compat(A, B, 'friendship').dealbreakers.length, 0);
  const C = buildAxes({ ...calm(), it_look: 3 }); // still exploring vs a serious relationship
  assert.ok(compat(A, C, 'lifepartner').dealbreakers.includes('what you are each looking for'));
});

test('non-negotiables: one crossed caps softly, two are a deal-breaker; a flexible partner can bend', () => {
  const firm = (o) => ({ o, f: 2 });
  const A = buildAxes({ ...calm(), va1: firm(1), va5: firm(1) });
  const one = buildAxes({ ...calm(), va1: { o: 0, f: 1 } });
  const two = buildAxes({ ...calm(), va1: { o: 0, f: 1 }, va5: { o: 0, f: 1 } });
  const bends = buildAxes({ ...calm(), va1: { o: 0, f: 0 }, va5: { o: 0, f: 0 } });
  const c1 = compat(A, one, 'lifepartner'); const c2 = compat(A, two, 'lifepartner'); const c3 = compat(A, bends, 'lifepartner');
  assert.equal(c1.dealbreakers.length, 0); assert.ok(c1.overall <= 60); assert.ok(c1.watch.some((w) => w.startsWith('what matters most')));
  assert.ok(c2.dealbreakers.filter((x) => x.startsWith('what matters most')).length >= 2);
  assert.equal(c3.dealbreakers.length, 0);
});

test('similar calm people match well; the same pair scores differently per relation', () => {
  const A = buildAxes(calm()); const B = buildAxes({ ...calm(), em4: 4, dy5: 0 });
  assert.ok(compat(A, B, 'lifepartner').overall >= 70, `got ${compat(A, B, 'lifepartner').overall}`);
  assert.ok(compat(A, A, 'friendship').overall >= 85);
  const X = person({}, 0); const Y = person({}, 3);
  const all = Object.values(compatAll(X, Y)).map((x) => x.overall);
  assert.ok(Math.max(...all) - Math.min(...all) >= 10);
  assert.ok(selfView(A).summary.length >= 3 && theirMind(B).length >= 3);
  assert.ok(selfView(A).dims.length === 8);
});

test('sharing a rare value answer counts for more than sharing a common one', () => {
  const A = buildAxes(calm()); const B = buildAxes({ ...calm(), va2: { o: 0, f: 1 }, va3: { o: 0, f: 1 } }); // same on 4 cards
  const values = () => compat(A, B, 'friendship').dims.find((x) => x.key === 'values').score;
  setRarity({}); const plain = values();
  // the 4 shared answers are rare (10% of players picked them)
  setRarity({ va1: { 0: 0.9, 1: 0.1 }, va5: { 0: 0.9, 1: 0.1 }, va4: { 0: 0.1, 1: 0.9 }, va6: { 0: 0.1, 1: 0.9 } });
  const rare = values();
  setRarity({});
  assert.ok(rare > plain, `${rare} vs ${plain}`);
});

test('a Soul DNA from the old quiz (v4) still matches against the games', () => {
  const old = { v: 4, traits: Object.fromEntries(Object.keys(buildAxes({}).traits).filter((t) => !t.startsWith('b_') && !t.startsWith('att_') && t !== 'chrono').map((t) => [t, { m: 55, c: 0.6 }])), spread: {}, completeness: 60 };
  const c = compat(old, buildAxes(calm()), 'dating');
  assert.ok(Number.isInteger(c.overall));
  assert.ok(selfView(old).spectrum.every((x) => x.key !== 'chrono'));
});
