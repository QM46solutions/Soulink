// Build 1: Soul DNA quiz, "no connecting before Soul DNA" rule, Soul Score, home feed, place search.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool } from './helpers.js';
import { config } from '../src/config.js';

before(resetDb);
after(() => closePool());

const answers = (pick) => Array.from({ length: 10 }, (_, i) => ({ questionId: i + 1, optionIndex: pick(i) }));
const takeQuiz = (u, pick = () => 0) => api().post('/soul/quiz').set(u.h).send({ answers: answers(pick) });

describe('Soul DNA', () => {
  test('quiz has 10 questions without the scoring weights', async () => {
    const u = await makeUser();
    const r = await api().get('/soul/quiz').set(u.h).expect(200);
    assert.equal(r.body.questions.length, 10);
    assert.equal(r.body.questions[0].options.length, 4);
    assert.equal(typeof r.body.questions[0].options[0], 'string');
  });

  test('finishing the quiz activates Soul DNA and gives a Soul type (no trait numbers)', async () => {
    const u = await makeUser();
    assert.equal((await api().get('/users/me').set(u.h)).body.user.soulReady, false);
    const r = await takeQuiz(u).expect(200);
    assert.equal(r.body.user.soulReady, true);
    assert.ok(r.body.soul.type.startsWith('The '));
    assert.ok(r.body.soul.tagline.length > 10);
    assert.equal(r.body.soul.traits, undefined);
  });

  test('incomplete or repeated answers are rejected', async () => {
    const u = await makeUser();
    await api().post('/soul/quiz').set(u.h).send({ answers: answers(() => 0).slice(0, 9) }).expect(400);
    const dup = answers(() => 0); dup[9].questionId = 1;
    await api().post('/soul/quiz').set(u.h).send({ answers: dup }).expect(400);
  });

  test('cannot follow or start a chat before creating Soul DNA', async () => {
    const was = config.soulRequired;
    config.soulRequired = true;
    try {
      const a = await makeUser(); const b = await makeUser();
      const f = await api().post(`/users/${b.user.id}/follow`).set(a.h).expect(403);
      assert.equal(f.body.error.code, 'soul_required');
      await api().post('/conversations/direct').set(a.h).send({ userId: b.user.id }).expect(403);
      await takeQuiz(a).expect(200);
      await api().post(`/users/${b.user.id}/follow`).set(a.h).expect(200);
    } finally { config.soulRequired = was; }
  });

  test('profile shows a Soul Score when both people have Soul DNA', async () => {
    const a = await makeUser(); const b = await makeUser(); const c = await makeUser();
    await takeQuiz(a, () => 0); await takeQuiz(b, () => 0); await takeQuiz(c, () => 3);
    const same = await api().get(`/users/u/${b.user.username}`).set(a.h).expect(200);
    const diff = await api().get(`/users/u/${c.user.username}`).set(a.h).expect(200);
    assert.ok(same.body.soulScore >= 95, `same answers → high score, got ${same.body.soulScore}`);
    assert.ok(diff.body.soulScore < same.body.soulScore);
    const none = await makeUser();
    assert.equal((await api().get(`/users/u/${a.user.username}`).set(none.h)).body.soulScore, null);
  });
});

describe('Home feed', () => {
  test('new person: no connections, no posts', async () => {
    const u = await makeUser();
    const r = await api().get('/feed').set(u.h).expect(200);
    assert.deepEqual(r.body, { connections: 0, posts: [] });
  });
  test('connections are counted once someone follows you back or you follow them', async () => {
    const a = await makeUser(); const b = await makeUser();
    await api().post(`/users/${b.user.id}/follow`).set(a.h).expect(200);
    assert.equal((await api().get('/feed').set(a.h)).body.connections, 1);
    assert.equal((await api().get('/feed').set(b.h)).body.connections, 1);
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
