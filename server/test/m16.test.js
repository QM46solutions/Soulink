// Comments: 👌🏻, replies and offense marks. Premium paid message to someone you're not connected with.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool } from './helpers.js';

before(resetDb);
after(() => closePool());

describe('Comments', () => {
  test('like, reply (one level) and offense marks', async () => {
    const a = await makeUser(); const b = await makeUser(); const c = await makeUser();
    const p = (await api().post('/posts').set(a.h).field('caption', 'Chai or coffee?').expect(201)).body.post;
    const top = (await api().post(`/posts/${p.id}/comments`).set(b.h).send({ body: 'Chai, always' }).expect(201)).body.comment;
    const reply = (await api().post(`/posts/${p.id}/comments`).set(c.h).send({ body: '@x agreed', parentId: top.id }).expect(201)).body.comment;
    const deeper = (await api().post(`/posts/${p.id}/comments`).set(a.h).send({ body: 'same', parentId: reply.id }).expect(201)).body.comment;
    assert.equal(reply.parentId, top.id);
    assert.equal(deeper.parentId, top.id); // replies stay one level deep
    const l = (await api().post(`/posts/${p.id}/comments/${top.id}/like`).set(c.h).expect(200)).body;
    assert.deepEqual(l, { liked: true, likeCount: 1 });
    await api().post(`/posts/${p.id}/comments/${top.id}/offense`).set(b.h).send({ reason: 'spam' }).expect(400); // not your own
    const o = (await api().post(`/posts/${p.id}/comments/${top.id}/offense`).set(c.h).send({ reason: 'spam' }).expect(200)).body;
    assert.equal(o.offended, true); assert.equal(o.offenseCount, 1);
    const list = (await api().get(`/posts/${p.id}/comments`).set(c.h).expect(200)).body.comments;
    const t = list.find((x) => x.id === top.id);
    assert.equal(t.liked, true); assert.equal(t.likeCount, 1); assert.equal(t.offended, true); assert.equal(t.offenseReason, 'spam');
    assert.equal(list.filter((x) => x.parentId === top.id).length, 2);
  });
});

describe('Paid message', () => {
  test('one message to a non-connection lands in their Requests (test payment); once a day per person', async () => {
    const a = await makeUser(); const b = await makeUser();
    const info = (await api().get('/conversations/paid-message').set(a.h).expect(200)).body;
    assert.equal(info.priceInr, 500);
    const r = (await api().post('/conversations/paid-message').set(a.h).send({ userId: b.user.id, body: 'Loved your Spark! Would love to connect.' }).expect(201)).body;
    assert.equal(r.test, true);
    const reqs = (await api().get('/conversations?box=requests').set(b.h).expect(200)).body.conversations;
    assert.ok(reqs.some((x) => x.id === r.conversation.id));
    await api().post('/conversations/paid-message').set(a.h).send({ userId: b.user.id, body: 'again' }).expect(429);
  });
});
