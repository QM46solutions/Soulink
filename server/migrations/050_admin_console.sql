-- Team console (admin.qm46.in): its own sign-in, app health numbers, issues, releases, and hourly ad bookings.

-- People who can sign in to the console. Not app users. Password (scrypt) + Google Authenticator code.
CREATE TABLE console_users (
  id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_console_users PRIMARY KEY CONSTRAINT df_cu_id DEFAULT NEWID(),
  email         NVARCHAR(254) COLLATE Latin1_General_CI_AS NOT NULL,
  name          NVARCHAR(80) NOT NULL,
  role          NVARCHAR(12) NOT NULL CONSTRAINT ck_cu_role CHECK (role IN (N'owner', N'ads', N'support', N'viewer')),
  pw_hash       NVARCHAR(200) NULL,
  totp_secret   NVARCHAR(64) NULL,
  invite_code   NVARCHAR(64) NULL,
  failed        INT NOT NULL CONSTRAINT df_cu_failed DEFAULT 0,
  locked_until  DATETIMEOFFSET NULL,
  last_login_at DATETIMEOFFSET NULL,
  disabled_at   DATETIMEOFFSET NULL,
  created_at    DATETIMEOFFSET NOT NULL CONSTRAINT df_cu_created DEFAULT SYSDATETIMEOFFSET()
);
GO
CREATE UNIQUE INDEX ux_console_users_email ON console_users (email);
GO
CREATE TABLE console_log (
  id         BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_console_log PRIMARY KEY,
  actor_id   UNIQUEIDENTIFIER NULL,
  actor_name NVARCHAR(80) NULL,
  action     NVARCHAR(200) NOT NULL,
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_cl_created DEFAULT SYSDATETIMEOFFSET()
);
GO
-- How many different people used the app in each hour (Indian time). Fills from today on.
CREATE TABLE activity_hourly (
  day   DATE NOT NULL,
  hour  TINYINT NOT NULL,
  users INT NOT NULL,
  CONSTRAINT pk_activity_hourly PRIMARY KEY (day, hour)
);
GO
CREATE TABLE activity_daily (
  day   DATE NOT NULL CONSTRAINT pk_activity_daily PRIMARY KEY,
  users INT NOT NULL
);
GO
-- Server health, one row per 5 minutes while the server is busy.
CREATE TABLE server_metrics (
  at        DATETIMEOFFSET NOT NULL CONSTRAINT pk_server_metrics PRIMARY KEY,
  requests  INT NOT NULL,
  errors    INT NOT NULL,
  p50_ms    INT NOT NULL,
  p95_ms    INT NOT NULL,
  max_ms    INT NOT NULL,
  rss_mb    INT NOT NULL,
  cpu_pct   SMALLINT NOT NULL,
  slowest   NVARCHAR(400) NULL
);
GO
-- How long each app screen took to become usable (sent by the app from the next version on).
CREATE TABLE screen_timings (
  id         BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_screen_timings PRIMARY KEY,
  screen     NVARCHAR(60) NOT NULL,
  platform   NVARCHAR(10) NULL,
  ms         INT NOT NULL,
  app_version NVARCHAR(20) NULL,
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_st_created DEFAULT SYSDATETIMEOFFSET()
);
GO
CREATE INDEX ix_screen_timings_created ON screen_timings (created_at);
GO
-- Problems: reported by users ("Report a problem"), crashes from the app, or added by the team.
CREATE TABLE app_issues (
  id          INT IDENTITY(100,1) NOT NULL CONSTRAINT pk_app_issues PRIMARY KEY,
  title       NVARCHAR(200) NOT NULL,
  details     NVARCHAR(2000) NULL,
  source      NVARCHAR(10) NOT NULL CONSTRAINT ck_ai_source CHECK (source IN (N'user', N'crash', N'team')),
  severity    NVARCHAR(10) NOT NULL CONSTRAINT df_ai_sev DEFAULT N'medium' CONSTRAINT ck_ai_sev CHECK (severity IN (N'critical', N'high', N'medium', N'low')),
  status      NVARCHAR(12) NOT NULL CONSTRAINT df_ai_status DEFAULT N'new' CONSTRAINT ck_ai_status CHECK (status IN (N'new', N'progress', N'fixed', N'released', N'wontfix')),
  owner       NVARCHAR(80) NULL,
  reports     INT NOT NULL CONSTRAINT df_ai_reports DEFAULT 1,
  user_id     UNIQUEIDENTIFIER NULL,
  platform    NVARCHAR(10) NULL,
  app_version NVARCHAR(20) NULL,
  fixed_in    NVARCHAR(30) NULL,
  created_at  DATETIMEOFFSET NOT NULL CONSTRAINT df_ai_created DEFAULT SYSDATETIMEOFFSET(),
  updated_at  DATETIMEOFFSET NOT NULL CONSTRAINT df_ai_updated DEFAULT SYSDATETIMEOFFSET()
);
GO
-- Every version sent to a store and every over-the-air update.
CREATE TABLE app_releases (
  id          INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_app_releases PRIMARY KEY,
  version     NVARCHAR(40) NOT NULL,
  channel     NVARCHAR(10) NOT NULL CONSTRAINT ck_ar_channel CHECK (channel IN (N'play', N'appstore', N'ota', N'apk')),
  track       NVARCHAR(40) NULL,
  status      NVARCHAR(30) NOT NULL,
  released_on DATE NOT NULL,
  features    NVARCHAR(MAX) NOT NULL CONSTRAINT df_ar_features DEFAULT N'[]' CONSTRAINT ck_ar_features CHECK (ISJSON(features) = 1),
  fixes       NVARCHAR(MAX) NOT NULL CONSTRAINT df_ar_fixes DEFAULT N'[]' CONSTRAINT ck_ar_fixes CHECK (ISJSON(fixes) = 1),
  created_at  DATETIMEOFFSET NOT NULL CONSTRAINT df_ar_created DEFAULT SYSDATETIMEOFFSET()
);
GO
INSERT INTO app_releases (version, channel, track, status, released_on, features, fixes) VALUES
 (N'1.0.0 (1)', N'apk', N'Test APK', N'Retired', '2026-11-04', N'["First phone build for founders and testers"]', N'[]'),
 (N'Update 2026.11.12', N'ota', N'Over-the-air', N'Live', '2026-11-12', N'["Soul DNA v6: 7 rounds, 21 taps, photo grids","7-day cooling period before account deletion; 6-month rejoin wait","Reviewer login for app stores"]', N'["Sparks no longer show a time and name watermark"]'),
 (N'1.0.0 (2)', N'play', N'Internal testing', N'Live', '2026-11-13', N'["New night-aurora app icon","Push notifications (Firebase)","Auto-update: new versions load on next open"]', N'["Keyboard no longer covers text boxes"]'),
 (N'1.0.0 (3)', N'play', N'Internal testing', N'In progress', '2026-11-17', N'["Camera, microphone and location marked optional, so tablets and Chromebooks can install"]', N'[]'),
 (N'Update 2026.11.17', N'ota', N'Over-the-air', N'Live', '2026-11-17', N'["Moments (stories) visible to Connections only; Followers see posts and reels"]', N'[]');
GO
-- Ad customers, hourly bookings and payments (the team books ads; customers don't sign in).
CREATE TABLE ad_customers (
  id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_ad_customers PRIMARY KEY CONSTRAINT df_ac_id DEFAULT NEWID(),
  name         NVARCHAR(120) NOT NULL,
  kind         NVARCHAR(60) NULL,
  contact_name NVARCHAR(80) NULL,
  phone        NVARCHAR(20) NULL,
  email        NVARCHAR(254) NULL,
  gst          NVARCHAR(20) NULL,
  address      NVARCHAR(300) NULL,
  created_at   DATETIMEOFFSET NOT NULL CONSTRAINT df_ac_created DEFAULT SYSDATETIMEOFFSET()
);
GO
CREATE TABLE ad_bookings (
  id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_ad_bookings PRIMARY KEY CONSTRAINT df_ab_id DEFAULT NEWID(),
  invoice_no  INT IDENTITY(1001,1) NOT NULL,
  customer_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_ab_customer REFERENCES ad_customers(id),
  campaign_id UNIQUEIDENTIFIER NULL,
  name        NVARCHAR(120) NOT NULL,
  placement   NVARCHAR(10) NOT NULL,
  cities      NVARCHAR(400) NOT NULL,
  start_date  DATE NOT NULL,
  days        INT NOT NULL,
  hours       NVARCHAR(100) NOT NULL,
  hours_total INT NOT NULL,
  rate        INT NOT NULL,
  subtotal    INT NOT NULL,
  gst         INT NOT NULL,
  total       INT NOT NULL,
  status      NVARCHAR(16) NOT NULL CONSTRAINT df_ab_status DEFAULT N'awaiting' CONSTRAINT ck_ab_status CHECK (status IN (N'awaiting', N'booked', N'cancelled')),
  created_by  NVARCHAR(80) NULL,
  created_at  DATETIMEOFFSET NOT NULL CONSTRAINT df_ab_created DEFAULT SYSDATETIMEOFFSET()
);
GO
CREATE TABLE ad_payments (
  id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_ad_payments PRIMARY KEY CONSTRAINT df_ap_id DEFAULT NEWID(),
  customer_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_ap_customer REFERENCES ad_customers(id),
  booking_id  UNIQUEIDENTIFIER NULL,
  amount      INT NOT NULL,
  method      NVARCHAR(20) NOT NULL,
  reference   NVARCHAR(80) NULL,
  paid_on     DATE NOT NULL,
  recorded_by NVARCHAR(80) NULL,
  created_at  DATETIMEOFFSET NOT NULL CONSTRAINT df_ap_created DEFAULT SYSDATETIMEOFFSET()
);
GO
-- A booked ad shows only in its booked hours (",19,20,21,") and cities (",hyderabad,bengaluru,").
ALTER TABLE ad_campaigns ADD hours_csv NVARCHAR(100) NULL, cities_csv NVARCHAR(400) NULL;
GO
-- Small settings the console can change (ad rate card).
CREATE TABLE console_settings (
  [key]      NVARCHAR(40) NOT NULL CONSTRAINT pk_console_settings PRIMARY KEY,
  value      NVARCHAR(MAX) NOT NULL CONSTRAINT ck_cs_value CHECK (ISJSON(value) = 1),
  updated_at DATETIMEOFFSET NOT NULL CONSTRAINT df_cs_updated DEFAULT SYSDATETIMEOFFSET()
);
GO
INSERT INTO console_settings ([key], value) VALUES (N'rate_card', N'{"rates":{"feed":450,"sparks":700},"peakHours":[19,20,21,22],"peakExtra":0.25,"gst":0.18,"cities":{"Hyderabad":1,"Bengaluru":1,"Mumbai":1.1,"Delhi NCR":1.1,"Chennai":0.8,"Pune":0.8,"Vijayawada":0.5}}');
