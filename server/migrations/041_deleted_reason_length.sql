-- deleted_accounts.reason was NVARCHAR(20): longer reasons ("unfinished_signup_expired") made the deletion fail.
ALTER TABLE deleted_accounts ALTER COLUMN reason NVARCHAR(60) NULL;
GO
