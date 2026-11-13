-- Argue / Referee v1 (replaces the unused Milestone 5 draft tables) + Instagram-style chat extras.
CREATE TABLE argue_cases (
  id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_argue_cases PRIMARY KEY DEFAULT NEWID(),
  created_by  UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_ac_creator REFERENCES users(id),
  mode        NVARCHAR(10) NOT NULL CONSTRAINT ck_ac_mode CHECK (mode IN (N'phone', N'invite')),  -- phone = pass one phone around
  topic       NVARCHAR(150) NULL,
  status      NVARCHAR(10) NOT NULL CONSTRAINT df_ac_status DEFAULT N'open' CONSTRAINT ck_ac_status CHECK (status IN (N'open', N'judging', N'decided', N'failed')),
  verdict     NVARCHAR(MAX) NULL CONSTRAINT ck_ac_verdict CHECK (verdict IS NULL OR ISJSON(verdict) = 1),
  judge       NVARCHAR(20) NULL,     -- claude | basic
  created_at  DATETIMEOFFSET NOT NULL CONSTRAINT df_ac_created DEFAULT SYSDATETIMEOFFSET(),
  decided_at  DATETIMEOFFSET NULL
);
CREATE INDEX ix_argue_creator ON argue_cases (created_by, created_at DESC);
GO
CREATE TABLE argue_participants (
  case_id      UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_ap_case REFERENCES argue_cases(id) ON DELETE CASCADE,
  seat         SMALLINT NOT NULL,              -- 1..6, order of speaking
  name         NVARCHAR(50) NOT NULL,
  user_id      UNIQUEIDENTIFIER NULL CONSTRAINT fk_ap_user REFERENCES users(id),   -- set in invite mode (and for the creator)
  statement    NVARCHAR(MAX) NULL,
  submitted_at DATETIMEOFFSET NULL,
  CONSTRAINT pk_argue_participants PRIMARY KEY (case_id, seat)
);
CREATE INDEX ix_argue_user ON argue_participants (user_id);
GO
-- Chat: Soulmoji stickers, replies, reactions
ALTER TABLE messages DROP CONSTRAINT ck_msg_kind;
GO
ALTER TABLE messages ADD CONSTRAINT ck_msg_kind CHECK (kind IN (N'text', N'image', N'voice', N'system', N'soulmoji'));
GO
ALTER TABLE messages ADD reply_to_id UNIQUEIDENTIFIER NULL;
GO
CREATE TABLE message_reactions (
  message_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_mr_msg REFERENCES messages(id) ON DELETE CASCADE,
  user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_mr_user REFERENCES users(id),
  emoji      NVARCHAR(16) NOT NULL,
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_mr_created DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_message_reactions PRIMARY KEY (message_id, user_id)
);
GO
