-- Connect requests (intent + Soul Score + note) with Accept / Hold / Reject, and the resulting connections.
-- Follow (for seeing posts) stays separate. Chat opens only between connected people.
CREATE TABLE connection_requests (
  id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_conn_requests PRIMARY KEY DEFAULT NEWID(),
  from_id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_cr_from REFERENCES users(id),
  to_id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_cr_to REFERENCES users(id),
  knows           BIT NOT NULL CONSTRAINT df_cr_knows DEFAULT 0,          -- 1 = "someone I know", 0 = "someone new"
  intent          NVARCHAR(20) NOT NULL,
  note            NVARCHAR(150) NULL,
  soul_score      SMALLINT NULL,
  status          NVARCHAR(12) NOT NULL CONSTRAINT df_cr_status DEFAULT N'pending'
                  CONSTRAINT ck_cr_status CHECK (status IN (N'pending', N'held', N'accepted', N'rejected', N'suspended', N'withdrawn')),
  accepted_intent NVARCHAR(20) NULL,       -- set when accepted "as something else"
  hold_days       SMALLINT NULL,
  hold_until      DATETIMEOFFSET NULL,
  hold_reminded   BIT NOT NULL CONSTRAINT df_cr_reminded DEFAULT 0,
  hold_extended   BIT NOT NULL CONSTRAINT df_cr_extended DEFAULT 0,
  created_at      DATETIMEOFFSET NOT NULL CONSTRAINT df_cr_created DEFAULT SYSDATETIMEOFFSET(),
  responded_at    DATETIMEOFFSET NULL,
  CONSTRAINT ck_cr_self CHECK (from_id <> to_id)
);
CREATE INDEX ix_cr_to ON connection_requests (to_id, status, created_at DESC);
CREATE INDEX ix_cr_from ON connection_requests (from_id, status, created_at DESC);
-- only one open (pending or on hold) request from A to B at a time
CREATE UNIQUE INDEX ux_cr_open ON connection_requests (from_id, to_id) WHERE status IN (N'pending', N'held');
CREATE INDEX ix_cr_holds ON connection_requests (status, hold_until) WHERE status = N'held';
GO
CREATE TABLE connections (
  user_a     UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_conn_a REFERENCES users(id),   -- the pair is stored in the app's sorted (upper-case text) order
  user_b     UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_conn_b REFERENCES users(id),
  intent     NVARCHAR(20) NOT NULL,
  request_id UNIQUEIDENTIFIER NULL,
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_conn_created DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_connections PRIMARY KEY (user_a, user_b)
);
CREATE INDEX ix_conn_b ON connections (user_b);
GO
-- Which intents a person accepts receiving ("Open to"); default: everything
ALTER TABLE users ADD open_to NVARCHAR(MAX) NOT NULL
  CONSTRAINT df_users_open_to DEFAULT N'["friendship","dating","situationship","buddy","networking","vibing","unsure"]'
  CONSTRAINT ck_users_open_to CHECK (ISJSON(open_to) = 1);
GO
-- Notifications can carry small extra details (e.g. hold length, intent)
ALTER TABLE notifications ADD meta NVARCHAR(MAX) NULL CONSTRAINT ck_notif_meta CHECK (meta IS NULL OR ISJSON(meta) = 1);
GO
