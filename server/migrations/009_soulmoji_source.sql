-- Soulmoji AI works on the whole original selfie (more context than the face crop)
ALTER TABLE users ADD soulmoji_src_url NVARCHAR(300) NULL;
