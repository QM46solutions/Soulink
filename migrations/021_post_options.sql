-- Post menu: hide like count, turn off commenting, music on a post (a song from your phone, first 30 s plays).
ALTER TABLE posts ADD hide_likes BIT NOT NULL CONSTRAINT df_posts_hide_likes DEFAULT 0;
ALTER TABLE posts ADD comments_off BIT NOT NULL CONSTRAINT df_posts_comments_off DEFAULT 0;
ALTER TABLE posts ADD music_url NVARCHAR(400) NULL;
ALTER TABLE posts ADD music_title NVARCHAR(150) NULL;
