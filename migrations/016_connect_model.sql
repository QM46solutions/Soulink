-- One way of linking people: Connect.
--   A connects to B (B accepted A's request)  = a follow A -> B (accepted). A is one of B's Followers.
--   Both connected to each other               = a row in connections (shown as "Connections").
-- Existing connections stay mutual: make sure both directions exist.
INSERT INTO follows (follower_id, followee_id, status)
  SELECT c.user_a, c.user_b, N'accepted' FROM connections c
   WHERE NOT EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = c.user_a AND f.followee_id = c.user_b);
INSERT INTO follows (follower_id, followee_id, status)
  SELECT c.user_b, c.user_a, N'accepted' FROM connections c
   WHERE NOT EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = c.user_b AND f.followee_id = c.user_a);
UPDATE f SET status = N'accepted' FROM follows f
  JOIN connections c ON (f.follower_id = c.user_a AND f.followee_id = c.user_b) OR (f.follower_id = c.user_b AND f.followee_id = c.user_a);
GO
-- Pending follow requests (private accounts) become Connect requests
INSERT INTO connection_requests (from_id, to_id, knows, intent)
  SELECT f.follower_id, f.followee_id, 0, N'unsure' FROM follows f
   WHERE f.status = N'pending'
     AND NOT EXISTS (SELECT 1 FROM connection_requests q WHERE q.status IN (N'pending', N'held')
                       AND ((q.from_id = f.follower_id AND q.to_id = f.followee_id) OR (q.from_id = f.followee_id AND q.to_id = f.follower_id)));
DELETE FROM follows WHERE status = N'pending';
