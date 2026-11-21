-- Account lifecycle: pause, 30-day scheduled deletion, a 1-year identity record after deletion,
-- and banned identities (repeat offenders cannot create a new profile).
ALTER TABLE users ADD
  deactivated_at   DATETIMEOFFSET NULL,   -- set while paused or waiting to be deleted: hidden everywhere
  deactivate_reason NVARCHAR(20) NULL,    -- 'paused' | 'deleting'
  delete_after     DATETIMEOFFSET NULL;   -- scheduled deletion date (30 days after the request)
GO
-- What is kept for 1 year after an account is erased (DPDP Rules 2025 Rule 8(3); IT Rules 2021 Rule 3(1)(h)):
-- identity, contact, consent records. Never photos, chats, Soul DNA or face data.
ALTER TABLE deleted_accounts ADD
  display_name      NVARCHAR(100) NULL,
  birth_date        DATE NULL,
  city              NVARCHAR(120) NULL,
  terms_version     NVARCHAR(20) NULL,
  terms_accepted_at DATETIMEOFFSET NULL,
  face_consent_at   DATETIMEOFFSET NULL,
  reason            NVARCHAR(20) NULL;    -- 'user' | 'scheduled' | 'banned'
GO
CREATE TABLE banned_identities (
  id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_banned_identities PRIMARY KEY CONSTRAINT df_bi_id DEFAULT NEWID(),
  user_id        UNIQUEIDENTIFIER NULL,
  username       NVARCHAR(40) NULL,
  display_name   NVARCHAR(100) NULL,
  phone          NVARCHAR(20) NULL,
  email          NVARCHAR(254) NULL,
  face_embedding NVARCHAR(MAX) NULL,      -- encrypted face fingerprint (AES-256-GCM), used only to stop a new sign-up
  reason         NVARCHAR(500) NOT NULL,
  banned_by      UNIQUEIDENTIFIER NULL,
  banned_at      DATETIMEOFFSET NOT NULL CONSTRAINT df_bi_at DEFAULT SYSDATETIMEOFFSET(),
  expires_at     DATETIMEOFFSET NOT NULL,
  lifted_at      DATETIMEOFFSET NULL
);
GO
CREATE INDEX ix_banned_phone ON banned_identities (phone);
GO
CREATE INDEX ix_banned_email ON banned_identities (email);
