-- Pulse meter: who looked at whose profile (one row per viewer, per profile, per day).
-- Likes, comments, follows, connect requests, connections and anonymous messages already have their own tables.
CREATE TABLE profile_views (
  viewer_id  UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_pv_viewer REFERENCES users(id),
  target_id  UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_pv_target REFERENCES users(id),
  day        DATE NOT NULL,
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_pv_created DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_profile_views PRIMARY KEY (target_id, day, viewer_id)
);
