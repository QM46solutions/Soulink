// Connect requests: intent + Soul Score + note, Accept / Hold / Reject, notifications, cooldowns, chat.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool, query, makeDna } from './helpers.js';
import { config } from '../src/config.js';
import { processHolds } from '../src/services/connections.js';

before(resetDb);
after(() => closePool());

const quiz = (u, k = 0) => makeDna(u, k);
async function pair() { const a = await makeUser(); const b = await makeUser(); await quiz(a); await quiz(b, 1); return [a, b]; }
const send = (from, to, body = {}) => api().post('/connections/requests').set(from.h).send({ toUserId: to.user.id, intent: 'friendship', ...body });
const notes = async (u) => (await api().get('/notifications').set(u.h).expect(200)).body.notifications;

describe('Connect requests', () => {
  test('request carries intent, note and Soul Score; receiver sees it', async () => {
    const [a, b] = await pair();
    const r = await send(a, b, { intent: 'dating', note: 'We met at the Hitex meetup!', knows: true }).expect(201);
    assert.equal(r.body.request.intent, 'dating');
    assert.equal(r.body.request.note, 'We met at the Hitex meetup!');
    assert.ok(r.body.request.soulScore >= 30);
    const inbox = (await api().get('/connections/requests?box=incoming').set(b.h).expect(200)).body.requests;
    assert.equal(inbox.length, 1);
    assert.equal(inbox[0].user.id, a.user.id);
    assert.equal(inbox[0].intentLabel, 'Dating');
    assert.equal(inbox[0].knows, true);
    const n = await notes(b);
    assert.equal(n[0].type, 'connect_request');
    assert.equal(n[0].meta.intent, 'dating');
    // no duplicates, and the other side can't cross-send
    assert.equal((await send(a, b).expect(409)).body.error.code, 'already_requested');
    assert.equal((await send(b, a).expect(409)).body.error.code, 'incoming_pending');
  });

  test('accept (as something else) creates the connection and a chat with the note; sender is told', async () => {
    const [a, b] = await pair();
    const q = (await send(a, b, { intent: 'dating', note: 'Hi from the gym!' }).expect(201)).body.request;
    const acc = await api().post(`/connections/requests/${q.id}/accept`).set(b.h).send({ asIntent: 'friendship', connectBack: true }).expect(200);
    assert.equal(acc.body.intent, 'friendship');
    const status = (await api().get(`/connections/status/${b.user.id}`).set(a.h).expect(200)).body;
    assert.equal(status.connected.intent, 'friendship');
    const msgs = (await api().get(`/conversations/${acc.body.conversationId}/messages`).set(a.h).expect(200)).body.messages;
    const texts = msgs.map((m) => m.body);
    assert.ok(texts.some((t) => /connected for Friendship/.test(t)), texts.join(' | '));
    assert.ok(texts.includes('Hi from the gym!'));
    const n = await notes(a);
    assert.equal(n[0].type, 'connect_accepted');
    assert.equal(n[0].meta.acceptedIntent, 'friendship');
    assert.equal((await send(a, b).expect(409)).body.error.code, 'already_connected');
  });

  test('reject: sender is told, and must wait 30 days', async () => {
    const [a, b] = await pair();
    const q = (await send(a, b).expect(201)).body.request;
    await api().post(`/connections/requests/${q.id}/reject`).set(b.h).expect(200);
    assert.equal((await notes(a))[0].type, 'connect_rejected');
    assert.equal((await send(a, b).expect(403)).body.error.code, 'cooldown');
    const s = (await api().get(`/connections/status/${b.user.id}`).set(a.h)).body;
    assert.equal(s.lastOutcome, 'rejected');
    assert.ok(s.cooldownUntil);
  });

  test('hold: sender told the length; extend once; reminder before the end; auto-suspend after', async () => {
    const [a, b] = await pair();
    const q = (await send(a, b).expect(201)).body.request;
    await api().post(`/connections/requests/${q.id}/hold`).set(b.h).send({ days: 2 }).expect(400);
    await api().post(`/connections/requests/${q.id}/hold`).set(b.h).send({ days: 3 }).expect(200);
    const held = (await notes(a))[0];
    assert.equal(held.type, 'connect_held');
    assert.equal(held.meta.days, 3);
    await api().post(`/connections/requests/${q.id}/hold`).set(b.h).send({ days: 1 }).expect(200);
    assert.equal((await notes(a))[0].type, 'connect_hold_extended');
    assert.equal((await api().post(`/connections/requests/${q.id}/hold`).set(b.h).send({ days: 1 }).expect(409)).body.error.code, 'hold_extended');
    // 10 hours left → reminder to the receiver
    await query("UPDATE connection_requests SET hold_until = DATEADD(HOUR, 10, SYSDATETIMEOFFSET()), hold_days = 3 WHERE id=$1", [q.id]);
    let done = await processHolds();
    assert.ok(done.reminded >= 1);
    assert.equal((await notes(b))[0].type, 'connect_hold_reminder');
    // time's up → suspended, sender told, 7-day wait
    await query("UPDATE connection_requests SET hold_until = DATEADD(MINUTE, -1, SYSDATETIMEOFFSET()) WHERE id=$1", [q.id]);
    done = await processHolds();
    assert.ok(done.suspended >= 1);
    assert.equal((await notes(a))[0].type, 'connect_suspended');
    assert.equal((await send(a, b).expect(403)).body.error.code, 'cooldown');
  });

  test('receiver can still accept during a hold; sender can withdraw', async () => {
    const [a, b] = await pair();
    const q = (await send(a, b).expect(201)).body.request;
    await api().post(`/connections/requests/${q.id}/hold`).set(b.h).send({ days: 7 }).expect(200);
    await api().post(`/connections/requests/${q.id}/accept`).set(b.h).send({}).expect(200);
    const [c, d] = await pair();
    const q2 = (await send(c, d).expect(201)).body.request;
    await api().post(`/connections/requests/${q2.id}/withdraw`).set(c.h).expect(200);
    assert.equal((await api().get('/connections/requests?box=incoming').set(d.h)).body.requests.length, 0);
    await api().post(`/connections/requests/${q2.id}/accept`).set(d.h).send({}).expect(409);
  });

  test('Connect model: accept = they connect to you (Follower); connect back = Connections', async () => {
    const [a, b] = await pair();
    const me = async (u) => (await api().get('/users/me').set(u.h).expect(200)).body.counts;
    const q = (await send(a, b).expect(201)).body.request;
    assert.equal((await me(b)).requests, 1);
    const acc = (await api().post(`/connections/requests/${q.id}/accept`).set(b.h).send({}).expect(200)).body;
    assert.equal(acc.mutual, false);
    assert.equal(acc.canConnectBack, true);
    let cb = await me(b);
    assert.equal(cb.requests, 0);
    assert.equal(cb.followers, 1);
    assert.equal(cb.connections, 0);
    assert.equal((await send(b, a).expect(409)).body.error.code, 'can_connect_back');
    const back = (await api().post(`/connections/back/${a.user.id}`).set(b.h).expect(200)).body;
    assert.ok(back.conversationId);
    cb = await me(b);
    assert.equal(cb.followers, 1); // still connected to b, so still counted as a Follower
    assert.equal(cb.connections, 1);
    assert.equal((await me(a)).connections, 1);
    assert.ok((await notes(a)).some((n) => n.type === 'connect_back'));
    // disconnect: b leaves; a stays connected to b, so a is still b's Follower
    await api().delete(`/connections/with/${a.user.id}`).set(b.h).expect(200);
    cb = await me(b);
    assert.equal(cb.connections, 0);
    assert.equal(cb.followers, 1);
  });

  test('any intent can be sent (Open to was removed from settings)', async () => {
    const [a, b] = await pair();
    await send(a, b, { intent: 'dating' }).expect(201);
  });

  test('chat is only possible after connecting', async () => {
    const was = config.connectRequired;
    config.connectRequired = true;
    try {
      const [a, b] = await pair();
      assert.equal((await api().post('/conversations/direct').set(a.h).send({ userId: b.user.id }).expect(403)).body.error.code, 'not_connected');
      const q = (await send(a, b).expect(201)).body.request;
      await api().post(`/connections/requests/${q.id}/accept`).set(b.h).send({ connectBack: true }).expect(200);
      await api().post('/conversations/direct').set(a.h).send({ userId: b.user.id }).expect(200);
    } finally { config.connectRequired = was; }
  });
});

describe('Requests count on profiles', () => {
  test("others see how many requests someone has, never who sent them", async () => {
    const [a, b] = await pair();
    const c = await makeUser(); await quiz(c, 2);
    await send(b, a).expect(201);
    const seen = (await api().get(`/users/u/${a.user.username}`).set(c.h).expect(200)).body;
    assert.equal(seen.counts.requests, 1);
    assert.equal(JSON.stringify(seen).includes(b.user.id), false, "the sender's id never appears");
    assert.equal((await api().get(`/users/u/${a.user.username}`).set(a.h).expect(200)).body.counts.requests, 1);
  });
});
