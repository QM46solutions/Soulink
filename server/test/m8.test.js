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

describe('Settings: Pulse meter on/off and notification kinds', () => {
  test('switching my Pulse meter off hides it on my profile for everyone, me included', async () => {
    const a = await makeUser(); const b = await makeUser();
    const me = await api().patch('/users/me').set(a.h).send({ showPulse: false }).expect(200);
    assert.equal(me.body.user.settings.showPulse, false);
    assert.equal((await api().get(`/users/u/${a.user.username}`).set(b.h).expect(200)).body.pulse, null);
    assert.equal((await api().get(`/users/u/${a.user.username}`).set(a.h).expect(200)).body.pulse, null);
    assert.equal((await api().get('/users/me').set(a.h).expect(200)).body.pulse, null);
    await api().patch('/users/me').set(a.h).send({ showPulse: true }).expect(200);
    assert.ok((await api().get(`/users/u/${a.user.username}`).set(b.h).expect(200)).body.pulse);
  });

  test('notification kinds: all on by default, change one at a time', async () => {
    const a = await makeUser();
    const start = (await api().get('/users/me').set(a.h).expect(200)).body.user.settings.notifyPrefs;
    assert.equal(start.messages, true); assert.equal(start.likes, true);
    const r = await api().patch('/users/me').set(a.h).send({ notifyPrefs: { likes: false } }).expect(200);
    assert.equal(r.body.user.settings.notifyPrefs.likes, false);
    assert.equal(r.body.user.settings.notifyPrefs.messages, true);
    await api().patch('/users/me').set(a.h).send({ notifyPrefs: { nope: true } }).expect(400);
  });

  test('push subscription endpoints', async () => {
    const a = await makeUser();
    await api().get('/push/key').set(a.h).expect(200);
    const sub = { endpoint: 'https://push.example.com/abc', keys: { p256dh: 'x'.repeat(20), auth: 'y'.repeat(8) } };
    await api().post('/push/subscribe').set(a.h).send(sub).expect(201);
    await api().post('/push/subscribe').set(a.h).send(sub).expect(201); // same phone again: no duplicate
    const { rows } = await query('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id=$1', [a.user.id]);
    assert.equal(Number(rows[0].n), 1);
    await api().delete('/push/subscribe').set(a.h).send({ endpoint: sub.endpoint }).expect(200);
  });
});
