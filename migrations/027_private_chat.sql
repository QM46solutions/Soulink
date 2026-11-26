-- Private chat (tap 3 times in a chat): while it's on, new messages disappear once everyone has seen them
-- and someone leaves the chat (like Instagram's vanish mode).
ALTER TABLE conversations ADD private_mode BIT NOT NULL CONSTRAINT df_conv_private DEFAULT 0;
ALTER TABLE messages ADD vanish BIT NOT NULL CONSTRAINT df_msg_vanish DEFAULT 0;
ALTER TABLE messages ADD vanished_at DATETIMEOFFSET NULL;
