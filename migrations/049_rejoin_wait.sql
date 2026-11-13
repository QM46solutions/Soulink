-- Deleting your own account: for 6 months the same face, phone number or email can't create a new account.
-- banned_identities now holds two kinds of rows: 'ban' (removed for breaking the rules, 3 years) and
-- 'rejoin' (deleted by the user, 6 months). Both keep the face fingerprint encrypted; rejoin rows are erased
-- completely when the 6 months are over.
ALTER TABLE banned_identities ADD kind NVARCHAR(16) NOT NULL CONSTRAINT df_bi_kind DEFAULT N'ban';
GO
