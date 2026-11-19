-- Update App policy, richer crash / problem reports, and slow-request timings from the app.
-- Additive only: new nullable columns, one new table, one settings row. Nothing is renamed or removed.
ALTER TABLE app_issues ADD category NVARCHAR(40) NULL, comments NVARCHAR(1000) NULL, build NVARCHAR(30) NULL,
  os_version NVARCHAR(30) NULL, device NVARCHAR(80) NULL, screen NVARCHAR(60) NULL, screenshot_url NVARCHAR(500) NULL,
  fatal BIT NULL;
GO
ALTER TABLE screen_timings ADD build NVARCHAR(30) NULL;
GO
CREATE TABLE api_timings (
  id          BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_api_timings PRIMARY KEY,
  path        NVARCHAR(80) NOT NULL,   -- pattern only: ids replaced by :id, no query strings
  method      NVARCHAR(8) NOT NULL,
  status      INT NULL,                -- 0 = no response (network)
  ms          INT NOT NULL,
  platform    NVARCHAR(10) NULL,
  app_version NVARCHAR(20) NULL,
  build       NVARCHAR(30) NULL,
  created_at  DATETIMEOFFSET NOT NULL CONSTRAINT df_apit_created DEFAULT SYSDATETIMEOFFSET()
);
GO
CREATE INDEX ix_api_timings_created ON api_timings (created_at);
GO
IF NOT EXISTS (SELECT 1 FROM console_settings WHERE [key] = N'app_update')
  INSERT INTO console_settings ([key], value) VALUES (N'app_update',
    N'{"android":{"latest":"1.0.0","minimum":"1.0.0"},"ios":{"latest":"1.0.0","minimum":"1.0.0"},"message":"","mandatory":false}');
GO
