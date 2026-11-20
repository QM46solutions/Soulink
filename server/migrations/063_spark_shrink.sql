-- Posted videos are made small and quick to start (720p) by the video builder after posting (services/videoShrink.js).
-- shrunk_at: done (or didn't need it); shrink_tries: attempts so far (gives up after 3).
ALTER TABLE sparks ADD shrunk_at DATETIMEOFFSET NULL, shrink_tries INT NOT NULL CONSTRAINT df_sparks_shrink_tries DEFAULT 0;
