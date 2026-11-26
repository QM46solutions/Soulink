-- Sparks can be reported to the Soulink team (the ⋯ menu on a Spark), like posts.
ALTER TABLE reports DROP CONSTRAINT ck_reports_type;
ALTER TABLE reports ADD CONSTRAINT ck_reports_type CHECK (target_type IN (N'user', N'post', N'comment', N'message', N'case', N'story', N'spark'));
