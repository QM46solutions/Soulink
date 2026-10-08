// Spark studio edits, Casting Board and Open Mic Stage.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool } from './helpers.js';

before(resetDb);
after(() => closePool());

const mp4 = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32, ...new Array(64).fill(0)]);
const post = (u, fields) => {
  let q = api().post('/sparks').set(u.h);
  for (const [k, v] of Object.entries(fields)) q = q.field(k, typeof v === 'string' ? v : JSON.stringify(v));
  return q.attach('video', mp4, { filename: 'clip.mp4', contentType: 'video/mp4' });
};

describe('Spark studio', () => {
  test('edits are kept with the Spark; a too-long trim is refused', async () => {
    const a = await makeUser();
    const edit = { trim: [2, 20], speed: '1.5', filter: 'dream', texts: [{ t: 'Hello Hyd', x: 0.5, y: 0.3, color: '#ffffff', style: 'neon', size: 28 }], stickers: [{ e: '🔥', x: 0.2, y: 0.8, size: 60 }], musicStart: 12, musicVolume: 0.8, videoVolume: 0.3, cover: 5 };
    const s = (await post(a, { category: 'travel', place: 'Golconda', details: { sound: 'place', edit } }).expect(201)).body.spark;
    assert.equal(s.details.edit.filter, 'dream'); assert.equal(s.details.edit.texts[0].t, 'Hello Hyd'); assert.deepEqual(s.details.edit.trim, [2, 20]);
    await post(a, { category: 'travel', place: 'x', details: { edit: { trim: [0, 90] } } }).expect(400);
  });
});

describe('Casting Board', () => {
  test('post a role, audition, the caster picks; closed after', async () => {
    const caster = await makeUser(); const actor = await makeUser(); const other = await makeUser();
    const call = (await api().post('/sparks/casting').set(caster.h).send({ title: 'Angry dad', role: 'A dad finding out the exam results', script: 'You failed again?', days: 7 }).expect(201)).body.call;
    assert.equal(call.open, true);
    assert.equal((await api().get('/sparks/casting').set(actor.h).expect(200)).body.calls.length, 1);
    const aud = (await post(actor, { category: 'acting', castingId: call.id, details: { mode: 'scene' } }).expect(201)).body.spark;
    assert.equal(aud.castingId, call.id);
    const one = (await api().get(`/sparks/casting/${call.id}`).set(other.h).expect(200)).body;
    assert.equal(one.auditions.length, 1); assert.equal(one.call.auditions, 1);
    await api().post(`/sparks/casting/${call.id}/pick`).set(actor.h).send({ sparkId: aud.id }).expect(404);
    await api().post(`/sparks/casting/${call.id}/pick`).set(caster.h).send({ sparkId: aud.id }).expect(200);
    assert.equal((await api().get(`/sparks/casting/${call.id}`).set(other.h).expect(200)).body.call.open, false);
    assert.equal((await post(other, { category: 'acting', castingId: call.id }).expect(400)).body.error.code, 'casting_closed');
  });
});

describe('Open Mic Stage', () => {
  test('weekly theme, stage performances, open mics with RSVP', async () => {
    const a = await makeUser(); const b = await makeUser();
    const perf = (await post(a, { category: 'acting', stage: '1' }).expect(201)).body.spark;
    assert.ok(perf.stageWeek);
    const st = (await api().get('/sparks/stage').set(b.h).expect(200)).body;
    assert.ok(st.theme.title); assert.equal(st.top.length, 1);
    const when = new Date(Date.now() + 3 * 86400000).toISOString();
    const spot = (await api().post('/sparks/stage/spots').set(a.h).send({ title: 'Friday Open Mic', venue: 'Lamakaan', city: 'Hyderabad', startsAt: when, kind: 'comedy' }).expect(201)).body.spot;
    assert.equal(spot.going, 1); assert.equal(spot.myRsvp, 'going');
    const r1 = (await api().post(`/sparks/stage/spots/${spot.id}/rsvp`).set(b.h).send({ kind: 'perform' }).expect(200)).body.spot;
    assert.equal(r1.performing, 1); assert.equal(r1.myRsvp, 'perform');
    const r2 = (await api().post(`/sparks/stage/spots/${spot.id}/rsvp`).set(b.h).send({ kind: 'perform' }).expect(200)).body.spot;
    assert.equal(r2.performing, 0); assert.equal(r2.myRsvp, null);
    assert.equal((await api().get('/sparks/stage?city=Hyder').set(b.h).expect(200)).body.spots.length, 1);
    assert.equal((await api().get('/sparks/stage?city=Mumbai').set(b.h).expect(200)).body.spots.length, 0);
    await api().post('/sparks/stage/spots').set(a.h).send({ title: 'Old', venue: 'x', city: 'Hyderabad', startsAt: '2020-01-01T10:00:00Z' }).expect(400);
  });
});
