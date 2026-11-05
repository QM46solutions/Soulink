-- Legal: what each person agreed to and when, plus a 180-day record of deleted accounts (IT Rules 2021, rule 3(1)(h)).
ALTER TABLE users ADD terms_version NVARCHAR(20) NULL, terms_accepted_at DATETIMEOFFSET NULL, face_consent_at DATETIMEOFFSET NULL;
CREATE TABLE deleted_accounts (
  id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_deleted_accounts PRIMARY KEY DEFAULT NEWID(),
  user_id     UNIQUEIDENTIFIER NOT NULL,
  username    NVARCHAR(30) NULL,
  phone       NVARCHAR(20) NULL,
  email       NVARCHAR(254) NULL,
  created_at  DATETIMEOFFSET NULL,
  deleted_at  DATETIMEOFFSET NOT NULL CONSTRAINT df_deleted_at DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX ix_deleted_accounts_at ON deleted_accounts (deleted_at);
