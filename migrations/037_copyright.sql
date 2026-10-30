-- Copyright notices and takedowns, modelled on Instagram/Facebook's process and India's Copyright Rules 2013, Rule 75.
ALTER TABLE sparks ADD suspended_reason NVARCHAR(20) NULL;   -- 'offense' | 'copyright'
GO
ALTER TABLE posts ADD suspended_reason NVARCHAR(20) NULL;
GO
ALTER TABLE users ADD posting_blocked_until DATETIMEOFFSET NULL; -- second copyright strike: no new posts for 7 days
GO
CREATE TABLE copyright_reports (
  id               UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_copyright_reports PRIMARY KEY CONSTRAINT df_cpr_id DEFAULT NEWID(),
  -- who is complaining (shared with the uploader, as Instagram does)
  reporter_name    NVARCHAR(120) NOT NULL,
  reporter_email   NVARCHAR(254) NOT NULL,
  reporter_phone   NVARCHAR(30) NULL,
  reporter_address NVARCHAR(400) NOT NULL,
  relationship     NVARCHAR(20) NOT NULL,                  -- 'owner' | 'agent' (authorised to act for the owner)
  rights_owner     NVARCHAR(200) NOT NULL,                 -- the copyright owner's name
  -- the work and the content
  work_description NVARCHAR(1000) NOT NULL,
  original_url     NVARCHAR(500) NULL,                     -- where the original can be seen
  ownership_proof  NVARCHAR(1000) NULL,                    -- registration number, label agreement, link (Rule 75)
  content_kind     NVARCHAR(10) NOT NULL,                  -- 'spark' | 'post'
  content_id       UNIQUEIDENTIFIER NOT NULL,
  uploader_id      UNIQUEIDENTIFIER NULL,
  explanation      NVARCHAR(1000) NULL,
  -- statements (all must be true)
  good_faith       BIT NOT NULL,
  accurate         BIT NOT NULL,
  suit_undertaking BIT NOT NULL,                           -- will file an infringement suit within 21 days (Rule 75)
  signature        NVARCHAR(120) NOT NULL,
  -- handling
  status           NVARCHAR(20) NOT NULL CONSTRAINT df_cpr_status DEFAULT N'received', -- received | removed | rejected | restored | court_order
  decided_at       DATETIMEOFFSET NULL,
  decided_by       UNIQUEIDENTIFIER NULL,
  decision_note    NVARCHAR(500) NULL,
  restore_after    DATETIMEOFFSET NULL,                    -- 21 days after removal
  appeal_text      NVARCHAR(1000) NULL,
  appealed_at      DATETIMEOFFSET NULL,
  court_order_at   DATETIMEOFFSET NULL,
  created_at       DATETIMEOFFSET NOT NULL CONSTRAINT df_cpr_created DEFAULT SYSDATETIMEOFFSET()
);
GO
CREATE INDEX ix_cpr_status ON copyright_reports (status, created_at);
GO
CREATE TABLE copyright_strikes (
  id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_copyright_strikes PRIMARY KEY CONSTRAINT df_cps_id DEFAULT NEWID(),
  user_id    UNIQUEIDENTIFIER NOT NULL,
  report_id  UNIQUEIDENTIFIER NOT NULL,
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_cps_created DEFAULT SYSDATETIMEOFFSET(),
  removed_at DATETIMEOFFSET NULL                           -- appeal accepted / content restored
);
GO
CREATE INDEX ix_cps_user ON copyright_strikes (user_id, created_at);
