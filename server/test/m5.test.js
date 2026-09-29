// Argue / Referee and Instagram-style chat extras (replies, reactions, Soulmoji).
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool, query } from './helpers.js';
import { _test as referee } from '../src/services/referee.js';

before(resetDb);
after(() => closePool());

describe('Argue (same phone)', () => {
  test('names in order → each side added → verdict with a winner', async () => {
    const a = await makeUser();
    const start = await api().post('/argue').set(a.h).send({ mode: 'phone', count: 3, topic: 'Who does the dishes', names: ['Sai', 'Ananya', 'Rahul'] }).expect(201);
    const c = start.body.case;
    assert.equal(c.people.length, 3);
    assert.equal(c.status, 'open');
    await api().post(`/argue/${c.id}/statement`).set(a.h).send({ seat: 1, text: 'Too short' }).expect(400);
    await api().post(`/argue/${c.id}/statement`).set(a.h).send({ seat: 1, text: 'I did the dishes on Monday and Tuesday because we agreed to take turns. I understand Ananya was busy.' }).expect(200);
    const mid = await api().post(`/argue/${c.id}/statement`).set(a.h).send({ seat: 2, text: 'You ALWAYS say that!! Whatever, this is stupid.' }).expect(200);
    assert.equal(mid.body.case.status, 'open');
    assert.equal(mid.body.case.people[1].statement, null, 'other sides stay hidden until the verdict');
    const done = await api().post(`/argue/${c.id}/statement`).set(a.h).send({ seat: 3, text: 'I was travelling this week so I could not help, sorry. Next week I will do it twice.' }).expect(200);
    const v = done.body.case;
    assert.equal(v.status, 'decided');
    assert.equal(v.judge, 'basic');
    assert.ok(v.verdict.winnerSeats.length >= 1);
    assert.ok(!v.verdict.winnerSeats.includes(2), 'the harsh side should not win');
    assert.equal(v.verdict.people.length, 3);
    assert.ok(v.people.every((p) => p.statement), 'all sides visible after the verdict');
    await api().post(`/argue/${c.id}/statement`).set(a.h).send({ seat: 1, text: 'Trying to change my side later' }).expect(409);
  });

  test('wrong number of names is rejected', async () => {
    const a = await makeUser();
    await api().post('/argue').set(a.h).send({ mode: 'phone', count: 3, names: ['A', 'B'] }).expect(400);
  });
});

describe('Argue (invite)', () => {
  test('everyone answers on their own phone; sides hidden until the verdict; invitees notified', async () => {
    const a = await makeUser(); const b = await makeUser();
    const c = (await api().post('/argue').set(a.h).send({ mode: 'invite', count: 2, topic: 'Weekend plan', inviteUserIds: [b.user.id] }).expect(201)).body.case;
    const inv = (await api().get('/notifications').set(b.h)).body.notifications[0];
    assert.equal(inv.type, 'argue_invite');
    await api().post(`/argue/${c.id}/statement`).set(a.h).send({ text: 'I planned the trek two weeks ago and everyone agreed to it.' }).expect(200);
    const bView = (await api().get(`/argue/${c.id}`).set(b.h).expect(200)).body.case;
    assert.equal(bView.mySeat, 2);
    assert.equal(bView.people[0].submitted, true);
    assert.equal(bView.people[0].statement, null);
    const stranger = await makeUser();
    await api().get(`/argue/${c.id}`).set(stranger.h).expect(404);
    const fin = (await api().post(`/argue/${c.id}/statement`).set(b.h).send({ text: 'Fair point, but it may rain on Saturday so maybe Sunday is better for both of us.' }).expect(200)).body.case;
    assert.equal(fin.status, 'decided');
    assert.equal((await api().get('/notifications').set(a.h)).body.notifications[0].type, 'argue_verdict');
    assert.equal((await api().get('/argue').set(b.h)).body.cases.length, 1);
  });
});

describe('Referee helpers', () => {
  test('Claude output is cleaned up and seats are checked', () => {
    const people = [{ seat: 1, name: 'A', statement: 'x' }, { seat: 2, name: 'B', statement: 'y' }];
    const v = referee.tidy({ winnerSeats: [2, 9], headline: 'B wins', people: [{ seat: 2, fairness: 140 }] }, people);
    assert.deepEqual(v.winnerSeats, [2]);
    assert.equal(v.people[1].fairness, 100);
    assert.equal(v.people[0].fairness, 50);
  });
});

describe('Chat extras', () => {
  async function chat() {
    const a = await makeUser(); const b = await makeUser();
    const conv = (await api().post('/conversations/direct').set(a.h).send({ userId: b.user.id }).expect(200)).body.conversation;
    return { a, b, conv };
  }
  test('reply to a message shows the quoted message', async () => {
    const { a, b, conv } = await chat();
    const m1 = (await api().post(`/conversations/${conv.id}/messages`).set(a.h).send({ body: 'Chai at 5?' }).expect(201)).body.message;
    const m2 = (await api().post(`/conversations/${conv.id}/messages`).set(b.h).send({ body: 'Yes!', replyToId: m1.id }).expect(201)).body.message;
    assert.equal(m2.replyTo.text, 'Chai at 5?');
    const list = (await api().get(`/conversations/${conv.id}/messages`).set(a.h)).body.messages;
    assert.equal(list.find((m) => m.id === m2.id).replyTo.id, m1.id);
  });
  test('reactions: add, change, remove', async () => {
    const { a, b, conv } = await chat();
    const m = (await api().post(`/conversations/${conv.id}/messages`).set(a.h).send({ body: 'Big news!' }).expect(201)).body.message;
    let r = (await api().post(`/conversations/${conv.id}/messages/${m.id}/react`).set(b.h).send({ emoji: '❤️' }).expect(200)).body;
    assert.deepEqual(r.reactions, [{ emoji: '❤️', count: 1, mine: true }]);
    r = (await api().post(`/conversations/${conv.id}/messages/${m.id}/react`).set(b.h).send({ emoji: '😂' }).expect(200)).body;
    assert.equal(r.reactions[0].emoji, '😂');
    r = (await api().post(`/conversations/${conv.id}/messages/${m.id}/react`).set(b.h).send({ emoji: '😂' }).expect(200)).body;
    assert.deepEqual(r.reactions, []);
  });
  test('Soulmoji needs a face photo, then sends a sticker', async () => {
    const { a, conv } = await chat();
    const no = await api().post(`/conversations/${conv.id}/messages`).set(a.h).send({ soulmoji: { mood: 'laugh', caption: 'LOL' } }).expect(400);
    assert.equal(no.body.error.code, 'no_face_photo');
    await query("UPDATE users SET avatar_url='/uploads/avatars/test.jpg' WHERE id=$1", [a.user.id]);
    const m = (await api().post(`/conversations/${conv.id}/messages`).set(a.h).send({ soulmoji: { mood: 'laugh', caption: 'LOL' } }).expect(201)).body.message;
    assert.equal(m.kind, 'soulmoji');
    assert.equal(m.soulmoji.mood, 'laugh');
    assert.equal(m.soulmoji.faceUrl, '/uploads/avatars/test.jpg');
    await api().post(`/conversations/${conv.id}/messages`).set(a.h).send({ soulmoji: { mood: 'banana' } }).expect(400);
  });
});
