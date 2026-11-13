-- Sparks studio: edits are kept with the Spark (trim, speed, filter, text, stickers, music mix, cover) in details.edit.
-- Casting Board: someone posts a role; people audition with a Spark; the caster picks one.
-- Open Mic Stage: a weekly theme everyone performs to (Sparks tagged with the week), and Stage Spots:
-- real-life open mics in your city with "I'm going" / "I'll perform".
ALTER TABLE sparks ADD casting_id UNIQUEIDENTIFIER NULL;
ALTER TABLE sparks ADD stage_week NVARCHAR(10) NULL;
GO
CREATE INDEX ix_sparks_casting ON sparks (casting_id, created_at DESC);
CREATE INDEX ix_sparks_stage ON sparks (stage_week, created_at DESC);
CREATE TABLE casting_calls (
  id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_casting PRIMARY KEY DEFAULT NEWID(),
  author_id       UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_casting_author REFERENCES users(id),
  title           NVARCHAR(100) NOT NULL,
  role            NVARCHAR(300) NOT NULL,
  script          NVARCHAR(1000) NULL,
  category        NVARCHAR(12) NOT NULL CONSTRAINT df_casting_cat DEFAULT N'acting',
  ends_at         DATETIMEOFFSET NOT NULL,
  picked_spark_id UNIQUEIDENTIFIER NULL,
  created_at      DATETIMEOFFSET NOT NULL CONSTRAINT df_casting_created DEFAULT SYSDATETIMEOFFSET(),
  deleted_at      DATETIMEOFFSET NULL
);
CREATE TABLE stage_spots (
  id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_stage_spots PRIMARY KEY DEFAULT NEWID(),
  author_id  UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_spot_author REFERENCES users(id),
  title      NVARCHAR(100) NOT NULL,
  venue      NVARCHAR(150) NOT NULL,
  city       NVARCHAR(80) NOT NULL,
  starts_at  DATETIMEOFFSET NOT NULL,
  kind       NVARCHAR(12) NOT NULL CONSTRAINT df_spot_kind DEFAULT N'any',
  link       NVARCHAR(300) NULL,
  note       NVARCHAR(300) NULL,
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_spot_created DEFAULT SYSDATETIMEOFFSET(),
  deleted_at DATETIMEOFFSET NULL
);
CREATE INDEX ix_stage_spots_when ON stage_spots (starts_at);
CREATE TABLE stage_rsvps (
  spot_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_rsvp_spot REFERENCES stage_spots(id) ON DELETE CASCADE,
  user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_rsvp_user REFERENCES users(id),
  kind       NVARCHAR(8) NOT NULL CONSTRAINT ck_rsvp_kind CHECK (kind IN (N'going', N'perform')),
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_rsvp_created DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_stage_rsvps PRIMARY KEY (spot_id, user_id)
);
