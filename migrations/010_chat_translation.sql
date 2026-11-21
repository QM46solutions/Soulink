-- Chat translator: each person's preferred chat language + saved translations (made once per message/language)
ALTER TABLE users ADD chat_language NVARCHAR(5) NULL;
GO
CREATE TABLE message_translations (
  message_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT fk_mt_message REFERENCES messages(id) ON DELETE CASCADE,
  lang       NVARCHAR(5) NOT NULL,
  src_lang   NVARCHAR(5) NOT NULL,
  text       NVARCHAR(MAX) NOT NULL,
  created_at DATETIMEOFFSET NOT NULL CONSTRAINT df_mt_created DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pk_message_translations PRIMARY KEY (message_id, lang)
);
