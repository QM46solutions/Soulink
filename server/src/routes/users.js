import { Router } from 'express';
import { z } from 'zod';
import { one, many, query, tx } from '../db.js';
import { config } from '../config.js';
import { ah, badRequest, notFound, forbidden } from '../lib/errors.js';
import { ageFrom } from '../lib/auth.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadMemory, saveFile } from '../providers/storage.js';
import {
  canViewContent, counts, isBlockedEither, meView, notify, publicProfile, relationship, userCard,
} from '../services/social.js';

const r = Router();
r.use(requireAuth);

const USERNAME = z.string().trim().toLowerCase().regex(/^[a-z0-9._]{3,30}$/, '3–30 characters: letters, numbers, dot, underscore');
const RESERVED = new Set(['admin', 'soulink', 'support', 'help', 'me', 'settings', 'api', 'root']);

const profileSchema = z.object({
  username: USERNAME.optional(),
  displayName: z.string().trim().min(1).max(50).optional(),
  bio: z.string().max(300).optional(),
  city: z.string().trim().max(60).nullable().optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(),
  gender: z.enum(['male', 'female', 'non_binary', 'prefer_not']).nullable().optional(),
  interests: z.array(z.string().trim().min(1).max(30)).max(15).optional(),
  isPrivate: z.boolean().optional(),
  showInDiscover: z.boolean().optional(),
  faceDiscoverable: z.boolean().optional(),
  consentTracking: z.boolean().optional(),
}).strict();

const COLS = {
  username: 'username', displayName: 'display_name', bio: 'bio', city: 'city', birthDate: 'birth_date',
  gender: 'gender', interests: 'interests', isPrivate: 'is_private', showInDiscover: 'show_in_discover',
  faceDiscoverable: 'face_discoverable', consentTracking: 'consent_tracking',
};

async function assertUsernameFree(username, myId) {
  if (RESERVED.has(username)) throw badRequest('That username is not available', 'username_taken');
  const taken = await one('SELECT id FROM users WHERE username=$1 AND id<>$2', [username, myId]);
  if (taken) throw badRequest('That username is taken', 'username_taken');
}

// ---------- my account ----------

r.get('/me', ah(async (req, res) => {
  res.json({ user: meView(req.user), counts: await counts(req.user.id) });
}));

r.patch('/me', ah(async (req, res) => {
  const data = profileSchema.parse(req.body);
  if (data.username) await assertUsernameFree(data.username, req.user.id);
  if (data.birthDate && ageFrom(data.birthDate) < config.minAge) throw badRequest(`You must be ${config.minAge} or older to use Soulink`, 'underage');
  if (data.faceDiscoverable && !req.user.face_verified) throw badRequest('Verify your face first to be discoverable by face', 'face_not_verified');

  const entries = Object.entries(data);
  if (!entries.length) return res.json({ user: meView(req.user) });

  const user = await tx(async (c) => {
    const sets = entries.map(([k], i) => `${COLS[k]} = $${i + 2}`).join(', ');
    const u = (await c.query(`UPDATE users SET ${sets}, updated_at = SYSDATETIMEOFFSET() OUTPUT INSERTED.* WHERE id = $1`, [req.user.id, ...entries.map(([, v]) => v)])).rows[0];
    // Going public auto-approves pending follow requests (Instagram behaviour)
    if (data.isPrivate === false && req.user.is_private) {
      await c.query(`UPDATE follows SET status=N'accepted' WHERE followee_id=$1 AND status=N'pending'`, [req.user.id]);
    }
    return u;
  });
  res.json({ user: meView(user) });
}));

// Finish sign-up: requires username, name and an 18+ birth date
r.post('/me/complete-onboarding', ah(async (req, res) => {
  const data = profileSchema.extend({
    username: USERNAME,
    displayName: z.string().trim().min(1).max(50),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  }).parse(req.body);
  if (config.faceRequired && !req.user.face_verified) throw badRequest('Complete the face scan first', 'face_required');
  await assertUsernameFree(data.username, req.user.id);
  if (ageFrom(data.birthDate) < config.minAge) throw badRequest(`You must be ${config.minAge} or older to use Soulink`, 'underage');
  const entries = Object.entries(data);
  const sets = entries.map(([k], i) => `${COLS[k]} = $${i + 2}`).join(', ');
  const user = await one(
    `UPDATE users SET ${sets}, onboarding_done = 1, updated_at = SYSDATETIMEOFFSET() OUTPUT INSERTED.* WHERE id=$1`,
    [req.user.id, ...entries.map(([, v]) => v)],
  );
  res.json({ user: meView(user) });
}));

r.post('/me/avatar', uploadMemory('image', 8).single('photo'), ah(async (req, res) => {
  const url = await saveFile(req.file, 'avatars');
  const user = await one('UPDATE users SET avatar_url=$2, updated_at=SYSDATETIMEOFFSET() OUTPUT INSERTED.* WHERE id=$1', [req.user.id, url]);
  res.json({ user: meView(user) });
}));

r.delete('/me/avatar', ah(async (req, res) => {
  const user = await one('UPDATE users SET avatar_url=NULL, updated_at=SYSDATETIMEOFFSET() OUTPUT INSERTED.* WHERE id=$1', [req.user.id]);
  res.json({ user: meView(user) });
}));

r.get('/username-available', ah(async (req, res) => {
  const parsed = USERNAME.safeParse(req.query.u ?? '');
  if (!parsed.success) return res.json({ available: false, reason: parsed.error.issues[0].message });
  const u = parsed.data;
  const taken = RESERVED.has(u) || !!(await one('SELECT TOP 1 1 AS x FROM users WHERE username=$1 AND id<>$2', [u, req.user.id]));
  res.json({ available: !taken, reason: taken ? 'That username is taken' : null });
}));

// ---------- follow requests addressed to me ----------

r.get('/me/follow-requests', ah(async (req, res) => {
  const rows = await many(
    `SELECT u.*, f.created_at AS requested_at FROM follows f JOIN users u ON u.id=f.follower_id
      WHERE f.followee_id=$1 AND f.status=N'pending' ORDER BY f.created_at DESC`,
    [req.user.id],
  );
  res.json({ requests: rows.map((u) => ({ user: userCard(u), requestedAt: u.requested_at })) });
}));

r.post('/me/follow-requests/:userId/accept', ah(async (req, res) => {
  const row = await one(
    `UPDATE follows SET status=N'accepted' OUTPUT INSERTED.follower_id WHERE follower_id=$1 AND followee_id=$2 AND status=N'pending'`,
    [String(req.params.userId).toLowerCase(), req.user.id],
  );
  if (!row) throw notFound('Request not found');
  await notify(String(req.params.userId).toLowerCase(), req.user.id, 'follow_accept');
  res.json({ ok: true });
}));

r.post('/me/follow-requests/:userId/decline', ah(async (req, res) => {
  const row = await one(
    `DELETE FROM follows OUTPUT DELETED.follower_id WHERE follower_id=$1 AND followee_id=$2 AND status=N'pending'`,
    [String(req.params.userId).toLowerCase(), req.user.id],
  );
  if (!row) throw notFound('Request not found');
  res.json({ ok: true });
}));

// ---------- other users ----------

async function loadTarget(req, by = 'id') {
  const val = by === 'id' ? String(req.params.id).toLowerCase() : String(req.params.username).toLowerCase();
  if (by === 'id' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(val)) throw notFound('User not found');
  const u = await one(`SELECT * FROM users WHERE ${by === 'id' ? 'id' : 'username'}=$1 AND onboarding_done = 1`, [val]);
  if (!u || (await isBlockedEither(req.user.id, u.id))) throw notFound('User not found');
  return u;
}

r.get('/u/:username', ah(async (req, res) => {
  const u = await loadTarget(req, 'username');
  const rel = await relationship(req.user.id, u.id);
  const canView = canViewContent(u, rel);
  res.json({ user: publicProfile(u), counts: await counts(u.id), relationship: rel, canViewContent: canView });
}));

async function listFollows(req, res, direction) {
  const u = await loadTarget(req);
  const rel = await relationship(req.user.id, u.id);
  if (!canViewContent(u, rel)) throw forbidden('This account is private', 'private_account');
  const [joinCol, whereCol] = direction === 'followers' ? ['follower_id', 'followee_id'] : ['followee_id', 'follower_id'];
  const rows = await many(
    `SELECT TOP 200 u.* FROM follows f JOIN users u ON u.id = f.${joinCol}
      WHERE f.${whereCol}=$1 AND f.status=N'accepted'
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$2 AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=$2))
      ORDER BY f.created_at DESC`,
    [u.id, req.user.id],
  );
  res.json({ users: rows.map(userCard) });
}
r.get('/:id/followers', ah((req, res) => listFollows(req, res, 'followers')));
r.get('/:id/following', ah((req, res) => listFollows(req, res, 'following')));

r.post('/:id/follow', ah(async (req, res) => {
  const u = await loadTarget(req);
  if (u.id === req.user.id) throw badRequest("You can't follow yourself");
  const existing = await one('SELECT status FROM follows WHERE follower_id=$1 AND followee_id=$2', [req.user.id, u.id]);
  if (existing) return res.json({ following: existing.status });
  const status = u.is_private ? 'pending' : 'accepted';
  try {
    await query('INSERT INTO follows (follower_id, followee_id, status) VALUES ($1, $2, $3)', [req.user.id, u.id, status]);
  } catch (e) {
    // A double tap can race; the first insert wins
    if (e?.number === 2627 || e?.originalError?.info?.number === 2627) {
      const again = await one('SELECT status FROM follows WHERE follower_id=$1 AND followee_id=$2', [req.user.id, u.id]);
      return res.json({ following: again?.status ?? status });
    }
    throw e;
  }
  await notify(u.id, req.user.id, status === 'pending' ? 'follow_request' : 'follow');
  res.json({ following: status });
}));

// Unfollow, or cancel a pending request
r.delete('/:id/follow', ah(async (req, res) => {
  const u = await loadTarget(req);
  await query('DELETE FROM follows WHERE follower_id=$1 AND followee_id=$2', [req.user.id, u.id]);
  res.json({ following: 'none' });
}));

// Remove someone who follows me
r.delete('/:id/follower', ah(async (req, res) => {
  const u = await loadTarget(req);
  await query('DELETE FROM follows WHERE follower_id=$1 AND followee_id=$2', [u.id, req.user.id]);
  res.json({ ok: true });
}));

export default r;
