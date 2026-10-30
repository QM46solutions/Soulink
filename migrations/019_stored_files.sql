-- Cloud hosting: uploaded photos and voice notes are kept in the database too (cloud disks are wiped on restart).
CREATE TABLE stored_files (
  path       NVARCHAR(400) NOT NULL CONSTRAINT pk_stored_files PRIMARY KEY,
  mime       NVARCHAR(100) NOT NULL,
  data       VARBINARY(MAX) NOT NULL,
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_stored_files_created DEFAULT SYSDATETIMEOFFSET()
);
