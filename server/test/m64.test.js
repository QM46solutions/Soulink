// Account Data & Backup: the ZIP download (own content only), and restore (validation, ownership, duplicates,
// bringing back deleted posts with only eligible interactions, recreating lost posts, unsafe and changed files).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import yauzl from 'yauzl';
import { api, resetDb, closePool, query, makeUser } from './helpers.js';
import { pairOf } from '../src/services/connections.js';

before(resetDb);
after(() => closePool());

const png = () => Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const binary = (res, cb) => { const parts = []; res.on('data', (c) => parts.push(c)); res.on('end', () => cb(null, Buffer.concat(parts))); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(get, done, tries = 100) {
  for (let i = 0; i < tries; i++) { const v = await get(); if (done(v)) return v; await wait(100); }
  throw new Error('timed out');
}
function unzip(buf) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buf, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      const files = {};
      zip.on('entry', (e) => zip.openReadStream(e, (er, s) => {
        if (er) return reject(er);
        const parts = []; s.on('data', (c) => parts.push(c)); s.on('end', () => { files[e.fileName] = Buffer.concat(parts); zip.readEntry(); });
      }));
      zip.on('end', () => resolve(files));
      zip.readEntry();
    });
  });
}
const connect = (a, b) => { const [x, y] = pairOf(a.user.id, b.user.id); return query(`INSERT INTO connections (user_a, user_b, intent) VALUES ($1, $2, N'friendship')`, [x, y]); };
const like = (p, u) => query('INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)', [p, u.user.id]);
const comment = (p, u, body) => query('INSERT INTO comments (post_id, author_id, body) VALUES ($1, $2, $3)', [p, u.user.id, body]);

let me; let post; let zipBuf;

test('Download My Data: a ZIP with the manifest, profile, posts and the original photos, and nobody else’s data', async () => {
  me = await makeUser({ displayName: 'Meera R' });
  const friend = await makeUser();
  post = (await api().post('/posts').set(me.h).field('caption', 'Charminar at dawn').attach('photos', png(), { filename: 'a.png', contentType: 'image/png' }).expect(201)).body.post;
  await connect(me, friend); await like(post.id, friend); await comment(post.id, friend, 'Beautiful');

  const start = (await api().post('/account/backup/export').set(me.h).expect(202)).body.backup;
  const ready = await until(async () => (await api().get(`/account/backup/export/${start.id}`).set(me.h).expect(200)).body.backup, (b) => b.status === 'ready' || b.status === 'failed');
  assert.equal(ready.status, 'ready', ready.error);
  assert.equal(ready.counts.posts, 1); assert.equal(ready.counts.photos, 1);
  assert.ok(new Date(ready.expiresAt) > new Date(Date.now() + 6 * 86400_000));

  const other = await makeUser();
  await api().get(`/account/backup/export/${start.id}/download`).set(other.h).expect(404); // only its owner
  const dl = await api().get(`/account/backup/export/${start.id}/download`).set(me.h).buffer(true).parse(binary).expect(200);
  assert.equal(dl.headers['content-type'], 'application/zip');
  assert.equal(Number(dl.headers['content-length']), dl.body.length);
  zipBuf = dl.body;
  const files = await unzip(zipBuf);
  for (const p of ['backup_manifest.json', 'account/profile.json', 'account/account_metadata.json', 'posts/posts.json', 'interactions/likes.json', 'interactions/comments.json', 'interactions/replies.json', 'metadata/relationships.json', 'metadata/export_information.json']) {
    assert.ok(files[`Soulink_Backup/${p}`], `${p} is in the ZIP`);
  }
  const manifest = JSON.parse(files['Soulink_Backup/backup_manifest.json']);
  assert.equal(manifest.formatVersion, 2); assert.ok(manifest.signature);
  const posts = JSON.parse(files['Soulink_Backup/posts/posts.json']);
  assert.equal(posts[0].caption, 'Charminar at dawn'); assert.equal(posts[0].likeCountAtExport, 1);
  const photo = files[`Soulink_Backup/${posts[0].media[0].file}`];
  assert.deepEqual(photo, png(), 'the original photo, unchanged');
  const everything = Object.values(files).map((b) => b.toString('latin1')).join('\n');
  assert.ok(!everything.includes(friend.user.id) && !everything.includes(friend.user.username), 'no other person’s id or username');
  assert.ok(!everything.includes('Beautiful'), 'no other person’s comment');
});

test('Restore: a backup of posts that are still here changes nothing (no duplicates)', async () => {
  const v = (await api().post('/account/backup/restore/validate').set(me.h).attach('backup', zipBuf, { filename: 'b.zip', contentType: 'application/zip' }).expect(200)).body;
  assert.equal(v.summary.duplicatesSkipped, 1); assert.equal(v.summary.postsToRestore, 0);
  await api().post(`/account/backup/restore/${v.restore.id}/start`).set(me.h).expect(202);
  const done = await until(async () => (await api().get(`/account/backup/restore/${v.restore.id}`).set(me.h).expect(200)).body.restore, (r) => ['done', 'failed'].includes(r.status));
  assert.equal(done.status, 'done', done.error);
  const n = (await query('SELECT COUNT(*) AS n FROM posts WHERE author_id=$1', [me.user.id])).rows[0].n;
  assert.equal(n, 1);
});

test('Restore brings back a deleted post with likes and comments only from current, active, unblocked Connections', async () => {
  const stillConnected = await makeUser(); const neverConnected = await makeUser(); const blocked = await makeUser(); const paused = await makeUser();
  await connect(me, stillConnected); await connect(me, blocked); await connect(me, paused);
  for (const u of [stillConnected, neverConnected, blocked, paused]) await like(post.id, u);
  await comment(post.id, stillConnected, 'Keep'); await comment(post.id, neverConnected, 'Stranger'); await comment(post.id, blocked, 'Blocked');
  await query('INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2)', [blocked.user.id, me.user.id]);
  await query('UPDATE users SET deactivated_at = SYSDATETIMEOFFSET() WHERE id=$1', [paused.user.id]);
  await query('UPDATE posts SET deleted_at = SYSDATETIMEOFFSET() WHERE id=$1', [post.id]);

  const v = (await api().post('/account/backup/restore/validate').set(me.h).attach('backup', zipBuf, { filename: 'b.zip', contentType: 'application/zip' }).expect(200)).body;
  assert.equal(v.summary.postsBroughtBack, 1);
  // likes: the first friend + stillConnected (eligible); neverConnected, blocked, paused (not)
  assert.equal(v.summary.likesEligible, 2); assert.equal(v.summary.commentsEligible, 2);
  assert.equal(v.summary.interactionsExcluded, 5);
  await api().post(`/account/backup/restore/${v.restore.id}/start`).set(me.h).expect(202);
  await api().post(`/account/backup/restore/${v.restore.id}/start`).set(me.h).expect((r) => assert.ok([200, 202].includes(r.status))); // double tap: harmless
  const done = await until(async () => (await api().get(`/account/backup/restore/${v.restore.id}`).set(me.h).expect(200)).body.restore, (r) => ['done', 'failed'].includes(r.status));
  assert.equal(done.status, 'done', done.error);
  assert.equal(done.result.broughtBack, 1); assert.equal(done.result.interactionsSkipped, 5);
  const row = (await query('SELECT deleted_at FROM posts WHERE id=$1', [post.id])).rows[0];
  assert.equal(row.deleted_at, null);
  const likers = (await query('SELECT user_id FROM post_likes WHERE post_id=$1', [post.id])).rows.map((x) => x.user_id);
  assert.equal(likers.length, 2); assert.ok(likers.includes(stillConnected.user.id));
  const visible = (await query('SELECT body FROM comments WHERE post_id=$1 AND deleted_at IS NULL ORDER BY created_at', [post.id])).rows.map((x) => x.body);
  assert.deepEqual(visible.sort(), ['Beautiful', 'Keep']);
  // the post shows the recalculated counts
  const shown = (await api().get(`/posts/${post.id}`).set(me.h).expect(200)).body.post;
  assert.equal(shown.likeCount ?? shown.likes, 2);
});

test('Restore recreates a post that is gone, with its original id and photo, and no interactions', async () => {
  // gone for good (as after deleting the account): every row that points at the post, then the post
  await query(`DECLARE @s NVARCHAR(MAX) = N'';
    SELECT @s += N'DELETE FROM ' + QUOTENAME(OBJECT_NAME(fk.parent_object_id)) + N' WHERE ' + QUOTENAME(c.name) + N' = @id;'
    FROM sys.foreign_key_columns fk JOIN sys.columns c ON c.object_id = fk.parent_object_id AND c.column_id = fk.parent_column_id
    WHERE fk.referenced_object_id = OBJECT_ID('posts');
    EXEC sp_executesql @s, N'@id UNIQUEIDENTIFIER', @id = $1;
    DELETE FROM posts WHERE id = $1`, [post.id]);
  const v = (await api().post('/account/backup/restore/validate').set(me.h).attach('backup', zipBuf, { filename: 'b.zip', contentType: 'application/zip' }).expect(200)).body;
  assert.equal(v.summary.postsToRestore, 1); assert.equal(v.summary.photosToRestore, 1);
  await api().post(`/account/backup/restore/${v.restore.id}/start`).set(me.h).expect(202);
  const done = await until(async () => (await api().get(`/account/backup/restore/${v.restore.id}`).set(me.h).expect(200)).body.restore, (r) => ['done', 'failed'].includes(r.status));
  assert.equal(done.status, 'done', done.error);
  assert.equal(done.result.postsRestored, 1); assert.equal(done.result.photosRestored, 1);
  const back = (await query('SELECT * FROM posts WHERE id=$1', [post.id])).rows[0];
  assert.equal(back.caption, 'Charminar at dawn'); assert.equal(back.author_id, me.user.id);
  const url = (Array.isArray(back.media_urls) ? back.media_urls : JSON.parse(back.media_urls))[0];
  assert.match(url, /^\/uploads\/posts\//);
  assert.equal((await query('SELECT COUNT(*) AS n FROM post_likes WHERE post_id=$1', [post.id])).rows[0].n, 0);
  const hist = (await api().get('/account/backup/history').set(me.h).expect(200)).body.backups;
  assert.ok(hist.some((h) => h.kind === 'export') && hist.some((h) => h.kind === 'restore' && h.status === 'done'));
});

test('Restore refuses: someone else’s backup, a changed file, unsafe paths, not a ZIP, an old JSON download', async () => {
  const other = await makeUser();
  const theirs = await api().post('/account/backup/restore/validate').set(other.h).attach('backup', zipBuf, { filename: 'b.zip', contentType: 'application/zip' }).expect(403);
  assert.equal(theirs.body.error.code, 'restore_not_yours');

  // one byte of the caption changed: the checksum (and so the backup) no longer matches
  const changed = Buffer.from(zipBuf); const at = changed.indexOf('Charminar'); changed[at] = 'K'.charCodeAt(0);
  const c = await api().post('/account/backup/restore/validate').set(me.h).attach('backup', changed, { filename: 'b.zip', contentType: 'application/zip' }).expect(400);
  assert.match(c.body.error.code, /restore_(damaged|invalid)/);

  // a file name that tries to leave the folder ("../")
  const evil = Buffer.from(zipBuf); let i = evil.indexOf('Soulink_Backup/posts/');
  while (i >= 0) { evil.write('Soulink_Backup/../ts/', i, 'latin1'); i = evil.indexOf('Soulink_Backup/posts/', i + 1); }
  const e = await api().post('/account/backup/restore/validate').set(me.h).attach('backup', evil, { filename: 'b.zip', contentType: 'application/zip' }).expect(400);
  assert.match(e.body.error.code, /restore_(unsafe|not_zip|damaged)/);

  await api().post('/account/backup/restore/validate').set(me.h).attach('backup', Buffer.from('hello world'), { filename: 'b.zip', contentType: 'application/zip' }).expect(400);
  const j = await api().post('/account/backup/restore/validate').set(me.h).attach('backup', Buffer.from('{"soulinkExport":1}'), { filename: 'b.json', contentType: 'application/json' }).expect(400);
  assert.equal(j.body.error.code, 'restore_legacy_json');
  await api().post('/account/backup/restore/validate').expect(401);
});

test('an expired download link stops working', async () => {
  const b = (await api().get('/account/backup/history').set(me.h).expect(200)).body.backups.find((x) => x.kind === 'export');
  await query('UPDATE account_backups SET expires_at = DATEADD(MINUTE, -1, SYSDATETIMEOFFSET()) WHERE id=$1', [b.id]);
  const r = await api().get(`/account/backup/export/${b.id}/download`).set(me.h).expect(410);
  assert.equal(r.body.error.code, 'backup_expired');
});
