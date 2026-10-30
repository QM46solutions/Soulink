-- Security controls (Information Security Policy sections 4, 5, 8):
--  user_sessions  one row per signed-in device; logout ends that row, deleting the account ends all of them
--  audit_log      who did what: logins, logouts, admin actions, data downloads, account deletion (kept 1 year)
-- No foreign keys to users on purpose: the audit trail and the "session ended" check outlive a deleted account.
CREATE TABLE user_sessions (
  id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_user_sessions PRIMARY KEY CONSTRAINT df_us_id DEFAULT NEWID(),
  user_id      UNIQUEIDENTIFIER NOT NULL,
  device       NVARCHAR(200) NULL,
  ip           NVARCHAR(64) NULL,
  created_at   DATETIMEOFFSET NOT NULL CONSTRAINT df_us_created DEFAULT SYSDATETIMEOFFSET(),
  last_seen_at DATETIMEOFFSET NOT NULL CONSTRAINT df_us_seen DEFAULT SYSDATETIMEOFFSET(),
  revoked_at   DATETIMEOFFSET NULL
);
GO
CREATE INDEX ix_user_sessions_user ON user_sessions (user_id);
GO
CREATE TABLE audit_log (
  id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_audit_log PRIMARY KEY,
  actor_id       UNIQUEIDENTIFIER NULL,
  action         NVARCHAR(60) NOT NULL,
  target_user_id UNIQUEIDENTIFIER NULL,
  detail         NVARCHAR(1000) NULL,
  ip             NVARCHAR(64) NULL,
  created_at     DATETIMEOFFSET NOT NULL CONSTRAINT df_audit_created DEFAULT SYSDATETIMEOFFSET()
);
GO
CREATE INDEX ix_audit_log_created ON audit_log (created_at);
GO
-- Face fingerprints are now encrypted in the app (AES-256-GCM), so the column no longer holds JSON
ALTER TABLE face_embeddings DROP CONSTRAINT ck_fe_embedding;
GO
-- Face search is on hold: nobody can be found by face
UPDATE users SET face_discoverable = 0 WHERE face_discoverable = 1;
