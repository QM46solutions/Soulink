// Settings › Where you're logged in: every device, log one out, log out of all the others.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool } from './helpers.js';
import { describeDevice, maskIp, startSession } from '../src/services/sessions.js';

before(resetDb);
after(() => closePool());

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const WIN_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const another = async (u, ua) => ({ Authorization: `Bearer ${await startSession(u.user.id, { headers: { 'user-agent': ua } })}` });

describe('Devices', () => {
  test('device names and partly hidden addresses', () => {
    assert.deepEqual(describeDevice(IPHONE), { name: 'Safari on iPhone', kind: 'phone' });
    assert.deepEqual(describeDevice(WIN_CHROME), { name: 'Chrome on Windows', kind: 'computer' });
    assert.equal(describeDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0').name, 'Edge on Mac');
    assert.equal(describeDevice('').name, 'Unknown device');
    assert.equal(maskIp('49.36.120.7'), '49.36.x.x');
    assert.equal(maskIp('::ffff:10.1.2.3'), '10.1.x.x');
  });

  test('see every device, log one out, then all the others', async () => {
    const u = await makeUser();
    const phone = await another(u, IPHONE);
    const laptop = await another(u, WIN_CHROME);
    let list = (await api().get('/account/sessions').set(u.h).expect(200)).body.sessions;
    assert.equal(list.filter((x) => x.active).length, 3);
    assert.equal(list[0].current, true, 'this device first');
    const ph = list.find((x) => x.device === 'Safari on iPhone');
    assert.ok(ph && !ph.current && ph.active && ph.lastActiveAt && ph.loggedInAt);
    assert.equal(JSON.stringify(list).includes('Mozilla'), false, 'only the readable name is sent');

    // log the phone out: it can't use the account any more
    await api().delete(`/account/sessions/${ph.id}`).set(u.h).expect(200);
    assert.equal((await api().get('/users/me').set(phone).expect(401)).body.error.code, 'session_ended');
    await api().delete(`/account/sessions/${ph.id}`).set(u.h).expect(404);
    // this device is logged out with Log out, not from here
    assert.equal((await api().delete(`/account/sessions/${list[0].id}`).set(u.h).expect(400)).body.error.code, 'current_session');

    const r = (await api().post('/account/sessions/end-others').set(u.h).expect(200)).body;
    assert.equal(r.ended, 1);
    await api().get('/users/me').set(laptop).expect(401);
    await api().get('/users/me').set(u.h).expect(200);
    list = r.sessions;
    assert.equal(list.filter((x) => x.active).length, 1);
    assert.equal(list.filter((x) => x.endedAt).length, 2, 'recently ended devices stay in the list');
  });

  test('someone else’s device can’t be logged out', async () => {
    const a = await makeUser(); const b = await makeUser();
    const mine = (await api().get('/account/sessions').set(a.h)).body.sessions[0];
    await api().delete(`/account/sessions/${mine.id}`).set(b.h).expect(404);
  });
});
