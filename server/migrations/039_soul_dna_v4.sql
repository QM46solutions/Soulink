-- Soul DNA v4: a model of how each person thinks, acts and reacts (scenario-based, adaptive).
--  soul_dna.plan                each person's own list of scenarios (a random mix, grown when the model is unsure)
--  connection_requests.known_as for someone you already know: family | friend | colleague | other
-- The old quiz answers don't fit the new model, so everyone takes the new Soul DNA once (about 8 minutes).
ALTER TABLE soul_dna ADD plan NVARCHAR(MAX) NULL;
GO
ALTER TABLE connection_requests ADD known_as NVARCHAR(20) NULL;
GO
UPDATE soul_dna SET answers = N'{}', dna = NULL, completed_at = NULL, plan = NULL;
GO
UPDATE users SET soul_ready = 0 WHERE soul_ready = 1;
