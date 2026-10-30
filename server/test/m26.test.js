// Open Mic = speak your mind (video or just your voice, with a topic; its own tab, not the main feed) and
// casting calls with clear requirements.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool } from './helpers.js';

before(resetDb);
after(() => closePool());

const mp4 = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32, ...new Array(64).fill(0)]);
const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, ...new Array(64).fill(0)]);
const post = (u, fields, file = { buf: mp4, name: 'clip.mp4', type: 'video/mp4' }) => {
  let q = api().post('/sparks').set(u.h);
  for (const [k, v] of Object.entries(fields)) q = q.field(k, typeof v === 'string' ? v : JSON.stringify(v));
  return q.attach('video', file.buf, { filename: file.name, contentType: file.type });
};
const voice = { buf: webm, name: 'voice.webm', type: 'audio/webm' };

describe('Open Mic', () => {
  test('speak on video or voice, with a topic; filtered by topic; kept out of the main feed', async () => {
    const a = await makeUser(); const b = await makeUser();
    assert.equal((await post(a, { category: 'openmic', caption: 'x' }).expect(400)).body.error.code, 'no_topic');
    const v = (await post(a, { category: 'openmic', mic: 'incident', caption: 'What happened at the bus stop' }).expect(201)).body.spark;
    assert.equal(v.micTopic, 'incident'); assert.equal(v.voice, false);
    const o = (await post(b, { category: 'openmic', mic: 'politics', caption: 'Roads in my area' }, voice).expect(201)).body.spark;
    assert.equal(o.voice, true); assert.equal(o.micTopic, 'politics');
    // only Open Mic can be voice-only
    await post(a, { category: 'travel', place: 'x' }, voice).expect(400);
    const all = (await api().get('/sparks/mic').set(a.h).expect(200)).body;
    assert.equal(all.posts.length, 2);
    assert.deepEqual(all.topics, ['story', 'incident', 'society', 'politics', 'voice', 'other']);
    const pol = (await api().get('/sparks/mic?topic=politics').set(a.h).expect(200)).body.posts;
    assert.deepEqual(pol.map((s) => s.id), [o.id]);
    await api().get('/sparks/mic?sort=top').set(a.h).expect(200);
    const feed = (await api().get('/sparks').set(a.h).expect(200)).body.sparks;
    assert.ok(!feed.some((s) => s.category === 'openmic'), 'Open Mic stays in its own tab');
  });
});

describe('Casting requirements', () => {
  test('a casting call carries its requirements', async () => {
    const c = await makeUser();
    const call = (await api().post('/sparks/casting').set(c.h).send({
      title: 'College friend', role: 'Cheerful friend in a hostel scene', days: 14,
      requirements: { ageMin: 18, ageMax: 25, gender: 'female', languages: ['Telugu', 'Hindi'], location: 'Hyderabad', pay: 'paid', payNote: '₹2,000 a day' },
    }).expect(201)).body.call;
    assert.deepEqual(call.requirements.languages, ['Telugu', 'Hindi']);
    assert.equal(call.requirements.pay, 'paid');
    assert.equal((await api().get(`/sparks/casting/${call.id}`).set(c.h).expect(200)).body.call.requirements.ageMax, 25);
    await api().post('/sparks/casting').set(c.h).send({ title: 'Wrong ages', role: 'Someone for a scene', requirements: { ageMin: 40, ageMax: 20 } }).expect(400);
    const plain = (await api().post('/sparks/casting').set(c.h).send({ title: 'No needs', role: 'Anyone for a scene' }).expect(201)).body.call;
    assert.deepEqual(plain.requirements, {});
  });
});
