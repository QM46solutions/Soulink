-- Soul DNA v2: one long quiz in sections (answers saved as you go).
CREATE TABLE soul_dna (
  user_id      UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_soul_dna PRIMARY KEY CONSTRAINT fk_dna_user REFERENCES users(id),
  answers      NVARCHAR(MAX) NOT NULL CONSTRAINT df_dna_answers DEFAULT N'{}',
  dna          NVARCHAR(MAX) NULL,           -- computed axes / priorities / spread (JSON), set when completed
  completed_at DATETIMEOFFSET NULL,
  updated_at   DATETIMEOFFSET NOT NULL CONSTRAINT df_dna_updated DEFAULT SYSDATETIMEOFFSET()
);
GO
-- Everyone retakes Soul DNA (the old 10-question quiz is retired). Old answers stay in soul_profiles for reference.
UPDATE users SET soul_ready = 0;
