// Security controls: device sessions, logout, account deletion everywhere, audit trail, face encryption, face search hold.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool, query } from './helpers.js';
import { sealFace, openFace } from '../src/lib/faceCrypto.js';

before(resetDb);
after(() => closePool());

// a second login on another device for the same account
async function secondDevice(phone) {
  const r = await api().post('/auth/otp/request').send({ phone }).expect(200);
  const v = await api().post('/auth/otp/verify').send({ phone, code: r.body.devCode }).expect(200);
  return { Authorization: `Bearer ${v.body.token}` };
}

describe('Sessions', () => {
  test('logging out ends only this device', async () => {
    const a = await makeUser();
    const other = await secondDevice(a.user.phone);
    await api().post('/auth/logout').set(a.h).expect(200);
    const r = await api().get('/users/me').set(a.h).expect(401);
    assert.equal(r.body.error.code, 'session_ended');
    await api().get('/users/me').set(other).expect(200); // the other device is still logged in
    const rows = (await query("SELECT action FROM audit_log WHERE actor_id=$1 AND action='logout'", [a.user.id])).rows;
    assert.equal(rows.length, 1);
  });

  test('deleting the account logs out every device with "No user account found"', async () => {
    const a = await makeUser();
    const other = await secondDevice(a.user.phone);
    await api().delete('/users/me').set(a.h).send({ confirm: 'DELETE' }).expect(200);
    for (const h of [a.h, other]) {
      const r = await api().get('/users/me').set(h).expect(401);
      assert.equal(r.body.error.code, 'no_account');
      assert.equal(r.body.error.message, 'No user account found.');
    }
    const open = (await query('SELECT COUNT(*) AS n FROM user_sessions WHERE user_id=$1 AND revoked_at IS NULL', [a.user.id])).rows[0].n;
    assert.equal(Number(open), 0);
    const logged = (await query("SELECT COUNT(*) AS n FROM audit_log WHERE target_user_id=$1 AND action='account_deleted'", [a.user.id])).rows[0].n;
    assert.equal(Number(logged), 1);
  });

  test('a login is written to the audit trail', async () => {
    const a = await makeUser();
    const n = (await query("SELECT COUNT(*) AS n FROM audit_log WHERE actor_id=$1 AND action IN ('signup','login')", [a.user.id])).rows[0].n;
    assert.ok(Number(n) >= 1);
  });
});

describe('Face data', () => {
  test('face fingerprints are encrypted and can be read back', () => {
    const v = Array.from({ length: 128 }, (_, i) => Math.round(Math.sin(i) * 1e6) / 1e6);
    const sealed = sealFace(v);
    assert.ok(sealed.startsWith('v1:'));
    assert.ok(!sealed.includes('0.'), 'no plain numbers in the stored value');
    assert.deepEqual(openFace(sealed), v);
    assert.deepEqual(openFace(JSON.stringify(v)), v); // older plain rows still read
    assert.equal(openFace(`v1:${Buffer.alloc(40).toString('base64')}`), null); // tampered value is rejected
  });

  test('face search is on hold', async () => {
    const a = await makeUser();
    const r = await api().patch('/users/me').set(a.h).send({ faceDiscoverable: true }).expect(400);
    assert.equal(r.body.error.code, 'face_search_paused');
  });
});
