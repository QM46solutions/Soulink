-- Chat "+" menu (WhatsApp-style): share a location, a Soulink contact, a document, or a poll.
ALTER TABLE messages DROP CONSTRAINT ck_msg_kind;
GO
ALTER TABLE messages ADD CONSTRAINT ck_msg_kind CHECK (kind IN (N'text', N'image', N'voice', N'system', N'soulmoji', N'post', N'moment', N'location', N'contact', N'document', N'poll'));
GO
-- one vote per person per poll (changing your answer replaces it)
CREATE TABLE poll_votes (
  message_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_pv_msg REFERENCES messages(id) ON DELETE CASCADE,
  user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_pv_user REFERENCES users(id),
  option_idx INT NOT NULL,
  voted_at   DATETIMEOFFSET NOT NULL CONSTRAINT df_pv_voted DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_poll_votes PRIMARY KEY (message_id, user_id)
);
