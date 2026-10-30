-- Group invite links: the only thing from Messages that can be shared. The link shows the group's name, photo and
-- member count (never messages); joining needs a Soulink login. Admins can reset it or turn it off.
ALTER TABLE conversations ADD invite_code NVARCHAR(24) NULL;
GO
CREATE UNIQUE INDEX ux_conversations_invite ON conversations (invite_code) WHERE invite_code IS NOT NULL;
GO
