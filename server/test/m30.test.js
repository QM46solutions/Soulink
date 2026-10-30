// Face fingerprints: a separate FACE_KEY. Values locked with the old key (worked out from the login secret) still open
// once FACE_KEY is set, and new values use FACE_KEY.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { openFace, sealFace } from '../src/lib/faceCrypto.js';

test('old-key faces still open after FACE_KEY is set; new ones use FACE_KEY', () => {
  const was = process.env.FACE_KEY;
  try {
    delete process.env.FACE_KEY;
    const v = Array.from({ length: 128 }, (_, i) => i / 1000);
    const old = sealFace(v);
    assert.ok(old.startsWith('v1:'));
    process.env.FACE_KEY = crypto.randomBytes(32).toString('base64');
    assert.deepEqual(openFace(old), v);
    const fresh = sealFace(v);
    assert.ok(fresh.startsWith('v2:'));
    assert.deepEqual(openFace(fresh), v);
    process.env.FACE_KEY = crypto.randomBytes(32).toString('base64'); // a different key can't open it
    assert.equal(openFace(fresh), null);
    assert.deepEqual(openFace(JSON.stringify(v)), v); // very old plain rows
  } finally { if (was === undefined) delete process.env.FACE_KEY; else process.env.FACE_KEY = was; }
});
