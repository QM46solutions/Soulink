-- Build 1: Soul DNA v1 (vibe quiz). A person must have an active Soul DNA before connecting with anyone.
ALTER TABLE users ADD soul_ready BIT NOT NULL CONSTRAINT df_users_soul_ready DEFAULT 0;
GO
ALTER TABLE users ADD soul_type NVARCHAR(40) NULL;
GO
ALTER TABLE soul_profiles ADD quiz_answers NVARCHAR(MAX) NULL CONSTRAINT ck_sp_quiz CHECK (quiz_answers IS NULL OR ISJSON(quiz_answers) = 1);
GO
