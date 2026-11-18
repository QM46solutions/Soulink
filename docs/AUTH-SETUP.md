# Soulink sign-in: how it works and how to configure it

_Last updated: 19 Nov 2026 (migration 056)._

## The rule (agreed 19 Nov 2026)

- **New accounts:** an email confirmed with a code is mandatory. Sign-up starts with email; a phone sign-up (once SMS
  is live) adds and confirms its email as the first step of profile setup. The server refuses to finish a profile
  without one (`SIGNUP_EMAIL_REQUIRED`, on everywhere except the automated tests).
- **Existing accounts without email:** reminded once per app launch on Home to add one (Settings › Sign-in &
  security). A code goes only to the address they type.
- **Returning people:** opening the app never asks for anything while the session is alive. A session ends only on
  logout, "log out of other devices", a ban or deletion, or after 30 days unused (`JWT_EXPIRES_IN`, renews itself
  while the app is used). After that, the phone's own Face ID / fingerprint ("quick sign-in", offered at the end of
  registration and after a code sign-in) gets them back in. A code is asked only for a fresh login (new phone,
  reinstall, web, no biometrics, "Not you? Use another account"), recovery (biometrics changed, key switched off,
  3 failed tries) or a paused / deleting account.
- **Which code:** the phone number first once SMS is live (`PHONE_LOGIN=true`; the app reads `GET /auth/options`),
  email as the fallback. Until then, email.
- **No other codes:** codes are sent only for signing in and for adding / changing an email. Nothing else in the app
  sends one, and a session never asks for a code again.

## The flows

| Who | How they get in | What gets marked |
|---|---|---|
| New person | Email → 6-digit code by email → face check (one-time, duplicate-account check) → profile | `email_verified_at` (only when the email was really sent) and, after the face check, `face_verified` |
| Returning person, same phone | **Sign in with fingerprint / face unlock**; email code only as the fallback above | nothing new |
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

### Email provider (needed for real email codes)

All email goes through `server/src/providers/email.js` (`sendEmail`), so switching provider is a settings change.

| Setting | Value |
|---|---|
| `EMAIL_PROVIDER` | `resend` (recommended) or `gmail`; `console` only for development |
| `EMAIL_FROM` | `Soulink <no-reply@qm46.in>`: must be on the verified domain (Resend) or the Workspace mailbox (Gmail) |
| `RESEND_API_KEY` | secret, Resend → API Keys, **Sending access** only, limited to the domain |
| `GMAIL_SERVICE_ACCOUNT` | secret, only for `gmail`: the service-account key file's JSON, base64-encoded |
| `GMAIL_SENDER` | only for `gmail`: the Google Workspace mailbox to send as, e.g. `no-reply@qm46.in` |
| `EMAIL_FALLBACK_PROVIDER` | optional: tried once if the main provider fails (e.g. `gmail` behind `resend`) |

**Resend:** add the domain (or a subdomain such as `mail.qm46.in`) in Resend → Domains, add the DNS records it shows
at the domain's DNS host, wait for "Verified", create the key, set the three settings, **Save and deploy**.

**Gmail API (only with Google Workspace on qm46.in):** a personal @gmail.com can't be used (a service account can
only act for a Workspace mailbox, and a personal account's OAuth refresh token for an unverified app expires after
7 days). Steps: Google Cloud project → enable Gmail API → create a service account and a JSON key → Workspace Admin
console → Security → API controls → Domain-wide delegation → add the service account's client ID with scope
`https://www.googleapis.com/auth/gmail.send` → base64 the key file (`base64 -i key.json | pbcopy` on a Mac) and paste
it into `GMAIL_SERVICE_ACCOUNT` in Render, never into chat or Git. Limit: 2,000 messages a day per mailbox.

The server logs at start-up which provider it uses and any missing setting (names only, never values).

### Team testing (while phone codes are off)
- `TEST_LOGIN_TARGETS` = comma-separated team numbers / emails, e.g. `98xxxxxxxx,someone@example.com`.
  These may use phone sign-in while it's off, and see their code on screen while `OTP_DEV_ECHO=true`.
  **Must be empty before public launch** (the server refuses to start otherwise).

### SMS (MSG91) — later, when DLT is approved
- `SMS_PROVIDER` = `msg91`, `MSG91_AUTH_KEY` (secret), `MSG91_OTP_TEMPLATE_ID` (DLT-approved template), test with
  team numbers, then `PHONE_LOGIN` = `true`.

### Before public launch (server refuses to start otherwise when `ACCESS_CODE` is empty)
- `OTP_DEV_ECHO` = `false`, `TEST_LOGIN_TARGETS` empty, `EMAIL_PROVIDER` = `resend` or `gmail` with its key, `SIGNUP_EMAIL_REQUIRED` not false, `PHONE_LOGIN` true only with a real SMS provider.
- Codes are never shown on screen on a public server, whatever the settings.

## Database
Migration `056_verified_contacts_device_keys.sql` runs automatically on deploy: adds `users.email_verified_at`,
`users.phone_verified_at`, `otp_codes.purpose` / `user_id`, and the `device_keys` table. Existing accounts are
not marked verified retroactively.

## App builds
- Android build 4 (1.0.0) already contains the secure-storage module, so the new screens arrive by OTA update.
- iOS needs a new build (Face ID usage text added to `app.json`).
