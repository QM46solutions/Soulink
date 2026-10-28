// Anonymous messages: only between Connections; the sender picks how long they stay hidden, then it's revealed.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool, query, makeDna } from './helpers.js';
import { processAnonReveals } from '../src/services/anon.js';

before(resetDb);
after(() => closePool());

const quiz = (u, k = 0) => makeDna(u, k);
async function connect(a, b) {
  const q = (await api().post('/connections/requests').set(a.h).send({ toUserId: b.user.id, intent: 'friendship' }).expect(201)).body.request;
  await api().post(`/connections/requests/${q.id}/accept`).set(b.h).send({ connectBack: true }).expect(200);
}
async function pair(connected = true) {
  const a = await makeUser(); const b = await makeUser(); await quiz(a); await quiz(b, 1);
  if (connected) await connect(a, b);
  return [a, b];
}
const notes = async (u) => (await api().get('/notifications').set(u.h).expect(200)).body.notifications;
const leaks = (obj, u) => JSON.stringify(obj).toUpperCase().includes(String(u.user.id).toUpperCase()) || JSON.stringify(obj).includes(u.user.username);

describe('Anonymous messages', () => {
  test('only to Connections: never to someone you are not connected with', async () => {
    const [a, b] = await pair(false);
    assert.equal((await api().get(`/anon/can/${b.user.id}`).set(a.h).expect(200)).body.allowed, false);
    assert.equal((await api().post('/anon').set(a.h).send({ toUserId: b.user.id, body: 'hey' }).expect(403)).body.error.code, 'not_connected');
    await connect(a, b);
    const can = (await api().get(`/anon/can/${b.user.id}`).set(a.h).expect(200)).body;
    assert.equal(can.allowed, true);
    assert.ok(can.revealHours.includes(168));
  });

  test('recipient never sees who sent it before the reveal; sender chooses how long', async () => {
    const [a, b] = await pair();
    await api().post('/anon').set(a.h).send({ toUserId: b.user.id, body: 'x', revealHours: 5 }).expect(400); // not one of the choices
    const r = await api().post('/anon').set(a.h).send({ toUserId: b.user.id, body: 'I like your vibe', revealHours: 72 }).expect(201);
    const hours = (new Date(r.body.revealAt).getTime() - Date.now()) / 3600000;
    assert.ok(hours > 71 && hours <= 72, String(hours));
    const list = (await api().get('/anon').set(b.h).expect(200)).body;
    assert.equal(list.threads.length, 1);
    assert.equal(list.threads[0].role, 'recipient');
    assert.equal(list.threads[0].other, null);
    assert.equal(list.threads[0].revealHours, 72);
    assert.equal(list.unread, 1);
    const one = (await api().get(`/anon/${r.body.threadId}`).set(b.h).expect(200)).body;
    assert.equal(one.messages[0].body, 'I like your vibe');
    assert.equal(one.thread.revealed, false); // being connected doesn't reveal it any more: only the time does
    assert.equal(leaks(list, a) || leaks(one, a), false);
    const n = await notes(b);
    assert.equal(n[0].type, 'anon_message');
    assert.equal(n[0].actor, null);
    const mine = (await api().get('/anon').set(a.h).expect(200)).body.threads[0];
    assert.equal(mine.role, 'sender');
    assert.equal(mine.other.id, b.user.id);
  });

  test('only 3 messages until they reply; reply works both ways', async () => {
    const [a, b] = await pair();
    const t = (await api().post('/anon').set(a.h).send({ toUserId: b.user.id, body: '1' }).expect(201)).body.threadId;
    await api().post(`/anon/${t}/messages`).set(a.h).send({ body: '2' }).expect(201);
    await api().post(`/anon/${t}/messages`).set(a.h).send({ body: '3' }).expect(201);
    await api().post(`/anon/${t}/messages`).set(a.h).send({ body: '4' }).expect(403);
    await api().post(`/anon/${t}/messages`).set(b.h).send({ body: 'who is this?' }).expect(201);
    await api().post(`/anon/${t}/messages`).set(a.h).send({ body: '4' }).expect(201);
  });

  test('revealed when the chosen time is up, both are told; a new anonymous message can start after', async () => {
    const [a, b] = await pair();
    const t = (await api().post('/anon').set(a.h).send({ toUserId: b.user.id, body: 'guess who', revealHours: 1 }).expect(201)).body.threadId;
    await query('UPDATE anon_threads SET reveal_at=DATEADD(MINUTE, -1, SYSDATETIMEOFFSET()) WHERE id=$1', [t]);
    const done = await processAnonReveals();
    assert.ok(done.revealed >= 1);
    const v = (await api().get(`/anon/${t}`).set(b.h).expect(200)).body.thread;
    assert.equal(v.revealed, true);
    assert.equal(v.revealReason, 'time');
    assert.equal(v.other.id, a.user.id);
    assert.ok((await notes(b)).some((n) => n.type === 'anon_revealed' && n.actor?.id === a.user.id));
    assert.ok((await notes(a)).some((n) => n.type === 'anon_revealed_sender'));
    const t2 = (await api().post('/anon').set(a.h).send({ toUserId: b.user.id, body: 'again, secretly' }).expect(201)).body.threadId;
    assert.notEqual(t2, t);
  });

  test('after a disconnect: hidden from the list and no more anonymous messages', async () => {
    const [a, b] = await pair();
    const t = (await api().post('/anon').set(a.h).send({ toUserId: b.user.id, body: 'hi' }).expect(201)).body.threadId;
    await api().delete(`/connections/with/${b.user.id}`).set(a.h).expect(200);
    assert.equal((await api().get('/anon').set(b.h).expect(200)).body.threads.length, 0);
    await api().post(`/anon/${t}/messages`).set(a.h).send({ body: 'still there?' }).expect(403);
  });

  test('recipient can close it; sender then cannot write', async () => {
    const [a, b] = await pair();
    const t = (await api().post('/anon').set(a.h).send({ toUserId: b.user.id, body: 'hi' }).expect(201)).body.threadId;
    await api().post(`/anon/${t}/close`).set(b.h).expect(200);
    await api().post(`/anon/${t}/messages`).set(a.h).send({ body: 'again' }).expect(403);
    assert.equal((await api().get('/anon').set(b.h).expect(200)).body.threads.length, 0);
  });
});
