import { Router } from 'express';
import { pulseFor, recordProfileView } from '../services/pulse.js';
import { prefsOf } from '../services/push.js';
import { z } from 'zod';
import { one, many, query, tx } from '../db.js';
import { config } from '../config.js';
import { ah, badRequest, notFound, forbidden } from '../lib/errors.js';
import { ageFrom } from '../lib/auth.js';
import { requireAuth, requireSoul } from '../middleware/auth.js';
import { headline } from '../services/soulStore.js';
import { uploadMemory, saveFile } from '../providers/storage.js';
import { placeCoords } from '../services/places.js';
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
  showPulse: z.boolean().optional(),
  notifyPrefs: z.record(z.enum(['messages', 'requests', 'likes', 'comments', 'anonymous', 'argue', 'events']), z.boolean()).optional(),
  college: z.string().trim().max(120).nullable().optional(),
  company: z.string().trim().max(120).nullable().optional(),
  languages: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  chatLanguage: z.enum(['en', 'hi', 'te', 'bn']).nullable().optional(),
}).strict();

const COLS = {
  username: 'username', displayName: 'display_name', bio: 'bio', city: 'city', birthDate: 'birth_date',
  gender: 'gender', interests: 'interests', isPrivate: 'is_private', showInDiscover: 'show_in_discover',
  faceDiscoverable: 'face_discoverable', consentTracking: 'consent_tracking', showPulse: 'show_pulse', notifyPrefs: 'notify_prefs',
  college: 'college', company: 'company', languages: 'languages', chatLanguage: 'chat_language',
};

// The typed city also gives area coordinates for the distance filter (used until the phone shares its location)
function withCityCoords(data, entries) {
  if (!('city' in data)) return entries;
  const c = placeCoords(data.city);
  return [...entries, ['__lat', c ? Math.round(c.lat * 100) / 100 : null], ['__lon', c ? Math.round(c.lon * 100) / 100 : null]];
}
COLS.__lat = 'lat'; COLS.__lon = 'lon';

async function assertUsernameFree(username, myId) {
  if (RESERVED.has(username)) throw badRequest('That username is not available', 'username_taken');
  const taken = await one('SELECT id FROM users WHERE username=$1 AND id<>$2', [username, myId]);
  if (taken) throw badRequest('That username is taken', 'username_taken');
}

// ---------- my account ----------

r.get('/me', ah(async (req, res) => {
  // your own page also shows connection requests waiting for your answer (pending or on hold)
  const reqs = await one(`SELECT COUNT(*) AS n FROM connection_requests WHERE to_id=$1 AND status IN (N'pending', N'held')`, [req.user.id]);
  const pulseOff = req.user.show_pulse === false || req.user.show_pulse === 0;
  res.json({ user: meView(req.user), counts: { ...(await counts(req.user.id)), requests: Number(reqs?.n || 0) }, pulse: pulseOff ? null : await pulseFor(req.user.id) });
}));

// Soulink Events (coming soon): "Notify me when events launch"
r.put('/me/events-notify', ah(async (req, res) => {
  const { on } = z.object({ on: z.boolean() }).parse(req.body || {});
  const u = await one('UPDATE users SET events_notify=$2 OUTPUT INSERTED.* WHERE id=$1', [req.user.id, on ? 1 : 0]);
  res.json({ user: meView(u) });
}));

r.patch('/me', ah(async (req, res) => {
  const data = profileSchema.parse(req.body);
  if (data.username) await assertUsernameFree(data.username, req.user.id);
  if (data.birthDate && ageFrom(data.birthDate) < config.minAge) throw badRequest(`You must be ${config.minAge} or older to use Soulink`, 'underage');
  if (data.faceDiscoverable && !req.user.face_verified) throw badRequest('Verify your face first to be discoverable by face', 'face_not_verified');

  if (data.notifyPrefs) data.notifyPrefs = JSON.stringify({ ...prefsOf(req.user), ...data.notifyPrefs }); // change one kind, keep the rest
  const entries = withCityCoords(data, Object.entries(data));
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

// Phone location for the distance filter, rounded to about 1 km (area level). Never shown to anyone.
r.put('/me/location', ah(async (req, res) => {
  const { lat, lon } = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }).parse(req.body);
  const user = await one('UPDATE users SET lat=$2, lon=$3 OUTPUT INSERTED.* WHERE id=$1', [req.user.id, Math.round(lat * 100) / 100, Math.round(lon * 100) / 100]);
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
  const entries = withCityCoords(data, Object.entries(data));
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

r.post('/me/follow-requests/:userId/accept', requireSoul, ah(async (req, res) => {
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
  // Soul Score (Soul DNA v2): headline numbers for every relation type and the one that applies to you two.
  // Both people need a completed Soul DNA.
  const match = u.id !== req.user.id ? await headline(req.user.id, u.id) : null;
  const score = match ? match.all[match.relation].overall : null;
  await recordProfileView(req.user.id, u.id); // feeds their Pulse meter
  const pulseHidden = u.show_pulse === false || u.show_pulse === 0; // Pulse meter switched off: hidden on the profile for everyone
  res.json({ user: publicProfile(u), counts: await counts(u.id), relationship: rel, canViewContent: canView, soulScore: score, match, pulse: pulseHidden ? null : await pulseFor(u.id) });
}));

async function listFollows(req, res, direction) {
  const u = await loadTarget(req);
  const rel = await relationship(req.user.id, u.id);
  if (!canViewContent(u, rel)) throw forbidden('This account is private', 'private_account');
  const [joinCol, whereCol] = direction === 'followers' ? ['follower_id', 'followee_id'] : ['followee_id', 'follower_id'];
  const rows = await many(
    `SELECT TOP 200 u.*, CASE WHEN EXISTS (SELECT 1 FROM follows g WHERE g.follower_id=f.followee_id AND g.followee_id=f.follower_id AND g.status=N'accepted') THEN 1 ELSE 0 END AS mutual
      FROM follows f JOIN users u ON u.id = f.${joinCol}
      WHERE f.${whereCol}=$1 AND f.status=N'accepted'
        -- Followers: everyone connected to this person (mutual ones are also Connections, marked "mutual")
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$2 AND b.blocked_id=u.id) OR (b.blocker_id=u.id AND b.blocked_id=$2))
      ORDER BY f.created_at DESC`,
    [u.id, req.user.id],
  );
  res.json({ users: rows.map((x) => ({ ...userCard(x), mutual: !!x.mutual })) });
}
r.get('/:id/followers', ah((req, res) => listFollows(req, res, 'followers')));
r.get('/:id/following', ah((req, res) => listFollows(req, res, 'following')));

// Anyone's connections list (same privacy as followers). The connection type is shown only on your own list.
r.get('/:id/connections', ah(async (req, res) => {
  const u = await loadTarget(req);
  const rel = await relationship(req.user.id, u.id);
  if (!canViewContent(u, rel)) throw forbidden('This account is private', 'private_account');
  const rows = await many(
    `SELECT c.intent, c.created_at AS since, x.* FROM connections c
       JOIN users x ON x.id = CASE WHEN c.user_a=$1 THEN c.user_b ELSE c.user_a END
      WHERE (c.user_a=$1 OR c.user_b=$1)
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=$2 AND b.blocked_id=x.id) OR (b.blocker_id=x.id AND b.blocked_id=$2))
      ORDER BY c.created_at DESC`,
    [u.id, req.user.id],
  );
  res.json({ users: rows.map((x) => ({ ...userCard(x), ...(rel.isMe ? { intent: x.intent, since: x.since } : {}) })) });
}));

r.post('/:id/follow', requireSoul, ah(async (req, res) => {
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
