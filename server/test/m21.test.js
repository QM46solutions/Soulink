// Copyright: report → review → removal with notice → contest → 21-day restore; strikes; music rules.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool, query } from './helpers.js';
import { runCopyrightRestores } from '../src/services/copyright.js';

before(resetDb);
after(() => closePool());

let admin;
async function setup() {
  if (!admin) { admin = await makeUser({ username: 'crteam' }); }
  process.env.ADMIN_USERNAMES = 'crteam';
}
async function aPost(u) {
  return (await api().post('/posts').set(u.h).field('caption', 'My dance video').expect(201)).body.post;
}
const report = (postId, extra = {}) => ({
  name: 'Ravi Kumar', email: 'legal@label.example', address: 'Banjara Hills, Hyderabad 500034', relationship: 'agent',
  rightsOwner: 'Example Music Pvt Ltd', work: 'The song "Monsoon Nights" (2024), sound recording and lyrics',
  contentUrl: `https://soulink.app/post/${postId}`, goodFaith: true, accurate: true, suitUndertaking: true, signature: 'Ravi Kumar', ...extra,
});

describe('Copyright', () => {
  test('a report needs every statement, and a real Soulink link', async () => {
    const u = await makeUser(); const p = await aPost(u);
    await api().post('/copyright/reports').send(report(p.id, { suitUndertaking: false })).expect(400);
    await api().post('/copyright/reports').send(report(p.id, { contentUrl: 'https://example.com/x' })).expect(400);
    const ok = await api().post('/copyright/reports').send(report(p.id)).expect(201);
    assert.ok(ok.body.reference);
  });

  test('removal hides the post, shows a copyright notice, tells the uploader who complained, and gives a strike', async () => {
    await setup();
    const u = await makeUser(); const viewer = await makeUser(); const p = await aPost(u);
    await api().post('/copyright/reports').send(report(p.id)).expect(201);
    const q = (await api().get('/admin/copyright').set(admin.h).expect(200)).body.reports.find((x) => x.contentId.toLowerCase() === p.id.toLowerCase());
    const d = (await api().post(`/admin/copyright/${q.id}/decide`).set(admin.h).send({ action: 'remove' }).expect(200)).body;
    assert.equal(d.strikes, 1);
    const seen = await api().get(`/posts/${p.id}`).set(viewer.h).expect(404);
    assert.equal(seen.body.error.code, 'copyright_removed');
    const mine = (await api().get('/copyright/mine').set(u.h).expect(200)).body;
    assert.equal(mine.strikes, 1);
    assert.equal(mine.notices[0].reporter.email, 'legal@label.example'); // shared with the uploader, as Instagram does
    assert.equal(mine.notices[0].proof, undefined); // but not the reporter's private details
  });

  test('a contested removal comes back after 21 days without a court order, and the strike goes', async () => {
    await setup();
    const u = await makeUser(); const viewer = await makeUser(); const p = await aPost(u);
    await api().post('/copyright/reports').send(report(p.id)).expect(201);
    const id = (await query('SELECT id FROM copyright_reports WHERE content_id=$1', [p.id])).rows[0].id;
    await api().post(`/admin/copyright/${id}/decide`).set(admin.h).send({ action: 'remove' }).expect(200);
    await api().post(`/copyright/${id}/appeal`).set(u.h).send({ text: 'This is my own composition, recorded in my studio.', confirm: true }).expect(200);
    await query('UPDATE copyright_reports SET restore_after = DATEADD(DAY, -1, SYSDATETIMEOFFSET()) WHERE id=$1', [id]);
    await runCopyrightRestores();
    await api().get(`/posts/${p.id}`).set(viewer.h).expect(200);
    assert.equal((await api().get('/copyright/mine').set(u.h).expect(200)).body.strikes, 0);
  });

  test('a second strike stops posting for 7 days; a third removes the account', async () => {
    await setup();
    const u = await makeUser();
    for (let i = 1; i <= 3; i += 1) {
      const p = await aPost(u);
      await api().post('/copyright/reports').send(report(p.id)).expect(201);
      const id = (await query('SELECT id FROM copyright_reports WHERE content_id=$1', [p.id])).rows[0].id;
      await api().post(`/admin/copyright/${id}/decide`).set(admin.h).send({ action: 'remove' }).expect(200);
      if (i === 2) {
        const r = await api().post('/posts').set(u.h).field('caption', 'again').expect(403);
        assert.equal(r.body.error.code, 'posting_limited');
        await query('UPDATE users SET posting_blocked_until = NULL WHERE id=$1', [u.user.id]);
      }
    }
    assert.equal((await query('SELECT id FROM users WHERE id=$1', [u.user.id])).rows.length, 0);
  });
});

describe('Music', () => {
  test('a song from the phone needs a rights confirmation', async () => {
    const u = await makeUser(); const p = await aPost(u);
    const r = await api().post(`/posts/${p.id}/music`).set(u.h).attach('audio', Buffer.from('ID3fake'), { filename: 'song.mp3', contentType: 'audio/mpeg' }).field('title', 'Song').expect(400);
    assert.equal(r.body.error.code, 'rights_not_confirmed');
  });
});
