-- Phone codes sent through Message Central VerifyNow: the provider creates and checks the code itself,
-- so the row keeps the provider's verificationId instead of a code we generated.
ALTER TABLE otp_codes ADD provider_ref NVARCHAR(64) NULL;
