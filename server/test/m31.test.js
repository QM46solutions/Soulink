// Private file links, shared-post previews and group invite links.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool } from './helpers.js';
import { checkSigned, signPath } from '../src/lib/fileLinks.js';

before(resetDb);
after(() => closePool());
const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');

describe('Private file links', () => {
  test('a file opens only with a valid, unexpired signed link', async () => {
    const a = await makeUser();
    const url = (await api().post('/users/me/avatar').set(a.h).attach('photo', png, { filename: 'a.png', contentType: 'image/png' }).expect(200)).body.user.avatarUrl;
    assert.match(url, /^\/uploads\/.+\?t=\d+\.[a-z0-9-]+\.[A-Za-z0-9_-]{24}$/);
    await api().get(url).expect(200);                          // signed: opens
    const plain = url.split('?')[0];
    await api().get(plain).expect(403);                        // bare link: refused
    await api().get(`${plain}?t=123.g.${'x'.repeat(24)}`).expect(403); // made-up / expired signature: refused
    await api().get(url.replace(/.{3}$/, 'abc')).expect(403);  // tampered signature
    assert.equal(checkSigned(plain, signPath(plain, 'g', -10).split('?t=')[1]), false); // expired
    // links the app sends back are compared without their signature
    const me = (await api().get('/users/me').set(a.h).expect(200)).body.user;
    assert.equal(me.avatarUrl.split('?')[0], plain);
  });
});

describe('Shared post preview (no account)', () => {
  test('a public post shows its preview for 15 seconds; private accounts and unknown posts do not', async () => {
    const a = await makeUser(); const p = await makeUser({ isPrivate: true });
    const post = (await api().post('/posts').set(a.h).field('caption', 'Golconda at sunset').expect(201)).body.post;
    const r = (await api().get(`/share/post/${post.id}`).expect(200)).body;
    assert.equal(r.caption, 'Golconda at sunset'); assert.equal(r.previewSeconds, 15); assert.equal(r.author.username, a.user.username);
    assert.equal(r.author.phone, undefined);
    const hidden = (await api().post('/posts').set(p.h).field('caption', 'private one').expect(201)).body.post;
    assert.equal((await api().get(`/share/post/${hidden.id}`).expect(404)).body.error.code, 'not_shareable');
    await api().get('/share/post/00000000-0000-0000-0000-000000000000').expect(404);
    await api().get('/feed').expect(401); // everything else still needs a login
  });
});

describe('Group invite links', () => {
  test('only admins make them; the link shows name + member count, joining needs a login; reset / off', async () => {
    const a = await makeUser(); const b = await makeUser(); const c = await makeUser(); const d = await makeUser();
    const g = (await api().post('/conversations/group').set(a.h).send({ title: 'Hyd hikers', userIds: [b.user.id, c.user.id] }).expect(201)).body.conversation;
    await api().post(`/conversations/${g.id}/invite`).set(b.h).expect(403); // not an admin
    const code = (await api().post(`/conversations/${g.id}/invite`).set(a.h).expect(200)).body.inviteCode;
    assert.equal((await api().get(`/conversations/${g.id}`).set(a.h).expect(200)).body.conversation.inviteCode, code);
    assert.equal((await api().get(`/conversations/${g.id}`).set(b.h).expect(200)).body.conversation.inviteCode, undefined);
    await api().get(`/conversations/invite/${code}`).expect(401);       // needs a login
    const prev = (await api().get(`/conversations/invite/${code}`).set(d.h).expect(200)).body.group;
    assert.equal(prev.title, 'Hyd hikers'); assert.equal(prev.members, 3); assert.equal(prev.joined, false);
    assert.equal(prev.lastMessage, undefined);
    await api().get(`/conversations/${g.id}/messages`).set(d.h).expect(404); // no messages before joining
    const joined = (await api().post(`/conversations/invite/${code}/join`).set(d.h).expect(200)).body.conversation;
    assert.equal(joined.members.length, 4);
    const fresh = (await api().post(`/conversations/${g.id}/invite`).set(a.h).expect(200)).body.inviteCode; // reset
    await api().get(`/conversations/invite/${code}`).set(d.h).expect(404);
    await api().delete(`/conversations/${g.id}/invite`).set(a.h).expect(200);
    await api().get(`/conversations/invite/${fresh}`).set(d.h).expect(404);
  });
});
