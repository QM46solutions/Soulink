// Anonymous messages: sender hidden for 7 days or until a Soul Connection, then revealed.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool, query } from './helpers.js';
import { processAnonReveals } from '../src/services/anon.js';

before(resetDb);
after(() => closePool());

const quiz = (u, k = 0) => api().post('/soul/quiz').set(u.h).send({ answers: Array.from({ length: 10 }, (_, i) => ({ questionId: i + 1, optionIndex: (i + k) % 4 })) }).expect(200);
async function pair() { const a = await makeUser(); const b = await makeUser(); await quiz(a); await quiz(b, 1); return [a, b]; }
const notes = async (u) => (await api().get('/notifications').set(u.h).expect(200)).body.notifications;
const leaks = (obj, u) => JSON.stringify(obj).toUpperCase().includes(String(u.user.id).toUpperCase()) || JSON.stringify(obj).includes(u.user.username);

describe('Anonymous messages', () => {
  test('recipient never sees who sent it before the reveal', async () => {
    const [a, b] = await pair();
    const r = await api().post('/anon').set(a.h).send({ toUserId: b.user.id, body: 'I like your vibe' }).expect(201);
    const list = (await api().get('/anon').set(b.h).expect(200)).body;
    assert.equal(list.threads.length, 1);
    assert.equal(list.threads[0].role, 'recipient');
    assert.equal(list.threads[0].other, null);
    assert.equal(list.unread, 1);
    const one = (await api().get(`/anon/${r.body.threadId}`).set(b.h).expect(200)).body;
    assert.equal(one.messages[0].body, 'I like your vibe');
    assert.equal(leaks(list, a) || leaks(one, a), false);
    const n = await notes(b);
    assert.equal(n[0].type, 'anon_message');
    assert.equal(n[0].actor, null);
    // Sender knows who they wrote to
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

  test('revealed after 7 days, both are told', async () => {
    const [a, b] = await pair();
    const t = (await api().post('/anon').set(a.h).send({ toUserId: b.user.id, body: 'guess who' }).expect(201)).body.threadId;
    await query('UPDATE anon_threads SET reveal_at=DATEADD(MINUTE, -1, SYSDATETIMEOFFSET()) WHERE id=$1', [t]);
    const done = await processAnonReveals();
    assert.ok(done.revealed >= 1);
    const v = (await api().get(`/anon/${t}`).set(b.h).expect(200)).body.thread;
    assert.equal(v.revealed, true);
    assert.equal(v.revealReason, 'time');
    assert.equal(v.other.id, a.user.id);
    assert.ok((await notes(b)).some((n) => n.type === 'anon_revealed' && n.actor?.id === a.user.id));
    assert.ok((await notes(a)).some((n) => n.type === 'anon_revealed_sender'));
  });

  test('revealed straight away when they become a Soul Connection; no anon to connections', async () => {
    const [a, b] = await pair();
    const t = (await api().post('/anon').set(a.h).send({ toUserId: b.user.id, body: 'hey' }).expect(201)).body.threadId;
    const q = (await api().post('/connections/requests').set(b.h).send({ toUserId: a.user.id, intent: 'friendship' }).expect(201)).body.request;
    await api().post(`/connections/requests/${q.id}/accept`).set(a.h).send({}).expect(200);
    const v = (await api().get(`/anon/${t}`).set(b.h).expect(200)).body.thread;
    assert.equal(v.revealed, true);
    assert.equal(v.revealReason, 'connected');
    assert.equal(v.connected, true);
    assert.ok(v.conversationId);
    await api().post('/anon').set(b.h).send({ toUserId: a.user.id, body: 'x' }).expect(409);
  });

  test('recipient can close it; sender then cannot write', async () => {
    const [a, b] = await pair();
    const t = (await api().post('/anon').set(a.h).send({ toUserId: b.user.id, body: 'hi' }).expect(201)).body.threadId;
    await api().post(`/anon/${t}/close`).set(b.h).expect(200);
    await api().post(`/anon/${t}/messages`).set(a.h).send({ body: 'again' }).expect(403);
    assert.equal((await api().get('/anon').set(b.h).expect(200)).body.threads.length, 0);
  });
});
