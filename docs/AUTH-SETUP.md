# Soulink sign-in: how it works and how to configure it

_Last updated: 19 Nov 2026 (migration 056)._

## The rule (agreed 19 Nov 2026)

- **Logging in:** two choices, **Email** or **Phone number**. The person picks one and verifies only that one with a
  6-digit code (email code or SMS code). There is no fingerprint / Face ID sign-in (removed 19 Nov 2026).
- **Phone codes:** ready but off until MSG91 + DLT are approved (`PHONE_LOGIN=true` turns them on, no app update
  needed). Until then the Phone number choice says "Sign-in by text message is coming soon. Please use email for
  now"; only the store reviewer's number and `TEST_LOGIN_TARGETS` get past it.
- **Staying logged in:** a login never times out. It survives closing the app, restarts and app updates, and ends
  only on **Log out**, "Log out of other devices" / logging a device out in Settings, account deletion or a ban (or
  if every session is ended for a security reason). Reinstalling the app or clearing its data removes the saved login.
- **Sign-up (unchanged):** email + code (mandatory), the one-time face check, then the profile. Accounts without an
  email are reminded on Home to add one (Settings › Sign-in & security).
- **No other codes:** codes are sent only for logging in and for adding / changing an email.

## The flows

| Who | How they get in | What gets marked |
|---|---|---|
| New person | Email → 6-digit code → face check (one-time, duplicate-account check) → profile | `email_verified_at` (only when the email was really sent) and, after the face check, `face_verified` |
| Logged-in person opening the app | Nothing to do: still logged in | nothing new |
| After Log out / new phone | Email (or, once SMS is live, Phone number) → 6-digit code | nothing new |
| Phone number (SMS) | **Off** until MSG91 + DLT are live and tested (`PHONE_LOGIN=true`) | `phone_verified_at` only after a real SMS |
| Store reviewer | `REVIEW_PHONE` + `REVIEW_CODE` (fixed code, nothing is sent) | never marked phone-verified |

## Security rules in the code

- Codes: 6 digits, stored as an HMAC (never plain), expire in 5 min, single use, 5 wrong tries then dead.
- Limits per address: one code every 30 s, 5 an hour, 10 a day; plus 20 code requests / 15 min per IP
  (`/auth/otp`, `/account/email`).
- If the email/SMS fails to send, the code is thrown away and the person gets a clear "couldn't send" message.
- The code request answers the same whether or not an account exists (no account lookup by email/phone).
- Codes are shown on screen (`devCode`) **only** in development, or for addresses in `TEST_LOGIN_TARGETS` while
  `OTP_DEV_ECHO=true`. The public never gets a code back from the API.
- Logins: each device has a session on the server; its token has no expiry of its own and works until the session
  is ended. Tokens issued earlier with an expiry date keep working while their session is open.
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
Migration `057_remove_quick_sign_in.sql` switches off every fingerprint / face sign-in key (the table is kept for
history only). Migration `056_verified_contacts_device_keys.sql` runs automatically on deploy: adds `users.email_verified_at`,
`users.phone_verified_at`, `otp_codes.purpose` / `user_id`, and the `device_keys` table. Existing accounts are
not marked verified retroactively.

## App builds
- These changes are JavaScript only: Android build 4 (1.0.0) gets them by an over-the-air update; no new build needed.
