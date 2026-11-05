-- Soulmoji AI: the photo sent to the AI is now a square around the face (not the whole selfie), and
-- users.soulmoji_crop says where the Soulmoji face square sits inside it, so every AI expression comes back
-- framed exactly like the Soulmoji face (an uploaded photo with the person small in it used to come back whole).
ALTER TABLE users ADD soulmoji_crop NVARCHAR(200) NULL;
GO
