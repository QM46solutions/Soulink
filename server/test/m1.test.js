import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, query, closePool } from './helpers.js';

before(resetDb);
after(() => closePool());

describe('Auth: OTP sign-up / login', () => {
  test('rejects invalid phone', async () => {
    const r = await api().post('/auth/otp/request').send({ phone: '12345' }).expect(400);
    assert.equal(r.body.error.code, 'invalid_phone');
  });

  test('normalizes Indian number, creates account, logs in again as same user', async () => {
    const a = await api().post('/auth/otp/request').send({ phone: '98765 43210' }).expect(200);
    assert.equal(a.body.target, '+919876543210');
    assert.match(a.body.devCode, /^\d{6}$/);
    const v1 = await api().post('/auth/otp/verify').send({ phone: '9876543210', code: a.body.devCode }).expect(200);
    assert.equal(v1.body.isNew, true);
    assert.equal(v1.body.user.onboardingDone, false);

    // cooldown: immediate re-request blocked
    await api().post('/auth/otp/request').send({ phone: '9876543210' }).expect(429);
    await query('UPDATE otp_codes SET created_at = DATEADD(MINUTE, -1, SYSDATETIMEOFFSET())');
    const b = await api().post('/auth/otp/request').send({ phone: '+919876543210' }).expect(200);
    const v2 = await api().post('/auth/otp/verify').send({ phone: '9876543210', code: b.body.devCode }).expect(200);
    assert.equal(v2.body.isNew, false);
    assert.equal(v2.body.user.id, v1.body.user.id);
  });

  test('wrong code counts attempts and code cannot be reused', async () => {
    const a = await api().post('/auth/otp/request').send({ email: 'Test@Example.com' }).expect(200);
    assert.equal(a.body.target, 'test@example.com');
    const wrong = a.body.devCode === '000000' ? '111111' : '000000';
    const w = await api().post('/auth/otp/verify').send({ email: 'test@example.com', code: wrong }).expect(400);
    assert.equal(w.body.error.code, 'otp_wrong');
    const { rows } = await query('SELECT attempts FROM otp_codes WHERE target=$1', ['test@example.com']);
    assert.equal(rows[0].attempts, 1);
    await api().post('/auth/otp/verify').send({ email: 'test@example.com', code: a.body.devCode }).expect(200);
    await api().post('/auth/otp/verify').send({ email: 'test@example.com', code: a.body.devCode }).expect(400);
  });

  test('Log in only sends a code when the account exists', async () => {
    const r1 = await api().post('/auth/otp/request').send({ phone: '9111111111', intent: 'login' }).expect(404);
    assert.equal(r1.body.error.code, 'no_account');
    const r2 = await api().post('/auth/otp/request').send({ phone: '9111111111', intent: 'signup' }).expect(200);
    assert.equal(r2.body.accountExists, false);
    await api().post('/auth/otp/verify').send({ phone: '9111111111', code: r2.body.devCode }).expect(200);
    await query('UPDATE otp_codes SET created_at = DATEADD(MINUTE, -1, SYSDATETIMEOFFSET())');
    const r3 = await api().post('/auth/otp/request').send({ phone: '9111111111', intent: 'login' }).expect(200);
    assert.equal(r3.body.accountExists, true);
    await api().post('/auth/otp/request').send({ email: 'x@example.com', intent: 'hack' }).expect(400);
  });

  test('protected routes need a token', async () => {
    await api().get('/users/me').expect(401);
    await api().get('/users/me').set('Authorization', 'Bearer nonsense').expect(401);
  });

  test('Google sign-in is stubbed until cloud move', async () => {
    await api().post('/auth/google').send({}).expect(501);
  });
});

describe('Onboarding & profile', () => {
  test('blocks under-18 and enforces username rules', async () => {
    const a = await api().post('/auth/otp/request').send({ phone: '9123456780' });
    const { body } = await api().post('/auth/otp/verify').send({ phone: '9123456780', code: a.body.devCode });
    const h = { Authorization: `Bearer ${body.token}` };
    const young = new Date(); young.setFullYear(young.getFullYear() - 16);
    const u = await api().post('/users/me/complete-onboarding').set(h)
      .send({ username: 'teen_user', displayName: 'Teen', birthDate: young.toISOString().slice(0, 10) }).expect(400);
    assert.equal(u.body.error.code, 'underage');
    await api().post('/users/me/complete-onboarding').set(h)
      .send({ username: 'Bad Name!', displayName: 'X', birthDate: '1990-01-01' }).expect(400);
    await api().post('/users/me/complete-onboarding').set(h)
      .send({ username: 'admin', displayName: 'X', birthDate: '1990-01-01' }).expect(400);
  });

  test('username availability and duplicate usernames', async () => {
    const a = await makeUser({ username: 'sai.raghava' });
    const b = await makeUser();
    const r1 = await api().get('/users/username-available?u=Sai.Raghava').set(b.h).expect(200);
    assert.equal(r1.body.available, false);
    const r2 = await api().get('/users/username-available?u=nikhil_c').set(b.h).expect(200);
    assert.equal(r2.body.available, true);
    await api().patch('/users/me').set(b.h).send({ username: 'sai.raghava' }).expect(400);
    // own username is "available" to self
    const r3 = await api().get('/users/username-available?u=sai.raghava').set(a.h).expect(200);
    assert.equal(r3.body.available, true);
  });

  test('update profile fields; finding people by face is on hold', async () => {
    const a = await makeUser();
    const r = await api().patch('/users/me').set(a.h).send({ bio: 'Hello', city: 'Hyderabad', interests: ['cricket', 'music'] }).expect(200);
    assert.equal(r.body.user.city, 'Hyderabad');
    assert.deepEqual(r.body.user.interests, ['cricket', 'music']);
    const f = await api().patch('/users/me').set(a.h).send({ faceDiscoverable: true }).expect(400);
    assert.equal(f.body.error.code, 'face_search_paused');
    await api().patch('/users/me').set(a.h).send({ unknownField: 1 }).expect(400);
  });

  test('avatar upload saves an image', async () => {
    const a = await makeUser();
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');
    const r = await api().post('/users/me/avatar').set(a.h).attach('photo', png, { filename: 'a.png', contentType: 'image/png' }).expect(200);
    assert.match(r.body.user.avatarUrl, /^\/uploads\/avatars\/[^?]+\.png\?t=.+$/); // a private, signed link
    await api().get(r.body.user.avatarUrl).expect(200);
    await api().post('/users/me/avatar').set(a.h).attach('photo', Buffer.from('hi'), { filename: 'a.txt', contentType: 'text/plain' }).expect(400);
  });
});

describe('Follow graph (Instagram rules)', () => {
  test('public account: instant follow, counts update, unfollow', async () => {
    const a = await makeUser(); const b = await makeUser();
    const f = await api().post(`/users/${b.user.id}/follow`).set(a.h).expect(200);
    assert.equal(f.body.following, 'accepted');
    const p = await api().get(`/users/u/${b.user.username}`).set(a.h).expect(200);
    assert.equal(p.body.counts.followers, 1);
    assert.equal(p.body.relationship.following, 'accepted');
    assert.equal(p.body.canViewContent, true);
    await api().delete(`/users/${b.user.id}/follow`).set(a.h).expect(200);
    const p2 = await api().get(`/users/u/${b.user.username}`).set(a.h).expect(200);
    assert.equal(p2.body.counts.followers, 0);
  });

  test('private account: request → hidden content → accept → visible', async () => {
    const a = await makeUser(); const b = await makeUser({ isPrivate: true });
    const f = await api().post(`/users/${b.user.id}/follow`).set(a.h).expect(200);
    assert.equal(f.body.following, 'pending');
    const p = await api().get(`/users/u/${b.user.username}`).set(a.h).expect(200);
    assert.equal(p.body.canViewContent, false);
    await api().get(`/users/${b.user.id}/followers`).set(a.h).expect(403);

    const reqs = await api().get('/users/me/follow-requests').set(b.h).expect(200);
    assert.equal(reqs.body.requests.length, 1);
    assert.equal(reqs.body.requests[0].user.id, a.user.id);
    const bp = await api().get(`/users/u/${a.user.username}`).set(b.h).expect(200);
    assert.equal(bp.body.relationship.requestedYou, true);

    await api().post(`/users/me/follow-requests/${a.user.id}/accept`).set(b.h).expect(200);
    const p2 = await api().get(`/users/u/${b.user.username}`).set(a.h).expect(200);
    assert.equal(p2.body.canViewContent, true);
    const fl = await api().get(`/users/${b.user.id}/followers`).set(a.h).expect(200);
    assert.equal(fl.body.users[0].id, a.user.id);

    const notes = await api().get('/notifications').set(a.h).expect(200);
    assert.equal(notes.body.notifications[0].type, 'follow_accept');
  });

  test('decline request; cancel request; remove follower', async () => {
    const a = await makeUser(); const b = await makeUser({ isPrivate: true }); const c = await makeUser();
    await api().post(`/users/${b.user.id}/follow`).set(a.h).expect(200);
    await api().post(`/users/me/follow-requests/${a.user.id}/decline`).set(b.h).expect(200);
    const p = await api().get(`/users/u/${b.user.username}`).set(a.h);
    assert.equal(p.body.relationship.following, 'none');

    await api().post(`/users/${b.user.id}/follow`).set(c.h).expect(200);
    await api().delete(`/users/${b.user.id}/follow`).set(c.h).expect(200);
    const reqs = await api().get('/users/me/follow-requests').set(b.h);
    assert.equal(reqs.body.requests.length, 0);

    await api().post(`/users/${a.user.id}/follow`).set(c.h).expect(200);
    await api().delete(`/users/${c.user.id}/follower`).set(a.h).expect(200);
    const pc = await api().get(`/users/u/${a.user.username}`).set(c.h);
    assert.equal(pc.body.relationship.following, 'none');
  });

  test('switching private → public auto-accepts pending requests', async () => {
    const a = await makeUser(); const b = await makeUser({ isPrivate: true });
    await api().post(`/users/${b.user.id}/follow`).set(a.h);
    await api().patch('/users/me').set(b.h).send({ isPrivate: false }).expect(200);
    const p = await api().get(`/users/u/${b.user.username}`).set(a.h);
    assert.equal(p.body.relationship.following, 'accepted');
  });

  test('cannot follow yourself; unknown user 404', async () => {
    const a = await makeUser();
    await api().post(`/users/${a.user.id}/follow`).set(a.h).expect(400);
    await api().post(`/users/00000000-0000-0000-0000-000000000000/follow`).set(a.h).expect(404);
    await api().get('/users/u/nobody_here').set(a.h).expect(404);
  });
});

describe('Search', () => {
  test('finds by username prefix and display name, excludes self', async () => {
    const me = await makeUser({ username: 'searcher1' });
    await makeUser({ username: 'nikhil.cheedella', displayName: 'Nikhil Cheedella' });
    await makeUser({ username: 'ravi_k', displayName: 'Ravi Kumar' });
    const r1 = await api().get('/search/users?q=nik').set(me.h).expect(200);
    assert.equal(r1.body.users[0].username, 'nikhil.cheedella');
    const r2 = await api().get('/search/users?q=kumar').set(me.h).expect(200);
    assert.equal(r2.body.users[0].username, 'ravi_k');
    const r3 = await api().get('/search/users?q=searcher').set(me.h).expect(200);
    assert.equal(r3.body.users.length, 0);
    const r4 = await api().get('/search/users?q=%25').set(me.h).expect(200);
    assert.ok(Array.isArray(r4.body.users));
  });
});

describe('Safety: block & report', () => {
  test('block hides users both ways and removes follows', async () => {
    const a = await makeUser({ username: 'blocker_a' }); const b = await makeUser({ username: 'blocked_b' });
    await api().post(`/users/${b.user.id}/follow`).set(a.h);
    await api().post(`/users/${a.user.id}/follow`).set(b.h);
    await api().post(`/blocks/${b.user.id}`).set(a.h).expect(200);
    await api().get(`/users/u/blocked_b`).set(a.h).expect(404);
    await api().get(`/users/u/blocker_a`).set(b.h).expect(404);
    const s = await api().get('/search/users?q=blocke').set(b.h);
    assert.equal(s.body.users.length, 0);
    await api().post(`/users/${a.user.id}/follow`).set(b.h).expect(404);
    const { rows } = await query('SELECT COUNT(*) AS n FROM follows WHERE follower_id IN ($1,$2) AND followee_id IN ($1,$2)', [a.user.id, b.user.id]);
    assert.equal(rows[0].n, 0);
    const list = await api().get('/blocks').set(a.h);
    assert.equal(list.body.users[0].id, b.user.id);
    await api().delete(`/blocks/${b.user.id}`).set(a.h).expect(200);
    await api().get(`/users/u/blocked_b`).set(a.h).expect(200);
  });

  test('report validates reason', async () => {
    const a = await makeUser(); const b = await makeUser();
    await api().post('/reports').set(a.h).send({ targetType: 'user', targetId: b.user.id, reason: 'spam' }).expect(201);
    await api().post('/reports').set(a.h).send({ targetType: 'user', targetId: b.user.id, reason: 'because' }).expect(400);
  });
});
