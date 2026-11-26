-- Soul Filters: new profile data used when finding new people.
-- lat/lon are rounded to about 1 km (area level, never the exact spot).
ALTER TABLE users ADD lat DECIMAL(7,2) NULL;
GO
ALTER TABLE users ADD lon DECIMAL(7,2) NULL;
GO
ALTER TABLE users ADD college NVARCHAR(120) NULL;
GO
ALTER TABLE users ADD company NVARCHAR(120) NULL;
GO
ALTER TABLE users ADD languages NVARCHAR(MAX) NULL CONSTRAINT ck_users_languages CHECK (languages IS NULL OR ISJSON(languages) = 1);
GO
ALTER TABLE users ADD discover_filters NVARCHAR(MAX) NULL CONSTRAINT ck_users_dfilters CHECK (discover_filters IS NULL OR ISJSON(discover_filters) = 1);
GO
CREATE INDEX ix_users_discover ON users (onboarding_done, show_in_discover) INCLUDE (birth_date, gender, lat, lon, last_active_at);
