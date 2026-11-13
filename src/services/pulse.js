// Pulse meter: how much attention a person is getting, 0-100, over the last 30 days.
// Rises when people view the profile and interact (likes, comments, follows, connect requests,
// connections, anonymous messages). Newer activity counts more (half-life 10 days), so when nobody
// notices you, the pulse slowly falls. Your own activity on your own profile never counts.
import { one, query } from '../db.js';

export const WEIGHTS = { view: 1, like: 2, comment: 3, follow: 3, request: 4, connection: 5, anon: 2 };
const WINDOW_DAYS = 30;
const HALF_LIFE_HOURS = 240;
const SCALE = 30; // raw points for ~63/100; keeps 100 hard to reach

export const LEVELS = [
  { min: 80, key: 'fire', label: 'On fire' },
  { min: 60, key: 'hot', label: 'Hot' },
  { min: 40, key: 'buzzing', label: 'Buzzing' },
  { min: 20, key: 'warm', label: 'Warming up' },
  { min: 0, key: 'quiet', label: 'Quiet' },
];
export const levelOf = (score) => LEVELS.find((l) => score >= l.min);
export const scoreFromRaw = (raw) => Math.round(100 * (1 - Math.exp(-Math.max(0, raw) / SCALE)));

/** Every attention event for a user as (created_at, weight). $1 = user id */
const EVENTS = `
  SELECT created_at, ${WEIGHTS.view} AS w FROM profile_views WHERE target_id=$1 AND viewer_id<>$1
  UNION ALL SELECT l.created_at, ${WEIGHTS.like} FROM post_likes l JOIN posts p ON p.id=l.post_id WHERE p.author_id=$1 AND p.deleted_at IS NULL AND l.user_id<>$1
  UNION ALL SELECT c.created_at, ${WEIGHTS.comment} FROM comments c JOIN posts p ON p.id=c.post_id WHERE p.author_id=$1 AND p.deleted_at IS NULL AND c.author_id<>$1 AND c.deleted_at IS NULL
  UNION ALL SELECT created_at, ${WEIGHTS.follow} FROM follows WHERE followee_id=$1 AND follower_id<>$1 AND status=N'accepted'
  UNION ALL SELECT created_at, ${WEIGHTS.request} FROM connection_requests WHERE to_id=$1
  UNION ALL SELECT created_at, ${WEIGHTS.connection} FROM connections WHERE user_a=$1 OR user_b=$1
  UNION ALL SELECT created_at, ${WEIGHTS.anon} FROM anon_threads WHERE recipient_id=$1`;

/** Raw pulse points as they were at time `at` (decayed to that moment). */
const RAW_AT = (p) => `SUM(CASE WHEN e.created_at <= ${p} AND e.created_at > DATEADD(DAY, -${WINDOW_DAYS}, ${p})
  THEN e.w * POWER(CAST(0.5 AS FLOAT), DATEDIFF(MINUTE, e.created_at, ${p}) / (60.0 * ${HALF_LIFE_HOURS})) ELSE 0 END)`;

export async function pulseFor(userId) {
  // trend: today's pulse compared with 3 days ago (database clock, so time zones never matter)
  const row = await one(
    `SELECT ${RAW_AT('SYSDATETIMEOFFSET()')} AS raw_now, ${RAW_AT('DATEADD(DAY, -3, SYSDATETIMEOFFSET())')} AS raw_then FROM (${EVENTS}) e`, [userId],
  );
  const score = scoreFromRaw(Number(row?.raw_now || 0));
  const before = scoreFromRaw(Number(row?.raw_then || 0));
  const lvl = levelOf(score);
  return { score, level: lvl.key, label: lvl.label, trend: score - before >= 3 ? 'up' : before - score >= 3 ? 'down' : 'steady' };
}

/** Someone opened this profile: counted once per viewer per day. */
export async function recordProfileView(viewerId, targetId) {
  if (!viewerId || !targetId || String(viewerId).toUpperCase() === String(targetId).toUpperCase()) return;
  await query(
    `IF NOT EXISTS (SELECT 1 FROM profile_views WHERE target_id=$2 AND viewer_id=$1 AND day=CAST(SYSDATETIMEOFFSET() AS DATE))
       INSERT INTO profile_views (viewer_id, target_id, day) VALUES ($1, $2, CAST(SYSDATETIMEOFFSET() AS DATE))`, [viewerId, targetId],
  ).catch(() => { /* two tabs at once: already counted */ });
}
