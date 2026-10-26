// Soulmoji works the same on the laptop and in the cloud: the built-in engine, files kept in the database,
// the server's disk wiped on restart (as on Render), and an unreachable AI address that must be ignored.
process.env.STORAGE = 'db';
process.env.SOULMOJI_AI_URL = 'http://127.0.0.1:9/no-ai-here';
delete process.env.SOULMOJI_ENGINE;
const { test, before, after, describe } = await import('node:test');
const assert = (await import('node:assert/strict')).default;
const fs = await import('node:fs/promises');
const path = await import('node:path');
const { createRequire } = await import('node:module');
const { api, resetDb, makeUser, closePool, query } = await import('./helpers.js');
const { config } = await import('../src/config.js');
const { saveFile } = await import('../src/providers/storage.js');
const jpeg = createRequire(import.meta.url)('jpeg-js');
const points = JSON.parse(await fs.readFile(new URL('./fixtures/soulmoji-points.json', import.meta.url), 'utf8'));

before(resetDb);
after(() => closePool());

// a plain 512×512 test image (the engine needs the 68 points, not a real face)
function testImage() {
  const w = 512, h = 512, data = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i += 1) { const x = i % w, y = Math.floor(i / w); data[i * 4] = 120 + (x % 90); data[i * 4 + 1] = 100 + (y % 70); data[i * 4 + 2] = 150; data[i * 4 + 3] = 255; }
  return Buffer.from(jpeg.encode({ data, width: w, height: h }, 90).data);
}

describe('Soulmoji, cloud setup', () => {
  test('uses the built-in engine, ignores the unreachable AI, and survives a disk wipe', async () => {
    assert.equal(config.storage, 'db');
    assert.equal(config.soulmojiEngine, 'builtin');
    const u = await makeUser();
    const faceUrl = await saveFile({ buffer: testImage(), mimetype: 'image/jpeg' }, 'soulmoji');
    await query('UPDATE users SET soulmoji_face_url=$2, soulmoji_points=$3, soulmoji_src_url=$2 WHERE id=$1', [u.user.id, faceUrl, JSON.stringify(points)]);

    const face = (await api().get('/soulmoji/face').set(u.h).expect(200)).body;
    assert.equal(face.engine, 'builtin');

    const t0 = Date.now();
    const happy = (await api().post('/soulmoji/render').set(u.h).send({ mood: 'happy' }).expect(200)).body;
    assert.ok(Date.now() - t0 < 5000, 'no waiting on the AI address');
    assert.ok(!happy.ai);

    // Render restart: the server's disk is wiped; files must come back from the database
    await fs.rm(path.join(config.uploadDir, 'soulmoji'), { recursive: true, force: true });
    const img = await api().get(happy.imageUrl).expect(200);
    assert.match(img.headers['content-type'], /image\/jpeg/);
    assert.ok(img.body.length > 1000);

    // and the next mood still renders from the selfie kept in the database
    const sad = (await api().post('/soulmoji/render').set(u.h).send({ mood: 'sad' }).expect(200)).body;
    assert.notEqual(sad.imageUrl, happy.imageUrl);
    await api().get(sad.imageUrl).expect(200);
  });

  test('every mood renders', async () => {
    const u = await makeUser();
    const faceUrl = await saveFile({ buffer: testImage(), mimetype: 'image/jpeg' }, 'soulmoji');
    await query('UPDATE users SET soulmoji_face_url=$2, soulmoji_points=$3 WHERE id=$1', [u.user.id, faceUrl, JSON.stringify(points)]);
    for (const mood of (await api().get('/soulmoji/face').set(u.h).expect(200)).body.moods) {
      await api().post('/soulmoji/render').set(u.h).send({ mood }).expect(200);
    }
  });
});
