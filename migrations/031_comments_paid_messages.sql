-- Comments: 👌🏻 likes, replies (comments.parent_id already exists) and offense marks; a comment marked offensive
-- by more than 10 people is hidden from everyone except the person who wrote it.
-- Paid single message (Premium): one message to someone you're not connected with, ₹500 each.
ALTER TABLE comments ADD hidden_at DATETIMEOFFSET NULL;
CREATE TABLE comment_likes (
  comment_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_clikes_comment REFERENCES comments(id) ON DELETE CASCADE,
  user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_clikes_user REFERENCES users(id),
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_clikes_created DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_comment_likes PRIMARY KEY (comment_id, user_id)
);
CREATE TABLE comment_offenses (
  comment_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_coff_comment REFERENCES comments(id) ON DELETE CASCADE,
  user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_coff_user REFERENCES users(id),
  reason     NVARCHAR(20) NULL,
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_coff_created DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_comment_offenses PRIMARY KEY (comment_id, user_id)
);
CREATE INDEX ix_comments_parent ON comments (parent_id);
CREATE TABLE paid_messages (
  id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_paid_messages PRIMARY KEY DEFAULT NEWID(),
  sender_id       UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_paidmsg_sender REFERENCES users(id),
  recipient_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_paidmsg_recipient REFERENCES users(id),
  conversation_id UNIQUEIDENTIFIER NULL,
  message_id      UNIQUEIDENTIFIER NULL,
  amount_paise    INT NOT NULL,
  payment_ref     NVARCHAR(120) NULL,
  status          NVARCHAR(12) NOT NULL CONSTRAINT ck_paidmsg_status CHECK (status IN (N'paid', N'test')),
  created_at      DATETIMEOFFSET NOT NULL CONSTRAINT df_paidmsg_created DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX ix_paid_messages_pair ON paid_messages (sender_id, recipient_id, created_at);
