-- Moments (from the Home "+"): a photo or a written card, added to your Moments (24 h, Connections + Followers)
-- and/or sent to chats. In chat a Moment opens once, can be replayed once, or saved to stay in the chat.
CREATE TABLE moments (
  id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_moments PRIMARY KEY DEFAULT NEWID(),
  author_id  UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_moments_author REFERENCES users(id),
  media_url  NVARCHAR(500) NULL,
  text       NVARCHAR(500) NULL,
  bg         NVARCHAR(40) NULL,
  is_story   BIT NOT NULL CONSTRAINT df_moments_story DEFAULT 0,
  expires_at DATETIMEOFFSET NOT NULL CONSTRAINT df_moments_expires DEFAULT DATEADD(HOUR, 24, SYSDATETIMEOFFSET()),
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_moments_created DEFAULT SYSDATETIMEOFFSET(),
  deleted_at DATETIMEOFFSET NULL
);
CREATE INDEX ix_moments_author ON moments (author_id, expires_at);
CREATE TABLE moment_views (
  moment_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_mv_moment REFERENCES moments(id) ON DELETE CASCADE,
  viewer_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_mv_viewer REFERENCES users(id),
  viewed_at DATETIMEOFFSET NOT NULL CONSTRAINT df_mv_viewed DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_moment_views PRIMARY KEY (moment_id, viewer_id)
);
CREATE TABLE chat_moment_opens (
  message_id     UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_cmo_msg REFERENCES messages(id) ON DELETE CASCADE,
  user_id        UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_cmo_user REFERENCES users(id),
  opens          INT NOT NULL CONSTRAINT df_cmo_opens DEFAULT 0,
  last_opened_at DATETIMEOFFSET NOT NULL CONSTRAINT df_cmo_last DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_chat_moment_opens PRIMARY KEY (message_id, user_id)
);
ALTER TABLE messages ADD saved_at DATETIMEOFFSET NULL;      -- a chat Moment someone saved: stays in the chat
ALTER TABLE messages ADD moment_ref NVARCHAR(800) NULL;      -- a reply to someone's Moment: small preview of it (JSON)
GO
ALTER TABLE messages DROP CONSTRAINT ck_msg_kind;
GO
ALTER TABLE messages ADD CONSTRAINT ck_msg_kind CHECK (kind IN (N'text', N'image', N'voice', N'system', N'soulmoji', N'post', N'moment'));
