// Update App policy, richer crash / problem reports, slow-request timings, and "only the newest code works".
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { api, resetDb, closePool, query, makeUser } from './helpers.js';
import { compareVersions } from '../src/services/appUpdate.js';

before(resetDb);
after(() => closePool());

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function code(secret) {
  let bits = ''; for (const c of secret) bits += B32.indexOf(c).toString(2).padStart(5, '0');
  const key = []; for (let i = 0; i + 8 <= bits.length; i += 8) key.push(parseInt(bits.slice(i, i + 8), 2));
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const h = crypto.createHmac('sha1', Buffer.from(key)).update(msg).digest(); const o = h[h.length - 1] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000)).padStart(6, '0');
}
const PW = 'correct horse battery';
const T = (t) => ({ Authorization: `Bearer ${t}` });
let owner; let support;

test('console team for these tests', async () => {
  process.env.CONSOLE_SETUP_KEY = 'setup-key-for-tests';
  const { secret } = (await api().post('/console/auth/new-secret').send({ email: 'sai@qm46.in' }).expect(200)).body;
  owner = (await api().post('/console/auth/setup').send({ setupKey: 'setup-key-for-tests', email: 'sai@qm46.in', name: 'Sai', password: PW, secret, code: code(secret) }).expect(200)).body.token;
  const inv = (await api().post('/console/team').set(T(owner)).send({ email: 'help@qm46.in', name: 'Helper', role: 'support' }).expect(200)).body;
  const { secret: s2 } = (await api().post('/console/auth/new-secret').send({ email: 'help@qm46.in' }).expect(200)).body;
  support = (await api().post('/console/auth/accept').send({ email: 'help@qm46.in', inviteCode: inv.inviteCode, password: PW, secret: s2, code: code(s2) }).expect(200)).body.token;
});

test('version compare', () => {
  assert.equal(compareVersions('1.0.10', '1.0.9'), 1);
  assert.equal(compareVersions('1.0', '1.0.0'), 0);
  assert.equal(compareVersions('1.0.0', '1.0.1'), -1);
  assert.equal(compareVersions('2.0.0', '1.9.9'), 1);
});

test('GET /app/version works without a login and gives the official store links', async () => {
  const v = (await api().get('/app/version').expect(200)).body;
  assert.equal(v.android.latest, '1.0.0'); assert.equal(v.android.minimum, '1.0.0');
  assert.match(v.android.storeUrl, /^https:\/\/play\.google\.com\/store\/apps\/details\?id=app\.soulink\.mobile$/);
  assert.equal(v.ios.storeUrl, null, 'no App Store link until APP_STORE_ID is set');
  process.env.APP_STORE_ID = '1234567890';
  assert.equal((await api().get('/app/version').expect(200)).body.ios.storeUrl, 'https://apps.apple.com/app/id1234567890');
  delete process.env.APP_STORE_ID;
});

test('only the owner can change the update policy, and it is checked', async () => {
  const body = { android: { latest: '1.0.1', minimum: '1.0.0' }, ios: { latest: '1.0.0', minimum: '1.0.0' }, message: 'Faster chat', mandatory: false };
  await api().put('/console/app-update').set(T(support)).send(body).expect(403);
  await api().put('/console/app-update').set(T(owner)).send({ ...body, android: { latest: '1.0.0', minimum: '1.0.2' } }).expect(400); // minimum newer than latest
  await api().put('/console/app-update').set(T(owner)).send({ ...body, android: { latest: 'one', minimum: '1.0.0' } }).expect(400);
  await api().put('/console/app-update').set(T(owner)).send(body).expect(200);
  const v = (await api().get('/app/version').expect(200)).body;
  assert.equal(v.android.latest, '1.0.1'); assert.equal(v.message, 'Faster chat');
  assert.equal((await api().get('/console/app-update').set(T(support)).expect(200)).body.policy.android.latest, '1.0.1');
});

test('crashes and non-fatal errors keep version, build, phone and screen; same crash on the same version is counted', async () => {
  const u = await makeUser();
  const crash = { message: 'TypeError: x is undefined\nat Feed', platform: 'android', appVersion: '1.0.0', build: 'ota-1a2b3c4d', osVersion: '14', device: 'Pixel 7', screen: '(tabs)/index' };
  await api().post('/telemetry/crash').set(u.h).send(crash).expect(200);
  await api().post('/telemetry/crash').set(u.h).send(crash).expect(200);
  await api().post('/telemetry/crash').set(u.h).send({ ...crash, fatal: false, message: 'Error: image failed' }).expect(200);
  const rows = (await query(`SELECT * FROM app_issues WHERE source = N'crash' ORDER BY id`)).rows;
  const fatal = rows.find((x) => x.title.startsWith('Crash: TypeError'));
  assert.equal(fatal.reports, 2); assert.equal(fatal.device, 'Pixel 7'); assert.equal(fatal.build, 'ota-1a2b3c4d'); assert.equal(fatal.screen, '(tabs)/index'); assert.equal(fatal.fatal, true);
  const nonFatal = rows.find((x) => x.title.startsWith('Error: image failed'));
  assert.equal(nonFatal.fatal, false); assert.equal(nonFatal.severity, 'medium');
  // an older app that sends only message / platform / version still works
  await api().post('/telemetry/crash').set(u.h).send({ message: 'Old app crash', platform: 'ios', appVersion: '1.0.0' }).expect(200);
  const h = (await api().get('/console/app-health').set(T(support)).expect(200)).body;
  assert.ok(h.crashes.some((x) => x.version === '1.0.0' && Number(x.crashes) >= 2));
});

test('slow requests are kept as patterns only (no ids or names)', async () => {
  const u = await makeUser();
  await api().post('/telemetry/api').set(u.h).send({ items: [
    { path: '/posts/6f1c2a7e-0000-4000-8000-000000000001?x=1', method: 'get', status: 200, ms: 3400, platform: 'android', appVersion: '1.0.0' },
    { path: '/users/meera.r/followers', method: 'GET', status: 0, ms: 15000, platform: 'android', appVersion: '1.0.0' },
  ] }).expect(200);
  const rows = (await query('SELECT path, method, status FROM api_timings ORDER BY id')).rows;
  assert.deepEqual(rows.map((x) => x.path), ['/posts/:id', '/users/:name/followers']);
  assert.equal(rows[0].method, 'GET');
  const h = (await api().get('/console/app-health').set(T(owner)).expect(200)).body;
  assert.ok(h.api.some((x) => x.path === '/users/:name/followers' && Number(x.failed) === 1));
});

test('Report a problem: category, comments, diagnostics, screenshot, duplicate and validation', async () => {
  const u = await makeUser();
  await api().post('/telemetry/problem').set(u.h).send({ details: 'x' }).expect(400);
  await api().post('/telemetry/problem').set(u.h).send({ details: 'The chat does not scroll', category: 'Not a category' }).expect(400);
  const a = (await api().post('/telemetry/problem').set(u.h).send({ details: 'The chat does not scroll after a photo', category: 'Screen not loading', comments: 'Since yesterday', platform: 'android', appVersion: '1.0.0', device: 'Pixel 7', osVersion: '14' }).expect(200)).body;
  assert.match(a.ref, /^SL-\d+$/);
  const again = (await api().post('/telemetry/problem').set(u.h).send({ details: 'The chat does not scroll after a photo', category: 'Screen not loading' }).expect(200)).body;
  assert.equal(again.ref, a.ref); assert.equal(again.duplicate, true);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const b = (await api().post('/telemetry/problem').set(u.h).field('details', 'Profile photo will not change').field('category', 'Profile-related issue').field('platform', 'ios')
    .attach('screenshot', png, { filename: 'shot.png', contentType: 'image/png' }).expect(200)).body;
  const row = (await query('SELECT * FROM app_issues WHERE id=$1', [Number(b.ref.slice(3))])).rows[0];
  assert.equal(row.category, 'Profile-related issue'); assert.match(row.screenshot_url, /^\/uploads\/reports\//);
  // the screenshot is private: only the console can open it
  await api().get(`/console/issues/${row.id}/screenshot`).expect(401);
  const img = await api().get(`/console/issues/${row.id}/screenshot`).set(T(support)).expect(200);
  assert.ok(img.body.length > 10);
  const first = (await query('SELECT * FROM app_issues WHERE id=$1', [Number(a.ref.slice(3))])).rows[0];
  assert.equal(first.comments, 'Since yesterday'); assert.equal(first.device, 'Pixel 7');
  await api().post('/telemetry/problem').send({ details: 'no login here' }).expect(401);
});

test('only the newest email code works: an earlier unused code is cancelled when a new one is sent', async () => {
  const target = 'newest-code@example.com';
  process.env.TEST_LOGIN_TARGETS = target;
  const { config } = await import('../src/config.js');
  const before = config.testLoginTargets; config.testLoginTargets = [target];
  const first = (await api().post('/auth/otp/request').send({ email: target }).expect(200)).body.devCode;
  await query("UPDATE otp_codes SET created_at = DATEADD(SECOND, -40, created_at) WHERE target=$1", [target]); // past the 30 s wait
  const second = (await api().post('/auth/otp/request').send({ email: target }).expect(200)).body.devCode;
  assert.ok(first && second);
  if (first !== second) await api().post('/auth/otp/verify').send({ email: target, code: first }).expect(400);
  await api().post('/auth/otp/verify').send({ email: target, code: second }).expect(200);
  // after the newest code is used, the older one does not come back to life
  if (first !== second) await api().post('/auth/otp/verify').send({ email: target, code: first }).expect(400);
  config.testLoginTargets = before;
});
