-- Soulink schema for Microsoft SQL Server (2019+ / Azure SQL).
-- Covers all v1 milestones so later features don't need table rewrites.
-- Batches are separated by GO lines (the migration runner splits on them).
--
-- Conventions
--   * IDs: UNIQUEIDENTIFIER DEFAULT NEWID()
--   * Timestamps: DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
--   * Lists / structured values: NVARCHAR(MAX) holding JSON (checked with ISJSON)
--   * Case-insensitive text (usernames, emails) uses a CI collation
--   * SQL Server allows only one cascade path per table, so links to users are NO ACTION;
--     account deletion (Milestone 7) removes a user's rows in code, in the right order.

-- ============ Milestone 1: accounts, profiles, social graph, safety ============

CREATE TABLE users (
  id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_users PRIMARY KEY DEFAULT NEWID(),
  phone             NVARCHAR(20) NULL,
  email             NVARCHAR(254) COLLATE Latin1_General_CI_AS NULL,
  google_sub        NVARCHAR(255) NULL,
  apple_sub         NVARCHAR(255) NULL,
  username          NVARCHAR(30) COLLATE Latin1_General_CI_AS NULL,
  display_name      NVARCHAR(50) NULL,
  bio               NVARCHAR(300) NOT NULL CONSTRAINT df_users_bio DEFAULT N'',
  avatar_url        NVARCHAR(500) NULL,
  city              NVARCHAR(60) NULL,
  birth_date        DATE NULL,
  gender            NVARCHAR(20) NULL,
  interests         NVARCHAR(MAX) NOT NULL CONSTRAINT df_users_interests DEFAULT N'[]',
  is_private        BIT NOT NULL CONSTRAINT df_users_private DEFAULT 0,
  is_premium        BIT NOT NULL CONSTRAINT df_users_premium DEFAULT 0,
  face_verified     BIT NOT NULL CONSTRAINT df_users_face_verified DEFAULT 0,
  face_discoverable BIT NOT NULL CONSTRAINT df_users_face_disc DEFAULT 0,
  show_in_discover  BIT NOT NULL CONSTRAINT df_users_discover DEFAULT 1,
  consent_tracking  BIT NOT NULL CONSTRAINT df_users_consent DEFAULT 0,
  onboarding_done   BIT NOT NULL CONSTRAINT df_users_onboarding DEFAULT 0,
  last_active_at    DATETIMEOFFSET NULL,
  created_at        DATETIMEOFFSET NOT NULL CONSTRAINT df_users_created DEFAULT SYSDATETIMEOFFSET(),
  updated_at        DATETIMEOFFSET NOT NULL CONSTRAINT df_users_updated DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT ck_users_username CHECK (username IS NULL OR (LEN(username) BETWEEN 3 AND 30 AND username NOT LIKE N'%[^a-z0-9._]%')),
  CONSTRAINT ck_users_interests CHECK (ISJSON(interests) = 1)
);
-- Unique only when set (SQL Server treats NULLs as equal in plain UNIQUE constraints)
CREATE UNIQUE INDEX ux_users_phone      ON users (phone)      WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX ux_users_email      ON users (email)      WHERE email IS NOT NULL;
CREATE UNIQUE INDEX ux_users_google     ON users (google_sub) WHERE google_sub IS NOT NULL;
CREATE UNIQUE INDEX ux_users_apple      ON users (apple_sub)  WHERE apple_sub IS NOT NULL;
CREATE UNIQUE INDEX ux_users_username   ON users (username)   WHERE username IS NOT NULL;
CREATE INDEX ix_users_display_name      ON users (display_name);

CREATE TABLE otp_codes (
  id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_otp PRIMARY KEY DEFAULT NEWID(),
  target      NVARCHAR(254) NOT NULL,          -- normalized phone (+91...) or lowercase email
  channel     NVARCHAR(10) NOT NULL CONSTRAINT ck_otp_channel CHECK (channel IN (N'phone', N'email')),
  code_hash   NVARCHAR(64) NOT NULL,
  attempts    INT NOT NULL CONSTRAINT df_otp_attempts DEFAULT 0,
  expires_at  DATETIMEOFFSET NOT NULL,
  consumed_at DATETIMEOFFSET NULL,
  created_at  DATETIMEOFFSET NOT NULL CONSTRAINT df_otp_created DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX ix_otp_target ON otp_codes (target, created_at DESC);

CREATE TABLE follows (
  follower_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_follows_follower REFERENCES users(id),
  followee_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_follows_followee REFERENCES users(id),
  status      NVARCHAR(10) NOT NULL CONSTRAINT ck_follows_status CHECK (status IN (N'accepted', N'pending')),
  created_at  DATETIMEOFFSET NOT NULL CONSTRAINT df_follows_created DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_follows PRIMARY KEY (follower_id, followee_id),
  CONSTRAINT ck_follows_self CHECK (follower_id <> followee_id)
);
CREATE INDEX ix_follows_followee ON follows (followee_id, status);

CREATE TABLE blocks (
  blocker_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_blocks_blocker REFERENCES users(id),
  blocked_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_blocks_blocked REFERENCES users(id),
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_blocks_created DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_blocks PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT ck_blocks_self CHECK (blocker_id <> blocked_id)
);
CREATE INDEX ix_blocks_blocked ON blocks (blocked_id);

CREATE TABLE reports (
  id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_reports PRIMARY KEY DEFAULT NEWID(),
  reporter_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_reports_reporter REFERENCES users(id),
  target_type NVARCHAR(10) NOT NULL CONSTRAINT ck_reports_type CHECK (target_type IN (N'user', N'post', N'comment', N'message', N'case', N'story')),
  target_id   UNIQUEIDENTIFIER NOT NULL,
  reason      NVARCHAR(30) NOT NULL,
  details     NVARCHAR(1000) NULL,
  status      NVARCHAR(10) NOT NULL CONSTRAINT df_reports_status DEFAULT N'open'
              CONSTRAINT ck_reports_status CHECK (status IN (N'open', N'reviewed', N'actioned', N'dismissed')),
  created_at  DATETIMEOFFSET NOT NULL CONSTRAINT df_reports_created DEFAULT SYSDATETIMEOFFSET()
);

CREATE TABLE notifications (
  id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_notifications PRIMARY KEY DEFAULT NEWID(),
  user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_notif_user REFERENCES users(id),
  actor_id   UNIQUEIDENTIFIER NULL CONSTRAINT fk_notif_actor REFERENCES users(id),
  type       NVARCHAR(30) NOT NULL,   -- follow, follow_request, follow_accept, like, comment, message, case_invite, verdict
  entity_id  UNIQUEIDENTIFIER NULL,
  read_at    DATETIMEOFFSET NULL,
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_notif_created DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX ix_notif_user ON notifications (user_id, created_at DESC);

-- ============ Milestone 2: chat ============

CREATE TABLE conversations (
  id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_conversations PRIMARY KEY DEFAULT NEWID(),
  is_group        BIT NOT NULL CONSTRAINT df_conv_group DEFAULT 0,
  title           NVARCHAR(100) NULL,
  avatar_url      NVARCHAR(500) NULL,
  created_by      UNIQUEIDENTIFIER NULL CONSTRAINT fk_conv_creator REFERENCES users(id),
  last_message_at DATETIMEOFFSET NULL,
  created_at      DATETIMEOFFSET NOT NULL CONSTRAINT df_conv_created DEFAULT SYSDATETIMEOFFSET()
);

CREATE TABLE conversation_members (
  conversation_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_cm_conv REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_cm_user REFERENCES users(id),
  role            NVARCHAR(10) NOT NULL CONSTRAINT df_cm_role DEFAULT N'member' CONSTRAINT ck_cm_role CHECK (role IN (N'admin', N'member')),
  is_request      BIT NOT NULL CONSTRAINT df_cm_request DEFAULT 0,   -- message request (not yet accepted)
  last_read_at    DATETIMEOFFSET NULL,
  joined_at       DATETIMEOFFSET NOT NULL CONSTRAINT df_cm_joined DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_conversation_members PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX ix_cm_user ON conversation_members (user_id);

CREATE TABLE messages (
  id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_messages PRIMARY KEY DEFAULT NEWID(),
  conversation_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_msg_conv REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UNIQUEIDENTIFIER NULL CONSTRAINT fk_msg_sender REFERENCES users(id),
  kind            NVARCHAR(10) NOT NULL CONSTRAINT df_msg_kind DEFAULT N'text' CONSTRAINT ck_msg_kind CHECK (kind IN (N'text', N'image', N'voice', N'system')),
  body            NVARCHAR(MAX) NULL,
  media_url       NVARCHAR(500) NULL,
  duration_ms     INT NULL,
  created_at      DATETIMEOFFSET NOT NULL CONSTRAINT df_msg_created DEFAULT SYSDATETIMEOFFSET(),
  deleted_at      DATETIMEOFFSET NULL
);
CREATE INDEX ix_messages_conv ON messages (conversation_id, created_at DESC);

-- ============ Milestone 3: posts, feed, stories ============

CREATE TABLE posts (
  id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_posts PRIMARY KEY DEFAULT NEWID(),
  author_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_posts_author REFERENCES users(id),
  caption      NVARCHAR(2200) NOT NULL CONSTRAINT df_posts_caption DEFAULT N'',
  media_urls   NVARCHAR(MAX) NOT NULL CONSTRAINT df_posts_media DEFAULT N'[]' CONSTRAINT ck_posts_media CHECK (ISJSON(media_urls) = 1),
  case_id      UNIQUEIDENTIFIER NULL,           -- set when the post is a shared anonymous verdict
  is_anonymous BIT NOT NULL CONSTRAINT df_posts_anon DEFAULT 0,
  created_at   DATETIMEOFFSET NOT NULL CONSTRAINT df_posts_created DEFAULT SYSDATETIMEOFFSET(),
  deleted_at   DATETIMEOFFSET NULL
);
CREATE INDEX ix_posts_author ON posts (author_id, created_at DESC);

CREATE TABLE post_likes (
  post_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_likes_post REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_likes_user REFERENCES users(id),
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_likes_created DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_post_likes PRIMARY KEY (post_id, user_id)
);

CREATE TABLE comments (
  id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_comments PRIMARY KEY DEFAULT NEWID(),
  post_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_comments_post REFERENCES posts(id) ON DELETE CASCADE,
  author_id  UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_comments_author REFERENCES users(id),
  parent_id  UNIQUEIDENTIFIER NULL CONSTRAINT fk_comments_parent REFERENCES comments(id),
  body       NVARCHAR(2200) NOT NULL,
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_comments_created DEFAULT SYSDATETIMEOFFSET(),
  deleted_at DATETIMEOFFSET NULL
);
CREATE INDEX ix_comments_post ON comments (post_id, created_at);

CREATE TABLE stories (
  id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_stories PRIMARY KEY DEFAULT NEWID(),
  author_id  UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_stories_author REFERENCES users(id),
  media_url  NVARCHAR(500) NOT NULL,
  caption    NVARCHAR(300) NULL,
  expires_at DATETIMEOFFSET NOT NULL CONSTRAINT df_stories_expires DEFAULT DATEADD(HOUR, 24, SYSDATETIMEOFFSET()),
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_stories_created DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX ix_stories_author ON stories (author_id, expires_at);

CREATE TABLE story_views (
  story_id  UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_sv_story REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_sv_viewer REFERENCES users(id),
  viewed_at DATETIMEOFFSET NOT NULL CONSTRAINT df_sv_viewed DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_story_views PRIMARY KEY (story_id, viewer_id)
);

-- ============ Milestone 4: Soul DNA ============

CREATE TABLE soul_questions (
  id      INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_soul_questions PRIMARY KEY,
  text    NVARCHAR(300) NOT NULL,
  options NVARCHAR(MAX) NOT NULL CONSTRAINT ck_sq_options CHECK (ISJSON(options) = 1),   -- [{ "label": "...", "weights": { "empathy": 2 } }]
  active  BIT NOT NULL CONSTRAINT df_sq_active DEFAULT 1
);

CREATE TABLE soul_answers (
  user_id      UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_sa_user REFERENCES users(id),
  question_id  INT NOT NULL CONSTRAINT fk_sa_question REFERENCES soul_questions(id),
  option_index INT NOT NULL,
  answered_at  DATETIMEOFFSET NOT NULL CONSTRAINT df_sa_answered DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_soul_answers PRIMARY KEY (user_id, question_id)
);

CREATE TABLE behavior_events (
  id         BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_behavior_events PRIMARY KEY,
  user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_be_user REFERENCES users(id),
  type       NVARCHAR(30) NOT NULL,     -- profile_view, dwell, search, like, comment, message_sent, case_vote, ...
  target_id  UNIQUEIDENTIFIER NULL,
  value      DECIMAL(18, 4) NULL,        -- e.g. dwell ms
  meta       NVARCHAR(MAX) NULL CONSTRAINT ck_be_meta CHECK (meta IS NULL OR ISJSON(meta) = 1),
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_be_created DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX ix_behavior_user ON behavior_events (user_id, created_at DESC);

CREATE TABLE soul_profiles (
  user_id        UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_soul_profiles PRIMARY KEY CONSTRAINT fk_sp_user REFERENCES users(id),
  empathy        SMALLINT NOT NULL CONSTRAINT df_sp_empathy DEFAULT 50,
  ambition       SMALLINT NOT NULL CONSTRAINT df_sp_ambition DEFAULT 50,
  humor          SMALLINT NOT NULL CONSTRAINT df_sp_humor DEFAULT 50,
  loyalty        SMALLINT NOT NULL CONSTRAINT df_sp_loyalty DEFAULT 50,
  creativity     SMALLINT NOT NULL CONSTRAINT df_sp_creativity DEFAULT 50,
  conflict_style SMALLINT NOT NULL CONSTRAINT df_sp_conflict DEFAULT 50,   -- 0 = avoids conflict, 100 = confronts directly
  mentality      SMALLINT NOT NULL CONSTRAINT df_sp_mentality DEFAULT 50,  -- 0 = practical/realist, 100 = idealist/optimist
  nature         SMALLINT NOT NULL CONSTRAINT df_sp_nature DEFAULT 50,     -- 0 = introvert/calm, 100 = extrovert/energetic
  summary        NVARCHAR(MAX) NULL,
  confidence     SMALLINT NOT NULL CONSTRAINT df_sp_confidence DEFAULT 0,  -- 0-100, grows with data
  computed_at    DATETIMEOFFSET NOT NULL CONSTRAINT df_sp_computed DEFAULT SYSDATETIMEOFFSET()
);

-- ============ Milestone 5: Argue / Referee ============

CREATE TABLE cases (
  id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_cases PRIMARY KEY DEFAULT NEWID(),
  title        NVARCHAR(150) NOT NULL,
  opened_by    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_cases_opened REFERENCES users(id),
  other_party  UNIQUEIDENTIFIER NULL CONSTRAINT fk_cases_other REFERENCES users(id),
  status       NVARCHAR(20) NOT NULL CONSTRAINT df_cases_status DEFAULT N'open'
               CONSTRAINT ck_cases_status CHECK (status IN (N'open', N'awaiting_other', N'provisional', N'final', N'closed')),
  verdict      NVARCHAR(MAX) NULL CONSTRAINT ck_cases_verdict CHECK (verdict IS NULL OR ISJSON(verdict) = 1),
  verdict_kind NVARCHAR(12) NULL CONSTRAINT ck_cases_kind CHECK (verdict_kind IN (N'provisional', N'final')),
  is_public    BIT NOT NULL CONSTRAINT df_cases_public DEFAULT 0,
  created_at   DATETIMEOFFSET NOT NULL CONSTRAINT df_cases_created DEFAULT SYSDATETIMEOFFSET(),
  updated_at   DATETIMEOFFSET NOT NULL CONSTRAINT df_cases_updated DEFAULT SYSDATETIMEOFFSET()
);

CREATE TABLE case_statements (
  id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_case_statements PRIMARY KEY DEFAULT NEWID(),
  case_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_cs_case REFERENCES cases(id) ON DELETE CASCADE,
  user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_cs_user REFERENCES users(id),
  kind       NVARCHAR(10) NOT NULL CONSTRAINT ck_cs_kind CHECK (kind IN (N'statement', N'question', N'answer')),
  body       NVARCHAR(MAX) NOT NULL,
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_cs_created DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX ix_case_statements ON case_statements (case_id, created_at);

CREATE TABLE case_votes (
  case_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_cv_case REFERENCES cases(id) ON DELETE CASCADE,
  user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_cv_user REFERENCES users(id),
  side       NVARCHAR(4) NOT NULL CONSTRAINT ck_cv_side CHECK (side IN (N'a', N'b', N'both')),
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_cv_created DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_case_votes PRIMARY KEY (case_id, user_id)
);

-- ============ Milestone 6: Face ============

CREATE TABLE face_embeddings (
  user_id     UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_face_embeddings PRIMARY KEY CONSTRAINT fk_fe_user REFERENCES users(id),
  provider    NVARCHAR(20) NOT NULL,     -- local | rekognition
  embedding   NVARCHAR(MAX) NULL CONSTRAINT ck_fe_embedding CHECK (embedding IS NULL OR ISJSON(embedding) = 1),  -- JSON array of 128 floats
  external_id NVARCHAR(100) NULL,        -- Rekognition FaceId
  created_at  DATETIMEOFFSET NOT NULL CONSTRAINT df_fe_created DEFAULT SYSDATETIMEOFFSET()
);
