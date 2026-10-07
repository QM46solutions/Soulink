// Build 1: Soul DNA (v2 sectioned quiz, predicted compatibility), connecting rules, home feed, place search.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool, makeDna, sampleAnswers } from './helpers.js';
import { config } from '../src/config.js';

before(resetDb);
after(() => closePool());

const takeQuiz = (u, k = 0) => makeDna(u, k);

describe('Soul DNA', () => {
  test('one quiz in sections, no scoring weights sent to the phone', async () => {
    const u = await makeUser();
    const r = await api().get('/soul/dna').set(u.h).expect(200);
    assert.ok(r.body.total >= 60, `got ${r.body.total} questions`);
    assert.equal(r.body.questions.length, r.body.total);
    assert.ok(r.body.sections.length >= 10);
    const types = new Set(r.body.questions.map((q) => q.type));
    for (const t of ['choice', 'forced', 'scale', 'rank']) assert.ok(types.has(t), `has ${t} questions`);
    assert.equal(JSON.stringify(r.body.questions).includes('"axes"'), false);
    assert.equal(r.body.completed, false);
  });

  test('progress is saved and resumable; finishing gives a Soul type', async () => {
    const u = await makeUser();
    assert.equal((await api().get('/users/me').set(u.h)).body.user.soulReady, false);
    const all = sampleAnswers(0); const ids = Object.keys(all);
    const half = Object.fromEntries(ids.slice(0, 10).map((id) => [id, all[id]]));
    const p = await api().put('/soul/dna/answers').set(u.h).send({ answers: half }).expect(200);
    assert.equal(p.body.answered, 10);
    const inc = await api().post('/soul/dna/complete').set(u.h).expect(400);
    assert.equal(inc.body.error.code, 'incomplete');
    assert.equal((await api().get('/soul/dna').set(u.h)).body.answered, 10);
    const r = await takeQuiz(u);
    assert.equal(r.body.user.soulReady, true);
    assert.ok(r.body.soul.type.startsWith('The '));
    assert.ok(r.body.me.dims.length >= 10);
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
    assert.ok(other.all.lifepartner.overall >= 80, 'same answers score high the normal way');
    assert.notEqual(other.relation, 'lifepartner');
  });

  test('invalid answers are rejected', async () => {
    const u = await makeUser();
    const q = (await api().get('/soul/dna').set(u.h)).body.questions;
    const scale = q.find((x) => x.type === 'scale'); const rank = q.find((x) => x.type === 'rank');
    await api().put('/soul/dna/answers').set(u.h).send({ answers: { [scale.id]: 9 } }).expect(400);
    await api().put('/soul/dna/answers').set(u.h).send({ answers: { [rank.id]: ['x'] } }).expect(400);
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
