-- Milestone 2: chat additions.
-- A 1:1 conversation gets a direct_key made of the two user ids in sorted order,
-- so the same pair of people always share one thread (and two taps can't create two).
ALTER TABLE conversations ADD direct_key NVARCHAR(80) NULL;
GO
CREATE UNIQUE INDEX ux_conversations_direct ON conversations (direct_key) WHERE direct_key IS NOT NULL;
CREATE INDEX ix_conversations_last ON conversations (last_message_at DESC);
GO
-- Faster "unread count" lookups
CREATE INDEX ix_messages_conv_sender ON messages (conversation_id, sender_id, created_at);
