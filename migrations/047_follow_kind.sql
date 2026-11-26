-- Follow vs Connect. Until now a follows row meant "connected to" (a one-way Connect). Public profiles now also get a
-- plain Follow (see their posts and Sparks, no request, no chat); private profiles can only be connected with.
--  follows.kind  'connect' = connected to them (one way; both ways = Connections)  ·  'follow' = just following
ALTER TABLE follows ADD kind NVARCHAR(10) NOT NULL CONSTRAINT df_follows_kind DEFAULT N'connect';
