// Account lifecycle: pause, 30-day scheduled deletion, cancel by logging in, restore from a download, bans.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool, query } from './helpers.js';
import { runScheduledDeletions } from '../src/services/lifecycle.js';

before(resetDb);
after(() => closePool());

async function login(phone) {
  await query('DELETE FROM otp_codes WHERE target=$1', [phone]); // skip the 30-second resend wait between test logins
  const r = await api().post('/auth/otp/request').send({ phone }).expect(200);
  const v = await api().post('/auth/otp/verify').send({ phone, code: r.body.devCode }).expect(200);
  return { body: v.body, h: { Authorization: `Bearer ${v.body.token}` } };
}

describe('Pause and delete', () => {
  test('pausing hides the account and signs out; logging in brings it back', async () => {
    const a = await makeUser(); const b = await makeUser();
    await api().post('/users/me/pause').set(a.h).expect(200);
    const r = await api().get('/users/me').set(a.h).expect(401);
    assert.ok(['account_paused', 'session_ended'].includes(r.body.error.code));
    await api().get(`/users/u/${a.user.username}`).set(b.h).expect(404); // hidden from others
    const back = await login(a.user.phone);
    assert.equal(back.body.welcomeBack, 'paused');
    await api().get(`/users/u/${a.user.username}`).set(b.h).expect(200);
  });

  test('deletion waits 30 days, and logging in before then cancels it', async () => {
    const a = await makeUser();
    const s = (await api().post('/users/me/schedule-deletion').set(a.h).send({ confirm: 'DELETE' }).expect(200)).body;
    assert.match(s.message, /deleted in 30 days\. Log in before then to cancel/);
    const days = (new Date(s.deleteAfter) - Date.now()) / 86400_000;
    assert.ok(days > 29.9 && days < 30.1);
    const back = await login(a.user.phone);
    assert.equal(back.body.welcomeBack, 'deleting');
    const row = (await query('SELECT delete_after FROM users WHERE id=$1', [a.user.id])).rows[0];
    assert.equal(row.delete_after, null);
  });

  test('after 30 days the account is erased and a 1-year identity record kept', async () => {
    const a = await makeUser();
    await api().post('/users/me/schedule-deletion').set(a.h).send({ confirm: 'DELETE' }).expect(200);
    await query('UPDATE users SET delete_after = DATEADD(DAY, -1, SYSDATETIMEOFFSET()) WHERE id=$1', [a.user.id]);
    await runScheduledDeletions();
    assert.equal((await query('SELECT id FROM users WHERE id=$1', [a.user.id])).rows.length, 0);
    const rec = (await query('SELECT display_name, birth_date, phone, reason FROM deleted_accounts WHERE user_id=$1', [a.user.id])).rows[0];
    assert.equal(rec.reason, 'scheduled'); assert.equal(rec.phone, a.user.phone); assert.ok(rec.birth_date); assert.ok(rec.display_name);
  });
});

describe('Restore my data', () => {
  test('a genuine download restores the profile on the new account', async () => {
    const a = await makeUser();
    await api().patch('/users/me').set(a.h).send({ bio: 'Chai and long walks' }).expect(200);
    const file = (await api().get('/users/me/export').set(a.h).expect(200)).body;
    assert.ok(file.signature);
    await api().delete('/users/me').set(a.h).send({ confirm: 'DELETE' }).expect(200);
    const again = await login(a.user.phone); // a fresh account with the same number
    const r = (await api().post('/users/me/restore').set(again.h).send(file).expect(200)).body;
    assert.ok(r.restored.includes('profile'));
    assert.equal(r.user.bio, 'Chai and long walks');
  });

  test('a changed file or somebody else\'s file is refused', async () => {
    const a = await makeUser(); const b = await makeUser();
    const file = (await api().get('/users/me/export').set(a.h).expect(200)).body;
    const changed = { ...file, profile: { ...file.profile, bio: 'hacked' } };
    assert.equal((await api().post('/users/me/restore').set(a.h).send(changed).expect(400)).body.error.code, 'restore_invalid');
    assert.equal((await api().post('/users/me/restore').set(b.h).send(file).expect(403)).body.error.code, 'restore_not_yours');
  });
});

describe('Bans', () => {
  test('a banned person cannot sign up again with the same number', async () => {
    const admin = await makeUser({ username: 'soulinkteam' });
    process.env.ADMIN_USERNAMES = 'soulinkteam';
    const bad = await makeUser();
    await api().post(`/admin/users/${bad.user.username}/ban`).set(admin.h).send({ reason: 'Repeated harassment of other users' }).expect(200);
    assert.equal((await query('SELECT id FROM users WHERE id=$1', [bad.user.id])).rows.length, 0);
    const r = await api().post('/auth/otp/request').send({ phone: bad.user.phone }).expect(403);
    assert.equal(r.body.error.code, 'banned');
    const bans = (await api().get('/admin/bans').set(admin.h).expect(200)).body.bans;
    assert.equal(bans[0].username, bad.user.username);
    await api().post(`/admin/bans/${bans[0].id}/lift`).set(admin.h).send({ reason: 'Appeal accepted by Grievance Officer' }).expect(200);
    await query('DELETE FROM otp_codes WHERE target=$1', [bad.user.phone]);
    await api().post('/auth/otp/request').send({ phone: bad.user.phone }).expect(200);
  });
});
