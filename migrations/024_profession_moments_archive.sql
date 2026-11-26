-- Profession on the profile (free text, shown under the photo) + "content creator" badge.
-- Moments archive: every Moment you make is kept for your own profile's Moments tab
-- (added to your Moments and/or sent to chats). Only Moments added as a story are ever shown to others, and only for 24 h.
ALTER TABLE users ADD profession NVARCHAR(80) NULL;
ALTER TABLE users ADD is_creator BIT NOT NULL CONSTRAINT df_users_is_creator DEFAULT 0;
ALTER TABLE moments ADD sent_chats INT NOT NULL CONSTRAINT df_moments_sent_chats DEFAULT 0;
