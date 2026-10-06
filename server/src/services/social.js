import { one, many, query } from '../db.js';
import { ageFrom } from '../lib/auth.js';

/** True if either user has blocked the other. */
export async function isBlockedEither(a, b) {
  if (!a || !b || a === b) return false;
  const row = await one(
    `SELECT TOP 1 1 AS x FROM blocks WHERE (blocker_id=$1 AND blocked_id=$2) OR (blocker_id=$2 AND blocked_id=$1)`,
    [a, b],
  );
  return !!row;
}

/**
 * Relationship from viewer → target.
 * following: 'none' | 'pending' | 'accepted'   (viewer follows target)
 * followsYou: boolean                           (target follows viewer, accepted)
 */
export async function relationship(viewerId, targetId) {
  if (String(viewerId).toLowerCase() === String(targetId).toLowerCase()) return { isMe: true, following: 'none', followsYou: false, requestedYou: false, connected: false };
  const rows = await many(
    `SELECT follower_id, status FROM follows
      WHERE (follower_id=$1 AND followee_id=$2) OR (follower_id=$2 AND followee_id=$1)`,
    [viewerId, targetId],
  );
  const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
  const out = rows.find((r) => same(r.follower_id, viewerId));
  const inc = rows.find((r) => same(r.follower_id, targetId));
  const conn = await one('SELECT 1 AS y FROM connections WHERE (user_a=$1 AND user_b=$2) OR (user_a=$2 AND user_b=$1)', [viewerId, targetId]);
  return {
    isMe: false,
    following: out ? out.status : 'none',
    followsYou: inc?.status === 'accepted',
    requestedYou: inc?.status === 'pending',
    connected: !!conn,
  };
}

/** Can the viewer see this user's posts, stories and follower lists? (Instagram rules) */
export function canViewContent(target, rel) {
  return rel.isMe || !target.is_private || rel.following === 'accepted' || !!rel.connected;
}

export async function counts(userId) {
  return one(
    `SELECT
       (SELECT COUNT(*) FROM posts WHERE author_id=$1 AND deleted_at IS NULL) AS posts,
       (SELECT COUNT(*) FROM follows WHERE followee_id=$1 AND status=N'accepted') AS followers,
       (SELECT COUNT(*) FROM follows WHERE follower_id=$1 AND status=N'accepted') AS following,
       (SELECT COUNT(*) FROM connections WHERE user_a=$1 OR user_b=$1) AS connections`,
    [userId],
  );
}

export async function notify(userId, actorId, type, entityId = null, meta = null) {
  if (userId === actorId) return;
  await query(`INSERT INTO notifications (user_id, actor_id, type, entity_id, meta) VALUES ($1,$2,$3,$4,$5)`, [userId, actorId, type, entityId, meta ? JSON.stringify(meta) : null]);
  try { (await import('../realtime.js')).emitToUsers([userId], 'notification:new', { type }); } catch { /* realtime not running (tests) */ }
}

/** Compact user card used in lists (search, followers, requests). */
export const userCard = (u) => ({
  id: u.id,
  username: u.username,
  displayName: u.display_name,
  avatarUrl: u.avatar_url,
  isPrivate: u.is_private,
  verified: u.face_verified,
  soulType: u.soul_type ?? null,
});

/** Full profile as seen by someone else. */
export const publicProfile = (u) => ({
  ...userCard(u),
  bio: u.bio,
  city: u.city,
  interests: u.interests,
  isPremium: u.is_premium,
  college: u.college ?? null,
  company: u.company ?? null,
  languages: Array.isArray(u.languages) ? u.languages : [],
});

/** The logged-in user's own account, including private settings. */
export const meView = (u) => ({
  ...publicProfile(u),
  phone: u.phone,
  email: u.email,
  birthDate: u.birth_date,
  age: u.birth_date ? ageFrom(u.birth_date) : null,
  gender: u.gender,
  settings: {
    isPrivate: u.is_private,
    showInDiscover: u.show_in_discover,
    faceDiscoverable: u.face_discoverable,
    consentTracking: u.consent_tracking,
  },
  onboardingDone: u.onboarding_done,
  soulReady: !!u.soul_ready,
  hasLocation: u.lat != null && u.lon != null,
  chatLanguage: u.chat_language || null,
  eventsNotify: !!u.events_notify,
  openTo: Array.isArray(u.open_to) ? u.open_to : (() => { try { return JSON.parse(u.open_to || '[]'); } catch { return []; } })(),
  createdAt: u.created_at,
});
