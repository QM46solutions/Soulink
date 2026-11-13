-- Ads (run by the Soulink team): sponsored cards between Home posts, Spark ads between Sparks, sponsored Argue topics.
-- Spread around: an owner pays to show their Spark to more people (by city and age) for 1, 3 or 7 days.
CREATE TABLE ad_campaigns (
  id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_ad_campaigns PRIMARY KEY DEFAULT NEWID(),
  placement   NVARCHAR(10) NOT NULL CONSTRAINT ck_ad_placement CHECK (placement IN (N'feed', N'sparks', N'argue')),
  brand       NVARCHAR(80) NOT NULL,
  logo_url    NVARCHAR(400) NULL,
  headline    NVARCHAR(120) NOT NULL,
  body        NVARCHAR(400) NULL,
  media_url   NVARCHAR(400) NULL,
  media_kind  NVARCHAR(10) NULL,
  cta_label   NVARCHAR(30) NULL,
  cta_url     NVARCHAR(400) NULL,
  argue_topic NVARCHAR(150) NULL,
  city        NVARCHAR(60) NULL,
  starts_at   DATETIMEOFFSET NOT NULL CONSTRAINT df_ad_starts DEFAULT SYSDATETIMEOFFSET(),
  ends_at     DATETIMEOFFSET NOT NULL,
  active      BIT NOT NULL CONSTRAINT df_ad_active DEFAULT 1,
  impressions INT NOT NULL CONSTRAINT df_ad_impr DEFAULT 0,
  clicks      INT NOT NULL CONSTRAINT df_ad_clicks DEFAULT 0,
  created_by  UNIQUEIDENTIFIER NULL,
  created_at  DATETIMEOFFSET NOT NULL CONSTRAINT df_ad_created DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX ix_ads_live ON ad_campaigns (placement, active, ends_at);
CREATE TABLE spark_spreads (
  id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_spark_spreads PRIMARY KEY DEFAULT NEWID(),
  spark_id     UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_spread_spark REFERENCES sparks(id),
  user_id      UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_spread_user REFERENCES users(id),
  city         NVARCHAR(60) NULL,
  age_min      INT NOT NULL,
  age_max      INT NOT NULL,
  days         INT NOT NULL,
  amount_paise INT NOT NULL,
  payment_ref  NVARCHAR(120) NULL,
  status       NVARCHAR(10) NOT NULL CONSTRAINT ck_spread_status CHECK (status IN (N'active', N'test', N'stopped')),
  starts_at    DATETIMEOFFSET NOT NULL CONSTRAINT df_spread_starts DEFAULT SYSDATETIMEOFFSET(),
  ends_at      DATETIMEOFFSET NOT NULL,
  impressions  INT NOT NULL CONSTRAINT df_spread_impr DEFAULT 0,
  created_at   DATETIMEOFFSET NOT NULL CONSTRAINT df_spread_created DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX ix_spreads_live ON spark_spreads (status, ends_at);
