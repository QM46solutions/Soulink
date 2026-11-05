-- Notification settings (which kinds reach your phone), phones subscribed to push notifications,
-- Pulse meter on/off, and server secrets generated on first use (push keys).
ALTER TABLE users ADD notify_prefs NVARCHAR(400) NULL;
ALTER TABLE users ADD show_pulse BIT NOT NULL CONSTRAINT df_users_show_pulse DEFAULT 1;
GO
CREATE TABLE push_subscriptions (
  id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_push_subscriptions PRIMARY KEY DEFAULT NEWID(),
  user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_push_user REFERENCES users(id),
  endpoint   NVARCHAR(800) NOT NULL,
  p256dh     NVARCHAR(200) NOT NULL,
  auth       NVARCHAR(100) NOT NULL,
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_push_created DEFAULT SYSDATETIMEOFFSET()
);
CREATE UNIQUE INDEX ux_push_endpoint ON push_subscriptions (endpoint);
CREATE INDEX ix_push_user ON push_subscriptions (user_id);
CREATE TABLE app_secrets (
  name  NVARCHAR(100) NOT NULL CONSTRAINT pk_app_secrets PRIMARY KEY,
  value NVARCHAR(MAX) NOT NULL
);
