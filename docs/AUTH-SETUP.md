# Soulink sign-in: how it works and how to configure it

_Last updated: 18 Nov 2026 (migration 056)._

## The flows

| Who | How they get in | What gets marked |
|---|---|---|
| New person | Email → 6-digit code by email → face check (one-time, duplicate-account check) → profile | `email_verified_at` (only when the email was really sent) and, after the face check, `face_verified` |
| Returning person, same phone | **Sign in with fingerprint / face unlock** (if they turned it on) — or email code | nothing new |
| Returning person, new phone / biometrics changed | Email code, then they can turn quick sign-in on again | nothing new |
| Phone number (SMS) | **Off** until MSG91 + DLT are live and tested (`PHONE_LOGIN=true`) | `phone_verified_at` only after a real SMS |
| Store reviewer | `REVIEW_PHONE` + `REVIEW_CODE` (fixed code, nothing is sent) | never marked phone-verified |

**Quick sign-in is not face verification.** The phone's own biometric check only releases a random sign-in key
stored in the Android Keystore / iOS Keychain. Soulink never receives a fingerprint or face image or template, and
the unlock says nothing about *whose* face it is, so it never changes `face_verified` or the verified badge.

## Security rules in the code

- Codes: 6 digits, stored as an HMAC (never plain), expire in 5 min, single use, 5 wrong tries then dead.
- Limits per address: one code every 30 s, 5 an hour, 10 a day; plus 20 code requests / 15 min per IP
  (`/auth/otp`, `/account/email`) and 30 quick-sign-in tries / 15 min per IP.
- If the email/SMS fails to send, the code is thrown away and the person gets a clear "couldn't send" message.
- The code request answers the same whether or not an account exists (no account lookup by email/phone).
- Codes are shown on screen (`devCode`) **only** in development, or for addresses in `TEST_LOGIN_TARGETS` while
  `OTP_DEV_ECHO=true`. The public never gets a code back from the API.
- Quick sign-in keys: 32 random bytes; server keeps only an HMAC; max 5 per account; switched off after 5 wrong
  tries or 180 days unused, when that device is logged out from another device, on "log out of all other
  devices", and on account deletion. A paused / scheduled-for-deletion account must use an email code.
- Adding or changing an email (Settings › Sign-in & security) needs a code sent to the **new** address; that code
  can't be used to sign in, and a login code can't be used to change an email.

## Render settings (Dashboard → soulink service → Environment)

Enter secrets only in Render. Never paste them into chat, code or Git.

### Email (Resend) — needed for real email codes
1. Create a Resend account, add the sending domain (e.g. `qm46.in` or a subdomain such as `mail.qm46.in`) and add
   the DNS records Resend shows (SPF/DKIM; DMARC recommended) at the domain's DNS host. Wait for "Verified".
2. Create an API key with **Sending access** only, restricted to that domain.
3. In Render set:
   - `EMAIL_PROVIDER` = `resend`
   - `RESEND_API_KEY` = the key (secret)
   - `EMAIL_FROM` = `Soulink <no-reply@qm46.in>` (must be on the verified domain)
4. Save → redeploy. Test with a team email listed in `TEST_LOGIN_TARGETS` first.

### Team testing (while phone codes are off)
- `TEST_LOGIN_TARGETS` = comma-separated team numbers / emails, e.g. `98xxxxxxxx,someone@example.com`.
  These may use phone sign-in while it's off, and see their code on screen while `OTP_DEV_ECHO=true`.
  **Must be empty before public launch** (the server refuses to start otherwise).

### SMS (MSG91) — later, when DLT is approved
- `SMS_PROVIDER` = `msg91`, `MSG91_AUTH_KEY` (secret), `MSG91_OTP_TEMPLATE_ID` (DLT-approved template), test with
  team numbers, then `PHONE_LOGIN` = `true`.

### Before public launch (server refuses to start otherwise when `ACCESS_CODE` is empty)
- `OTP_DEV_ECHO` = `false`, `TEST_LOGIN_TARGETS` empty, `EMAIL_PROVIDER` = `resend`, `PHONE_LOGIN` true only with a real SMS provider.

## Database
Migration `056_verified_contacts_device_keys.sql` runs automatically on deploy: adds `users.email_verified_at`,
`users.phone_verified_at`, `otp_codes.purpose` / `user_id`, and the `device_keys` table. Existing accounts are
not marked verified retroactively.

## App builds
- Android build 4 (1.0.0) already contains the secure-storage module, so the new screens arrive by OTA update.
- iOS needs a new build (Face ID usage text added to `app.json`).
