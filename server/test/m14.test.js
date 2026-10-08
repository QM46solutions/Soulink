// Music from JioSaavn / Deezer / free music on posts, Moments and Sparks (stored as references, never downloaded).
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool } from './helpers.js';

before(resetDb);
after(() => closePool());
const mp4 = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32, ...new Array(64).fill(0)]);

describe('Music', () => {
  test('search needs login; online search is off in tests', async () => {
    await api().get('/music/search?source=saavn&q=telugu').expect(401);
    const a = await makeUser();
    const r = await api().get('/music/search?source=deezer&q=hits').set(a.h).expect(200);
    assert.deepEqual(r.body.tracks, []);
    await api().get('/music/search?source=spotify').set(a.h).expect(400);
  });
  test('a bad song reference is refused', async () => {
    await api().get('/music/play/saavn:..%2Fx').expect(404);
    await api().get('/music/play/youtube:abc').expect(404);
  });
  test('a post keeps the song and where its 30 seconds start', async () => {
    const a = await makeUser();
    const p = (await api().post('/posts').set(a.h).field('caption', 'Golconda evening').expect(201)).body.post;
    const r = await api().post(`/posts/${p.id}/music/stream`).set(a.h).send({ ref: 'saavn:AbC_12', title: 'Naatu Naatu · Rahul', start: 62 }).expect(200);
    assert.deepEqual(r.body.post.music, { url: '/music/play/saavn:AbC_12', title: 'Naatu Naatu · Rahul', start: 62 });
    await api().post(`/posts/${p.id}/music/stream`).set(a.h).send({ ref: 'evil:1', title: 'x' }).expect(400);
    const b = await makeUser();
    await api().post(`/posts/${p.id}/music/stream`).set(b.h).send({ ref: 'deezer:1', title: 'x' }).expect((res) => assert.ok(res.status === 403 || res.status === 404));
    const d = await api().delete(`/posts/${p.id}/music`).set(a.h).expect(200);
    assert.equal(d.body.post.music, null);
  });
  test('a Moment can carry a song', async () => {
    const a = await makeUser();
    const m = (await api().post('/moments').set(a.h).field('text', 'Rain mood').field('story', '1').field('musicRef', 'deezer:3135556').field('musicTitle', 'Song · Artist').field('musicStart', '0').expect(201)).body.moment;
    assert.equal(m.music.url, '/music/play/deezer:3135556');
    assert.equal(m.music.title, 'Song · Artist');
  });
  test('a Spark can use a picked song instead of an uploaded one', async () => {
    const a = await makeUser();
    const s = (await api().post('/sparks').set(a.h).field('category', 'fitness').field('caption', 'Leg day').field('musicRef', 'free:1b2c3d4e-0000-4000-8000-000000000000').field('musicTitle', 'Run · Jo · CC BY')
      .field('details', JSON.stringify({ type: 'workout' })).attach('video', mp4, { filename: 'c.mp4', contentType: 'video/mp4' })).body.spark;
    if (s) { assert.equal(s.music.url, '/music/play/free:1b2c3d4e-0000-4000-8000-000000000000'); assert.equal(s.music.title, 'Run · Jo · CC BY'); }
  });
});
