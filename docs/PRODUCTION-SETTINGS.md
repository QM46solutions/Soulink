# Production settings (Azure, Central India)

The server refuses to start as a public production server (NODE_ENV=production, no ACCESS_CODE) unless these are set.
Put every secret in Azure Key Vault and reference it from App Service settings.

| Setting | Value | Why |
| --- | --- | --- |
| NODE_ENV | production | |
| JWT_SECRET | 64 random characters | Login tokens |
| FACE_KEY | 32 random bytes, base64 (see below) | Encrypts face fingerprints (AES-256-GCM) |
| SMS_PROVIDER | msg91 | Login codes by SMS |
| MSG91_AUTH_KEY | from MSG91 | |
| MSG91_OTP_TEMPLATE_ID | DLT-approved OTP template (variable `##otp##`) | |
| MSG91_ACCOUNT_DELETED_TEMPLATE_ID | DLT-approved "account deleted" template (optional) | Notice to phone-only accounts |
| EMAIL_PROVIDER | resend | Login codes by email, account notices |
| RESEND_API_KEY, EMAIL_FROM | from Resend, e.g. `Soulink <no-reply@yourdomain>` | |
| OTP_DEV_ECHO | false | Codes are never returned by the API |
| TESTING_MODE | false | Strict rate limits |
| PREMIUM_FREE_TRIAL | false | |
| CORS_ORIGINS | other websites allowed to call the API, comma separated (the app's own address is always allowed) | |
| EXPORT_KEY | 64 random characters | Signs "Download my data" files so Restore accepts only genuine ones |
| ADMIN_USERNAMES | Soulink team usernames, comma separated | Ads Manager, bans |
| COPYRIGHT_EMAIL | the inbox that receives copyright reports (default: Grievance Officer) | Copyright notices |
| MUSIC_DEEZER / MUSIC_PHONE | off (until licensed) | Unlicensed music stays off |
| SOULMOJI_ENGINE | `ai` on Render (benchmark-quality Soulmojis from the Azure AI). Without a working SOULMOJI_AI_URL it falls back to the built-in engine | Soulmoji |
| SOULMOJI_AI_URL | `https://<app>.centralindia.azurecontainerapps.io` from soulmoji-cloud/AZURE-SETUP.md | Soulmoji |
| SOULMOJI_AI_TOKEN | the secret printed by the Azure setup (same value is stored in Azure) | Soulmoji |
| SOULMOJI_AI_FEATURES | `edit` (the Azure container does only Soulmoji; voice translator and Argue referee stay as they are) | Soulmoji |
| FACE_SEARCH | false (feature on hold) | |
| DB_ENCRYPT / DB_TRUST_SERVER_CERT | true / false | Encrypted database connection |

Make a FACE_KEY (once, keep it in Key Vault; losing it means every user must redo the face scan):

    node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

Never change FACE_KEY or JWT_SECRET casually: a new JWT_SECRET logs everyone out; a new FACE_KEY needs a re-encryption step.
