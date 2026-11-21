-- Fingerprint / face unlock sign-in was removed (19 Nov 2026): switch off every key that phones set up for it.
-- The table stays (history only); nothing reads or creates keys any more.
UPDATE device_keys SET revoked_at = SYSDATETIMEOFFSET() WHERE revoked_at IS NULL;
