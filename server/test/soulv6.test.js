// Soul DNA v6 (no database): 7 categories × 3 taps, photo grids, answer shapes, deal-breakers from the games,
// firmness, rarity, and older Soul DNA still matching.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CORE_SIZE, QUESTIONS, SECTIONS, buildAxes, compat, compatAll, isComplete, planFor, publicQuestions, sampleAnswers, selfView, setRarity, theirMind, validAnswer } from '../src/services/soulDna.js';

const Q = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));
const person = (over = {}, k = 0) => buildAxes({ ...sampleAnswers(k), ...over });
// a calm, kind person to build pairs from
const calm = () => ({
  g_nature: { s: [4, 6, 9] }, pe_cancel: 3, pe_team: 3,
  g_feel: { s: [8, 10] }, em1: 0, em5: 1,
  g_values: { s: [0, 5, 7] }, va1: { o: 1, f: 1 }, va6: { o: 0, f: 1 },
  it_look: 1, g_loyal: { s: [1, 2, 8] }, lp3: { o: 0, f: 1 },
  fx_me: { s: ['veg'] }, fx_box: { must: [], never: ['smoke'] }, it_kids: 2,
  g_day: { s: [1, 4, 9] }, dy4: 1, dy5: 2,
  g_fight: { s: [2, 3] }, cf1: 0, cf3: 0,
});

test('7 categories × 3 taps, in order; the loyalty question follows what you are looking for', () => {
  assert.equal(SECTIONS.length, 7);
  const partner = planFor({ it_look: 0 }); const friend = planFor({ it_look: 2 });
  assert.equal(partner.length, 21); assert.equal(friend.length, 21); assert.equal(CORE_SIZE, 21);
  for (const s of SECTIONS) assert.equal(partner.filter((id) => Q[id].section === s.key).length, 3, s.key);
  assert.ok(partner.includes('lp3') && !partner.includes('lf2'));
  assert.ok(friend.includes('lf2') && !friend.includes('lp3'));
  const order = partner.map((id) => SECTIONS.findIndex((s) => s.key === Q[id].section));
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'categories come one after another, never mixed');
  for (const s of SECTIONS) assert.equal(Q[partner.find((id) => Q[id].section === s.key)].kind, s.key === 'loyalty' ? 'pick' : s.key === 'flex' ? 'me' : 'photos', `${s.key} opens with its photos`);
  const pub = publicQuestions();
  const raw = JSON.stringify(pub);
  assert.equal(raw.includes('"set"') || raw.includes('att_anx') || raw.includes('"s":'), false, 'no scoring sent to the phone');
  assert.equal(raw.includes('emoji'), false, 'no emoji anywhere in the games');
  for (const q of pub.filter((x) => x.kind === 'photos')) assert.ok(q.photos.length >= 8 && q.photos.length <= 15 && q.photos.every(Boolean), q.id);
  assert.ok(pub.find((q) => q.id === 'fx_me').chips.every((c) => c.photo && c.key !== 'kids'));
});

test('answer shapes are checked per kind', () => {
  assert.equal(validAnswer(Q.g_nature, { s: [0, 3, 5] }), true);
  assert.equal(validAnswer(Q.g_nature, { s: [2] }), true, 'one is enough');
  assert.equal(validAnswer(Q.g_nature, { s: [] }), false);
  assert.equal(validAnswer(Q.g_nature, { s: [0, 1, 2, 3] }), false, 'at most 3');
  assert.equal(validAnswer(Q.g_nature, { s: [1, 1] }), false);
  assert.equal(validAnswer(Q.g_nature, { s: [99] }), false);
  assert.equal(validAnswer(Q.g_values, { s: [0, 1] }), false, 'values: exactly 3');
  assert.equal(validAnswer(Q.g_values, { s: [0, 1, 2] }), true);
  assert.equal(validAnswer(Q.va1, { o: 0, f: 2 }), true);
  assert.equal(validAnswer(Q.va1, { o: 0 }), false, 'the firmness dial is required');
  assert.equal(validAnswer(Q.fx_me, { s: ['smoke', 'veg'] }), true);
  assert.equal(validAnswer(Q.fx_me, { s: ['kids'] }), false, 'kids comes from its own question');
  assert.equal(validAnswer(Q.fx_box, { must: ['kids'], never: [] }), true);
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

test('a photo pick moves the traits it shows, and the first pick counts most', () => {
  const party = buildAxes({ g_nature: { s: [0] } }).traits; const book = buildAxes({ g_nature: { s: [1] } }).traits;
  assert.ok(party.b_E.m > 60 && book.b_E.m < 45);
  const first = buildAxes({ g_nature: { s: [0, 1] } }).traits.b_E.m; const second = buildAxes({ g_nature: { s: [1, 0] } }).traits.b_E.m;
  assert.ok(first > second, `${first} vs ${second}`);
});

test('a crossed "Never", kids and different intentions are deal-breakers for couples, not friends', () => {
  const A = buildAxes(calm()); // never: smoke
  const B = buildAxes({ ...calm(), fx_me: { s: ['smoke', 'veg'] } });
  assert.ok(compat(A, B, 'dating').dealbreakers.some((x) => x.startsWith('smoking')));
  assert.ok(compat(A, B, 'dating').overall <= 40);
  assert.equal(compat(A, B, 'friendship').dealbreakers.length, 0);
  const noKids = buildAxes({ ...calm(), fx_box: { must: [], never: ['kids'] } });
  const wantsKids = buildAxes({ ...calm(), it_kids: 0 });
  assert.ok(compat(noKids, wantsKids, 'lifepartner').dealbreakers.some((x) => x.startsWith('wanting kids')));
  const C = buildAxes({ ...calm(), it_look: 3 }); // still exploring vs a serious relationship
  assert.ok(compat(A, C, 'lifepartner').dealbreakers.includes('what you are each looking for'));
});

test('non-negotiables: one crossed caps softly, two are a deal-breaker; a flexible partner can bend', () => {
  const firm = (o) => ({ o, f: 2 });
  const A = buildAxes({ ...calm(), va1: firm(1), va6: firm(0) });
  const one = buildAxes({ ...calm(), va1: { o: 0, f: 1 } });
  const two = buildAxes({ ...calm(), va1: { o: 0, f: 1 }, va6: { o: 1, f: 1 } });
  const bends = buildAxes({ ...calm(), va1: { o: 0, f: 0 }, va6: { o: 1, f: 0 } });
  const c1 = compat(A, one, 'lifepartner'); const c2 = compat(A, two, 'lifepartner'); const c3 = compat(A, bends, 'lifepartner');
  assert.equal(c1.dealbreakers.length, 0); assert.ok(c1.overall <= 60); assert.ok(c1.watch.some((w) => w.startsWith('what matters most')));
  assert.ok(c2.dealbreakers.filter((x) => x.startsWith('what matters most')).length >= 2);
  assert.equal(c3.dealbreakers.length, 0);
});

test('similar calm people match well; the same pair scores differently per relation', () => {
  const A = buildAxes(calm()); const B = buildAxes({ ...calm(), dy5: 0, g_day: { s: [1, 4, 10] } });
  assert.ok(compat(A, B, 'lifepartner').overall >= 70, `got ${compat(A, B, 'lifepartner').overall}`);
  assert.ok(compat(A, A, 'friendship').overall >= 85);
  const X = person({}, 0); const Y = person({}, 3);
  const all = Object.values(compatAll(X, Y)).map((x) => x.overall);
  assert.ok(Math.max(...all) - Math.min(...all) >= 8, all.join(' '));
  assert.ok(selfView(A).summary.length >= 3 && theirMind(B).length >= 3);
  assert.equal(selfView(A).dims.length, 7);
});

test('sharing rare picks counts for more than sharing common ones', () => {
  const A = buildAxes(calm()); const B = buildAxes({ ...calm(), g_values: { s: [0, 2, 3] }, va1: { o: 0, f: 0 }, g_nature: { s: [0, 2] } });
  const values = () => compat(A, B, 'friendship').dims.find((x) => x.key === 'values').score;
  setRarity({}); const plain = values();
  setRarity({ g_values: { 0: 0.05, 5: 0.05, 7: 0.05 }, va1: { 0: 0.9, 1: 0.1 }, va6: { 0: 0.1, 1: 0.9 } });
  const rare = values();
  setRarity({});
  assert.ok(rare > plain, `${rare} vs ${plain}`);
});

test('an older Soul DNA (v4) still matches against the new one', () => {
  const old = { v: 4, traits: Object.fromEntries(Object.keys(buildAxes({}).traits).filter((t) => !t.startsWith('b_') && !t.startsWith('att_') && t !== 'chrono').map((t) => [t, { m: 55, c: 0.6 }])), spread: {}, completeness: 60 };
  const c = compat(old, buildAxes(calm()), 'dating');
  assert.ok(Number.isInteger(c.overall));
  assert.ok(selfView(old).spectrum.every((x) => x.key !== 'chrono'));
});
