// Sign-in update: email codes, phone sign-in kept off until SMS is live, no code shown to the public, verified
// emails only after a real delivery, adding an email, and "sign in with fingerprint / face unlock" device keys.
import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { api, query, resetDb, makeUser, closePool } from './helpers.js';
import { config } from '../src/config.js';

const saved = { ...config, otp: { ...config.otp }, testLoginTargets: [...config.testLoginTargets] };
const realFetch = globalThis.fetch;
before(resetDb);
afterEach(() => { Object.assign(config, saved, { otp: { ...saved.otp }, testLoginTargets: [...saved.testLoginTargets] }); globalThis.fetch = realFetch; });
after(() => closePool());
const ago = (sql) => query(`UPDATE otp_codes SET created_at = ${sql}`);

test('phone sign-in is off until SMS is live; the reviewer and the team test numbers still work', async () => {
  Object.assign(config, { phoneLogin: false, reviewPhone: '+919999900001', reviewCode: '424242', testLoginTargets: ['9999900002'] });
  const off = await api().post('/auth/otp/request').send({ phone: '9999900003' }).expect(403);
  assert.equal(off.body.error.code, 'phone_login_off');
  await api().post('/auth/otp/request').send({ phone: '9999900001' }).expect(200);           // reviewer
  const rv = await api().post('/auth/otp/verify').send({ phone: '9999900001', code: '424242' }).expect(200);
  assert.equal(rv.body.user.phoneVerified, false); // nothing was really sent to that phone
  await api().post('/auth/otp/request').send({ phone: '9999900002' }).expect(200);           // team test number
  await api().post('/auth/otp/request').send({ email: 'someone@example.com' }).expect(200);   // email always works
});

test('outside development the code is shown only to the team test addresses', async () => {
  Object.assign(config, { isDev: false, otpDevEcho: true, testLoginTargets: ['team@example.com'] });
  const pub = await api().post('/auth/otp/request').send({ email: 'public@example.com' }).expect(200);
  assert.equal(pub.body.devCode, undefined);
  const team = await api().post('/auth/otp/request').send({ email: 'team@example.com' }).expect(200);
  assert.match(team.body.devCode, /^\d{6}$/);
});

test('hourly and daily limits per address', async () => {
  for (let i = 0; i < 5; i++) {
    await api().post('/auth/otp/request').send({ email: 'busy@example.com' }).expect(200);
    await ago('DATEADD(SECOND, -40, created_at)'); // past the 30 s wait, still within the hour
  }
  const r = await api().post('/auth/otp/request').send({ email: 'busy@example.com' }).expect(429);
  assert.match(r.body.error.message, /Too many codes/);
});

test('a failed email send gives a clear error and does not start the wait', async () => {
  config.emailProvider = 'resend';
  globalThis.fetch = async () => ({ ok: false, status: 500 });
  const r = await api().post('/auth/otp/request').send({ email: 'fail@example.com' }).expect(503);
  assert.equal(r.body.error.code, 'otp_not_sent');
  const n = (await query("SELECT COUNT(*) AS n FROM otp_codes WHERE target='fail@example.com'")).rows[0].n;
  assert.equal(Number(n), 0);
  globalThis.fetch = async () => ({ ok: true, status: 200 });
  await api().post('/auth/otp/request').send({ email: 'fail@example.com' }).expect(200); // no 30 s wait
});

test('an email counts as verified only after a real delivery', async () => {
  const a = await api().post('/auth/otp/request').send({ email: 'test-mode@example.com' }).expect(200);
  const v1 = await api().post('/auth/otp/verify').send({ email: 'test-mode@example.com', code: a.body.devCode }).expect(200);
  assert.equal(v1.body.user.emailVerified, false); // test mode (server log), not really sent
  config.emailProvider = 'resend';
  globalThis.fetch = async () => ({ ok: true, status: 200 });
  const b = await api().post('/auth/otp/request').send({ email: 'real@example.com' }).expect(200);
  const v2 = await api().post('/auth/otp/verify').send({ email: 'real@example.com', code: b.body.devCode }).expect(200);
  assert.equal(v2.body.user.emailVerified, true);
  assert.equal(v2.body.user.phoneVerified, false);
});

test('adding an email to a phone account: code to the new address first', async () => {
  const u = await makeUser();
  const other = await api().post('/auth/otp/request').send({ email: 'taken@example.com' }).expect(200);
  await api().post('/auth/otp/verify').send({ email: 'taken@example.com', code: other.body.devCode }).expect(200);

  const t = await api().post('/account/email/request').set(u.h).send({ email: 'taken@example.com' }).expect(200); // same answer
  const clash = await api().post('/account/email/verify').set(u.h).send({ email: 'taken@example.com', code: t.body.devCode }).expect(409);
  assert.equal(clash.body.error.code, 'email_taken');

  const r = await api().post('/account/email/request').set(u.h).send({ email: 'Mine@Example.com' }).expect(200);
  await api().post('/account/email/verify').set(u.h).send({ email: 'mine@example.com', code: '000000' }).expect(400);
  const ok = await api().post('/account/email/verify').set(u.h).send({ email: 'mine@example.com', code: r.body.devCode }).expect(200);
  assert.equal(ok.body.user.email, 'mine@example.com');
  // a login code can't be used to add an email, and an add-email code can't sign anyone in
  await api().post('/auth/otp/verify').send({ email: 'mine@example.com', code: r.body.devCode }).expect(400);
});

test('fingerprint / face-unlock sign-in: set up, use, wrong tries, logged out elsewhere, paused account', async () => {
  const u = await makeUser();
  const k = (await api().post('/auth/device-keys').set(u.h).send({ label: 'Test phone' }).expect(201)).body;
  assert.ok(k.id && k.secret.length >= 40);
  const stored = (await query('SELECT secret_hash FROM device_keys WHERE id=$1', [k.id])).rows[0].secret_hash;
  assert.notEqual(stored, k.secret); // only a keyed hash is kept

  const ok = await api().post('/auth/device-keys/unlock').send({ id: k.id, secret: k.secret }).expect(200);
  assert.ok(ok.body.token);
  await api().get('/users/me').set({ Authorization: `Bearer ${ok.body.token}` }).expect(200);
  const list = (await api().get('/auth/device-keys').set(u.h).expect(200)).body.keys;
  assert.equal(list.length, 1); assert.equal(list[0].label, 'Test phone');

  for (let i = 0; i < 5; i++) await api().post('/auth/device-keys/unlock').send({ id: k.id, secret: `${k.secret}x` }).expect(401);
  const locked = await api().post('/auth/device-keys/unlock').send({ id: k.id, secret: k.secret }).expect(401); // revoked after 5 wrong tries
  assert.equal(locked.body.error.code, 'device_key_invalid');

  // a key belongs to the session that set it up: "log out of other devices" switches it off
  const k2 = (await api().post('/auth/device-keys').set(u.h).send({}).expect(201)).body;
  const s2 = (await api().post('/auth/device-keys/unlock').send({ id: k2.id, secret: k2.secret }).expect(200)).body.token;
  await api().post('/account/sessions/end-others').set(u.h).expect(200);
  await api().post('/auth/device-keys/unlock').send({ id: k2.id, secret: k2.secret }).expect(401);
  assert.ok(s2);

  // a paused account comes back only through a code sign-in
  const k3 = (await api().post('/auth/device-keys').set(u.h).send({}).expect(201)).body;
  await query("UPDATE users SET deactivated_at=SYSDATETIMEOFFSET(), deactivate_reason=N'paused' WHERE id=$1", [u.user.id]);
  const paused = await api().post('/auth/device-keys/unlock').send({ id: k3.id, secret: k3.secret }).expect(409);
  assert.equal(paused.body.error.code, 'use_code');
});

test('a half-made email sign-up does not block adding that email to a finished account', async () => {
  const u = await makeUser();
  const s = await api().post('/auth/otp/request').send({ email: 'half@example.com' }).expect(200);
  const half = (await api().post('/auth/otp/verify').send({ email: 'half@example.com', code: s.body.devCode }).expect(200)).body.user;
  await query("UPDATE otp_codes SET created_at = DATEADD(MINUTE, -1, created_at) WHERE target='half@example.com'");
  const r = await api().post('/account/email/request').set(u.h).send({ email: 'half@example.com' }).expect(200);
  const ok = await api().post('/account/email/verify').set(u.h).send({ email: 'half@example.com', code: r.body.devCode }).expect(200);
  assert.equal(ok.body.user.email, 'half@example.com');
  assert.equal((await query('SELECT COUNT(*) AS n FROM users WHERE id=$1', [half.id])).rows[0].n, 0);
});
