-- Why someone marked a post offensive (Instagram-style report reasons).
ALTER TABLE post_offenses ADD reason NVARCHAR(30) NULL;
