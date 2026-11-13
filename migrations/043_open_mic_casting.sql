-- Open Mic is now "speak your mind": anyone shares something openly (a story, an incident, society, politics,
-- raising a voice...) on video or with just their voice. Those Sparks have category 'openmic' + a topic, and
-- stay in the Open Mic tab (not the main Sparks feed). Casting calls get clear requirements (age, gender,
-- languages, location, paid or not).
ALTER TABLE sparks DROP CONSTRAINT ck_sparks_category;
GO
ALTER TABLE sparks ADD CONSTRAINT ck_sparks_category CHECK (category IN (N'travel', N'cooking', N'acting', N'fitness', N'news', N'openmic'));
GO
ALTER TABLE sparks ADD mic_topic NVARCHAR(20) NULL, is_voice BIT NOT NULL CONSTRAINT df_sparks_is_voice DEFAULT 0;
GO
CREATE INDEX ix_sparks_mic ON sparks (category, mic_topic, created_at DESC);
GO
ALTER TABLE casting_calls ADD requirements NVARCHAR(MAX) NULL;
GO
