// Staying logged in and keeping notifications: logins renew themselves while used, and a phone whose push
// address was replaced by the browser is moved to the new address.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { api, resetDb, makeUser, closePool, query } from './helpers.js';
import { config } from '../src/config.js';

before(resetDb);
after(() => closePool());

describe('Logins and notifications stay on', () => {
  test('a login older than a day gets a fresh one (same session); a new one does not', async () => {
    const u = await makeUser();
    const now = await api().get('/users/me').set(u.h).expect(200);
    assert.equal(now.headers['x-soulink-token'], undefined);
    const p = jwt.decode(u.token);
    const old = jwt.sign({ sub: p.sub, sid: p.sid, iat: Math.floor(Date.now() / 1000) - 2 * 86400 }, config.jwtSecret, { expiresIn: '7d' });
    const r = await api().get('/users/me').set({ Authorization: `Bearer ${old}` }).expect(200);
    const fresh = r.headers['x-soulink-token'];
    assert.ok(fresh);
    const q = jwt.decode(fresh);
    assert.equal(q.sid, p.sid);
    assert.ok(q.exp - Date.now() / 1000 > 6 * 86400);
    await api().get('/users/me').set({ Authorization: `Bearer ${fresh}` }).expect(200);
  });

  test('a replaced push address moves to the new one, for the same person', async () => {
    const u = await makeUser();
    const keys = { p256dh: 'BPx'.padEnd(40, 'a'), auth: 'authauth' };
    await api().post('/push/subscribe').set(u.h).send({ endpoint: 'https://web.push.apple.com/old-123', keys }).expect(201);
    assert.equal((await api().post('/push/renew').send({ oldEndpoint: 'https://web.push.apple.com/unknown', endpoint: 'https://web.push.apple.com/x', keys }).expect(200)).body.ok, false);
    await api().post('/push/renew').send({ oldEndpoint: 'https://web.push.apple.com/old-123', endpoint: 'https://web.push.apple.com/new-456', keys }).expect(200);
    const rows = (await query('SELECT endpoint, user_id FROM push_subscriptions WHERE user_id=$1', [u.user.id])).rows;
    assert.deepEqual(rows.map((x) => x.endpoint), ['https://web.push.apple.com/new-456']);
  });
});
