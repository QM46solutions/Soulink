// Ads, run by the Soulink team (admins) for paying customers. No tracking: an ad is matched only on where it shows
// and the viewer's city. Each ad can have a customer (owner), a budget and a price per 1,000 views: it stops showing
// when the budget is used up. The customer sees their own dashboard.
//  GET    /ads?placement=feed|sparks|argue&n=3  live ads for me
//  POST   /ads/:id/seen | /ads/:id/click        counts (views, people reached, clicks, day by day)
//  GET    /ads/mine                              my ads dashboard (customer): spent, left, paid, views, advice, my Spark boosts
//  Admin: GET /ads/manage (all ads + revenue) · POST /ads (multipart) · PATCH /ads/:id · DELETE /ads/:id
import { Router } from 'express';
import { z } from 'zod';
import { many, one, query } from '../db.js';
import { ah, badRequest, forbidden, notFound } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadMemory, saveFile } from '../providers/storage.js';
import { isAdmin } from '../lib/payments.js';
import { audit } from '../services/audit.js';
import { userCard } from '../services/social.js';
import { adStats, adTips, dailySeries, placementTip, spentPaise } from '../services/adStats.js';

const r = Router();
r.use(requireAuth);
const uuid = z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid id');
const PLACEMENTS = ['feed', 'sparks', 'argue'];

export const adView = (a, admin = false) => ({
  id: a.id, placement: a.placement, brand: a.brand, logoUrl: a.logo_url || null, headline: a.headline, body: a.body || null,
  mediaUrl: a.media_url || null, mediaKind: a.media_kind || null, ctaLabel: a.cta_label || null, ctaUrl: a.cta_url || null,
  argueTopic: a.argue_topic || null,
  ...(admin ? {
    city: a.city || null, startsAt: a.starts_at, endsAt: a.ends_at, active: a.active === true || a.active === 1, impressions: a.impressions, clicks: a.clicks,
    owner: a.o_username ? userCard({ id: a.owner_id, username: a.o_username, display_name: a.o_display_name, avatar_url: a.o_avatar_url }) : null,
    stats: adStats(a),
  } : {}),
});
const WITH_OWNER = `SELECT a.*, o.username AS o_username, o.display_name AS o_display_name, o.avatar_url AS o_avatar_url
  FROM ad_campaigns a LEFT JOIN users o ON o.id = a.owner_id`;
// "today" in India
const TODAY = "CAST(SWITCHOFFSET(SYSDATETIMEOFFSET(), '+05:30') AS DATE)";
async function dailyFor(ids, days = 30) {
  if (!ids.length) return [];
  return many(`SELECT ad_id, day, impressions, clicks FROM ad_daily WHERE day > DATEADD(day, -${days}, ${TODAY}) AND ad_id IN (${ids.map((_, i) => `$${i + 1}`).join(',')})`, ids);
}
const rupees = (p) => Math.round(p / 100);

r.get('/', ah(async (req, res) => {
  const { placement, n } = z.object({ placement: z.enum(PLACEMENTS), n: z.coerce.number().int().min(1).max(10).default(3) }).parse(req.query);
  const rows = await many(
    `SELECT TOP ${n} * FROM ad_campaigns WHERE placement=$1 AND active=1 AND starts_at <= SYSDATETIMEOFFSET() AND ends_at > SYSDATETIMEOFFSET()
       AND (city IS NULL OR LTRIM(RTRIM(city)) = N'' OR LOWER(LTRIM(RTRIM(city))) = LOWER(LTRIM(RTRIM($2))))
       AND (budget_paise IS NULL OR cpm_paise IS NULL OR CAST(impressions AS BIGINT) * cpm_paise / 1000 < budget_paise) -- budget used up: stops
     ORDER BY NEWID()`, [placement, req.user.city || ''],
  );
  res.json({ ads: rows.map((a) => adView(a)) });
}));
const bumpDay = (id, col) => query(`MERGE ad_daily AS t USING (SELECT $1 AS ad_id, ${TODAY} AS day) AS s ON t.ad_id = s.ad_id AND t.day = s.day
  WHEN MATCHED THEN UPDATE SET ${col} = t.${col} + 1
  WHEN NOT MATCHED THEN INSERT (ad_id, day, ${col}) VALUES (s.ad_id, s.day, 1);`, [id]);
r.post('/:id/seen', ah(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const ad = await one('UPDATE ad_campaigns SET impressions = impressions + 1 OUTPUT INSERTED.id WHERE id=$1', [id]);
  if (ad) {
    await bumpDay(id, 'impressions').catch(() => {});
    // people reached: the first time this person sees this ad
    const first = await one(`IF NOT EXISTS (SELECT 1 FROM ad_viewers WHERE ad_id=$1 AND user_id=$2)
      BEGIN INSERT INTO ad_viewers (ad_id, user_id) VALUES ($1, $2); SELECT 1 AS n; END ELSE SELECT 0 AS n`, [id, req.user.id]).catch(() => null);
    if (first?.n) await query('UPDATE ad_campaigns SET reach = reach + 1 WHERE id=$1', [id]);
  }
  res.json({ ok: true });
}));
r.post('/:id/click', ah(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const ad = await one('UPDATE ad_campaigns SET clicks = clicks + 1 OUTPUT INSERTED.id WHERE id=$1', [id]);
  if (ad) await bumpDay(id, 'clicks').catch(() => {});
  res.json({ ok: true });
}));

// ---------- the customer's own dashboard ----------
// does this person have any ads or Spark boosts? (shows "My ads" in Settings)
r.get('/has', ah(async (req, res) => {
  const a = await one('SELECT TOP 1 1 AS x FROM ad_campaigns WHERE owner_id=$1', [req.user.id]);
  const b = a ? null : await one("SELECT TOP 1 1 AS x FROM spark_spreads WHERE user_id=$1 AND status <> N'test'", [req.user.id]).catch(() => null);
  res.json({ has: !!(a || b) });
}));
r.get('/mine', ah(async (req, res) => {
  const rows = await many(`${WITH_OWNER} WHERE a.owner_id = $1 ORDER BY a.created_at DESC`, [req.user.id]);
  const daily = await dailyFor(rows.map((a) => a.id));
  const ads = rows.map((a) => ({ ...adView(a, true), daily: dailySeries(daily.filter((d) => String(d.ad_id).toLowerCase() === String(a.id).toLowerCase())) }));
  const sum = (f) => rows.reduce((t, a) => t + f(a), 0);
  const billed = rows.filter((a) => a.budget_paise != null && a.cpm_paise != null);
  const spent = sum(spentPaise); const paid = sum((a) => a.paid_paise || 0);
  const views = sum((a) => Number(a.impressions || 0)); const clicks = sum((a) => Number(a.clicks || 0));
  const tips = [...rows.flatMap((a) => adTips(a, adStats(a))), placementTip(rows)].filter(Boolean);
  // their own paid Spark boosts ("Spread around")
  const boosts = await many(`SELECT TOP 50 sp.*, s.caption FROM spark_spreads sp JOIN sparks s ON s.id = sp.spark_id
    WHERE sp.user_id=$1 AND sp.status <> N'test' ORDER BY sp.created_at DESC`, [req.user.id]).catch(() => []);
  res.json({
    totals: {
      ads: rows.length, running: ads.filter((a) => a.stats.status === 'running').length,
      budget: rupees(billed.reduce((t, a) => t + a.budget_paise, 0)), spent: rupees(spent),
      left: rupees(billed.reduce((t, a) => t + Math.max(0, a.budget_paise - spentPaise(a)), 0)),
      paid: rupees(paid), balance: rupees(paid - spent),
      views, reach: sum((a) => Number(a.reach || 0)), clicks, ctr: views ? Math.round((clicks / views) * 1000) / 10 : 0,
      boosts: rupees(boosts.reduce((t, b) => t + (b.amount_paise || 0), 0)),
    },
    daily: dailySeries(daily),
    tips,
    ads,
    boosts: boosts.map((b) => ({ id: b.id, sparkId: b.spark_id, caption: b.caption || '', city: b.city || null, ageMin: b.age_min, ageMax: b.age_max, days: b.days,
      amount: rupees(b.amount_paise || 0), views: Number(b.impressions || 0), startsAt: b.starts_at, endsAt: b.ends_at, status: b.status })),
  });
}));

// ---------- admin ----------
// every admin request is written to the audit trail (policy section 4)
const admin = (req, res, next) => {
  if (!isAdmin(req.user)) return next(forbidden('Only the Soulink team can manage ads', 'not_admin'));
  audit(req, 'admin_ads', { detail: `${req.method} ${req.originalUrl}`.slice(0, 200) }).catch(() => {});
  return next();
};
r.get('/manage', admin, ah(async (req, res) => {
  const rows = await many(`SELECT TOP 200 a.*, o.username AS o_username, o.display_name AS o_display_name, o.avatar_url AS o_avatar_url
    FROM ad_campaigns a LEFT JOIN users o ON o.id = a.owner_id ORDER BY a.created_at DESC`, []);
  const daily = await dailyFor(rows.map((a) => a.id));
  const sum = (f) => rows.reduce((t, a) => t + f(a), 0);
  const spent = sum(spentPaise); const paid = sum((a) => a.paid_paise || 0);
  const boosts = await one("SELECT COUNT(*) AS n, ISNULL(SUM(amount_paise), 0) AS p FROM spark_spreads WHERE status <> N'test'", []).catch(() => ({ n: 0, p: 0 }));
  res.json({
    revenue: {
      booked: rupees(sum((a) => a.budget_paise || 0)), earned: rupees(spent), received: rupees(paid),
      toCollect: rupees(sum((a) => Math.max(0, spentPaise(a) - (a.paid_paise || 0)))),
      boosts: rupees(Number(boosts?.p || 0)), boostCount: Number(boosts?.n || 0),
      views: sum((a) => Number(a.impressions || 0)), clicks: sum((a) => Number(a.clicks || 0)),
    },
    daily: dailySeries(daily),
    ads: rows.map((a) => adView(a, true)),
  });
}));
const money = z.coerce.number().min(0).max(10000000);
async function ownerOf(username) {
  if (username === undefined) return undefined;
  if (!username) return null;
  const u = await one('SELECT id FROM users WHERE username=$1 AND deactivated_at IS NULL', [username.replace(/^@/, '').trim().toLowerCase()]);
  if (!u) throw badRequest(`No Soulink account @${username.replace(/^@/, '')}`, 'no_owner');
  return u.id;
}
r.post('/', admin, uploadMemory('post', 40, 2).fields([{ name: 'media', maxCount: 1 }, { name: 'logo', maxCount: 1 }]), ah(async (req, res) => {
  const d = z.object({
    placement: z.enum(PLACEMENTS),
    brand: z.string().trim().min(1).max(80),
    headline: z.string().trim().min(1).max(120),
    body: z.string().trim().max(400).optional(),
    ctaLabel: z.string().trim().max(30).optional(),
    ctaUrl: z.string().trim().url().max(400).refine((u) => /^https?:\/\//.test(u), 'Use a web link').optional().or(z.literal('')),
    argueTopic: z.string().trim().max(150).optional(),
    city: z.string().trim().max(60).optional(),
    days: z.coerce.number().int().min(1).max(90).default(7),
    owner: z.string().trim().max(40).optional(),   // the customer's Soulink username (they get the dashboard)
    budgetInr: money.optional(),                   // their budget, ₹
    cpmInr: money.optional(),                      // price per 1,000 views, ₹
    paidInr: money.optional(),                     // what they have paid so far, ₹
  }).parse(req.body || {});
  if ((d.budgetInr != null) !== (d.cpmInr != null)) throw badRequest('Set both the budget and the price per 1,000 views (or neither)');
  const ownerId = await ownerOf(d.owner || '');
  if (d.placement === 'argue' && !d.argueTopic) throw badRequest('Add the argue topic for a sponsored Argue');
  const media = req.files?.media?.[0]; const logo = req.files?.logo?.[0];
  const mediaUrl = media ? await saveFile(media, 'ads', 'post') : null;
  const logoUrl = logo ? await saveFile(logo, 'ads', 'post') : null;
  const a = await one(
    `INSERT INTO ad_campaigns (placement, brand, logo_url, headline, body, media_url, media_kind, cta_label, cta_url, argue_topic, city, ends_at, created_by,
       owner_id, budget_paise, cpm_paise, paid_paise)
     OUTPUT INSERTED.id VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, DATEADD(day, $12, SYSDATETIMEOFFSET()), $13, $14, $15, $16, $17)`,
    [d.placement, d.brand, logoUrl, d.headline, d.body || null, mediaUrl, media ? (media.mimetype.startsWith('video/') ? 'video' : 'image') : null,
      d.ctaLabel || null, d.ctaUrl || null, d.argueTopic || null, d.city || null, d.days, req.user.id,
      ownerId, d.budgetInr != null ? Math.round(d.budgetInr * 100) : null, d.cpmInr != null ? Math.round(d.cpmInr * 100) : null, Math.round((d.paidInr || 0) * 100)],
  );
  res.status(201).json({ ad: adView(await one(`${WITH_OWNER} WHERE a.id=$1`, [a.id]), true) });
}));
r.patch('/:id', admin, ah(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const d = z.object({
    active: z.boolean().optional(), days: z.number().int().min(1).max(90).optional(),
    addBudgetInr: money.optional(),   // top up the budget
    addPaidInr: money.optional(),     // a payment received
    cpmInr: money.optional(),         // change the price per 1,000 views
    owner: z.string().trim().max(40).optional(),
  }).parse(req.body || {});
  if (d.active !== undefined) await query('UPDATE ad_campaigns SET active=$2 WHERE id=$1', [id, d.active ? 1 : 0]);
  if (d.days) await query('UPDATE ad_campaigns SET ends_at=DATEADD(day, $2, CASE WHEN ends_at > SYSDATETIMEOFFSET() THEN ends_at ELSE SYSDATETIMEOFFSET() END) WHERE id=$1', [id, d.days]);
  if (d.addBudgetInr) await query('UPDATE ad_campaigns SET budget_paise = ISNULL(budget_paise, 0) + $2 WHERE id=$1', [id, Math.round(d.addBudgetInr * 100)]);
  if (d.addPaidInr) await query('UPDATE ad_campaigns SET paid_paise = paid_paise + $2 WHERE id=$1', [id, Math.round(d.addPaidInr * 100)]);
  if (d.cpmInr != null) await query('UPDATE ad_campaigns SET cpm_paise=$2 WHERE id=$1', [id, Math.round(d.cpmInr * 100)]);
  if (d.owner !== undefined) await query('UPDATE ad_campaigns SET owner_id=$2 WHERE id=$1', [id, await ownerOf(d.owner)]);
  const a = await one(`${WITH_OWNER} WHERE a.id=$1`, [id]);
  if (!a) throw notFound('Ad not found');
  res.json({ ad: adView(a, true) });
}));
r.delete('/:id', admin, ah(async (req, res) => {
  await query('DELETE FROM ad_campaigns WHERE id=$1', [uuid.parse(req.params.id)]);
  res.json({ ok: true });
}));

export default r;
