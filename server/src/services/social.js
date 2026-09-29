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
  if (viewerId === targetId) return { isMe: true, following: 'none', followsYou: false, requestedYou: false };
  const rows = await many(
    `SELECT follower_id, status FROM follows
      WHERE (follower_id=$1 AND followee_id=$2) OR (follower_id=$2 AND followee_id=$1)`,
    [viewerId, targetId],
  );
  const out = rows.find((r) => r.follower_id === viewerId);
  const inc = rows.find((r) => r.follower_id === targetId);
  return {
    isMe: false,
    following: out ? out.status : 'none',
    followsYou: inc?.status === 'accepted',
    requestedYou: inc?.status === 'pending',
  };
}

/** Can the viewer see this user's posts, stories and follower lists? (Instagram rules) */
export function canViewContent(target, rel) {
  return rel.isMe || !target.is_private || rel.following === 'accepted';
}

export async function counts(userId) {
  return one(
    `SELECT
       (SELECT COUNT(*) FROM posts WHERE author_id=$1 AND deleted_at IS NULL) AS posts,
       (SELECT COUNT(*) FROM follows WHERE followee_id=$1 AND status=N'accepted') AS followers,
       (SELECT COUNT(*) FROM follows WHERE follower_id=$1 AND status=N'accepted') AS following`,
    [userId],
  );
}

export async function notify(userId, actorId, type, entityId = null) {
  if (userId === actorId) return;
  await query(`INSERT INTO notifications (user_id, actor_id, type, entity_id) VALUES ($1,$2,$3,$4)`, [userId, actorId, type, entityId]);
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
  createdAt: u.created_at,
});
