-- Soul Events: real-life events the team creates in the console (Soul Pub, marathons, cricket…). People register
-- in the app (name and phone from their account, address, a government ID), pay through Razorpay and get a QR
-- ticket; staff scan it at the gate, once.
CREATE TABLE soul_events (
  id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_soul_events PRIMARY KEY CONSTRAINT df_se_id DEFAULT NEWID(),
  title       NVARCHAR(120) NOT NULL,
  kind        NVARCHAR(20) NOT NULL CONSTRAINT df_se_kind DEFAULT N'social',
  tagline     NVARCHAR(200) NULL,
  description NVARCHAR(3000) NULL,
  venue       NVARCHAR(200) NOT NULL,
  city        NVARCHAR(60) NOT NULL,
  map_url     NVARCHAR(500) NULL,
  starts_at   DATETIMEOFFSET NOT NULL,
  ends_at     DATETIMEOFFSET NULL,
  price       INT NOT NULL CONSTRAINT df_se_price DEFAULT 0,     -- rupees per ticket, GST included
  capacity    INT NOT NULL,
  min_age     INT NULL,
  cover_url   NVARCHAR(500) NULL,
  status      NVARCHAR(12) NOT NULL CONSTRAINT df_se_status DEFAULT N'draft'
              CONSTRAINT ck_se_status CHECK (status IN (N'draft', N'published', N'closed', N'cancelled')),
  created_by  NVARCHAR(80) NULL,
  created_at  DATETIMEOFFSET NOT NULL CONSTRAINT df_se_created DEFAULT SYSDATETIMEOFFSET(),
  updated_at  DATETIMEOFFSET NOT NULL CONSTRAINT df_se_updated DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT ck_se_price CHECK (price >= 0),
  CONSTRAINT ck_se_capacity CHECK (capacity > 0)
);
GO
CREATE INDEX ix_soul_events_status ON soul_events (status, starts_at);
GO
CREATE TABLE event_registrations (
  id             UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_event_regs PRIMARY KEY CONSTRAINT df_er_id DEFAULT NEWID(),
  event_id       UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_er_event REFERENCES soul_events(id),
  user_id        UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_er_user REFERENCES users(id),
  full_name      NVARCHAR(80) NOT NULL,
  phone          NVARCHAR(20) NOT NULL,
  address        NVARCHAR(400) NOT NULL,
  id_type        NVARCHAR(12) NOT NULL CONSTRAINT ck_er_idtype CHECK (id_type IN (N'aadhaar', N'pan', N'dl', N'passport')),
  id_proof_url   NVARCHAR(500) NULL,                -- private file; removed some time after the event
  amount         INT NOT NULL,
  status         NVARCHAR(12) NOT NULL CONSTRAINT df_er_status DEFAULT N'pending'
                 CONSTRAINT ck_er_status CHECK (status IN (N'pending', N'paid', N'cancelled', N'refunded')),
  pay_mode       NVARCHAR(8) NULL,                  -- live | test | free
  rzp_order_id   NVARCHAR(60) NULL,
  rzp_payment_id NVARCHAR(60) NULL,
  ticket_code    NVARCHAR(24) NULL,
  paid_at        DATETIMEOFFSET NULL,
  checked_in_at  DATETIMEOFFSET NULL,
  checked_in_by  NVARCHAR(80) NULL,
  created_at     DATETIMEOFFSET NOT NULL CONSTRAINT df_er_created DEFAULT SYSDATETIMEOFFSET(),
  updated_at     DATETIMEOFFSET NOT NULL CONSTRAINT df_er_updated DEFAULT SYSDATETIMEOFFSET()
);
GO
CREATE UNIQUE INDEX ux_event_regs_user ON event_registrations (event_id, user_id);
CREATE UNIQUE INDEX ux_event_regs_ticket ON event_registrations (ticket_code) WHERE ticket_code IS NOT NULL;
CREATE INDEX ix_event_regs_user ON event_registrations (user_id);
CREATE INDEX ix_event_regs_order ON event_registrations (rzp_order_id) WHERE rzp_order_id IS NOT NULL;
