-- Staff / internal accounts (e.g. "administrator") must never appear to users:
-- not in Discover / "Your matches", not in Search. Enforced server-side.
ALTER TABLE users ADD is_staff BIT NOT NULL CONSTRAINT df_users_is_staff DEFAULT 0;
GO
UPDATE users SET is_staff = 1, show_in_discover = 0
 WHERE LOWER(username) IN (N'administrator', N'admin', N'soulink', N'support');
