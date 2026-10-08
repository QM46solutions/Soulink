// Private chat: tap 3 times → messages disappear once seen and someone leaves the chat.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool, makeDna } from './helpers.js';

before(resetDb);
after(() => closePool());

describe('Private chat', () => {
  test('messages sent in private chat vanish after they are seen and a member leaves', async () => {
    const a = await makeUser(); const b = await makeUser(); await makeDna(a, 0); await makeDna(b, 1);
    const q = (await api().post('/connections/requests').set(a.h).send({ toUserId: b.user.id, intent: 'friendship' }).expect(201)).body.request;
    const conv = (await api().post(`/connections/requests/${q.id}/accept`).set(b.h).send({ connectBack: true }).expect(200)).body.conversationId;
    const send = (u, body) => api().post(`/conversations/${conv}/messages`).set(u.h).send({ body }).expect(201);
    const list = async (u) => (await api().get(`/conversations/${conv}/messages`).set(u.h).expect(200)).body.messages;
    await send(a, 'normal message');
    assert.equal((await api().post(`/conversations/${conv}/private`).set(a.h).send({ on: true }).expect(200)).body.privateMode, true);
    assert.equal((await api().get(`/conversations/${conv}`).set(b.h).expect(200)).body.conversation.privateMode, true);
    const secret = (await send(a, 'secret')).body.message;
    assert.equal(secret.vanish, true);
    // a leaves before b has seen it: nothing disappears
    assert.equal((await api().post(`/conversations/${conv}/leave`).set(a.h).expect(200)).body.vanished, 0);
    assert.ok((await list(b)).some((m) => m.body === 'secret'));
    // private view shows only private messages; the regular view never shows them
    const priv = (await api().get(`/conversations/${conv}/messages?vanish=1`).set(b.h).expect(200)).body.messages;
    assert.deepEqual(priv.map((m) => m.body), ['secret']);
    const reg = (await api().get(`/conversations/${conv}/messages?vanish=0`).set(b.h).expect(200)).body.messages;
    assert.ok(!reg.some((m) => m.body === 'secret')); assert.ok(reg.some((m) => m.body === 'normal message'));
    // b sees it and leaves: it's gone for both; the normal message stays
    await api().post(`/conversations/${conv}/read`).set(b.h).expect(200);
    assert.equal((await api().post(`/conversations/${conv}/leave`).set(b.h).expect(200)).body.vanished, 1);
    for (const u of [a, b]) {
      const ms = await list(u);
      assert.ok(!ms.some((m) => m.body === 'secret'));
      assert.ok(ms.some((m) => m.body === 'normal message'));
    }
    await api().post(`/conversations/${conv}/private`).set(b.h).send({ on: false }).expect(200);
    assert.equal((await send(a, 'after')).body.message.vanish, false);
  });
});
