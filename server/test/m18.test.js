// Legal: terms consent, data download, account deletion, music sources.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool, query } from './helpers.js';

before(resetDb);
after(() => closePool());

describe('Legal and privacy', () => {
  test('accepting the terms is recorded', async () => {
    const a = await makeUser();
    const u = (await api().post('/users/me/accept-terms').set(a.h).send({ version: '2026-10-15' }).expect(200)).body.user;
    assert.equal(u.termsVersion, '2026-10-15'); assert.ok(u.termsAcceptedAt);
  });

  test('download my data returns my profile and posts', async () => {
    const a = await makeUser();
    await api().post('/posts').set(a.h).field('caption', 'Hello Hyderabad').expect(201);
    const d = (await api().get('/users/me/export').set(a.h).expect(200)).body;
    assert.equal(d.profile.id.toLowerCase(), a.user.id.toLowerCase());
    assert.equal(d.posts[0].caption, 'Hello Hyderabad');
    assert.equal(d.profile.password_hash, undefined);
  });

  test('delete my account erases the person and keeps only the 180-day sign-up record', async () => {
    const a = await makeUser(); const b = await makeUser();
    await api().post('/posts').set(a.h).field('caption', 'bye').expect(201);
    await api().delete('/users/me').set(a.h).send({ confirm: 'nope' }).expect(400);
    await api().delete('/users/me').set(a.h).send({ confirm: 'DELETE' }).expect(200);
    await api().get('/users/me').set(a.h).expect(401);
    const rec = (await query('SELECT * FROM deleted_accounts WHERE user_id=$1', [a.user.id])).rows;
    assert.equal(rec.length, 1);
    await api().get(`/users/u/${a.user.username}`).set(b.h).expect(404);
  });

  test('music sources list', async () => {
    const a = await makeUser();
    const r = (await api().get('/music/sources').set(a.h).expect(200)).body;
    assert.ok(r.sources.includes('deezer'));
  });
});
