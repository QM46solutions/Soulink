// Sparks ⚡: short talent videos in 5 categories with category extras.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool } from './helpers.js';

before(resetDb);
after(() => closePool());

const mp4 = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32, ...new Array(64).fill(0)]);
const post = (u, fields, file = mp4) => {
  let q = api().post('/sparks').set(u.h);
  for (const [k, v] of Object.entries(fields)) q = q.field(k, typeof v === 'string' ? v : JSON.stringify(v));
  if (file) q = q.attach('video', file, { filename: 'clip.mp4', contentType: 'video/mp4' });
  return q;
};

describe('Sparks', () => {
  test('post in a category with its extras; everyone sees it; filter by category', async () => {
    const a = await makeUser(); const b = await makeUser();
    const cook = (await post(a, { category: 'cooking', caption: 'Hyderabadi biryani in 60s', details: { dish: 'Biryani', minutes: 45, diet: 'nonveg', ingredients: ['rice', 'chicken'], steps: ['marinate', 'layer', 'dum'] } }).expect(201)).body.spark;
    assert.equal(cook.details.dish, 'Biryani'); assert.equal(cook.details.steps.length, 3);
    await post(a, { category: 'travel', caption: 'sunset', place: 'Tank Bund, Hyderabad', details: { sound: 'place' } }).expect(201);
    await post(a, { category: 'acting', caption: 'Improv!', oneTake: '1', details: { mode: 'dice', prompt: { emotion: 'Angry', situation: 'at a wedding', character: 'a grandmother' } } }).expect(201);
    const all = (await api().get('/sparks').set(b.h).expect(200)).body.sparks;
    assert.equal(all.length, 3);
    const onlyCook = (await api().get('/sparks?category=cooking').set(b.h).expect(200)).body.sparks;
    assert.equal(onlyCook.length, 1); assert.equal(onlyCook[0].category, 'cooking');
    assert.equal(all.find((s) => s.category === 'acting').oneTake, true);
  });

  test('rules: a video is required, travel needs a place, unknown category refused', async () => {
    const a = await makeUser();
    await post(a, { category: 'comedy' }, null).expect(400);
    assert.equal((await post(a, { category: 'travel' }).expect(400)).body.error.code, 'no_place');
    await post(a, { category: 'dance' }).expect(400);
  });

  test('reactions, I tried it (cooking only), views, delete', async () => {
    const a = await makeUser(); const b = await makeUser();
    const s = (await post(a, { category: 'cooking', details: { dish: 'Dosa' } }).expect(201)).body.spark;
    assert.equal((await api().post(`/sparks/${s.id}/react`).set(b.h).expect(200)).body.reactions, 1);
    assert.equal((await api().post(`/sparks/${s.id}/tried`).set(b.h).expect(200)).body.tried, 1);
    await api().post(`/sparks/${s.id}/view`).set(b.h).expect(200);
    await api().post(`/sparks/${s.id}/view`).set(b.h).expect(200);
    const seen = (await api().get(`/sparks/user/${a.user.id}`).set(b.h).expect(200)).body.sparks[0];
    assert.equal(seen.views, 1); assert.equal(seen.reacted, true); assert.equal(seen.iTried, true);
    const c = (await post(a, { category: 'comedy' }).expect(201)).body.spark;
    await api().post(`/sparks/${c.id}/tried`).set(b.h).expect(400);
    await api().delete(`/sparks/${s.id}`).set(b.h).expect(404);
    await api().delete(`/sparks/${s.id}`).set(a.h).expect(200);
    assert.equal((await api().get(`/sparks/user/${a.user.id}`).set(b.h).expect(200)).body.sparks.length, 1);
  });

  test('private accounts: only their followers see their Sparks', async () => {
    const p = await makeUser({ isPrivate: true }); const x = await makeUser();
    await post(p, { category: 'music', details: { kind: 'original', songCredit: 'My own song' } }).expect(201);
    assert.equal((await api().get('/sparks').set(x.h).expect(200)).body.sparks.length, 0);
    assert.equal((await api().get('/sparks').set(p.h).expect(200)).body.sparks.length, 1);
  });
});
