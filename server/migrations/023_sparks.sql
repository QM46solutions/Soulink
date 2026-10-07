-- Sparks 🎬: short videos in 5 categories (travel, cooking, acting, fitness inspiration, news).
-- Each category has its own extras (stored in details JSON): place + sound for travel, recipe card for cooking,
-- the acting prompt/script for acting, workout card for fitness, headline + topic + source for news.
CREATE TABLE sparks (
  id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_sparks PRIMARY KEY DEFAULT NEWID(),
  author_id   UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_sparks_author REFERENCES users(id),
  category    NVARCHAR(12) NOT NULL CONSTRAINT ck_sparks_category CHECK (category IN (N'travel', N'cooking', N'acting', N'fitness', N'news')),
  video_url   NVARCHAR(500) NOT NULL,
  music_url   NVARCHAR(500) NULL,
  music_title NVARCHAR(150) NULL,
  caption     NVARCHAR(1000) NOT NULL CONSTRAINT df_sparks_caption DEFAULT N'',
  place       NVARCHAR(150) NULL,
  details     NVARCHAR(MAX) NULL,
  one_take    BIT NOT NULL CONSTRAINT df_sparks_one_take DEFAULT 0,   -- recorded in Soulink in one take, no edits
  created_at  DATETIMEOFFSET NOT NULL CONSTRAINT df_sparks_created DEFAULT SYSDATETIMEOFFSET(),
  deleted_at  DATETIMEOFFSET NULL
);
CREATE INDEX ix_sparks_feed ON sparks (category, created_at DESC);
CREATE INDEX ix_sparks_author ON sparks (author_id, created_at DESC);
CREATE TABLE spark_reactions (
  spark_id   UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_sr_spark REFERENCES sparks(id) ON DELETE CASCADE,
  user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_sr_user REFERENCES users(id),
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_sr_created DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_spark_reactions PRIMARY KEY (spark_id, user_id)
);
CREATE TABLE spark_tried (
  spark_id   UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_st_spark REFERENCES sparks(id) ON DELETE CASCADE,
  user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_st_user REFERENCES users(id),
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_st_created DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_spark_tried PRIMARY KEY (spark_id, user_id)
);
CREATE TABLE spark_views (
  spark_id  UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_sv2_spark REFERENCES sparks(id) ON DELETE CASCADE,
  viewer_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_sv2_viewer REFERENCES users(id),
  day       DATE NOT NULL,
  CONSTRAINT pk_spark_views PRIMARY KEY (spark_id, viewer_id, day)
);
