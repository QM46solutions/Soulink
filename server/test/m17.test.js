// Spread around (boost a Spark), voiceover in Spark Studio, and Soulink ads (feed, Sparks, sponsored Argue).
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool } from './helpers.js';

before(resetDb);
after(() => closePool());

const mp4 = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32, ...new Array(64).fill(0)]);
const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, ...new Array(64).fill(0)]);
const spark = (u, edit) => {
  let q = api().post('/sparks').set(u.h).field('category', 'acting').field('caption', 'Monologue');
  if (edit) q = q.field('details', JSON.stringify({ edit }));
  return q.attach('video', mp4, { filename: 'clip.mp4', contentType: 'video/mp4' });
};

describe('Spark Studio edits', () => {
  test('adjust, zoom, fade, text timing and a voiceover are kept', async () => {
    const a = await makeUser();
    const edit = { adjust: { b: 0.2, w: -0.3 }, zoom: { s: 1.5, x: 0.4, y: 0.6 }, fade: { in: 1, out: 1.5 }, voiceVolume: 0.8,
      texts: [{ t: 'Hi', x: 0.5, y: 0.3, color: '#ffffff', style: 'neon', size: 30, from: 1, to: 3 }], voice: '/uploads/not-mine.webm' };
    const s = (await spark(a, edit).attach('voice', webm, { filename: 'voice.webm', contentType: 'audio/webm' }).expect(201)).body.spark;
    const e = s.details.edit;
    assert.deepEqual(e.adjust, { b: 0.2, w: -0.3 });
    assert.equal(e.zoom.s, 1.5); assert.equal(e.fade.out, 1.5); assert.equal(e.texts[0].from, 1);
    assert.ok(e.voice && e.voice !== '/uploads/not-mine.webm'); // set by the server from the upload only
    await spark(a, { zoom: { s: 5, x: 0.5, y: 0.5 } }).expect(400);
  });
});

describe('Spread around', () => {
  test('owner spreads a Spark (test payment); it shows in others\' feed with spread:true', async () => {
    const a = await makeUser(); const b = await makeUser();
    const s = (await spark(a).expect(201)).body.spark;
    const plans = (await api().get('/sparks/spread/plans').set(a.h).expect(200)).body;
    assert.deepEqual(plans.plans.map((p) => p.priceInr), [49, 129, 249]);
    await api().post(`/sparks/${s.id}/spread`).set(b.h).send({ days: 3 }).expect(404); // not yours
    await api().post(`/sparks/${s.id}/spread`).set(a.h).send({ days: 2 }).expect(400);
    const sp = (await api().post(`/sparks/${s.id}/spread`).set(a.h).send({ days: 3, city: 'all', ageMin: 18, ageMax: 60 }).expect(201)).body.spread;
    assert.equal(sp.test, true); assert.equal(sp.days, 3); assert.equal(sp.priceInr, 129);
    await api().post(`/sparks/${s.id}/spread`).set(a.h).send({ days: 1 }).expect(400); // already spreading
    const feed = (await api().get('/sparks').set(b.h).expect(200)).body.sparks;
    assert.ok(feed.some((x) => x.id === s.id && x.spread === true));
    const mine = (await api().get('/sparks').set(a.h).expect(200)).body.sparks;
    assert.ok(!mine.some((x) => x.spread)); // you don't see your own as spread
    const st = (await api().get(`/sparks/${s.id}/spread`).set(a.h).expect(200)).body;
    assert.ok(st.spread.impressions >= 1);
    await api().post(`/sparks/${s.id}/spread/stop`).set(a.h).expect(200);
    assert.equal((await api().get(`/sparks/${s.id}/spread`).set(a.h).expect(200)).body.spread, null);
  });
});

describe('Ads', () => {
  test('only admins create ads; everyone gets live ones; seen / click are counted', async () => {
    const admin = await makeUser({ username: 'adminads1' }); const u = await makeUser();
    process.env.ADMIN_USERNAMES = 'adminads1';
    await api().post('/ads').set(u.h).field('placement', 'feed').field('brand', 'X').field('headline', 'Y').expect(403);
    const ad = (await api().post('/ads').set(admin.h).field('placement', 'feed').field('brand', 'Chai Point').field('headline', '2 chais for 99')
      .field('ctaLabel', 'Order').field('ctaUrl', 'https://example.com').field('days', '7').expect(201)).body.ad;
    await api().post('/ads').set(admin.h).field('placement', 'argue').field('brand', 'B').field('headline', 'h').expect(400); // needs a topic
    const got = (await api().get('/ads?placement=feed').set(u.h).expect(200)).body.ads;
    assert.ok(got.some((x) => x.id === ad.id)); assert.equal(got[0].impressions, undefined); // no stats for viewers
    await api().post(`/ads/${ad.id}/seen`).set(u.h).expect(200);
    await api().post(`/ads/${ad.id}/click`).set(u.h).expect(200);
    const m = (await api().get('/ads/manage').set(admin.h).expect(200)).body.ads.find((x) => x.id === ad.id);
    assert.equal(m.impressions, 1); assert.equal(m.clicks, 1);
    await api().patch(`/ads/${ad.id}`).set(admin.h).send({ active: false }).expect(200);
    assert.ok(!(await api().get('/ads?placement=feed').set(u.h).expect(200)).body.ads.some((x) => x.id === ad.id));
    const me = (await api().get('/users/me').set(admin.h).expect(200)).body.user;
    assert.equal(me.isAdmin, true);
  });
});

describe('Spark comments, offense marks and shares', () => {
  test('comment, reply, 👌🏻 a comment, mark a Spark, share it in a chat', async () => {
    const a = await makeUser(); const b = await makeUser();
    const s = (await spark(a).expect(201)).body.spark;
    const c = (await api().post(`/sparks/${s.id}/comments`).set(b.h).send({ body: 'Brilliant!' }).expect(201)).body.comment;
    const r = (await api().post(`/sparks/${s.id}/comments`).set(a.h).send({ body: 'Thank you', parentId: c.id }).expect(201)).body.comment;
    assert.equal(r.parentId, c.id);
    assert.deepEqual((await api().post(`/sparks/${s.id}/comments/${c.id}/like`).set(a.h).expect(200)).body, { liked: true, likeCount: 1 });
    await api().post(`/sparks/${s.id}/comments/${c.id}/offense`).set(b.h).send({ reason: 'spam' }).expect(400); // own comment
    const list = (await api().get(`/sparks/${s.id}/comments`).set(b.h).expect(200)).body.comments;
    assert.equal(list.length, 2);
    await api().post(`/sparks/${s.id}/offense`).set(a.h).send({}).expect(400); // own Spark
    const o = (await api().post(`/sparks/${s.id}/offense`).set(b.h).send({ reason: 'spam' }).expect(200)).body;
    assert.equal(o.offended, true); assert.equal(o.offenseCount, 1);
    const one = (await api().get(`/sparks/${s.id}`).set(b.h).expect(200)).body.spark;
    assert.equal(one.commentCount, 2); assert.equal(one.offended, true); assert.equal(one.offenseReason, 'spam');
    const sh = (await api().post(`/sparks/${s.id}/share`).set(b.h).send({}).expect(200)).body;
    assert.equal(sh.shareCount, 1);
    const st = (await api().get(`/sparks/${s.id}/offenses`).set(a.h).expect(200)).body;
    assert.equal(st.total, 1);
    await api().delete(`/sparks/${s.id}/comments/${c.id}`).set(a.h).expect(200); // the owner can remove comments
    assert.equal((await api().get(`/sparks/${s.id}/comments`).set(b.h).expect(200)).body.comments.length, 0);
  });
});
