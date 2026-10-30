import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool } from './helpers.js';

before(resetDb);
after(() => closePool());

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');

async function dm(from, to) {
  const r = await api().post('/conversations/direct').set(from.h).send({ userId: to.user.id }).expect(200);
  return r.body.conversation;
}
const send = (who, convId, body) => api().post(`/conversations/${convId}/messages`).set(who.h).send({ body });
const inbox = async (who, box = 'inbox') => (await api().get(`/conversations?box=${box}`).set(who.h).expect(200)).body;

describe('Chat: 1:1 and message requests', () => {
  test('message from a stranger lands in Requests; accepting moves it to the inbox', async () => {
    const a = await makeUser(); const b = await makeUser();
    const conv = await dm(a, b);
    assert.equal(conv.isGroup, false);
    assert.equal(conv.other.id, b.user.id);
    assert.equal(conv.title, b.user.displayName);

    // Empty thread: A sees it (they created it), B sees nothing yet
    assert.equal((await inbox(b, 'requests')).conversations.length, 0);

    const m = await send(a, conv.id, 'Hi Nikhil!').expect(201);
    assert.equal(m.body.message.body, 'Hi Nikhil!');
    assert.equal(m.body.message.senderId, a.user.id);

    const req = await inbox(b, 'requests');
    assert.equal(req.conversations.length, 1);
    assert.equal(req.conversations[0].isRequest, true);
    assert.equal(req.conversations[0].unreadCount, 1);
    assert.equal(req.conversations[0].lastMessage.text, 'Hi Nikhil!');
    assert.equal((await inbox(b)).requestCount, 1);
    assert.equal((await inbox(b)).conversations.length, 0);

    const aBox = await inbox(a);
    assert.equal(aBox.conversations[0].lastMessage.text, 'You: Hi Nikhil!');
    assert.equal(aBox.conversations[0].unreadCount, 0);

    await api().post(`/conversations/${conv.id}/accept`).set(b.h).expect(200);
    const bBox = await inbox(b);
    assert.equal(bBox.conversations.length, 1);
    assert.equal(bBox.requestCount, 0);
  });

  test('if they follow you, your message goes straight to their inbox', async () => {
    const a = await makeUser(); const b = await makeUser();
    await api().post(`/users/${a.user.id}/follow`).set(b.h).expect(200);
    const conv = await dm(a, b);
    await send(a, conv.id, 'hello').expect(201);
    assert.equal((await inbox(b)).conversations.length, 1);
    assert.equal((await inbox(b, 'requests')).conversations.length, 0);
  });

  test('replying to a request accepts it; the same pair always shares one thread', async () => {
    const a = await makeUser(); const b = await makeUser();
    const c1 = await dm(a, b);
    const c2 = await dm(b, a);
    assert.equal(c1.id, c2.id);
    await send(a, c1.id, 'one').expect(201);
    await send(b, c1.id, 'two').expect(201);
    assert.equal((await inbox(b)).conversations.length, 1);
  });

  test('messages page newest first; read receipts and unread counts', async () => {
    const a = await makeUser(); const b = await makeUser();
    await api().post(`/users/${a.user.id}/follow`).set(b.h);
    const conv = await dm(a, b);
    for (let i = 1; i <= 5; i++) await send(a, conv.id, `msg ${i}`).expect(201);
    const page1 = await api().get(`/conversations/${conv.id}/messages?limit=3`).set(b.h).expect(200);
    assert.deepEqual(page1.body.messages.map((m) => m.body), ['msg 5', 'msg 4', 'msg 3']);
    assert.equal(page1.body.hasMore, true);
    const oldest = page1.body.messages[2].createdAt;
    const page2 = await api().get(`/conversations/${conv.id}/messages?limit=3&before=${encodeURIComponent(oldest)}`).set(b.h).expect(200);
    assert.deepEqual(page2.body.messages.map((m) => m.body), ['msg 2', 'msg 1']);

    assert.equal((await inbox(b)).conversations[0].unreadCount, 5);
    const badge = await api().get('/conversations/unread').set(b.h).expect(200);
    assert.equal(badge.body.chats, 1);
    await api().post(`/conversations/${conv.id}/read`).set(b.h).expect(200);
    assert.equal((await inbox(b)).conversations[0].unreadCount, 0);
    const detail = await api().get(`/conversations/${conv.id}`).set(a.h).expect(200);
    const bMember = detail.body.conversation.members.find((m) => m.id === b.user.id);
    assert.ok(bMember.lastReadAt, 'B has a read time, so A sees "Seen"');
  });

  test('unsend your own message only', async () => {
    const a = await makeUser(); const b = await makeUser();
    const conv = await dm(a, b);
    const m = (await send(a, conv.id, 'oops').expect(201)).body.message;
    await api().delete(`/conversations/${conv.id}/messages/${m.id}`).set(b.h).expect(404);
    const del = await api().delete(`/conversations/${conv.id}/messages/${m.id}`).set(a.h).expect(200);
    assert.equal(del.body.message.deleted, true);
    assert.equal(del.body.message.body, null);
    assert.equal((await inbox(a)).conversations[0].lastMessage.text, 'You: Message unsent');
  });

  test('photos and voice notes', async () => {
    const a = await makeUser(); const b = await makeUser();
    const conv = await dm(a, b);
    const img = await api().post(`/conversations/${conv.id}/media`).set(a.h).attach('file', PNG, { filename: 'p.png', contentType: 'image/png' }).expect(201);
    assert.equal(img.body.message.kind, 'image');
    assert.match(img.body.message.mediaUrl, /^\/uploads\/chat\/[^?]+\.png\?t=.+$/); // a private, signed link
    const voice = await api().post(`/conversations/${conv.id}/media`).set(a.h)
      .field('durationMs', '4200').attach('file', Buffer.from('fake-audio'), { filename: 'v.m4a', contentType: 'audio/m4a' }).expect(201);
    assert.equal(voice.body.message.kind, 'voice');
    assert.equal(voice.body.message.durationMs, 4200);
    assert.equal((await inbox(a)).conversations[0].lastMessage.text, 'You: 🎤 Voice message');
    await api().post(`/conversations/${conv.id}/media`).set(a.h).attach('file', Buffer.from('x'), { filename: 'x.exe', contentType: 'application/octet-stream' }).expect(400);
  });

  test('strangers cannot read a conversation; empty messages rejected', async () => {
    const a = await makeUser(); const b = await makeUser(); const c = await makeUser();
    const conv = await dm(a, b);
    await api().get(`/conversations/${conv.id}/messages`).set(c.h).expect(404);
    await send(c, conv.id, 'hi').expect(404);
    await send(a, conv.id, '   ').expect(400);
    await api().post('/conversations/direct').set(a.h).send({ userId: a.user.id }).expect(400);
  });

  test('blocking stops messages both ways and hides the thread', async () => {
    const a = await makeUser(); const b = await makeUser();
    const conv = await dm(a, b);
    await send(a, conv.id, 'hey').expect(201);
    await api().post(`/blocks/${a.user.id}`).set(b.h).expect(200);
    await send(a, conv.id, 'hello?').expect(403);
    await api().post('/conversations/direct').set(a.h).send({ userId: b.user.id }).expect(404);
    assert.equal((await inbox(a)).conversations.length, 0);
  });

  test('deleting a request hides it until they message again', async () => {
    const a = await makeUser(); const b = await makeUser();
    const conv = await dm(a, b);
    await send(a, conv.id, 'first').expect(201);
    await api().delete(`/conversations/${conv.id}`).set(b.h).expect(200);
    assert.equal((await inbox(b, 'requests')).conversations.length, 0);
    await send(a, conv.id, 'second').expect(201);
    const req = await inbox(b, 'requests');
    assert.equal(req.conversations.length, 1);
    assert.equal(req.conversations[0].lastMessage.text, 'second');
  });
});

describe('Chat: groups', () => {
  test('create, rename, add, remove, leave; a group always keeps an admin', async () => {
    const a = await makeUser({ displayName: 'Sai' }); const b = await makeUser(); const c = await makeUser(); const d = await makeUser();
    await api().post('/conversations/group').set(a.h).send({ userIds: [b.user.id] }).expect(400);
    const g = (await api().post('/conversations/group').set(a.h).send({ title: 'Soulink founders', userIds: [b.user.id, c.user.id] }).expect(201)).body.conversation;
    assert.equal(g.isGroup, true);
    assert.equal(g.title, 'Soulink founders');
    assert.equal(g.members.length, 3);
    assert.equal(g.myRole, 'admin');
    const msgs = (await api().get(`/conversations/${g.id}/messages`).set(b.h).expect(200)).body.messages;
    assert.equal(msgs[0].kind, 'system');
    assert.equal(msgs[0].body, 'Sai created the group');

    await send(b, g.id, 'hi all').expect(201);
    await api().post(`/conversations/${g.id}/members`).set(b.h).send({ userIds: [d.user.id] }).expect(403);
    const added = await api().post(`/conversations/${g.id}/members`).set(a.h).send({ userIds: [d.user.id] }).expect(200);
    assert.equal(added.body.conversation.members.length, 4);

    await api().patch(`/conversations/${g.id}`).set(b.h).send({ title: 'Team' }).expect(200);
    await api().delete(`/conversations/${g.id}/members/${d.user.id}`).set(b.h).expect(403);
    await api().delete(`/conversations/${g.id}/members/${d.user.id}`).set(a.h).expect(200);
    await api().delete(`/conversations/${g.id}/members/me`).set(a.h).expect(200);
    const after = (await api().get(`/conversations/${g.id}`).set(b.h).expect(200)).body.conversation;
    assert.equal(after.members.length, 2);
    assert.equal(after.members.filter((m) => m.role === 'admin').length, 1);
    await api().get(`/conversations/${g.id}`).set(a.h).expect(404);
    await api().delete(`/conversations/${g.id}`).set(b.h).expect(400);
  });
});
