-- Posts: "Offense" marks (one per person per post) and suspension after too many; shares; posts sent in chat.
CREATE TABLE post_offenses (
  post_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_off_post REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_off_user REFERENCES users(id),
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_off_created DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_post_offenses PRIMARY KEY (post_id, user_id)
);
CREATE TABLE post_shares (
  id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_post_shares PRIMARY KEY DEFAULT NEWID(),
  post_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_share_post REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_share_user REFERENCES users(id),
  channel    NVARCHAR(10) NOT NULL,   -- 'chat' or 'external'
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_share_created DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX ix_post_shares_post ON post_shares (post_id);
ALTER TABLE posts ADD suspended_at DATETIMEOFFSET NULL;
GO
ALTER TABLE messages DROP CONSTRAINT ck_msg_kind;
GO
ALTER TABLE messages ADD CONSTRAINT ck_msg_kind CHECK (kind IN (N'text', N'image', N'voice', N'system', N'soulmoji', N'post'));
