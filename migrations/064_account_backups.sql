-- Account Data & Backup: "Download My Data" (ZIP with photos and videos) and "Restore My Data" jobs.
-- One row per export or restore. Exports keep only the list of files and their checksums (the ZIP itself is built
-- while it downloads, so no copy of anyone's data sits on the server). Restores keep their summary for the history.
CREATE TABLE account_backups (
  id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_account_backups PRIMARY KEY CONSTRAINT df_abk_id DEFAULT NEWID(),
  user_id     UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_abk_user REFERENCES users(id),  -- erased with the account
  kind        NVARCHAR(10) NOT NULL CONSTRAINT ck_abk_kind CHECK (kind IN (N'export', N'restore')),
  status      NVARCHAR(12) NOT NULL CONSTRAINT df_abk_status DEFAULT N'queued'
              CONSTRAINT ck_abk_status CHECK (status IN (N'queued', N'running', N'ready', N'validated', N'done', N'failed', N'expired', N'interrupted')),
  stage       NVARCHAR(60) NULL,      -- what it is doing now, shown in the app
  progress    INT NOT NULL CONSTRAINT df_abk_progress DEFAULT 0,  -- 0-100
  manifest    NVARCHAR(MAX) NULL,     -- export: the backup manifest; restore: the plan and then the result summary
  size_bytes  BIGINT NULL,
  error       NVARCHAR(400) NULL,
  created_at  DATETIMEOFFSET NOT NULL CONSTRAINT df_abk_created DEFAULT SYSDATETIMEOFFSET(),
  finished_at DATETIMEOFFSET NULL,
  expires_at  DATETIMEOFFSET NULL      -- export: the download works until then (7 days)
);
GO
CREATE INDEX ix_account_backups_user ON account_backups (user_id, created_at DESC);
GO
