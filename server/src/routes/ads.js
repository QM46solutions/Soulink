// Ads, run by the Soulink team (admins). No tracking: an ad is matched only on where it shows and the viewer's city.
//  GET    /ads?placement=feed|sparks|argue&n=3  live ads for me
//  POST   /ads/:id/seen | /ads/:id/click        counts (impressions, clicks)
//  Admin: GET /ads/manage · POST /ads (multipart: media?, logo?, fields) · PATCH /ads/:id · DELETE /ads/:id
import { Router } from 'express';
import { z } from 'zod';
import { many, one, query } from '../db.js';
import { ah, badRequest, forbidden, notFound } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadMemory, saveFile } from '../providers/storage.js';
import { isAdmin } from '../lib/payments.js';

const r = Router();
r.use(requireAuth);
const uuid = z.string().regex(/^[0-9a-fA-F-]{36}$/, 'Invalid id');
const PLACEMENTS = ['feed', 'sparks', 'argue'];

export const adView = (a, admin = false) => ({
  id: a.id, placement: a.placement, brand: a.brand, logoUrl: a.logo_url || null, headline: a.headline, body: a.body || null,
  mediaUrl: a.media_url || null, mediaKind: a.media_kind || null, ctaLabel: a.cta_label || null, ctaUrl: a.cta_url || null,
  argueTopic: a.argue_topic || null,
  ...(admin ? { city: a.city || null, startsAt: a.starts_at, endsAt: a.ends_at, active: a.active === true || a.active === 1, impressions: a.impressions, clicks: a.clicks } : {}),
});

r.get('/', ah(async (req, res) => {
  const { placement, n } = z.object({ placement: z.enum(PLACEMENTS), n: z.coerce.number().int().min(1).max(10).default(3) }).parse(req.query);
  const rows = await many(
    `SELECT TOP ${n} * FROM ad_campaigns WHERE placement=$1 AND active=1 AND starts_at <= SYSDATETIMEOFFSET() AND ends_at > SYSDATETIMEOFFSET()
       AND (city IS NULL OR LTRIM(RTRIM(city)) = N'' OR LOWER(LTRIM(RTRIM(city))) = LOWER(LTRIM(RTRIM($2)))) ORDER BY NEWID()`, [placement, req.user.city || ''],
  );
  res.json({ ads: rows.map((a) => adView(a)) });
}));
r.post('/:id/seen', ah(async (req, res) => { await query('UPDATE ad_campaigns SET impressions = impressions + 1 WHERE id=$1', [uuid.parse(req.params.id)]); res.json({ ok: true }); }));
r.post('/:id/click', ah(async (req, res) => { await query('UPDATE ad_campaigns SET clicks = clicks + 1 WHERE id=$1', [uuid.parse(req.params.id)]); res.json({ ok: true }); }));

// ---------- admin ----------
const admin = (req, res, next) => (isAdmin(req.user) ? next() : next(forbidden('Only the Soulink team can manage ads', 'not_admin')));
r.get('/manage', admin, ah(async (req, res) => {
  const rows = await many('SELECT TOP 200 * FROM ad_campaigns ORDER BY created_at DESC', []);
  res.json({ ads: rows.map((a) => adView(a, true)) });
}));
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
  }).parse(req.body || {});
  if (d.placement === 'argue' && !d.argueTopic) throw badRequest('Add the argue topic for a sponsored Argue');
  const media = req.files?.media?.[0]; const logo = req.files?.logo?.[0];
  const mediaUrl = media ? await saveFile(media, 'ads', 'post') : null;
  const logoUrl = logo ? await saveFile(logo, 'ads', 'post') : null;
  const a = await one(
    `INSERT INTO ad_campaigns (placement, brand, logo_url, headline, body, media_url, media_kind, cta_label, cta_url, argue_topic, city, ends_at, created_by)
     OUTPUT INSERTED.* VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, DATEADD(day, $12, SYSDATETIMEOFFSET()), $13)`,
    [d.placement, d.brand, logoUrl, d.headline, d.body || null, mediaUrl, media ? (media.mimetype.startsWith('video/') ? 'video' : 'image') : null,
      d.ctaLabel || null, d.ctaUrl || null, d.argueTopic || null, d.city || null, d.days, req.user.id],
  );
  res.status(201).json({ ad: adView(a, true) });
}));
r.patch('/:id', admin, ah(async (req, res) => {
  const id = uuid.parse(req.params.id);
  const d = z.object({ active: z.boolean().optional(), days: z.number().int().min(1).max(90).optional() }).parse(req.body || {});
  if (d.active !== undefined) await query('UPDATE ad_campaigns SET active=$2 WHERE id=$1', [id, d.active ? 1 : 0]);
  if (d.days) await query('UPDATE ad_campaigns SET ends_at=DATEADD(day, $2, SYSDATETIMEOFFSET()) WHERE id=$1', [id, d.days]);
  const a = await one('SELECT * FROM ad_campaigns WHERE id=$1', [id]);
  if (!a) throw notFound('Ad not found');
  res.json({ ad: adView(a, true) });
}));
r.delete('/:id', admin, ah(async (req, res) => {
  await query('DELETE FROM ad_campaigns WHERE id=$1', [uuid.parse(req.params.id)]);
  res.json({ ok: true });
}));

export default r;
