-- Soulink Studio: Sparks put together by the video builder (several clips / photos, Soul Looks).
-- A job waits here until the finished video is ready; only then is the Spark created (so feeds never show a
-- half-made Spark). payload = everything the Spark is posted with + the Studio recipe + the uploaded file names.
CREATE TABLE spark_builds (
  id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_spark_builds PRIMARY KEY CONSTRAINT df_sb_id DEFAULT NEWID(),
  author_id   UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_sb_author REFERENCES users(id),
  payload     NVARCHAR(MAX) NOT NULL CONSTRAINT ck_sb_payload CHECK (ISJSON(payload) = 1),
  status      NVARCHAR(12) NOT NULL CONSTRAINT df_sb_status DEFAULT N'queued'
                CONSTRAINT ck_sb_status CHECK (status IN (N'queued', N'building', N'done', N'failed')),
  attempts    INT NOT NULL CONSTRAINT df_sb_attempts DEFAULT 0,
  error       NVARCHAR(400) NULL,
  spark_id    UNIQUEIDENTIFIER NULL,
  created_at  DATETIMEOFFSET NOT NULL CONSTRAINT df_sb_created DEFAULT SYSDATETIMEOFFSET(),
  updated_at  DATETIMEOFFSET NOT NULL CONSTRAINT df_sb_updated DEFAULT SYSDATETIMEOFFSET()
);
GO
CREATE INDEX ix_spark_builds_author ON spark_builds (author_id, created_at DESC);
GO
CREATE INDEX ix_spark_builds_status ON spark_builds (status, updated_at);
GO
