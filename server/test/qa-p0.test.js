// QA programme, Phase 4 · P0 privacy, block, two-sided and concurrency checks (docs/qa/testcases/TEST-CASES.csv).
// Each test name starts with its test-case ID. Expected results follow the product rules, not the current code:
// a failure here is a candidate defect to investigate, never something to "fix" by changing the assertion.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool, query, makeDna } from './helpers.js';
import { pairOf } from '../src/services/connections.js';
import { config } from '../src/config.js';

before(resetDb);
after(() => closePool());

let k = 0;
async function person(opts = {}) { const u = await makeUser(opts); await makeDna(u, k++ % 20); return u; }
/** a Connect request from a to b, accepted by b; connectBack=true makes them Connections (both ways) */
async function connect(a, b, connectBack = true) {
  const q = (await api().post('/connections/requests').set(a.h).send({ toUserId: b.user.id, intent: 'friendship' }).expect(201)).body.request;
  return (await api().post(`/connections/requests/${q.id}/accept`).set(b.h).send({ connectBack }).expect(200)).body;
}
async function connectionRow(a, b) {
  const [x, y] = pairOf(a.user.id, b.user.id);
  return (await query('SELECT COUNT(*) AS n FROM connections WHERE user_a=$1 AND user_b=$2', [x, y])).rows[0].n;
}
const profile = (viewer, target) => api().get(`/users/u/${target.user.username}`).set(viewer.h);
const post = async (u, caption = 'QA post') => (await api().post('/posts').set(u.h).field('caption', caption).expect(201)).body.post;
const moment = async (u) => (await api().post('/moments').set(u.h).field('text', 'QA moment').field('bg', 'sunset').field('story', '1').expect(201)).body.moment;
const notes = async (u) => (await api().get('/notifications').set(u.h).expect(200)).body.notifications;
const hidden = (status) => [403, 404].includes(status);
const no5xx = (rs) => rs.forEach((r) => assert.ok(r.status < 500, `server error ${r.status}: ${JSON.stringify(r.body)}`));

describe('QA P0 · block', () => {
  test('SL-SAFE-MU-002 (OBS-009) block removes the Connection and open requests; unblock does not bring back Connection access', async () => {
    const a = await person({ isPrivate: true }); const c = await person(); const x = await person();
    const conv = (await connect(c, a)).conversationId; // c -> a accepted with connect back = Connections
    await post(a, 'private after unblock'); await moment(a);
    assert.equal(await connectionRow(a, c), 1, 'precondition: they are Connections');
    await api().post('/connections/requests').set(x.h).send({ toUserId: a.user.id, intent: 'friendship' }).expect(201); // x -> a pending
    await api().post(`/blocks/${c.user.id}`).set(a.h).expect(200);
    await api().post(`/blocks/${x.user.id}`).set(a.h).expect(200);
    // every problem is collected, so one run shows the whole impact
    const problems = [];
    if (await connectionRow(a, c)) problems.push('block left the Connection row in place');
    const openReq = (await query(`SELECT COUNT(*) AS n FROM connection_requests WHERE status IN (N'pending', N'held') AND ((from_id=$1 AND to_id=$2) OR (from_id=$2 AND to_id=$1))`, [a.user.id, x.user.id])).rows[0].n;
    if (openReq) problems.push('block left an open Connect request in place');
    const cnt = (await api().get(`/users/u/${a.user.username}`).set(a.h).expect(200)).body.counts.connections;
    if (Number(cnt) !== 0) problems.push(`while blocked, A's Connections count still includes C (${cnt})`);
    await api().delete(`/blocks/${c.user.id}`).set(a.h).expect(200);
    await api().delete(`/blocks/${x.user.id}`).set(a.h).expect(200);
    const p = (await profile(c, a).expect(200)).body;
    if (p.relationship.connected) problems.push('after unblock C is shown as a Connection without a new request');
    if (p.canViewContent) problems.push("after unblock C can see A's private profile content");
    const cp = await api().get(`/posts/user/${a.user.id}`).set(c.h);
    if (cp.status === 200 && cp.body.posts.length) problems.push("after unblock C receives A's private posts");
    if ((await api().get(`/moments/user/${a.user.id}`).set(c.h)).status === 200) problems.push("after unblock C can open A's Moments");
    // the "chat needs a Connection" rule is off in the test environment by default (config.connectRequired); production has it on
    const gate = config.connectRequired; config.connectRequired = true;
    try {
      if ((await api().post('/conversations/direct').set(c.h).send({ userId: a.user.id })).status < 300) problems.push('after unblock C can start a chat with A without connecting again');
      if ((await api().post(`/conversations/${conv}/messages`).set(c.h).send({ body: 'old chat after unblock' })).status < 300) problems.push('after unblock C can write in the old chat without connecting again');
    } finally { config.connectRequired = gate; }
    const xr = (await api().get('/connections/requests?box=incoming').set(a.h).expect(200)).body;
    if (JSON.stringify(xr).toUpperCase().includes(String(x.user.id).toUpperCase())) problems.push("after unblock X's old Connect request is back in A's requests");
    assert.deepEqual(problems, [], `OBS-009 impact:\n - ${problems.join('\n - ')}`);
  });

  test('SL-SAFE-MU-001 block matrix: nothing of A reaches the blocked person, and the other way round', async () => {
    const a = await person(); const c = await person();
    const conv = (await connect(c, a)).conversationId;
    const p = await post(a, 'blockmatrix caption'); await moment(a);
    await api().post(`/conversations/${conv}/messages`).set(c.h).send({ body: 'before block' }).expect(201);
    await api().post(`/blocks/${c.user.id}`).set(a.h).expect(200);
    // C looking at A
    assert.ok(hidden((await profile(c, a)).status), 'profile');
    assert.ok(hidden((await api().get(`/posts/user/${a.user.id}`).set(c.h)).status), 'post list');
    assert.ok(hidden((await api().get(`/posts/${p.id}`).set(c.h)).status), 'single post');
    assert.ok(hidden((await api().post(`/posts/${p.id}/like`).set(c.h)).status), 'like');
    assert.ok(hidden((await api().post(`/posts/${p.id}/comments`).set(c.h).send({ text: 'hi' })).status), 'comment');
    assert.ok(hidden((await api().get(`/moments/user/${a.user.id}`).set(c.h)).status), 'Moments');
    const tray = (await api().get('/moments/feed').set(c.h).expect(200)).body.groups;
    assert.ok(!tray.some((g) => g.user.id === a.user.id), 'Moments tray');
    const s = (await api().get(`/search/users?q=${a.user.username.slice(0, 6)}`).set(c.h).expect(200)).body.users;
    assert.ok(!s.some((u) => u.id === a.user.id), 'search');
    assert.ok(hidden((await api().post(`/conversations/${conv}/messages`).set(c.h).send({ body: 'after block' })).status), 'message in the old chat');
    // A looking at C
    assert.ok(hidden((await profile(a, c)).status), 'reverse: profile');
    // no new notifications reach A from C after the block
    const before = (await notes(a)).length;
    await api().post(`/posts/${p.id}/like`).set(c.h);
    assert.equal((await notes(a)).length, before, 'no notification after block');
  });
});

describe('QA P0 · who sees what', () => {
  test('SL-PROF-MU-001 private profile: stranger sees header only, Follower sees posts but not Moments, Connection sees both', async () => {
    const b = await person({ isPrivate: true }); const x = await person(); const d = await person(); const c = await person();
    await post(b, 'private post'); await moment(b);
    await connect(d, b, false); // d is a Follower of b, not a Connection
    await connect(c, b, true); // c is a Connection
    // stranger
    const px = (await profile(x, b).expect(200)).body;
    assert.equal(px.canViewContent, false);
    // the API answers 200 { posts: [], private: true } for a private account (by design): what matters is that nothing is returned
    const xp = await api().get(`/posts/user/${b.user.id}`).set(x.h);
    assert.ok(hidden(xp.status) || (xp.status === 200 && xp.body.posts.length === 0 && xp.body.private === true), 'stranger: no posts returned');
    assert.ok(hidden((await api().get(`/moments/user/${b.user.id}`).set(x.h)).status), 'stranger: Moments');
    const fx = await api().post(`/users/${b.user.id}/follow`).set(x.h);
    assert.equal(fx.status, 403, 'stranger: plain Follow on a private account is refused (Connect only)');
    // follower
    assert.equal((await profile(d, b).expect(200)).body.canViewContent, true, 'follower: posts');
    assert.equal((await api().get(`/posts/user/${b.user.id}`).set(d.h).expect(200)).body.posts.length, 1);
    assert.ok(hidden((await api().get(`/moments/user/${b.user.id}`).set(d.h)).status), 'follower must not see Moments');
    // connection
    assert.equal((await api().get(`/posts/user/${b.user.id}`).set(c.h).expect(200)).body.posts.length, 1);
    await api().get(`/moments/user/${b.user.id}`).set(c.h).expect(200);
  });

  test('SL-PROF-SEC-001 private account follower/following lists are hidden from strangers', async () => {
    const b = await person({ isPrivate: true }); const x = await person(); const c = await person();
    await connect(c, b);
    for (const list of ['followers', 'following', 'connections']) {
      const r = await api().get(`/users/${b.user.id}/${list}`).set(x.h);
      const leaked = r.status === 200 && JSON.stringify(r.body).includes(c.user.id);
      assert.ok(!leaked, `${list} leaked to a stranger`);
    }
  });
});

describe('QA P0 · both sides of an interaction', () => {
  test('SL-POST-MU-001 like: liker, author, third person, database and one notification', async () => {
    const a = await person(); const b = await person(); const c = await person();
    const p = await post(b);
    const r = (await api().post(`/posts/${p.id}/like`).set(a.h).expect(200)).body;
    assert.equal(r.liked, true); assert.equal(r.likeCount, 1);
    assert.equal((await query('SELECT COUNT(*) AS n FROM post_likes WHERE post_id=$1', [p.id])).rows[0].n, 1);
    const n = (await notes(b)).filter((x) => x.type === 'post_like');
    assert.equal(n.length, 1, 'author gets exactly one like notification');
    assert.equal((await notes(a)).filter((x) => x.type === 'post_like').length, 0, 'liker is not notified');
    const seen = (await api().get(`/posts/${p.id}`).set(c.h).expect(200)).body.post;
    assert.equal(seen.likeCount, 1, 'third person sees the count');
  });

  test('SL-NOTF-MU-001 Connect request, accept: each side notified once, nobody notifies themselves', async () => {
    const a = await person(); const b = await person();
    await connect(a, b);
    const toB = (await notes(b)).filter((x) => /connect/.test(x.type));
    const toA = (await notes(a)).filter((x) => /connect/.test(x.type));
    assert.ok(toB.length >= 1, 'receiver told about the request');
    assert.equal(toA.filter((x) => x.type === 'connect_accepted').length, 1, 'sender told once about acceptance');
    for (const [u, list] of [[a, await notes(a)], [b, await notes(b)]]) assert.ok(!list.some((x) => x.actor?.id === u.user.id), 'self-notification');
  });
});

describe('QA P0 · security of other people\'s objects', () => {
  test('SL-CHAT-SEC-001 a non-member cannot read or write a conversation', async () => {
    const a = await person(); const c = await person(); const x = await person();
    const conv = (await connect(c, a)).conversationId;
    await api().post(`/conversations/${conv}/messages`).set(a.h).send({ body: 'private' }).expect(201);
    const read = await api().get(`/conversations/${conv}/messages`).set(x.h);
    assert.ok(hidden(read.status) && !JSON.stringify(read.body).includes('private'), 'read');
    assert.ok(hidden((await api().get(`/conversations/${conv}`).set(x.h)).status), 'details');
    assert.ok(hidden((await api().post(`/conversations/${conv}/messages`).set(x.h).send({ body: 'intruder' })).status), 'write');
    assert.ok(hidden((await api().post(`/conversations/${conv}/read`).set(x.h)).status), 'mark read');
  });

  test('SL-CONN-SEC-001 a stranger cannot accept, reject, hold or withdraw someone else\'s request', async () => {
    const a = await person(); const b = await person(); const x = await person();
    const q = (await api().post('/connections/requests').set(a.h).send({ toUserId: b.user.id, intent: 'friendship' }).expect(201)).body.request;
    for (const act of ['accept', 'reject', 'hold', 'withdraw']) {
      const r = await api().post(`/connections/requests/${q.id}/${act}`).set(x.h).send({ hours: 24, days: 1 });
      assert.ok(r.status >= 400 && r.status < 500, `${act} by a stranger answered ${r.status}`);
    }
    const row = (await query('SELECT status FROM connection_requests WHERE id=$1', [q.id])).rows[0];
    assert.equal(row.status, 'pending');
  });

  test('SL-POST-SEC-001 another user cannot edit, delete, pin or archive my post', async () => {
    const a = await person(); const b = await person();
    const p = await post(a, 'mine');
    for (const r of [
      await api().patch(`/posts/${p.id}`).set(b.h).send({ caption: 'hacked' }),
      await api().delete(`/posts/${p.id}`).set(b.h),
      await api().post(`/posts/${p.id}/pin`).set(b.h),
      await api().post(`/posts/${p.id}/archive`).set(b.h),
    ]) assert.ok(r.status >= 400 && r.status < 500, `answered ${r.status}`);
    const row = (await query('SELECT caption, deleted_at FROM posts WHERE id=$1', [p.id])).rows[0];
    assert.equal(row.caption, 'mine'); assert.equal(row.deleted_at, null);
  });
});

describe('QA P0 · two people at the same moment', () => {
  test('SL-CONN-CON-001 A and B send Connect to each other at once: never two open requests', async () => {
    const a = await person(); const b = await person();
    const rs = await Promise.all([
      api().post('/connections/requests').set(a.h).send({ toUserId: b.user.id, intent: 'friendship' }),
      api().post('/connections/requests').set(b.h).send({ toUserId: a.user.id, intent: 'friendship' }),
    ]);
    no5xx(rs);
    const open = (await query(`SELECT COUNT(*) AS n FROM connection_requests WHERE status IN (N'pending', N'held')
      AND ((from_id=$1 AND to_id=$2) OR (from_id=$2 AND to_id=$1))`, [a.user.id, b.user.id])).rows[0].n;
    assert.equal(open, 1, 'exactly one open request between the two');
  });

  test('SL-POST-CON-001 like pressed twice at once: no server error, at most one like row', async () => {
    const a = await person(); const b = await person();
    const p = await post(b);
    const rs = await Promise.all([1, 2].map(() => api().post(`/posts/${p.id}/like`).set(a.h)));
    no5xx(rs);
    const n = (await query('SELECT COUNT(*) AS n FROM post_likes WHERE post_id=$1 AND user_id=$2', [p.id, a.user.id])).rows[0].n;
    assert.ok(n <= 1, `${n} like rows`);
  });

  test('SL-CHAT-CON-001 both send 20 messages at once: every message stored once, same order for both', async () => {
    const a = await person(); const c = await person();
    const conv = (await connect(c, a)).conversationId;
    const sends = [];
    for (let i = 0; i < 20; i++) { sends.push(api().post(`/conversations/${conv}/messages`).set(a.h).send({ body: `a${i}` })); sends.push(api().post(`/conversations/${conv}/messages`).set(c.h).send({ body: `c${i}` })); }
    const rs = await Promise.all(sends); no5xx(rs);
    const la = (await api().get(`/conversations/${conv}/messages?limit=100`).set(a.h).expect(200)).body.messages.filter((m) => /^[ac]\d+$/.test(m.body || ''));
    const lc = (await api().get(`/conversations/${conv}/messages?limit=100`).set(c.h).expect(200)).body.messages.filter((m) => /^[ac]\d+$/.test(m.body || ''));
    assert.equal(la.length, 40); assert.equal(new Set(la.map((m) => m.id)).size, 40);
    assert.deepEqual(la.map((m) => m.id), lc.map((m) => m.id), 'same order for both people');
  });
});
