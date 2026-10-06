// Posts: 👌🏻 likes, share (chat + outside), offense marks; more than 75 offenses suspends a post for everyone but its owner.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool, query } from './helpers.js';
import { OFFENSE_LIMIT } from '../src/routes/posts.js';

before(resetDb);
after(() => closePool());

const quiz = (u, k = 0) => api().post('/soul/quiz').set(u.h).send({ answers: Array.from({ length: 10 }, (_, i) => ({ questionId: i + 1, optionIndex: (i + k) % 4 })) }).expect(200);
const textPost = async (u, caption = 'hello Hyderabad') => (await api().post('/posts').set(u.h).field('caption', caption).expect(201)).body.post;

describe('Post offense, suspension and share', () => {
  test('offense toggles; you cannot mark your own post; the count is shown to everyone', async () => {
    const a = await makeUser(); const b = await makeUser();
    const p = await textPost(a);
    await api().post(`/posts/${p.id}/offense`).set(a.h).expect(400);
    assert.equal((await api().post(`/posts/${p.id}/offense`).set(b.h).expect(200)).body.offended, true);
    assert.equal((await api().get(`/posts/${p.id}`).set(a.h).expect(200)).body.post.offenseCount, 1);
    const seen = (await api().get(`/posts/${p.id}`).set(b.h).expect(200)).body.post;
    assert.equal(seen.offended, true);
    assert.equal(seen.offenseCount, 1);
    assert.equal((await api().post(`/posts/${p.id}/offense`).set(b.h).expect(200)).body.offended, false);
  });

  test('a mark keeps its reason (Instagram-style report); unknown reasons are refused', async () => {
    const a = await makeUser(); const b = await makeUser();
    const p = await textPost(a);
    await api().post(`/posts/${p.id}/offense`).set(b.h).send({ reason: 'not-a-reason' }).expect(400);
    await api().post(`/posts/${p.id}/offense`).set(b.h).send({ reason: 'bullying' }).expect(200);
    assert.equal((await api().get(`/posts/${p.id}`).set(b.h).expect(200)).body.post.offenseReason, 'bullying');
    assert.equal((await api().get(`/posts/${p.id}`).set(a.h).expect(200)).body.post.offenseReason, null);
  });

  test(`more than ${OFFENSE_LIMIT} offenses: hidden from everyone except the owner`, async () => {
    const a = await makeUser(); const b = await makeUser();
    const p = await textPost(a);
    for (let i = 0; i < OFFENSE_LIMIT; i += 1) {
      const u = (await query(`INSERT INTO users (username) OUTPUT INSERTED.id VALUES ($1)`, [`off${Date.now() % 100000}${i}`])).rows[0];
      await query('INSERT INTO post_offenses (post_id, user_id) VALUES ($1, $2)', [p.id, u.id]);
    }
    const last = (await api().post(`/posts/${p.id}/offense`).set(b.h).expect(200)).body; // the 76th
    assert.equal(last.suspended, true);
    await api().get(`/posts/${p.id}`).set(b.h).expect(404);
    assert.equal((await api().get(`/posts/user/${a.user.id}`).set(b.h).expect(200)).body.posts.length, 0);
    const own = (await api().get(`/posts/${p.id}`).set(a.h).expect(200)).body.post;
    assert.equal(own.suspended, true);
    assert.equal((await api().get(`/posts/user/${a.user.id}`).set(a.h).expect(200)).body.posts.length, 1);
    const n = (await api().get('/notifications').set(a.h).expect(200)).body.notifications;
    assert.ok(n.some((x) => x.type === 'post_suspended' && x.actor === null));
  });

  test('share into a chat sends a post message; outside share is counted', async () => {
    const a = await makeUser(); const b = await makeUser(); await quiz(a); await quiz(b, 1);
    const q = (await api().post('/connections/requests').set(a.h).send({ toUserId: b.user.id, intent: 'friendship' }).expect(201)).body.request;
    const conv = (await api().post(`/connections/requests/${q.id}/accept`).set(b.h).send({ connectBack: true }).expect(200)).body.conversationId;
    const p = await textPost(a, 'share me');
    const r = (await api().post(`/posts/${p.id}/share`).set(b.h).send({ conversationIds: [conv] }).expect(200)).body;
    assert.equal(r.sent, 1);
    const msgs = (await api().get(`/conversations/${conv}/messages`).set(a.h).expect(200)).body.messages;
    const m = msgs.find((x) => x.kind === 'post');
    assert.equal(m.post.postId, p.id);
    assert.equal(m.post.caption, 'share me');
    assert.equal((await api().post(`/posts/${p.id}/share`).set(b.h).send({}).expect(200)).body.shareCount, 2);
  });
});
