// Soul Events: register with a government ID, pay (test mode), get a QR ticket, staff check it in once.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { api, resetDb, makeUser, closePool, query } from './helpers.js';

before(resetDb);
after(() => closePool());
const png = () => { const p = new PNG({ width: 64, height: 64 }); p.data.fill(180); return PNG.sync.write(p); };
const inDays = (d) => new Date(Date.now() + d * 86400_000);
async function makeEvent(over = {}) {
  const e = { title: 'Soul Pub', kind: 'pub', venue: 'Prost', city: 'Hyderabad', price: 999, capacity: 2, status: 'published', ...over };
  const r = (await query(`INSERT INTO soul_events (title, kind, venue, city, starts_at, price, capacity, status) OUTPUT INSERTED.id VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [e.title, e.kind, e.venue, e.city, inDays(3), e.price, e.capacity, e.status])).rows?.[0] || (await query('SELECT TOP 1 id FROM soul_events ORDER BY created_at DESC')).rows[0];
  return r.id;
}
const register = (u, id, idProof = true) => {
  const q = api().post(`/events/${id}/register`).set(u.h).field('fullName', 'Test Person').field('address', '12 Kondapur Main Road, Hyderabad 500084').field('idType', 'aadhaar');
  return idProof ? q.attach('idProof', png(), { filename: 'id.png', contentType: 'image/png' }) : q;
};

describe('Soul Events', () => {
  test('only published events show; registering needs an ID; test payment gives a QR ticket that works once', async () => {
    const a = await makeUser(); const staff = await makeUser();
    process.env.ADMIN_USERNAMES = staff.user.username;
    const id = await makeEvent();
    await makeEvent({ title: 'Hidden draft', status: 'draft' });
    const list = (await api().get('/events').set(a.h).expect(200)).body;
    assert.deepEqual(list.events.map((e) => e.title), ['Soul Pub']);
    assert.equal(list.payMode, 'test');

    const pre = (await api().get(`/events/${id}`).set(a.h).expect(200)).body;
    assert.ok(pre.prefill.phone, 'phone comes from the account');
    await register(a, id, false).expect(400); // no ID proof
    const reg = (await register(a, id).expect(200)).body.registration;
    assert.equal(reg.status, 'pending'); assert.equal(reg.ticketCode, null); assert.equal(reg.hasIdProof, true);

    const pay = (await api().post(`/events/registrations/${reg.id}/pay`).set(a.h).send({}).expect(200)).body;
    assert.equal(pay.mode, 'test');
    const paid = (await api().post(`/events/registrations/${reg.id}/test-pay`).set(a.h).expect(200)).body.registration;
    assert.equal(paid.status, 'paid'); assert.match(paid.ticketCode, /^SL[A-Z2-9]{10}$/); assert.ok(paid.qr.length >= 21);
    await register(a, id).expect(400); // already registered

    const b = await makeUser();
    await api().get(`/events/registrations/${reg.id}`).set(b.h).expect(404); // not someone else's ticket
    await api().post('/events/check-in').set(b.h).send({ code: paid.ticketCode }).expect(403); // not staff

    const ok = (await api().post('/events/check-in').set(staff.h).send({ code: `SOULINK-TICKET:${paid.ticketCode}`, eventId: id }).expect(200)).body;
    assert.equal(ok.result, 'ok'); assert.equal(ok.name, 'Test Person');
    const again = (await api().post('/events/check-in').set(staff.h).send({ code: paid.ticketCode }).expect(200)).body;
    assert.equal(again.result, 'already');
    assert.equal((await api().post('/events/check-in').set(staff.h).send({ code: 'SLNOPE234567' }).expect(200)).body.result, 'invalid');
    const att = (await api().get(`/events/${id}/attendees`).set(staff.h).expect(200)).body.attendees;
    assert.equal(att.length, 1); assert.ok(att[0].checkedInAt);
  });

  test('free events give the ticket straight away; full events are sold out', async () => {
    const id = await makeEvent({ title: 'Free run', kind: 'run', price: 0, capacity: 1 });
    const a = await makeUser(); const b = await makeUser();
    const r = (await register(a, id).expect(200)).body.registration;
    assert.equal(r.status, 'paid'); assert.ok(r.ticketCode);
    const res = await register(b, id).expect(400);
    assert.equal(res.body.error.code, 'sold_out');
  });

  test('the payment page needs a valid link', async () => {
    await api().get('/events/pay/00000000-0000-0000-0000-000000000000?k=bad').expect(403);
  });
});
