-- Chat rules (Oct 2026):
--  * Anonymous messages only between Connections; the sender picks how long they stay hidden (anon_threads.reveal_hours).
--    A new anonymous message can be started again after an earlier one was revealed, so the one-per-pair rule goes.
--  * A held Connect request opens a chat in Requests while the hold lasts. When the hold ends the receiver is asked
--    to accept or reject (connection_requests.hold_decide_until); no answer = rejected automatically (auto_rejected).
--  * A chat that ends without a connection is hidden from both people (conversation_members.hidden_at) but kept;
--    if they chat again later, it starts fresh (conversations.history_from).
ALTER TABLE anon_threads DROP CONSTRAINT uq_anon_pair;
GO
CREATE INDEX ix_anon_pair ON anon_threads (sender_id, recipient_id, revealed_at);
GO
ALTER TABLE anon_threads ADD reveal_hours INT NULL;
GO
ALTER TABLE connection_requests ADD hold_decide_until DATETIMEOFFSET NULL, auto_rejected BIT NOT NULL CONSTRAINT df_cr_auto_rejected DEFAULT 0;
GO
ALTER TABLE conversation_members ADD hidden_at DATETIMEOFFSET NULL;
GO
ALTER TABLE conversations ADD history_from DATETIMEOFFSET NULL;
GO
