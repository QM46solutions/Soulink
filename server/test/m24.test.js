// Unfinished sign-ups: 1 hour to come back and carry on; after that the half-made account is erased and the person
// starts again as a new user. Real members are never touched.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool, query } from './helpers.js';
import { purgeUnfinishedSignups } from '../src/services/signupCleanup.js';

before(resetDb);
after(() => closePool());

let seq = 7700000000;
async function startSignup() {
  const phone = String(seq++);
  const r = await api().post('/auth/otp/request').send({ phone }).expect(200);
  const v = (await api().post('/auth/otp/verify').send({ phone, code: r.body.devCode }).expect(200)).body;
  return { phone, token: v.token, id: v.user.id, h: { Authorization: `Bearer ${v.token}` } };
}
const age = (id, minutes) => query(`UPDATE users SET created_at = DATEADD(MINUTE, -${minutes}, SYSDATETIMEOFFSET()), updated_at = DATEADD(MINUTE, -${minutes}, SYSDATETIMEOFFSET()), last_active_at = DATEADD(MINUTE, -${minutes}, SYSDATETIMEOFFSET()) WHERE id=$1`, [id]);
const exists = async (id) => !!(await query('SELECT id FROM users WHERE id=$1', [id])).rows[0];

describe('Unfinished sign-ups', () => {
  test('within the hour: they can carry on', async () => {
    const s = await startSignup();
    await age(s.id, 40);
    await api().get('/users/me').set(s.h).expect(200);
    assert.equal(await purgeUnfinishedSignups() >= 0, true);
    assert.equal(await exists(s.id), true);
  });

  test('after the hour: cleared on their next visit, and logging in again makes a new account', async () => {
    const s = await startSignup();
    await age(s.id, 61);
    const r = await api().get('/users/me').set(s.h).expect(401);
    assert.equal(r.body.error.code, 'signup_expired');
    assert.equal(await exists(s.id), false);
    await query(`UPDATE otp_codes SET created_at = DATEADD(MINUTE, -5, created_at) WHERE target LIKE '%' + $1`, [s.phone]); // past the 30-second wait
    const again = await api().post('/auth/otp/request').send({ phone: s.phone }).expect(200);
    const v = (await api().post('/auth/otp/verify').send({ phone: s.phone, code: again.body.devCode }).expect(200)).body;
    assert.equal(v.isNew, true);
    assert.notEqual(v.user.id, s.id);
  });

  test('coming back by logging in after the hour also starts fresh', async () => {
    const s = await startSignup();
    await age(s.id, 90);
    await query(`UPDATE otp_codes SET created_at = DATEADD(MINUTE, -5, created_at) WHERE target LIKE '%' + $1`, [s.phone]); // past the 30-second wait
    const again = await api().post('/auth/otp/request').send({ phone: s.phone }).expect(200);
    const v = (await api().post('/auth/otp/verify').send({ phone: s.phone, code: again.body.devCode }).expect(200)).body;
    assert.equal(v.isNew, true);
    assert.equal(await exists(s.id), false);
  });

  test('the hourly clean-up erases old unfinished sign-ups, never finished accounts', async () => {
    const s = await startSignup();
    const member = await makeUser();
    await age(s.id, 120);
    await age(member.user.id, 120);
    assert.ok((await purgeUnfinishedSignups()) >= 1);
    assert.equal(await exists(s.id), false);
    assert.equal(await exists(member.user.id), true);
    const gone = (await query("SELECT reason FROM deleted_accounts WHERE user_id=$1", [s.id])).rows[0];
    assert.equal(gone.reason, 'unfinished_signup_expired');
  });
});
