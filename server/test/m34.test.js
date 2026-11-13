// Store reviewers (Google Play / App Store): one test number with a fixed code that skips the live face scan.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, closePool, query } from './helpers.js';
import { config } from '../src/config.js';

before(resetDb);
after(() => closePool());

test('the review number always takes the fixed code and skips the face scan; other numbers are unchanged', async () => {
  const was = { phone: config.reviewPhone, code: config.reviewCode, face: config.faceRequired };
  config.reviewPhone = '9811122233'; config.reviewCode = '246810'; config.faceRequired = true;
  try {
    const r = await api().post('/auth/otp/request').send({ phone: '9811122233' }).expect(200);
    assert.equal(r.body.sent, true);
    await api().post('/auth/otp/verify').send({ phone: '9811122233', code: '111111' }).expect(400);
    await api().post('/auth/otp/request').send({ phone: '9811122233' }).expect(200); // no 30-second wait for reviewers
    const v = (await api().post('/auth/otp/verify').send({ phone: '9811122233', code: '246810' }).expect(200)).body;
    assert.equal(v.user.verified, true, 'no live face scan for the review account');
    const fp = (await query('SELECT COUNT(*) AS n FROM face_embeddings WHERE user_id=$1', [v.user.id])).rows[0].n;
    assert.equal(fp, 0, 'and no face fingerprint stored');
    // an ordinary number still gets a random code and needs the face scan
    const o = (await api().post('/auth/otp/request').send({ phone: '9811122299' }).expect(200)).body;
    if (o.devCode) assert.notEqual(o.devCode, '246810');
    const ov = (await api().post('/auth/otp/verify').send({ phone: '9811122299', code: o.devCode }).expect(200)).body;
    assert.equal(ov.user.verified, false);
  } finally { config.reviewPhone = was.phone; config.reviewCode = was.code; config.faceRequired = was.face; }
});
