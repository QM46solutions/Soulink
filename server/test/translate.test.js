import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGoogle } from '../src/services/soulmojiAi.js';

test('reads the free Google translator answer, piece by piece', () => {
  assert.equal(parseGoogle([[['నమస్కారం ', 'Hello ', null], ['మిత్రమా', 'friend', null]], null, 'en']), 'నమస్కారం మిత్రమా');
  assert.equal(parseGoogle(null), null);
  assert.equal(parseGoogle({ error: 1 }), null);
  assert.equal(parseGoogle([[]]), null);
});
