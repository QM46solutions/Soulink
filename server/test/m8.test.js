// Pulse meter: attention over the last 30 days, 0-100, newest counts most.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool, query } from './helpers.js';
import { scoreFromRaw, levelOf } from '../src/services/pulse.js';

before(resetDb);
after(() => closePool());

const myPulse = async (u) => (await api().get('/users/me').set(u.h).expect(200)).body.pulse;

describe('Pulse meter', () => {
  test('starts quiet; your own visits never count', async () => {
    const a = await makeUser();
    await api().get(`/users/u/${a.user.username}`).set(a.h).expect(200);
    const p = await myPulse(a);
    assert.equal(p.score, 0);
    assert.equal(p.level, 'quiet');
  });

  test('rises with profile views (once per person per day) and likes; visitors see it too', async () => {
    const a = await makeUser(); const b = await makeUser(); const c = await makeUser();
    await api().get(`/users/u/${a.user.username}`).set(b.h).expect(200);
    await api().get(`/users/u/${a.user.username}`).set(b.h).expect(200); // same day again: still one view
    const afterViews = await myPulse(a);
    assert.ok(afterViews.score > 0);
    const [post] = (await query(`INSERT INTO posts (author_id, caption, media_urls) OUTPUT INSERTED.id VALUES ($1, N'hi', N'[]')`, [a.user.id])).rows;
    await query('INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)', [post.id, b.user.id]);
    await query('INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)', [post.id, c.user.id]);
    const afterLikes = await myPulse(a);
    assert.ok(afterLikes.score > afterViews.score);
    assert.equal(afterLikes.trend, 'up');
    const seen = (await api().get(`/users/u/${a.user.username}`).set(c.h).expect(200)).body.pulse;
    assert.ok(seen.score >= afterLikes.score);
  });

  test('falls when nobody notices you (old activity fades, 30+ days is gone)', async () => {
    const a = await makeUser(); const b = await makeUser();
    await api().get(`/users/u/${a.user.username}`).set(b.h).expect(200);
    const fresh = (await myPulse(a)).score;
    await query('UPDATE profile_views SET created_at=DATEADD(DAY, -20, created_at) WHERE target_id=$1', [a.user.id]);
    const older = (await myPulse(a)).score;
    assert.ok(older < fresh);
    await query('UPDATE profile_views SET created_at=DATEADD(DAY, -15, created_at) WHERE target_id=$1', [a.user.id]);
    assert.equal((await myPulse(a)).score, 0);
  });

  test('scale and levels', () => {
    assert.equal(scoreFromRaw(0), 0);
    assert.ok(scoreFromRaw(200) <= 100);
    assert.equal(levelOf(85).key, 'fire');
    assert.equal(levelOf(10).key, 'quiet');
  });
});
