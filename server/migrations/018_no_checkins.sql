-- Chats and meetups are private: Soulink never asks for feedback about them (check-ins removed).
IF OBJECT_ID(N'dbo.pair_checkins', N'U') IS NOT NULL DROP TABLE dbo.pair_checkins;
