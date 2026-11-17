// Interests and location are for getting to know someone: once two people are connected, neither sees the
// other's interests or city any more (left out of the API response, not just hidden on screen).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool, makeDna } from './helpers.js';

before(resetDb);
after(() => closePool());

test('interests and city show before connecting and are left out after', async () => {
  const a = await makeUser(); const b = await makeUser(); await makeDna(a, 0); await makeDna(b, 1);
  await api().patch('/users/me').set(b.h).send({ city: 'Kondapur, Hyderabad', interests: ['cricket', 'music'] }).expect(200);
  await api().patch('/users/me').set(a.h).send({ city: 'Madhapur, Hyderabad', interests: ['art'] }).expect(200);

  const before = (await api().get(`/users/u/${b.user.username}`).set(a.h).expect(200)).body;
  assert.equal(before.relationship.connected, false);
  assert.equal(before.user.city, 'Kondapur, Hyderabad');
  assert.deepEqual(before.user.interests, ['cricket', 'music']);

  const q = (await api().post('/connections/requests').set(a.h).send({ toUserId: b.user.id, intent: 'friendship' }).expect(201)).body.request;
  await api().post(`/connections/requests/${q.id}/accept`).set(b.h).send({ connectBack: true }).expect(200);

  for (const [viewer, target] of [[a, b], [b, a]]) {
    const after = (await api().get(`/users/u/${target.user.username}`).set(viewer.h).expect(200)).body;
    assert.equal(after.relationship.connected, true);
    assert.ok(!('city' in after.user) && !('interests' in after.user), 'left out of the response');
    assert.equal(after.user.aboutHidden, true);
  }
  // each person still sees their own
  const mine = (await api().get('/users/me').set(b.h).expect(200)).body.user;
  assert.equal(mine.city, 'Kondapur, Hyderabad'); assert.deepEqual(mine.interests, ['cricket', 'music']);
  // connected people don't appear in Discover (where city and shared interests are shown)
  const found = (await api().post('/discover/search').set(a.h).send({}).expect(200)).body.people;
  assert.ok(!found.some((p) => p.id === b.user.id));
});
