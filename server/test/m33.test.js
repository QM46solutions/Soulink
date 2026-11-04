// Phone app: notification tokens (Expo push) and app links.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool, query } from './helpers.js';

before(resetDb);
after(() => closePool());

describe('Phone app', () => {
  test('the installed app registers its notification token; logging in as someone else moves it', async () => {
    const a = await makeUser(); const b = await makeUser();
    const token = 'ExponentPushToken[abcdefghijklmnopqrstuv]';
    await api().post('/push/expo').set(a.h).send({ token, platform: 'ios' }).expect(201);
    await api().post('/push/expo').set(a.h).send({ token: 'not-a-token' }).expect(400);
    await api().post('/push/expo').set(b.h).send({ token, platform: 'ios' }).expect(201);
    const rows = (await query('SELECT user_id FROM expo_push_tokens WHERE token=$1', [token])).rows;
    assert.equal(rows.length, 1);
    assert.equal(String(rows[0].user_id).toLowerCase(), String(b.user.id).toLowerCase());
    await api().delete('/push/expo').set(b.h).send({ token }).expect(200);
    assert.equal((await query('SELECT 1 AS x FROM expo_push_tokens WHERE token=$1', [token])).rows.length, 0);
    await api().post('/push/test').set(a.h).expect(200);
  });

  test('app-link files are served (empty until the store keys are set)', async () => {
    const al = await api().get('/.well-known/assetlinks.json').expect(200);
    assert.ok(Array.isArray(al.body));
    const aasa = await api().get('/.well-known/apple-app-site-association').expect(200);
    assert.ok(aasa.body.applinks);
  });
});
