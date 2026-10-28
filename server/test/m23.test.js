// Deleting an account erases the person's files too (photos, voice notes...), not just their rows:
// from the server's disk and from the database copy used by the cloud host.
process.env.STORAGE = 'db';
const { test, before, after, describe } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const fs = await import('node:fs');
const path = await import('node:path');
const { api, resetDb, makeUser, closePool, query } = await import('./helpers.js');
const { config } = await import('../src/config.js');

before(resetDb);
after(() => closePool());
const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');

describe('Account deletion erases files', () => {
  test("the deleted person's photo is gone; someone else's stays", async () => {
    const a = await makeUser();
    const b = await makeUser();
    const pa = (await api().post('/users/me/avatar').set(a.h).attach('photo', png, { filename: 'a.png', contentType: 'image/png' }).expect(200)).body.user.avatarUrl;
    const pb = (await api().post('/users/me/avatar').set(b.h).attach('photo', png, { filename: 'b.png', contentType: 'image/png' }).expect(200)).body.user.avatarUrl;
    const onDisk = (u) => fs.existsSync(path.join(config.uploadDir, u.replace(/^\/uploads\//, '')));
    const inDb = async (u) => (await query('SELECT COUNT(*) AS n FROM stored_files WHERE path=$1', [u])).rows[0].n > 0;
    assert.ok(onDisk(pa) && (await inDb(pa)));

    await api().delete('/users/me').set(a.h).send({ confirm: 'DELETE' }).expect(200);
    assert.ok(!onDisk(pa), 'photo removed from disk');
    assert.ok(!(await inDb(pa)), 'photo removed from the database copy');
    assert.ok(onDisk(pb) && (await inDb(pb)), "other people's photos are untouched");
    await api().get(pa).expect(404);
  });
});
