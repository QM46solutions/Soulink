// Paid ads: the team runs an ad for a customer with a budget and a price per 1,000 views. Spent / left / paid,
// people reached, day by day, advice; the ad stops when the budget is used up; the customer sees only their own.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { api, resetDb, makeUser, closePool, query } from './helpers.js';
import { adStats, adTips, dailySeries } from '../src/services/adStats.js';

before(resetDb);
after(() => closePool());

describe('Ads dashboard', () => {
  test('budget, spent, left, reach, stop at budget, customer dashboard and team revenue', async () => {
    const admin = await makeUser({ username: 'adminads2' });
    const brand = await makeUser({ username: 'chaibrand' });
    const viewer = await makeUser(); const viewer2 = await makeUser(); const other = await makeUser();
    process.env.ADMIN_USERNAMES = 'adminads2';
    const ad = (await api().post('/ads').set(admin.h).field('placement', 'feed').field('brand', 'Chai Point').field('headline', '2 chais for 99')
      .field('owner', '@chaibrand').field('budgetInr', '10').field('cpmInr', '1000').field('paidInr', '5').expect(201)).body.ad;
    assert.equal(ad.owner.username, 'chaibrand');
    assert.equal(ad.stats.budget, 10); assert.equal(ad.stats.left, 10);
    await api().post('/ads').set(admin.h).field('placement', 'feed').field('brand', 'X').field('headline', 'Y').field('budgetInr', '10').expect(400); // price missing
    await api().post('/ads').set(admin.h).field('placement', 'feed').field('brand', 'X').field('headline', 'Y').field('owner', 'nobody_here').expect(400);

    // 5 views (2 people) and a tap: ₹1 per view at ₹1,000 per 1,000 views
    for (const v of [viewer, viewer, viewer, viewer2, viewer2]) await api().post(`/ads/${ad.id}/seen`).set(v.h).expect(200);
    await api().post(`/ads/${ad.id}/click`).set(viewer.h).expect(200);
    const mine = (await api().get('/ads/mine').set(brand.h).expect(200)).body;
    assert.equal(mine.ads.length, 1);
    assert.equal(mine.totals.views, 5); assert.equal(mine.totals.reach, 2); assert.equal(mine.totals.clicks, 1);
    assert.equal(mine.totals.spent, 5); assert.equal(mine.totals.left, 5); assert.equal(mine.totals.paid, 5); assert.equal(mine.totals.balance, 0);
    assert.equal(mine.daily.length, 30); assert.equal(mine.daily[29].views, 5);
    assert.equal((await api().get('/ads/has').set(brand.h).expect(200)).body.has, true);
    // someone else sees nothing
    assert.equal((await api().get('/ads/mine').set(other.h).expect(200)).body.ads.length, 0);
    assert.equal((await api().get('/ads/has').set(other.h).expect(200)).body.has, false);

    // budget used up → stops showing, advice to top up
    for (let i = 0; i < 5; i += 1) await api().post(`/ads/${ad.id}/seen`).set(viewer.h).expect(200);
    assert.ok(!(await api().get('/ads?placement=feed').set(viewer.h).expect(200)).body.ads.some((x) => x.id === ad.id));
    const used = (await api().get('/ads/mine').set(brand.h).expect(200)).body;
    assert.equal(used.ads[0].stats.status, 'budget_used');
    assert.ok(used.tips.some((t) => t.kind === 'topup'));
    assert.ok(used.tips.some((t) => t.kind === 'payment')); // spent ₹10, paid ₹5
    // the team tops it up and records a payment → it shows again
    await api().patch(`/ads/${ad.id}`).set(admin.h).send({ addBudgetInr: 20, addPaidInr: 5 }).expect(200);
    assert.ok((await api().get('/ads?placement=feed').set(viewer.h).expect(200)).body.ads.some((x) => x.id === ad.id));
    const rev = (await api().get('/ads/manage').set(admin.h).expect(200)).body.revenue;
    assert.equal(rev.earned, 10); assert.equal(rev.received, 10); assert.equal(rev.booked, 30);
    await query('DELETE FROM ad_campaigns WHERE id=$1', [ad.id]);
  });

  test('advice: running out before the end date; too few taps', () => {
    const now = Date.now();
    const a = { id: 'x', headline: 'Sale', active: 1, starts_at: new Date(now - 2 * 86400000), ends_at: new Date(now + 10 * 86400000),
      budget_paise: 100000, cpm_paise: 10000, paid_paise: 100000, impressions: 6000, clicks: 6, reach: 3000 };
    const st = adStats(a, now);
    assert.equal(st.spent, 600); assert.equal(st.left, 400); assert.equal(st.budgetLastsDays, 1);
    const tips = adTips(a, st, now);
    assert.ok(tips.some((t) => t.kind === 'topup' && t.amount >= 2000));
    assert.ok(tips.some((t) => t.kind === 'creative'));
    assert.equal(dailySeries([], 7, now).length, 7);
  });
});
