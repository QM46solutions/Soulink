// Build 1: Soul DNA (v7: 8 categories of activities, predicted compatibility), connecting rules, home feed, place search.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool, makeDna, sampleAnswers, query } from './helpers.js';
import { config } from '../src/config.js';

before(resetDb);
after(() => closePool());

const takeQuiz = (u, k = 0) => makeDna(u, k);

describe('Soul DNA', () => {
  test('the first session: 11 activities across 8 categories, with no scoring sent to the phone', async () => {
    const u = await makeUser();
    const r = await api().get('/soul/dna').set(u.h).expect(200);
    assert.equal(r.body.total, 11, `got ${r.body.total} items`);
    assert.equal(r.body.sections.length, 8);
    assert.equal(r.body.plan.length, r.body.total);
    assert.ok(r.body.questions.length > r.body.total, 'the whole bank is sent; check-ins use the rest');
    const kinds = new Set(r.body.questions.map((q) => q.kind));
    for (const k of ['react', 'more', 'slider', 'rank', 'day', 'tiles', 'habits', 'needs']) assert.ok(kinds.has(k), k);
    const raw = JSON.stringify(r.body.questions);
    assert.equal(raw.includes('"set"') || raw.includes('intent_') || raw.includes('r_fight'), false);
    assert.equal(r.body.completed, false);
    // gut-reaction timing and the firmness dial are part of the answer; It depends / Skip are answers too
    await api().put('/soul/dna/answers').set(u.h).send({ answers: { tb1: { o: 1, ms: 1800, ch: 1 }, va1: { o: 0, f: 2, ms: 2100 }, in1: { s: [0, 4], ms: 4000 }, cf1: { skip: true, d: 1 } } }).expect(200);
    await api().put('/soul/dna/answers').set(u.h).send({ answers: { va1: { o: 0 } } }).expect(400);
    await api().put('/soul/dna/answers').set(u.h).send({ answers: { in1: { s: [1, 1] } } }).expect(400);
    await api().put('/soul/dna/answers').set(u.h).send({ answers: { in1: { s: [0, 1, 2, 3] } } }).expect(400);
    await api().put('/soul/dna/answers').set(u.h).send({ answers: { re5: { skip: true } } }).expect(400);
  });

  test('an older Soul DNA keeps matching, and its owner can play the new games for free', async () => {
    const u = await makeUser();
    await takeQuiz(u, 0);
    await query("UPDATE soul_dna SET dna=JSON_MODIFY(dna, '$.v', 4) WHERE user_id=$1", [u.user.id]);
    await query('UPDATE users SET soul_version=4 WHERE id=$1', [u.user.id]);
    assert.equal((await api().get('/users/me').set(u.h)).body.user.soulUpgrade, true);
    const d = (await api().get('/soul/dna').set(u.h).expect(200)).body;
    assert.equal(d.upgrade, true); assert.equal(d.completed, false);
    assert.equal((await api().get('/soul/dna/me').set(u.h)).body.upgrade, true);
    await api().post('/soul/dna/retake').set(u.h).expect(200); // not Premium: still allowed, once
    const r = await takeQuiz(u, 1);
    assert.equal(r.body.user.soulUpgrade, false);
    assert.equal((await api().get('/soul/dna').set(u.h)).body.completed, true);
  });

  test('a v6 Soul DNA keeps working; its owner is invited (optionally) to refresh it, and nothing is lost', async () => {
    const u = await makeUser();
    await takeQuiz(u, 0);
    await query("UPDATE soul_dna SET dna=JSON_MODIFY(dna, '$.v', 6), answers=N'{}' WHERE user_id=$1", [u.user.id]);
    await query('UPDATE users SET soul_version=6 WHERE id=$1', [u.user.id]);
    const me = (await api().get('/users/me').set(u.h)).body.user;
    assert.equal(me.soulRefresh, true); assert.equal(me.soulUpgrade, false); assert.equal(me.soulReady, true);
    const d = (await api().get('/soul/dna').set(u.h).expect(200)).body;
    assert.equal(d.completed, true); assert.equal(d.refresh, true);
    const ci = (await api().get('/soul/dna/checkin').set(u.h).expect(200)).body;
    assert.deepEqual(ci.ids, d.plan, 'refreshing starts with the new first session');
    const r = (await api().put('/soul/dna/answers').set(u.h).send({ answers: { li1: { v: 0 } } }).expect(200)).body;
    assert.equal(r.updated, true);
    assert.ok(r.me.categories.find((c) => c.key === 'conflict').earlier, 'categories not refreshed yet come from the earlier Soul DNA');
  });

  test('progress is saved and resumable; finishing gives a Soul type', async () => {
    const u = await makeUser();
    assert.equal((await api().get('/users/me').set(u.h)).body.user.soulReady, false);
    const all = sampleAnswers(0);
    const { plan } = (await api().get('/soul/dna').set(u.h)).body;
    const half = Object.fromEntries(plan.slice(0, 5).map((id) => [id, all[id]]));
    const p = await api().put('/soul/dna/answers').set(u.h).send({ answers: half }).expect(200);
    assert.equal(p.body.answered, 5);
    const inc = await api().post('/soul/dna/complete').set(u.h).expect(400);
    assert.equal(inc.body.error.code, 'incomplete');
    assert.equal((await api().get('/soul/dna').set(u.h)).body.answered, 5);
    const r = await takeQuiz(u);
    assert.equal(r.body.user.soulReady, true);
    assert.ok(r.body.soul.type.startsWith('The '));
    assert.equal(r.body.me.dims.length, 8);
    assert.equal(r.body.me.categories.length, 8);
    assert.ok(r.body.me.summary.length >= 3, 'how you think, in words');
    const me = await api().get('/soul/dna/me').set(u.h).expect(200);
    assert.equal(me.body.ready, true);
  });

  test('Life partner score, and the pinned pair gets 93% only with each other', async () => {
    const ak = await makeUser({ username: 'akhii' }); const ni = await makeUser({ username: 'nikhil.cheedella' }); const x = await makeUser();
    await takeQuiz(ak, 0); await takeQuiz(ni, 3); await takeQuiz(x, 0);
    const pairBody = (await api().get(`/users/u/nikhil.cheedella`).set(ak.h).expect(200)).body;
    const pair = pairBody.match;
    assert.equal(pair.all.lifepartner.overall, 93);
    // every other score is the normal calculation, and the default score shown is unchanged
    const { compatAll, buildAxes, sampleAnswers: sa } = await import('../src/services/soulDna.js');
    const real = compatAll(buildAxes(sa(0)), buildAxes(sa(3)));
    for (const k of ['dating', 'friendship', 'business', 'buddy']) assert.equal(pair.all[k].overall, real[k].overall);
    assert.equal(pair.relation, 'friendship');
    assert.equal(pairBody.soulScore, real.friendship.overall);
    const full = (await api().get(`/soul/compat/${ni.user.id}?relation=lifepartner`).set(ak.h).expect(200)).body;
    assert.equal(full.overall, 93);
    const other = (await api().get(`/users/u/${x.user.username}`).set(ak.h).expect(200)).body.match;
    assert.equal(typeof other.all.lifepartner.overall, 'number');
    assert.ok(other.all.lifepartner.overall >= 65, 'same answers score well the normal way');
    assert.notEqual(other.relation, 'lifepartner');
  });

  test('Soul DNA is free, and so are check-ins and updates; starting over is Premium', async () => {
    const u = await makeUser();
    await takeQuiz(u, 0);
    const ci = (await api().get('/soul/dna/checkin').set(u.h).expect(200)).body;
    assert.ok(ci.ids.length >= 1 && ci.questions.length === ci.ids.length);
    const upd = (await api().put('/soul/dna/answers').set(u.h).send({ answers: { cf1: { o: 1 } } }).expect(200)).body;
    assert.equal(upd.updated, true); assert.equal(upd.me.categories.length, 8);
    const cat = (await api().get('/soul/dna/checkin?category=conflict').set(u.h).expect(200)).body;
    assert.ok(cat.ids.includes('cf1') && cat.answers.cf1);
    assert.equal((await api().post('/soul/dna/retake').set(u.h).expect(403)).body.error.code, 'premium_required');
    await query('UPDATE users SET is_premium=1 WHERE id=$1', [u.user.id]);
    await api().post('/soul/dna/retake').set(u.h).expect(200);
    const d = (await api().get('/soul/dna').set(u.h).expect(200)).body;
    assert.equal(d.answered, 0); assert.equal(d.canRetake, true); assert.equal(d.retaking, true);
    assert.equal((await api().get('/users/me').set(u.h)).body.user.soulReady, true, 'old Soul DNA stays until the new one is done');
    await takeQuiz(u, 4);
  });

  test('invalid answers are rejected', async () => {
    const u = await makeUser();
    const q = (await api().get('/soul/dna').set(u.h)).body.questions;
    await api().put('/soul/dna/answers').set(u.h).send({ answers: { [q[0].id]: 9 } }).expect(400);
    await api().put('/soul/dna/answers').set(u.h).send({ answers: { [q[0].id]: ['x'] } }).expect(400);
    await api().put('/soul/dna/answers').set(u.h).send({ answers: { [q[0].id]: { o: 1, ms: -5 } } }).expect(400);
    await api().put('/soul/dna/answers').set(u.h).send({ answers: { nope: 1 } }).expect(400);
  });

  test('cannot follow or start a chat before creating Soul DNA', async () => {
    const was = config.soulRequired;
    config.soulRequired = true;
    try {
      const a = await makeUser(); const b = await makeUser();
      const f = await api().post(`/users/${b.user.id}/follow`).set(a.h).expect(403);
      assert.equal(f.body.error.code, 'soul_required');
      await api().post('/conversations/direct').set(a.h).send({ userId: b.user.id }).expect(403);
      await takeQuiz(a);
      await api().post(`/users/${b.user.id}/follow`).set(a.h).expect(200);
    } finally { config.soulRequired = was; }
  });

  test('profile shows scores for every relation type; similar people score higher', async () => {
    const a = await makeUser(); const b = await makeUser(); const c = await makeUser();
    await takeQuiz(a, 0); await takeQuiz(b, 0); await takeQuiz(c, 3);
    const same = await api().get(`/users/u/${b.user.username}`).set(a.h).expect(200);
    const diff = await api().get(`/users/u/${c.user.username}`).set(a.h).expect(200);
    assert.ok(same.body.soulScore >= 80, `same answers → high score, got ${same.body.soulScore}`);
    assert.ok(diff.body.soulScore < same.body.soulScore);
    for (const k of ['dating', 'friendship', 'business', 'buddy']) assert.equal(typeof same.body.match.all[k].overall, 'number');
    const none = await makeUser();
    assert.equal((await api().get(`/users/u/${a.user.username}`).set(none.h)).body.soulScore, null);
  });

  test('full breakdown: two scores, a type, strengths/friction, ', async () => {
    const a = await makeUser(); const b = await makeUser();
    await takeQuiz(a, 0); await takeQuiz(b, 5);
    const r = await api().get(`/soul/compat/${b.user.id}?relation=dating`).set(a.h).expect(200);
    assert.equal(r.body.ready, true);
    assert.equal(r.body.relation, 'dating');
    for (const k of ['overall', 'natural', 'relationship']) assert.equal(typeof r.body[k], 'number');
    assert.ok(r.body.type.length > 3);
    assert.ok(Array.isArray(r.body.dims));
    assert.equal(r.body.observed, undefined);
    await api().get(`/soul/compat/${b.user.id}?relation=nope`).set(a.h).expect(400);
  });
});

describe('Home feed', () => {
  test('new person: no connections, no posts', async () => {
    const u = await makeUser();
    const r = await api().get('/feed').set(u.h).expect(200);
    assert.deepEqual(r.body, { connections: 0, posts: [] });
  });
  test('follows alone are not Soul Connections', async () => {
    const a = await makeUser(); const b = await makeUser();
    await api().post(`/users/${b.user.id}/follow`).set(a.h).expect(200);
    assert.equal((await api().get('/feed').set(a.h)).body.connections, 0);
  });
  test('my posts show in my feed with likes and comments; strangers do not see them', async () => {
    const a = await makeUser(); const b = await makeUser();
    const p = (await api().post('/posts').set(a.h).field('caption', 'Hello Hyderabad').expect(201)).body.post;
    assert.equal(p.mine, true);
    const feed = (await api().get('/feed').set(a.h)).body.posts;
    assert.equal(feed[0].caption, 'Hello Hyderabad');
    assert.equal((await api().get('/feed').set(b.h)).body.posts.length, 0);
    assert.equal((await api().post(`/posts/${p.id}/like`).set(a.h).expect(200)).body.likeCount, 1);
    await api().post(`/posts/${p.id}/comments`).set(a.h).send({ body: 'first!' }).expect(201);
    const one = (await api().get(`/posts/${p.id}`).set(a.h)).body.post;
    assert.equal(one.commentCount, 1);
    await api().post('/posts').set(a.h).field('caption', '  ').expect(400);
    await api().delete(`/posts/${p.id}`).set(a.h).expect(200);
    assert.equal((await api().get('/feed').set(a.h)).body.posts.length, 0);
  });
});

describe('Places', () => {
  test('typing suggests Hyderabad areas first and knows other names', async () => {
    const g = await api().get('/places/search?q=gach').expect(200);
    assert.equal(g.body.places[0].label, 'Gachibowli, Hyderabad');
    const b = await api().get('/places/search?q=bangalore').expect(200);
    assert.equal(b.body.places[0].label, 'Bengaluru');
  });
  test('current position → nearest area', async () => {
    const r = await api().get('/places/near?lat=17.4698&lon=78.3578').expect(200);
    assert.equal(r.body.place.label, 'Kondapur, Hyderabad');
    await api().get('/places/near?lat=abc&lon=1').expect(400);
  });
});
