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
const strict = (fn) => async () => { const was = config.connectRequired; config.connectRequired = true; try { await fn(); } finally { config.connectRequired = was; } };
const notes = async (u) => (await api().get('/notifications').set(u.h).expect(200)).body.notifications;

describe('Connect requests', () => {
  test('asks first: someone I know (family / friend / colleague / other) or someone new (what I hope for)', async () => {
    const [a, b] = await pair();
    const known = await send(a, b, { intent: undefined, knows: true, knownAs: 'colleague' }).expect(201);
    assert.equal(known.body.request.intent, 'colleague');
    assert.equal(known.body.request.knownAs, 'colleague');
    const [c, d] = await pair();
    await send(c, d, { intent: undefined, knows: false }).expect(400);           // new person: say what you hope for
    await send(c, d, { intent: 'family', knows: false }).expect(400);            // "family" is only for people you know
    await send(c, d, { intent: undefined, knows: true, knownAs: 'cousin' }).expect(400);
    const fresh = await send(c, d, { intent: 'life_partner', knows: false }).expect(201);
    assert.equal(fresh.body.request.knownAs, null);
    const pq = await api().get(`/soul/pair/${d.user.id}?intent=life_partner`).set(c.h).expect(200);
    assert.ok(Array.isArray(pq.body.questions) && pq.body.questions.length <= 3);
  });

  test('request carries intent and Soul Score (a note is ignored: nothing reaches them before they accept)', async () => {
    const [a, b] = await pair();
    const r = await send(a, b, { intent: 'dating', note: 'We met at the Hitex meetup!', knows: true }).expect(201);
    assert.equal(r.body.request.intent, 'dating');
    assert.equal(r.body.request.note, null);
    assert.ok(Number.isInteger(r.body.request.soulScore) && r.body.request.soulScore >= 1 && r.body.request.soulScore <= 99);
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

  test('accept (as something else) creates the connection and a chat; sender is told', async () => {
    const [a, b] = await pair();
    const q = (await send(a, b, { intent: 'dating', note: 'Hi from the gym!' }).expect(201)).body.request;
    const acc = await api().post(`/connections/requests/${q.id}/accept`).set(b.h).send({ asIntent: 'friendship', connectBack: true }).expect(200);
    assert.equal(acc.body.intent, 'friendship');
    const status = (await api().get(`/connections/status/${b.user.id}`).set(a.h).expect(200)).body;
    assert.equal(status.connected.intent, 'friendship');
    const msgs = (await api().get(`/conversations/${acc.body.conversationId}/messages`).set(a.h).expect(200)).body.messages;
    const texts = msgs.map((m) => m.body);
    assert.ok(texts.some((t) => /connected for Friendship/.test(t)), texts.join(' | '));
    assert.ok(!texts.includes('Hi from the gym!'));
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

  test('hold: sender told the length; extend once; when it ends the receiver is asked; no answer = rejected', strict(async () => {
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
    // the hold is over → the receiver is asked to accept or reject (24 hours)
    await query("UPDATE connection_requests SET hold_until = DATEADD(MINUTE, -1, SYSDATETIMEOFFSET()) WHERE id=$1", [q.id]);
    let done = await processHolds();
    assert.ok(done.asked >= 1);
    assert.equal((await notes(b))[0].type, 'connect_hold_decide');
    const inbox = (await api().get('/connections/requests?box=incoming').set(b.h).expect(200)).body.requests;
    assert.ok(inbox[0].decideBy);
    // they can still chat while deciding
    const conv = (await api().get('/conversations?box=requests').set(a.h).expect(200)).body.conversations[0];
    await api().post(`/conversations/${conv.id}/messages`).set(a.h).send({ body: 'any news?' }).expect(201);
    // no answer in time → rejected automatically, sender told, chat hidden from both
    await query("UPDATE connection_requests SET hold_decide_until = DATEADD(MINUTE, -1, SYSDATETIMEOFFSET()) WHERE id=$1", [q.id]);
    done = await processHolds();
    assert.ok(done.rejected >= 1);
    const n = (await notes(a))[0];
    assert.equal(n.type, 'connect_rejected');
    assert.equal(n.meta.auto, true);
    for (const u of [a, b]) {
      for (const box of ['inbox', 'requests']) assert.equal((await api().get(`/conversations?box=${box}`).set(u.h).expect(200)).body.conversations.length, 0);
      await api().get(`/conversations/${conv.id}`).set(u.h).expect(404);
    }
    const kept = (await query('SELECT COUNT(*) AS n FROM messages WHERE conversation_id=$1', [conv.id])).rows[0].n;
    assert.ok(Number(kept) >= 1); // stored, never shown
    assert.equal((await send(a, b).expect(403)).body.error.code, 'cooldown');
  }));

  test('on hold: both can chat, in Requests; accept → Connections and the chat moves to Chats', strict(async () => {
    const [a, b] = await pair();
    const q = (await send(a, b).expect(201)).body.request;
    await api().post('/conversations/direct').set(a.h).send({ userId: b.user.id }).expect(403); // not before the hold
    await api().post(`/connections/requests/${q.id}/hold`).set(b.h).send({ days: 7 }).expect(200);
    const forA = (await api().get('/conversations?box=requests').set(a.h).expect(200)).body.conversations;
    const forB = (await api().get('/conversations?box=requests').set(b.h).expect(200)).body.conversations;
    assert.equal(forA.length, 1);
    assert.equal(forB.length, 1);
    assert.equal(forB[0].held.iHeld, true);
    assert.equal(forA[0].held.iHeld, false);
    const id = forA[0].id;
    assert.equal((await api().get(`/conversations/${id}`).set(a.h).expect(200)).body.conversation.canMessage, true);
    await api().post(`/conversations/${id}/messages`).set(a.h).send({ body: 'hi!' }).expect(201);
    await api().post(`/conversations/${id}/messages`).set(b.h).send({ body: 'hello' }).expect(201);
    // replying doesn't move it out of Requests; only accepting the Connect request does
    assert.equal((await api().get('/conversations?box=inbox').set(b.h).expect(200)).body.conversations.length, 0);
    await api().post(`/conversations/${id}/accept`).set(b.h).expect(400);
    const inc = (await api().get('/connections/requests?box=incoming').set(b.h).expect(200)).body.requests[0];
    assert.equal(inc.conversationId, id);
    const acc = (await api().post(`/connections/requests/${q.id}/accept`).set(b.h).send({}).expect(200)).body;
    assert.equal(acc.mutual, true);
    for (const u of [a, b]) {
      const chats = (await api().get('/conversations?box=inbox').set(u.h).expect(200)).body.conversations;
      assert.equal(chats.length, 1);
      assert.equal(chats[0].id, id);
      assert.equal((await api().get('/conversations?box=requests').set(u.h).expect(200)).body.conversations.length, 0);
    }
    const msgs = (await api().get(`/conversations/${id}/messages`).set(a.h).expect(200)).body.messages.map((m) => m.body);
    assert.ok(msgs.includes('hi!') && msgs.includes('hello'));
  }));

  test('on hold, then rejected: the chat is hidden for both (kept in the database)', strict(async () => {
    const [a, b] = await pair();
    const q = (await send(a, b).expect(201)).body.request;
    await api().post(`/connections/requests/${q.id}/hold`).set(b.h).send({ days: 3 }).expect(200);
    const id = (await api().get('/conversations?box=requests').set(a.h).expect(200)).body.conversations[0].id;
    await api().post(`/conversations/${id}/messages`).set(a.h).send({ body: 'please?' }).expect(201);
    await api().post(`/connections/requests/${q.id}/reject`).set(b.h).expect(200);
    for (const u of [a, b]) {
      assert.equal((await api().get('/conversations?box=requests').set(u.h).expect(200)).body.conversations.length, 0);
      await api().get(`/conversations/${id}`).set(u.h).expect(404);
    }
    await api().post(`/conversations/${id}/messages`).set(a.h).send({ body: 'hello?' }).expect(404);
  }));

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
