-- Music from JioSaavn / Deezer / free music on posts, Moments and Sparks.
-- A song picked from a music service is kept as a link like /music/play/saavn:<id> (nothing is downloaded).
-- music_start: where the 30-second clip starts in the song (seconds).
ALTER TABLE posts ADD music_start INT NULL;
ALTER TABLE moments ADD music_url NVARCHAR(400) NULL;
ALTER TABLE moments ADD music_title NVARCHAR(150) NULL;
ALTER TABLE moments ADD music_start INT NULL;
