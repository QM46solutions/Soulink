-- Soulink Events (coming soon): who wants to be told when events launch.
ALTER TABLE users ADD events_notify BIT NOT NULL CONSTRAINT df_users_events_notify DEFAULT 0;
