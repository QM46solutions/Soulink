-- Instagram-style privacy settings and the post ⋯ menu (save, archive, pin, not interested).
-- Who can interact
ALTER TABLE users ADD comment_who NVARCHAR(12) NOT NULL CONSTRAINT df_users_comment_who DEFAULT N'everyone';   -- everyone | connections | off
GO
ALTER TABLE users ADD connect_who NVARCHAR(12) NOT NULL CONSTRAINT df_users_connect_who DEFAULT N'everyone';   -- everyone | matches (Soul Score 70%+) | off
GO
ALTER TABLE users ADD moment_replies BIT NOT NULL CONSTRAINT df_users_moment_replies DEFAULT 1;
GO
-- Activity status and read receipts (both two-way: turn yours off and you don't see others' either)
ALTER TABLE users ADD show_activity BIT NOT NULL CONSTRAINT df_users_show_activity DEFAULT 1;
GO
ALTER TABLE users ADD read_receipts BIT NOT NULL CONSTRAINT df_users_read_receipts DEFAULT 1;
GO
-- Hidden words and limits
ALTER TABLE users ADD hide_offensive BIT NOT NULL CONSTRAINT df_users_hide_offensive DEFAULT 1;
GO
ALTER TABLE users ADD hidden_words NVARCHAR(2000) NULL;        -- comma-separated, lower case
GO
ALTER TABLE users ADD limit_until DATETIMEOFFSET NULL;         -- "Limit interactions": people who aren't Connections can't comment or send requests
GO
-- Post menu: pin to profile (up to 3), archive (only you see it)
ALTER TABLE posts ADD pinned_at DATETIMEOFFSET NULL;
GO
ALTER TABLE posts ADD archived_at DATETIMEOFFSET NULL;
GO
CREATE TABLE user_restricts (
  user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_urestrict_user REFERENCES users(id),
  target_id  UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_urestrict_target REFERENCES users(id),
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_urestrict_created DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_user_restricts PRIMARY KEY (user_id, target_id)
);
GO
CREATE TABLE user_mutes (
  user_id      UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_umute_user REFERENCES users(id),
  target_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_umute_target REFERENCES users(id),
  mute_posts   BIT NOT NULL CONSTRAINT df_umute_posts DEFAULT 1,
  mute_moments BIT NOT NULL CONSTRAINT df_umute_moments DEFAULT 1,
  created_at   DATETIMEOFFSET NOT NULL CONSTRAINT df_umute_created DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_user_mutes PRIMARY KEY (user_id, target_id)
);
GO
CREATE TABLE moment_hidden_from (
  user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_mhide_user REFERENCES users(id),
  target_id  UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_mhide_target REFERENCES users(id),
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_mhide_created DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_moment_hidden_from PRIMARY KEY (user_id, target_id)
);
GO
CREATE TABLE saved_posts (
  user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_savedp_user REFERENCES users(id),
  post_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_savedp_post REFERENCES posts(id),
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_savedp_created DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_saved_posts PRIMARY KEY (user_id, post_id)
);
GO
CREATE TABLE hidden_posts (
  user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_hiddenp_user REFERENCES users(id),
  post_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_hiddenp_post REFERENCES posts(id),
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_hiddenp_created DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_hidden_posts PRIMARY KEY (user_id, post_id)
);
GO
