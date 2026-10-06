# Soulink: where everything is

Project folder: **C:\Users\Sai raghava\Documents\Soulink**

## Run it any time

| What | How |
|---|---|
| After Claude delivers new code | Double-click `UPDATE-SOULINK.bat` (installs packages, updates database, runs tests) |
| Open in a browser on the laptop | Double-click `START-SOULINK-WEB.bat` → open http://localhost:8081 (VS Code: Ctrl+Shift+P → "Simple Browser: Show") |
| Open on your phone (browser, secure link, Wi-Fi or mobile data) | Double-click `START-SOULINK-PHONE.bat` → scan the QR code with the phone camera |
| Open on your phone (Expo Go app, same Wi-Fi) | Double-click `START-SOULINK.bat` → scan the QR code with Expo Go |
| Demo accounts for testing | Log in with 90000 00100 (@sai.demo), 00101-00105 for the others; tap the test-mode code |
| Run the automated tests only | VS Code terminal: `cd server` then `npm test` |
| Stop the app | Close the two black windows |
| Turn on the free AI referee (one time) | Double-click `INSTALL-FREE-AI.bat` (Ollama + Llama 3.2 3B, ~2 GB) |
| Erase all test data and start fresh | Double-click `RESET-SOULINK-DATA.bat`, type YES |
| See stored face fingerprints | Double-click `SHOW-FACE-DATA.bat` (writes face-report.txt) |

## Screens (UI) → file

All screens are in `mobile\src\app\`. Each file is one screen.

| Screen | File |
|---|---|
| Welcome + Log in | `mobile\src\app\(auth)\index.js` |
| Create account | `mobile\src\app\(auth)\signup.js` |
| Phone/email field with arrow (used by both) | `mobile\src\components\ContactEntry.js` |
| Enter the 6-digit code | `mobile\src\app\(auth)\verify.js` |
| Server address (testing) | `mobile\src\app\(auth)\server.js` |
| Create your soul profile (Face ID + 3 steps) | `mobile\src\app\setup.js` |
| Face ID camera scan (phone + laptop) | `mobile\src\components\FaceScan.js` |
| Home | `mobile\src\app\(tabs)\index.js` |
| Search | `mobile\src\app\(tabs)\search.js` |
| Discover | `mobile\src\app\(tabs)\discover.js` |
| Activity | `mobile\src\app\(tabs)\activity.js` |
| My profile | `mobile\src\app\(tabs)\profile.js` |
| Bottom tab bar + Messages icon | `mobile\src\app\(tabs)\_layout.js` |
| Someone's profile | `mobile\src\app\user\[username].js` |
| Followers / Following list | `mobile\src\app\follows\[id].js` |
| Edit profile | `mobile\src\app\edit-profile.js` |
| Settings | `mobile\src\app\settings.js` |
| Follow requests | `mobile\src\app\requests.js` |
| Blocked accounts | `mobile\src\app\blocked.js` |
| Messages (Chats / Requests) | `mobile\src\app\messages\index.js` |
| New message / new group | `mobile\src\app\messages\new.js` |
| Chat | `mobile\src\app\chat\[id].js` |
| Chat / group details | `mobile\src\app\chat\info\[id].js` |
| App-wide navigation (which screens exist) | `mobile\src\app\_layout.js` |

Shared pieces used by many screens:

| What | File |
|---|---|
| Design rules for every screen | `docs\DESIGN.md` |
| Shared screen layout + header | `mobile\src\components\BrandScreen.js` |
| Colours, fonts, spacing (the Soulink look) | `mobile\src\lib\theme.js` |
| Star background, gradient text, glass cards | `mobile\src\components\brand.js` |
| Buttons, inputs, avatars, user rows | `mobile\src\components\ui.js` |
| Chat bubbles, voice notes, message box | `mobile\src\components\chat.js` |
| Profile header (photo, counts, bio) | `mobile\src\components\ProfileHeader.js` |
| Profile form (setup + edit) | `mobile\src\components\ProfileForm.js` |
| Talking to the server | `mobile\src\lib\api.js` |
| Live updates (new messages, typing) | `mobile\src\lib\realtime.js` |

## Server (backend) → file

| What | File |
|---|---|
| Sign up / login codes | `server\src\routes\auth.js` |
| Profiles, follow requests | `server\src\routes\users.js` |
| Search | `server\src\routes\search.js` |
| Block and report | `server\src\routes\safety.js` |
| Activity notifications | `server\src\routes\notifications.js` |
| Chat | `server\src\routes\conversations.js` |
| Face ID (live check + enroll, one face = one account) | `server\src\routes\face.js` |
| Face engine (free, runs on the laptop) | `server\src\services\faceEngine.js` |
| Live updates | `server\src\realtime.js` |
| Settings (database login, ports) | `server\.env` (keep private) |
| Automated tests | `server\test\` |

## Database

| What | Where |
|---|---|
| Database design (tables) | `server\migrations\001_init.sql`, `002_chat.sql`, … (one file per change) |
| The actual data | SQL Server instance `localhost\SQLEXPRESS`, database **soulink** |
| Data files on disk | `C:\Program Files\Microsoft SQL Server\MSSQL17.SQLEXPRESS\MSSQL\DATA\soulink.mdf` (+ `soulink_log.ldf`) |
| Test database (wiped by each test run) | `soulink_test` on the same instance |
| Uploaded photos and voice notes | `server\uploads\` |

To look at the data: SQL Server Management Studio → connect to `localhost\SQLEXPRESS` (Windows Authentication) → Databases → **soulink** → Tables.

## Documents

| What | File |
|---|---|
| Product decisions | `SPEC.md` |
| Setup and daily use | `README.md` |
| Manual test checklists | `docs\test-plans\M1.md`, `M2.md`, … |
| This map | `docs\WHERE-IS-EVERYTHING.md` |

- Anonymous messages (7-day reveal): server `server/src/routes/anon.js` + `server/src/services/anon.js` (reveal timer, every minute), tables in `server/migrations/011_anonymous_messages.sql`; app `mobile/src/app/anon/[id].js`, `mobile/src/components/anon.js`, Messages > Anonymous tab. Tests: `server/test/m6.test.js`.
- Translator in the message box: `TranslateSetup` / `TranslatePreview` in `mobile/src/components/chat.js`; server `POST /conversations/:id/translate-draft` and `/voice-translate` in `server/src/routes/conversations.js`; speech-to-text + voices in `tools/soulmoji-ai/soulmoji_ai.py` (`/transcribe`, `/speak`), installed by `INSTALL-VOICE-TRANSLATOR.bat`. Tests: `server/test/m7.test.js`.
- Pulse meter: score in `server/src/services/pulse.js` (weights, 30-day window, 10-day half-life), profile views table `server/migrations/012_pulse.sql`, returned by `/users/me` and `/users/u/:username`; app `mobile/src/components/PulseMeter.js` inside `ProfileHeader.js`. Tests: `server/test/m8.test.js`.
- Post actions (👌🏻 like, share, offense, suspension after 75): `server/src/routes/posts.js` (OFFENSE_LIMIT), `server/migrations/013_post_offense_share.sql`; app `mobile/src/components/PostCard.js`, `mobile/src/app/share-post.js`, post bubble in `components/chat.js`. Tests: `server/test/m9.test.js`.
- `INSTALL-SOULMOJI-AI.bat` + `tools/soulmoji-ai/` — one-time install of the free local Soulmoji AI (LivePortrait). The server starts it automatically (`server/src/services/soulmojiAi.js`); without it Soulmoji uses the built-in warp engine.
