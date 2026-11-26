-- Phone-app notifications: each installed Soulink app (iPhone / Android) gives the server an Expo push token.
-- Expo's free push service hands them to Apple (APNs) and Google (Firebase). Web push stays in push_subscriptions.
CREATE TABLE expo_push_tokens (
  token      NVARCHAR(200) NOT NULL CONSTRAINT pk_expo_push_tokens PRIMARY KEY,
  user_id    UNIQUEIDENTIFIER NOT NULL,
  platform   NVARCHAR(10) NULL,
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_ept_created DEFAULT SYSDATETIMEOFFSET(),
  updated_at DATETIMEOFFSET NOT NULL CONSTRAINT df_ept_updated DEFAULT SYSDATETIMEOFFSET()
);
GO
CREATE INDEX ix_expo_push_tokens_user ON expo_push_tokens (user_id);
