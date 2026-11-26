-- Chat "+" menu: a game of OX (noughts and crosses) for the two people in a chat. The board lives in the message body.
ALTER TABLE messages DROP CONSTRAINT ck_msg_kind;
GO
ALTER TABLE messages ADD CONSTRAINT ck_msg_kind CHECK (kind IN (N'text', N'image', N'voice', N'system', N'soulmoji', N'post', N'moment', N'location', N'contact', N'document', N'poll', N'game'));
GO
