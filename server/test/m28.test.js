// The music picker's "For you" page answers even when the music sources are quiet (tests have no internet).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool } from './helpers.js';
import { FREE_MOODS } from '../src/services/music.js';

before(resetDb);
after(() => closePool());

test('For you: sections list (popular on Soulink + moods) and the mood words', async () => {
  const u = await makeUser();
  const r = (await api().get('/music/foryou').set(u.h).expect(200)).body;
  assert.ok(Array.isArray(r.sections));
  assert.ok(FREE_MOODS.romantic && FREE_MOODS.indian);
  await api().get('/music/foryou').expect(401);
});
