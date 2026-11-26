-- Grievance Officer complaints and lawful orders (IT Rules 2021 as amended to Feb 2026; DPDP Rules 2025).
-- Complaints: acknowledged at once (by email), resolved within 7 days; intimate images / impersonation of the
-- complainant removed within 2 hours. Lawful orders (court / government): content removed within 3 hours;
-- requests for user information answered within 72 hours. Records kept 3 years as evidence (security policy s.17).
CREATE TABLE grievances (
  id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_grievances PRIMARY KEY CONSTRAINT df_grv_id DEFAULT NEWID(),
  ticket_no      INT IDENTITY(5001, 1) NOT NULL,
  user_id        UNIQUEIDENTIFIER NULL,                 -- the complainant's account, when logged in
  name           NVARCHAR(120) NOT NULL,
  email          NVARCHAR(254) NOT NULL,
  phone          NVARCHAR(30) NULL,
  category       NVARCHAR(30) NOT NULL,                 -- intimate_or_impersonation | content | account | privacy | data_rights | ai_content | payment | other
  about_url      NVARCHAR(500) NULL,                    -- link to the post / Spark / profile
  about_username NVARCHAR(40) NULL,
  details        NVARCHAR(2000) NOT NULL,
  status         NVARCHAR(20) NOT NULL CONSTRAINT df_grv_status DEFAULT N'open',  -- open | in_progress | resolved | rejected
  urgent         BIT NOT NULL CONSTRAINT df_grv_urgent DEFAULT 0,                 -- 2-hour removal clock
  ack_sent_at    DATETIMEOFFSET NULL,
  due_at         DATETIMEOFFSET NOT NULL,               -- 2 hours (urgent) or 7 days
  reminded_at    DATETIMEOFFSET NULL,
  resolution     NVARCHAR(2000) NULL,
  resolved_at    DATETIMEOFFSET NULL,
  handled_by     NVARCHAR(80) NULL,                     -- console team member's name
  created_at     DATETIMEOFFSET NOT NULL CONSTRAINT df_grv_created DEFAULT SYSDATETIMEOFFSET()
);
GO
CREATE INDEX ix_grievances_status ON grievances (status, due_at);
GO
CREATE TABLE legal_orders (
  id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_legal_orders PRIMARY KEY CONSTRAINT df_lgo_id DEFAULT NEWID(),
  ref_no         INT IDENTITY(9001, 1) NOT NULL,
  source         NVARCHAR(20) NOT NULL,                 -- court | government | police | cert_in | other
  authority      NVARCHAR(200) NOT NULL,                -- who sent it (court name, ministry, police station)
  order_ref      NVARCHAR(120) NULL,                    -- their number / case number
  order_date     DATE NULL,
  kind           NVARCHAR(20) NOT NULL,                 -- takedown | info_request | preserve
  received_at    DATETIMEOFFSET NOT NULL,
  due_at         DATETIMEOFFSET NOT NULL,               -- takedown 3 h, info request 72 h, preserve 3 h
  content_urls   NVARCHAR(MAX) NULL,                    -- one link per line
  target_username NVARCHAR(40) NULL,
  summary        NVARCHAR(2000) NOT NULL,
  verified       BIT NOT NULL CONSTRAINT df_lgo_verified DEFAULT 0, -- official email domain / signed order checked
  status         NVARCHAR(20) NOT NULL CONSTRAINT df_lgo_status DEFAULT N'open', -- open | done | rejected
  action_note    NVARCHAR(2000) NULL,
  removed_count  INT NOT NULL CONSTRAINT df_lgo_removed DEFAULT 0,
  done_at        DATETIMEOFFSET NULL,
  done_by        NVARCHAR(80) NULL,
  created_by     NVARCHAR(80) NULL,
  reminded_at    DATETIMEOFFSET NULL,
  created_at     DATETIMEOFFSET NOT NULL CONSTRAINT df_lgo_created DEFAULT SYSDATETIMEOFFSET()
);
GO
CREATE INDEX ix_legal_orders_status ON legal_orders (status, due_at);
GO
