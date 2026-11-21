// Privacy settings (who can comment / connect, hidden words, restrict, mute, hide Moments, limits, read receipts),
// the post ⋯ menu (save, archive, pin, not interested), the OX game in chat, and the bigger translator language list.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, closePool, makeUser, makeDna } from './helpers.js';
import { detectLanguage, TRANSLATE_LANGS } from '../src/services/soulmojiAi.js';

before(resetDb);
after(() => closePool());

const aPost = async (u, caption = 'Charminar at night') => (await api().post('/posts').set(u.h).field('caption', caption).expect(201)).body.post;
const comment = (u, postId, body) => api().post(`/posts/${postId}/comments`).set(u.h).send({ body });
const visibleTo = async (u, postId) => (await api().get(`/posts/${postId}/comments`).set(u.h).expect(200)).body.comments.map((c) => c.body);
const setPrivacy = (u, body) => api().put('/privacy').set(u.h).send(body).expect(200);
const follow = async (a, b) => api().post(`/users/${b.user.id}/follow`).set(a.h);

test('who can comment: everyone, connections only, or off', async () => {
  const owner = await makeUser(); const stranger = await makeUser();
  const p = await aPost(owner);
  await comment(stranger, p.id, 'lovely!').expect(201);
  await setPrivacy(owner, { commentWho: 'connections' });
  const r = await comment(stranger, p.id, 'again').expect(403);
  assert.equal(r.body.error.code, 'comments_limited');
  await setPrivacy(owner, { commentWho: 'off' });
  await comment(stranger, p.id, 'and again').expect(403);
  await comment(owner, p.id, 'my own comment still works').expect(201);
});

test('hidden words and restrict: the comment is saved but only its writer sees it', async () => {
  const owner = await makeUser(); const a = await makeUser(); const b = await makeUser();
  const p = await aPost(owner);
  await setPrivacy(owner, { hiddenWords: ['Spoiler'] });
  await comment(a, p.id, 'big SPOILER: he dies').expect(201);
  await comment(a, p.id, 'you chutiya').expect(201); // offensive words are hidden by default
  await comment(a, p.id, 'nice photo').expect(201);
  assert.deepEqual(await visibleTo(b, p.id), ['nice photo']);
  assert.equal((await visibleTo(a, p.id)).length, 3, 'the writer still sees their own');
  await api().put(`/privacy/people/${a.user.id}`).set(owner.h).send({ restricted: true }).expect(200);
  await comment(a, p.id, 'restricted now').expect(201);
  assert.ok(!(await visibleTo(b, p.id)).includes('restricted now'));
  assert.equal((await api().get(`/posts/${p.id}`).set(b.h).expect(200)).body.post.commentCount, 1, 'hidden comments are not counted for others');
  const pr = (await api().get('/privacy').set(owner.h).expect(200)).body;
  assert.equal(pr.restricted.length, 1);
  assert.deepEqual(pr.privacy.hiddenWords, ['spoiler']);
});

test('limit interactions and connect settings block new Connect requests', async () => {
  const to = await makeUser(); const from = await makeUser(); await makeDna(to, 0); await makeDna(from, 1);
  await setPrivacy(to, { connectWho: 'off' });
  const r = await api().post('/connections/requests').set(from.h).send({ toUserId: to.user.id, intent: 'friendship' });
  assert.equal(r.status, 403); assert.equal(r.body.error.code, 'connect_closed');
  await setPrivacy(to, { connectWho: 'everyone', limitDays: 7 });
  const r2 = await api().post('/connections/requests').set(from.h).send({ toUserId: to.user.id, intent: 'friendship' });
  assert.equal(r2.status, 403); assert.equal(r2.body.error.code, 'connect_limited');
  const pr = (await setPrivacy(to, { limitDays: 0 })).body.privacy;
  assert.equal(pr.limitUntil, null);
});

test('post menu: save, pin (up to 3, pinned first), archive (hidden from everyone else), not interested', async () => {
  const me = await makeUser(); const other = await makeUser();
  const p1 = await aPost(me, 'one'); const p2 = await aPost(me, 'two'); const p3 = await aPost(me, 'three'); const p4 = await aPost(me, 'four');
  assert.equal((await api().post(`/posts/${p1.id}/save`).set(other.h).expect(200)).body.saved, true);
  assert.equal((await api().get('/posts/saved').set(other.h).expect(200)).body.posts[0].id, p1.id);
  for (const p of [p1, p2, p3]) await api().post(`/posts/${p.id}/pin`).set(me.h).expect(200);
  const lim = await api().post(`/posts/${p4.id}/pin`).set(me.h).expect(400);
  assert.equal(lim.body.error.code, 'pin_limit');
  await api().post(`/posts/${p2.id}/pin`).set(other.h).expect(404); // only your own
  let mine = (await api().get(`/posts/user/${me.user.id}`).set(other.h).expect(200)).body.posts;
  assert.deepEqual(mine.slice(0, 3).map((x) => x.pinned), [true, true, true]);
  assert.equal(mine[3].id, p4.id);
  assert.equal((await api().post(`/posts/${p4.id}/archive`).set(me.h).expect(200)).body.archived, true);
  mine = (await api().get(`/posts/user/${me.user.id}`).set(other.h).expect(200)).body.posts;
  assert.ok(!mine.some((x) => x.id === p4.id));
  await api().get(`/posts/${p4.id}`).set(other.h).expect(404);
  assert.equal((await api().get('/posts/archived').set(me.h).expect(200)).body.posts[0].id, p4.id);
  // not interested + mute hide posts from the feed
  await follow(other, me);
  await api().post(`/posts/${p3.id}/hide`).set(other.h).expect(200);
  let feed = (await api().get('/feed').set(other.h).expect(200)).body.posts.map((x) => x.id);
  assert.ok(!feed.includes(p3.id));
  await api().put(`/privacy/people/${me.user.id}`).set(other.h).send({ mutePosts: true }).expect(200);
  feed = (await api().get('/feed').set(other.h).expect(200)).body.posts.map((x) => x.id);
  assert.ok(!feed.some((id) => [p1.id, p2.id].includes(id)));
});

async function connected() {
  const a = await makeUser(); const b = await makeUser(); await makeDna(a, 0); await makeDna(b, 1);
  const q = (await api().post('/connections/requests').set(a.h).send({ toUserId: b.user.id, intent: 'friendship' }).expect(201)).body.request;
  await api().post(`/connections/requests/${q.id}/accept`).set(b.h).send({ connectBack: true }).expect(200);
  const conv = (await api().post('/conversations/direct').set(b.h).send({ userId: a.user.id }).expect(200)).body.conversation.id; // accepting doesn't open a chat
  return { a, b, conv };
}

test('OX game: two players, turns, a winner, and no moves after it ends', async () => {
  const { a, b, conv } = await connected();
  const g = (await api().post(`/conversations/${conv}/messages`).set(a.h).send({ game: { type: 'ox' } }).expect(201)).body.message;
  assert.equal(g.kind, 'game'); assert.equal(g.game.board, '.........');
  const move = (u, cell) => api().post(`/conversations/${conv}/messages/${g.id}/move`).set(u.h).send({ cell });
  assert.equal((await move(b, 0).expect(409)).body.error.code, 'not_your_turn');
  await move(a, 0).expect(200); await move(b, 3).expect(200); await move(a, 1).expect(200);
  assert.equal((await move(b, 1).expect(409)).body.error.code, 'taken');
  await move(b, 4).expect(200);
  const end = (await move(a, 2).expect(200)).body.game;
  assert.equal(end.winner, 'x'); assert.deepEqual(end.line, [0, 1, 2]);
  assert.equal((await move(b, 5).expect(409)).body.error.code, 'game_over');
  const list = (await api().get(`/conversations/${conv}/messages`).set(b.h).expect(200)).body.messages;
  assert.equal(list.find((m) => m.id === g.id).game.winner, 'x');
});

test('read receipts are two-way: turning mine off hides both people\'s "Seen"', async () => {
  const { a, b, conv } = await connected();
  await api().post(`/conversations/${conv}/messages`).set(a.h).send({ body: 'hi' }).expect(201);
  await api().post(`/conversations/${conv}/read`).set(b.h).expect(200);
  const seen = async (u) => (await api().get(`/conversations/${conv}`).set(u.h).expect(200)).body.conversation.members;
  const other = (ms, u) => ms.find((m) => String(m.id).toLowerCase() !== String(u.user.id).toLowerCase());
  assert.ok(other(await seen(a), a).lastReadAt, 'on by default');
  await setPrivacy(b, { readReceipts: false });
  assert.equal(other(await seen(a), a).lastReadAt, null, "a can't see b's");
  assert.equal(other(await seen(b), b).lastReadAt, null, "and b can't see a's");
});

test('translator: 14 languages, detected from their script', () => {
  assert.equal(TRANSLATE_LANGS.length, 14);
  assert.equal(detectLanguage('நான் வருகிறேன்'), 'ta');
  assert.equal(detectLanguage('ಹೇಗಿದ್ದೀರಾ'), 'kn');
  assert.equal(detectLanguage('मी घरी जातो, तो काळा आहे'), 'mr');
  assert.equal(detectLanguage('मैं घर जा रहा हूँ'), 'hi');
  assert.equal(detectLanguage('کٲشُر زبان'), 'ks');
  assert.equal(detectLanguage('ہم کل ملیں گے'), 'ur');
});
