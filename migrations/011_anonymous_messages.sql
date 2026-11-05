-- Anonymous messages: anyone can message anyone anonymously. The sender's identity is hidden
-- for 7 days from the first message, or until the two become a Soul Connection (whichever comes first).
CREATE TABLE anon_threads (
  id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_anon_threads PRIMARY KEY DEFAULT NEWID(),
  sender_id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_anon_sender REFERENCES users(id),
  recipient_id      UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_anon_recipient REFERENCES users(id),
  alias             NVARCHAR(40) NOT NULL,
  created_at        DATETIMEOFFSET NOT NULL CONSTRAINT df_anon_created DEFAULT SYSDATETIMEOFFSET(),
  reveal_at         DATETIMEOFFSET NOT NULL,
  revealed_at       DATETIMEOFFSET NULL,
  reveal_reason     NVARCHAR(12) NULL,      -- 'time' (7 days passed) or 'connected'
  last_message_at   DATETIMEOFFSET NOT NULL CONSTRAINT df_anon_last DEFAULT SYSDATETIMEOFFSET(),
  sender_read_at    DATETIMEOFFSET NULL,
  recipient_read_at DATETIMEOFFSET NULL,
  hidden_by_sender    BIT NOT NULL CONSTRAINT df_anon_hs DEFAULT 0,
  hidden_by_recipient BIT NOT NULL CONSTRAINT df_anon_hr DEFAULT 0,
  CONSTRAINT uq_anon_pair UNIQUE (sender_id, recipient_id)
);
CREATE INDEX ix_anon_recipient ON anon_threads (recipient_id, last_message_at DESC);
CREATE INDEX ix_anon_reveal ON anon_threads (revealed_at, reveal_at);
GO
CREATE TABLE anon_messages (
  id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_anon_messages PRIMARY KEY DEFAULT NEWID(),
  thread_id   UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_anonmsg_thread REFERENCES anon_threads(id) ON DELETE CASCADE,
  from_sender BIT NOT NULL,
  body        NVARCHAR(1000) NOT NULL,
  created_at  DATETIMEOFFSET NOT NULL CONSTRAINT df_anonmsg_created DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX ix_anonmsg_thread ON anon_messages (thread_id, created_at);
