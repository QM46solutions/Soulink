-- New accounts are private by default (only Connections see posts, Sparks and stories); each person can switch
-- to public in Settings › Privacy. Existing accounts keep the setting they have.
ALTER TABLE users DROP CONSTRAINT df_users_private;
ALTER TABLE users ADD CONSTRAINT df_users_private DEFAULT 1 FOR is_private;
