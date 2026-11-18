// Sign-in update: email codes, phone sign-in kept off until SMS is live, no code shown to the public, verified
// emails only after a real delivery, adding an email, and sessions that last until logout.
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

test('a login lasts until logout: no expiry, old tokens with a date still work, logout ends it', async () => {
  const jwt = (await import('jsonwebtoken')).default;
  const u = await makeUser();
  const raw = u.token;
  assert.equal(jwt.decode(raw).exp, undefined); // no expiry of its own
  // a token issued before this change (30-day expiry, now in the past) still works while its session is open
  const { sid, sub } = jwt.decode(raw);
  const old = jwt.sign({ sub, sid, iat: Math.floor(Date.now() / 1000) - 90 * 86400, exp: Math.floor(Date.now() / 1000) - 60 * 86400 }, config.jwtSecret);
  const r = await api().get('/users/me').set({ Authorization: `Bearer ${old}` }).expect(200);
  assert.ok(r.headers['x-soulink-token']); // swapped for a token without expiry
  assert.equal(jwt.decode(r.headers['x-soulink-token']).exp, undefined);
  // a token without a session still expires (none are issued any more)
  const noSession = jwt.sign({ sub, iat: Math.floor(Date.now() / 1000) - 30 * 86400, exp: Math.floor(Date.now() / 1000) - 86400 }, config.jwtSecret);
  await api().get('/users/me').set({ Authorization: `Bearer ${noSession}` }).expect(401);
  // log out ends it for good
  await api().post('/auth/logout').set(u.h).expect(200);
  await api().get('/users/me').set(u.h).expect(401);
  await api().get('/users/me').set({ Authorization: `Bearer ${old}` }).expect(401);
});

test('fingerprint / face sign-in is gone', async () => {
  const u = await makeUser();
  await api().post('/auth/device-keys').set(u.h).send({}).expect(404);
  const un = await api().post('/auth/device-keys/unlock').send({ id: '00000000-0000-0000-0000-000000000000', secret: 'x'.repeat(43) });
  assert.ok([401, 404].includes(un.status)); // no such sign-in any more
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

test('a new account cannot finish its profile without an email', async () => {
  config.signupEmailRequired = true;
  const r = await api().post('/auth/otp/request').send({ phone: '9876500001' }).expect(200);
  const t = (await api().post('/auth/otp/verify').send({ phone: '9876500001', code: r.body.devCode }).expect(200)).body.token;
  const h = { Authorization: `Bearer ${t}` };
  const body = { username: 'needs.email', displayName: 'Needs Email', birthDate: '1995-05-10' };
  const no = await api().post('/users/me/complete-onboarding').set(h).send(body).expect(400);
  assert.equal(no.body.error.code, 'email_required');
  const e = await api().post('/account/email/request').set(h).send({ email: 'needs@example.com' }).expect(200);
  await api().post('/account/email/verify').set(h).send({ email: 'needs@example.com', code: e.body.devCode }).expect(200);
  await api().post('/users/me/complete-onboarding').set(h).send(body).expect(200);
});

test('email providers: fallback when the first fails, Gmail message headers cannot be injected', async () => {
  const { sendEmail, mime } = await import('../src/providers/email.js');
  Object.assign(config, { emailProvider: 'resend', emailFallbackProvider: 'console' });
  process.env.RESEND_API_KEY = 'test';
  globalThis.fetch = async () => ({ ok: false, status: 500 });
  assert.equal(await sendEmail({ to: 'a@example.com', subject: 's', text: 't' }), 'console');
  const m = mime({ from: 'Soulink <no-reply@qm46.in>', to: 'a@example.com\r\nBcc: evil@example.com', subject: 'Hi\nX: y', text: 'code 123456' });
  assert.equal(m.split('\r\n\r\n')[0].split('\r\n').length, 6);
  assert.ok(!/^Bcc:/m.test(m));
  delete process.env.RESEND_API_KEY;
});

test('the app can ask which codes are on', async () => {
  config.phoneLogin = false;
  assert.deepEqual((await api().get('/auth/options').expect(200)).body, { phone: false, email: true });
});
