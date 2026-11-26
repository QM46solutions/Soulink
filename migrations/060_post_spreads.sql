-- Boost for posts: the same "Spread around" as Sparks (1, 3 or 7 days, by city and age), for photo / video posts.
-- Additive only: one new table.
CREATE TABLE post_spreads (
  id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_post_spreads PRIMARY KEY DEFAULT NEWID(),
  post_id      UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_post_spread_post REFERENCES posts(id),
  user_id      UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_post_spread_user REFERENCES users(id),
  city         NVARCHAR(60) NULL,
  age_min      INT NOT NULL,
  age_max      INT NOT NULL,
  days         INT NOT NULL,
  amount_paise INT NOT NULL,
  payment_ref  NVARCHAR(120) NULL,
  status       NVARCHAR(10) NOT NULL CONSTRAINT ck_post_spread_status CHECK (status IN (N'active', N'test', N'stopped')),
  starts_at    DATETIMEOFFSET NOT NULL CONSTRAINT df_post_spread_starts DEFAULT SYSDATETIMEOFFSET(),
  ends_at      DATETIMEOFFSET NOT NULL,
  impressions  INT NOT NULL CONSTRAINT df_post_spread_impr DEFAULT 0,
  created_at   DATETIMEOFFSET NOT NULL CONSTRAINT df_post_spread_created DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX ix_post_spreads_live ON post_spreads (status, ends_at);
