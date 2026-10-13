// Scheduled reveal: the post goes up now, others see only a blurred teaser until the reveal time.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { api, resetDb, makeUser, closePool } from './helpers.js';

before(resetDb);
after(() => closePool());
const png = () => { const p = new PNG({ width: 64, height: 64 }); p.data.fill(200); return PNG.sync.write(p); };
const inMin = (m) => new Date(Date.now() + m * 60_000).toISOString();

describe('Scheduled reveal', () => {
  test('others get no media until the reveal, only the teaser; the owner sees everything', async () => {
    const a = await makeUser(); const b = await makeUser();
    const p = (await api().post('/posts').set(a.h).field('caption', 'Big news soon').field('revealAt', inMin(90))
      .attach('photos', png(), { filename: 'a.png', contentType: 'image/png' }).expect(201)).body.post;
    assert.equal(p.media.length, 1);
    assert.equal(p.reveal.locked, false);
    assert.ok(p.reveal.teaser);
    const seen = (await api().get(`/posts/${p.id}`).set(b.h).expect(200)).body.post;
    assert.deepEqual(seen.media, []);
    assert.equal(seen.reveal.locked, true);
    assert.equal(seen.reveal.teaser, p.reveal.teaser);
  });
  test('reveal time must be 1 minute to 30 days away, and needs a photo or video', async () => {
    const a = await makeUser();
    const att = (q) => q.attach('photos', png(), { filename: 'a.png', contentType: 'image/png' });
    await att(api().post('/posts').set(a.h).field('revealAt', inMin(0.2))).expect(400);
    await att(api().post('/posts').set(a.h).field('revealAt', inMin(31 * 24 * 60))).expect(400);
    await api().post('/posts').set(a.h).field('caption', 'text only').field('revealAt', inMin(60)).expect(400);
  });
  test('a normal post has no reveal', async () => {
    const a = await makeUser();
    const p = (await api().post('/posts').set(a.h).field('caption', 'hi').expect(201)).body.post;
    assert.equal(p.reveal, null);
  });
});
