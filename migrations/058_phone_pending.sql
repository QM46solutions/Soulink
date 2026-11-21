-- A phone number added in Settings while SMS codes are off is kept as "pending" (not the sign-in number) until it is
-- confirmed with a code sent to it; nobody can sign in with a pending number.
ALTER TABLE users ADD phone_pending NVARCHAR(20) NULL;
