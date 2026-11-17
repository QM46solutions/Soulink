// Team console (admin.qm46.in): first-owner setup with an authenticator code, sign-in, roles, dashboards,
// and an hourly ad booking that goes live only after payment, only in its booked hours and cities.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { api, resetDb, closePool, query, makeUser } from './helpers.js';
import { flushMetrics, markUserActive } from '../src/services/metrics.js';

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

test('first owner needs the setup key and a working authenticator code; then sign-in needs all three', async () => {
  process.env.CONSOLE_SETUP_KEY = 'setup-key-for-tests';
  assert.equal((await api().get('/console/auth/state').expect(200)).body.needsSetup, true);
  const { secret } = (await api().post('/console/auth/new-secret').send({ email: 'sai@qm46.in' }).expect(200)).body;
  await api().post('/console/auth/setup').send({ setupKey: 'wrong-key-for-tests!', email: 'sai@qm46.in', name: 'Sai', password: PW, secret, code: code(secret) }).expect(403);
  await api().post('/console/auth/setup').send({ setupKey: 'setup-key-for-tests', email: 'sai@qm46.in', name: 'Sai', password: PW, secret, code: '000000' }).expect(400);
  const s = (await api().post('/console/auth/setup').send({ setupKey: 'setup-key-for-tests', email: 'sai@qm46.in', name: 'Sai', password: PW, secret, code: code(secret) }).expect(200)).body;
  assert.equal(s.me.role, 'owner');
  await api().post('/console/auth/setup').send({ setupKey: 'setup-key-for-tests', email: 'x@qm46.in', name: 'X', password: PW, secret, code: code(secret) }).expect(409);
  await api().post('/console/auth/login').send({ email: 'sai@qm46.in', password: PW, code: '123456' }).expect(401);
  const t = (await api().post('/console/auth/login').send({ email: 'sai@qm46.in', password: PW, code: code(secret) }).expect(200)).body.token;
  // an app token never works on the console
  const appUser = await makeUser();
  await api().get('/console/overview').set(appUser.h).expect(401);
  const ov = (await api().get('/console/overview').set({ Authorization: `Bearer ${t}` }).expect(200)).body;
  assert.ok(Number(ov.totals.total) >= 1);
  assert.equal(ov.growth.length, 30);
  assert.ok(ov.release?.version, 'release history is seeded');
  // an ads manager can't open owner pages
  const inv = (await api().post('/console/team').set({ Authorization: `Bearer ${t}` }).send({ email: 'priya@qm46.in', name: 'Priya', role: 'ads' }).expect(200)).body;
  const { secret: s2 } = (await api().post('/console/auth/new-secret').send({ email: 'priya@qm46.in' }).expect(200)).body;
  const pt = (await api().post('/console/auth/accept').send({ email: 'priya@qm46.in', inviteCode: inv.inviteCode, password: PW, secret: s2, code: code(s2) }).expect(200)).body.token;
  await api().get('/console/performance').set({ Authorization: `Bearer ${pt}` }).expect(403);
  await api().get('/console/team').set({ Authorization: `Bearer ${pt}` }).expect(403);
  await api().get('/console/ads/customers').set({ Authorization: `Bearer ${pt}` }).expect(200);
  globalThis.__owner = t; globalThis.__ads = pt;
});

test('people per hour and server health are recorded', async () => {
  const u = await makeUser();
  markUserActive(u.user.id);
  await api().get('/users/me').set(u.h).expect(200);
  await flushMetrics();
  const a = (await api().get('/console/activity').set({ Authorization: `Bearer ${globalThis.__owner}` }).expect(200)).body;
  assert.ok(a.today.some((x) => x.users >= 1));
  const p = (await api().get('/console/performance').set({ Authorization: `Bearer ${globalThis.__owner}` }).expect(200)).body;
  assert.ok(p.recent.length >= 1);
});

test('an hourly booking is priced from the rate card, waits for payment, then shows only in its hours and cities', async () => {
  const H = { Authorization: `Bearer ${globalThis.__ads}` };
  const c = (await api().post('/console/ads/customers').set(H).send({ name: 'Chai Point Gachibowli', kind: 'Café', phone: '9800000000' }).expect(200)).body;
  const hourNow = new Date(Date.now() + 330 * 60_000).getUTCHours();
  const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
  const q = (await api().post('/console/ads/quote').set(H).send({ placement: 'feed', cities: ['Hyderabad'], hours: [hourNow], days: 2 }).expect(200)).body;
  assert.equal(q.hoursTotal, 2);
  const bk = (await api().post('/console/ads/bookings').set(H).field('customerId', c.id).field('name', 'Evening chai').field('placement', 'feed')
    .field('cities', 'Hyderabad').field('hours', String(hourNow)).field('startDate', today).field('days', '2').field('brand', 'Chai Point').field('headline', 'Chai at ₹10').expect(200)).body;
  assert.equal(bk.total, q.total);
  const viewer = await makeUser();
  await query("UPDATE users SET city = N'Hyderabad' WHERE id = $1", [viewer.user.id]);
  const other = await makeUser();
  await query("UPDATE users SET city = N'Chennai' WHERE id = $1", [other.user.id]);
  const show = async (u) => (await api().get('/ads?placement=feed').set(u.h).expect(200)).body.ads.length;
  assert.equal(await show(viewer), 0, 'not live before payment');
  const pay = (await api().post('/console/ads/payments').set(H).send({ bookingId: bk.id, amount: bk.total, method: 'UPI', paidOn: today }).expect(200)).body;
  assert.equal(pay.live, true);
  assert.equal(await show(viewer), 1, 'live in Hyderabad in the booked hour');
  assert.equal(await show(other), 0, 'not in a city that was not booked');
  // people save their area ("Kondapur, Hyderabad"): a Hyderabad booking reaches them too, with its frequency (default: every 5 posts)
  const area = await makeUser();
  await query("UPDATE users SET city = N'Kondapur, Hyderabad' WHERE id = $1", [area.user.id]);
  const seen = (await api().get('/ads?placement=feed').set(area.h).expect(200)).body.ads;
  assert.equal(seen.length, 1, 'an area inside a booked city'); assert.equal(seen[0].every, 5);
  await api().put(`/console/ads/bookings/${bk.id}/frequency`).set(H).send({ every: 10 }).expect(200);
  assert.equal((await api().get('/ads?placement=feed').set(area.h).expect(200)).body.ads[0].every, 10);
  await api().put(`/console/ads/bookings/${bk.id}/frequency`).set(H).send({ every: 1 }).expect(400);
  await api().post(`/console/ads/bookings/${bk.id}/pause`).set(H).expect(200);
  assert.equal(await show(area), 0, 'paused');
  await api().post(`/console/ads/bookings/${bk.id}/resume`).set(H).expect(200);
  await query('UPDATE ad_campaigns SET hours_csv = $1', [`,${(hourNow + 3) % 24},`]);
  assert.equal(await show(viewer), 0, 'not outside the booked hours');
  const detail = (await api().get(`/console/ads/customers/${c.id}`).set(H).expect(200)).body;
  assert.equal(Number(detail.customer.due), 0);
  assert.equal(detail.bookings[0].status, 'booked');
});
