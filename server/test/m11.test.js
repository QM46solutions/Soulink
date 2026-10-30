// Chat "+" menu: location, contact, document and poll messages.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool, makeDna } from './helpers.js';

before(resetDb);
after(() => closePool());

async function connected() {
  const a = await makeUser(); const b = await makeUser(); await makeDna(a, 0); await makeDna(b, 1);
  const q = (await api().post('/connections/requests').set(a.h).send({ toUserId: b.user.id, intent: 'friendship' }).expect(201)).body.request;
  const conv = (await api().post(`/connections/requests/${q.id}/accept`).set(b.h).send({ connectBack: true }).expect(200)).body.conversationId;
  return { a, b, conv };
}

describe('Chat attachments', () => {
  test('location, contact and poll messages; voting and changing a vote', async () => {
    const { a, b, conv } = await connected();
    const c = await makeUser();
    const send = (u, body) => api().post(`/conversations/${conv}/messages`).set(u.h).send(body);
    const loc = (await send(a, { location: { lat: 17.4239, lon: 78.4738, label: 'Tank Bund' } }).expect(201)).body.message;
    assert.equal(loc.kind, 'location'); assert.equal(loc.location.label, 'Tank Bund');
    const card = (await send(a, { contact: { userId: c.user.id } }).expect(201)).body.message;
    assert.equal(card.contact.username, c.user.username);
    await send(a, { poll: { question: 'Dinner?', options: ['Biryani'] } }).expect(400);
    const poll = (await send(a, { poll: { question: 'Dinner?', options: ['Biryani', 'Dosa', 'Pizza'] } }).expect(201)).body.message;
    assert.deepEqual(poll.poll.counts, [0, 0, 0]);
    const vote = (u, option) => api().post(`/conversations/${conv}/messages/${poll.id}/vote`).set(u.h).send({ option });
    assert.deepEqual((await vote(b, 0).expect(200)).body.counts, [1, 0, 0]);
    assert.deepEqual((await vote(a, 1).expect(200)).body.counts, [1, 1, 0]);
    assert.deepEqual((await vote(b, 2).expect(200)).body.counts, [0, 1, 1]); // changed answer
    assert.equal((await vote(b, 2).expect(200)).body.myVote, null);          // same option again = no vote
    await vote(b, 5).expect(400);
    await vote(c, 0).expect(404); // not in this chat
    const list = (await api().get(`/conversations/${conv}/messages`).set(b.h).expect(200)).body.messages;
    const p = list.find((m) => m.id === poll.id);
    assert.equal(p.poll.total, 1); assert.equal(p.poll.myVote, null);
  });

  test('documents: PDFs go through, HTML is refused', async () => {
    const { a, conv } = await connected();
    const doc = (await api().post(`/conversations/${conv}/document`).set(a.h).field('name', 'Plan.pdf').attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'Plan.pdf', contentType: 'application/pdf' }).expect(201)).body.message;
    assert.equal(doc.kind, 'document'); assert.equal(doc.document.name, 'Plan.pdf'); assert.ok(doc.mediaUrl.split('?')[0].endsWith('.pdf'));
    await api().post(`/conversations/${conv}/document`).set(a.h).attach('file', Buffer.from('<script>'), { filename: 'x.html', contentType: 'text/html' }).expect(400);
  });
});
