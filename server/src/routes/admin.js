// Soulink team only (ADMIN_USERNAMES). Every call is written to the audit trail.
//  POST /admin/users/:username/ban  { reason, days? }  ban a repeat offender: their account is erased and their name,
//                                                     contact and encrypted face fingerprint are kept (3 years default)
//                                                     so they cannot create a new profile
//  GET  /admin/bans                                   active bans
//  POST /admin/bans/:id/lift          { reason }      lift a ban (appeal accepted); the face fingerprint is erased
import { Router } from 'express';
import { z } from 'zod';
import { many, one, query } from '../db.js';
import { ah, forbidden, notFound } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { isAdmin } from '../lib/payments.js';
import { audit } from '../services/audit.js';
import { banAccount, BAN_DAYS } from '../services/lifecycle.js';

const r = Router();
r.use(requireAuth, (req, res, next) => {
  if (!isAdmin(req.user)) return next(forbidden('Only the Soulink team can do this', 'not_admin'));
  audit(req, 'admin', { detail: `${req.method} ${req.originalUrl}`.slice(0, 200) }).catch(() => {});
  return next();
});

r.post('/users/:username/ban', ah(async (req, res) => {
  const { reason, days } = z.object({ reason: z.string().trim().min(10).max(500), days: z.number().int().min(30).max(BAN_DAYS * 2).optional() }).parse(req.body || {});
  const u = await one('SELECT * FROM users WHERE username=$1', [req.params.username]);
  if (!u) throw notFound('No such account');
  if (u.id === req.user.id) throw forbidden("You can't ban yourself");
  await banAccount(u, { reason, days: days || BAN_DAYS }, req);
  res.json({ ok: true, banned: u.username });
}));

r.get('/bans', ah(async (req, res) => {
  const rows = await many(`SELECT id, username, display_name, phone, email, reason, banned_at, expires_at, CASE WHEN face_embedding IS NULL THEN 0 ELSE 1 END AS has_face
    FROM banned_identities WHERE lifted_at IS NULL AND expires_at > SYSDATETIMEOFFSET() ORDER BY banned_at DESC`);
  res.json({ bans: rows.map((b) => ({ id: b.id, username: b.username, name: b.display_name, phone: b.phone, email: b.email, reason: b.reason, bannedAt: b.banned_at, expiresAt: b.expires_at, face: !!b.has_face })) });
}));

r.post('/bans/:id/lift', ah(async (req, res) => {
  const { reason } = z.object({ reason: z.string().trim().min(10).max(500) }).parse(req.body || {});
  await query('UPDATE banned_identities SET lifted_at=SYSDATETIMEOFFSET(), face_embedding=NULL WHERE id=$1 AND lifted_at IS NULL', [req.params.id]);
  await audit(req, 'ban_lifted', { detail: `${req.params.id}: ${reason}` });
  res.json({ ok: true });
}));

export default r;
