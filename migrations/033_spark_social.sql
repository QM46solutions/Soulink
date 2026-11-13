-- Sparks get the same social tools as posts: comments (replies, 👌🏻, offense marks), offense marks on the Spark and shares.
ALTER TABLE sparks ADD suspended_at DATETIMEOFFSET NULL;
CREATE TABLE spark_comments (
  id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_spark_comments PRIMARY KEY DEFAULT NEWID(),
  spark_id   UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_sc_spark REFERENCES sparks(id),
  author_id  UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_sc_author REFERENCES users(id),
  parent_id  UNIQUEIDENTIFIER NULL,
  body       NVARCHAR(2200) NOT NULL,
  hidden_at  DATETIMEOFFSET NULL,
  deleted_at DATETIMEOFFSET NULL,
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_sc_created DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX ix_spark_comments ON spark_comments (spark_id, created_at);
CREATE TABLE spark_comment_likes (
  comment_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_scl_c REFERENCES spark_comments(id),
  user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_scl_u REFERENCES users(id),
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_scl_created DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_spark_comment_likes PRIMARY KEY (comment_id, user_id)
);
CREATE TABLE spark_comment_offenses (
  comment_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_sco_c REFERENCES spark_comments(id),
  user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_sco_u REFERENCES users(id),
  reason     NVARCHAR(20) NULL,
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_sco_created DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_spark_comment_offenses PRIMARY KEY (comment_id, user_id)
);
CREATE TABLE spark_offenses (
  spark_id   UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_so_s REFERENCES sparks(id),
  user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_so_u REFERENCES users(id),
  reason     NVARCHAR(20) NULL,
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_so_created DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_spark_offenses PRIMARY KEY (spark_id, user_id)
);
CREATE TABLE spark_shares (
  id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT pk_spark_shares PRIMARY KEY DEFAULT NEWID(),
  spark_id   UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_ss_s REFERENCES sparks(id),
  user_id    UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_ss_u REFERENCES users(id),
  channel    NVARCHAR(10) NOT NULL,
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_ss_created DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX ix_spark_shares ON spark_shares (spark_id);
