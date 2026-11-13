-- Soulmoji v2: your own selfie (taken once) whose expression is edited for each mood.
ALTER TABLE users ADD soulmoji_face_url NVARCHAR(300) NULL;
GO
ALTER TABLE users ADD soulmoji_points NVARCHAR(MAX) NULL CONSTRAINT ck_users_smpoints CHECK (soulmoji_points IS NULL OR ISJSON(soulmoji_points) = 1);
GO
CREATE TABLE soulmoji_renders (
  id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_soulmoji_renders PRIMARY KEY DEFAULT NEWID(),
  user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_smr_user REFERENCES users(id),
  face_url   NVARCHAR(300) NOT NULL,
  mood       NVARCHAR(20) NOT NULL,
  url        NVARCHAR(300) NOT NULL,
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_smr_created DEFAULT SYSDATETIMEOFFSET()
);
GO
CREATE INDEX ix_smr_user ON soulmoji_renders (user_id, face_url, mood);
