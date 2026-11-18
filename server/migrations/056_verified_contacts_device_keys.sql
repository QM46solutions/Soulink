-- Sign-in update (Nov 2026)
--  · email_verified_at / phone_verified_at: set only when a code really reached that inbox / phone
--    (a real email or SMS provider), never in test mode.
--  · otp_codes.purpose + user_id: a code can also confirm an email being added to a signed-in account.
--  · device_keys: "sign in with fingerprint / face unlock" on a phone. The phone keeps a random secret behind its
--    own biometric lock; the server keeps only a keyed hash of it. No face or fingerprint data ever leaves the phone.
ALTER TABLE users ADD email_verified_at DATETIMEOFFSET NULL;
ALTER TABLE users ADD phone_verified_at DATETIMEOFFSET NULL;
GO
ALTER TABLE otp_codes ADD purpose NVARCHAR(20) NOT NULL CONSTRAINT df_otp_purpose DEFAULT N'login';
ALTER TABLE otp_codes ADD user_id UNIQUEIDENTIFIER NULL;
GO
CREATE TABLE device_keys (
  id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_device_keys PRIMARY KEY DEFAULT NEWID(),
  user_id      UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_device_keys_user REFERENCES users(id),
  secret_hash  NVARCHAR(64) NOT NULL,
  label        NVARCHAR(120) NULL,          -- "Android phone" etc., shown in Settings
  session_id   UNIQUEIDENTIFIER NULL,       -- the session that turned it on (logging that device out removes it)
  failures     INT NOT NULL CONSTRAINT df_device_keys_failures DEFAULT 0,
  created_at   DATETIMEOFFSET NOT NULL CONSTRAINT df_device_keys_created DEFAULT SYSDATETIMEOFFSET(),
  last_used_at DATETIMEOFFSET NULL,
  revoked_at   DATETIMEOFFSET NULL
);
CREATE INDEX ix_device_keys_user ON device_keys (user_id, revoked_at);
GO
