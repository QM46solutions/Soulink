-- Accepted connection requests count as a follow: the sender follows the receiver.
-- Backfill for connections accepted before this rule existed.
INSERT INTO follows (follower_id, followee_id, status)
SELECT DISTINCT cr.from_id, cr.to_id, N'accepted'
FROM connection_requests cr
WHERE cr.status = N'accepted'
  AND NOT EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = cr.from_id AND f.followee_id = cr.to_id);

UPDATE f SET status = N'accepted'
FROM follows f
JOIN connection_requests cr ON cr.from_id = f.follower_id AND cr.to_id = f.followee_id AND cr.status = N'accepted'
WHERE f.status = N'pending';
