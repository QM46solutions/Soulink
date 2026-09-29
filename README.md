# Soulink

A social network where every profile is real. It matches people by personality and has an AI referee for arguments.
The app's look matches the pitch site (soulink-pitch.netlify.app): same colours, Syne/Inter/Space Mono fonts, gradient wordmark, starfield and glass cards. Design tokens live in `mobile/src/lib/theme.js` and brand components in `mobile/src/components/brand.js`. The full product spec is in [SPEC.md](SPEC.md). The Milestone 1 test checklist is in [docs/test-plans/M1.md](docs/test-plans/M1.md).

```
soulink/
├── server/   Node.js + Express + SQL Server API   (runs on your laptop)
├── mobile/   React Native (Expo) app              (runs on your Android phone)
├── setup/    Windows setup script (used by SETUP-SOULINK.bat)
└── docs/     test plans
```

---

## Run it on your laptop (Windows)

### Install once
- **Node.js** (LTS) from https://nodejs.org
- **SQL Server Express** from https://www.microsoft.com/sql-server/sql-server-downloads (Basic install, instance `SQLEXPRESS`)
- **Expo Go** on your Android phone (Play Store)
- VS Code (optional) for reading and editing the code

### Setup, one time: double-click `SETUP-SOULINK.bat`
Click **Yes** when Windows asks for administrator rights. The setup then:
1. Turns on the SQL Server settings the app needs: network access on port 1433 and username/password logins.
2. Creates a `soulink` login and two databases, `soulink` (the app's data) and `soulink_test` (used by the automated tests).
3. Writes `server\.env` with a generated database password. Nobody needs to type or remember it.
4. Lets your phone reach the laptop on your home Wi-Fi (firewall rules for ports 4000 and 8081, private networks only).
5. Installs the packages, creates the tables and runs the automated tests.

It's safe to run again at any time. Logs are saved in `setup-log-system.txt` and `setup-log-app.txt`.

### After Claude delivers new code: double-click `UPDATE-SOULINK.bat`
It installs any new packages, adds new database tables and runs the automated tests. No administrator rights needed. Results are saved in `update-log.txt`.

### Every day: double-click `START-SOULINK.bat`
Two windows open:
- **Soulink server:** shows sign-up codes (no real SMS is sent) and errors. Keep it open.
- **Soulink app:** shows a QR code. Scan it with **Expo Go** on your phone. The phone and laptop must be on the **same Wi-Fi**.

The app finds the server on your laptop by itself. If it can't, tap ⚙️ on the welcome screen and enter the "From your phone" address shown in the server window.

### Viewing the app in VS Code (browser)
1. VS Code → File → Open Folder → `Documents\Soulink`.
2. Double-click **START-SOULINK-WEB.bat** (or run it from VS Code's terminal: `.\START-SOULINK-WEB.bat`). It starts the server and the app.
3. When the terminal shows `Web is waiting on http://localhost:8081`, press **Ctrl+Shift+P**, type **Simple Browser: Show** and enter `http://localhost:8081`.
   Or open that address in Chrome, press **F12**, then **Ctrl+Shift+M** to see it at phone size.

The browser version is for quick checks. Your phone (Expo Go) is the real target.

### Looking at the data
Open **SQL Server Management Studio**, connect to `localhost\SQLEXPRESS` with Windows Authentication, and open the `soulink` database. `users`, `follows`, `blocks` and `notifications` hold Milestone 1's data.

---

## Everyday commands

| What | Where | Command |
|---|---|---|
| Start server | `server/` | `npm run dev` |
| Start app | `mobile/` | `npx expo start` |
| Run automated API tests | `server/` | `npm test` (uses the `soulink_test` database) |
| Test the app in a browser | `mobile/` | `npx expo start --web` (for quick checks; the phone is the real target) |

## Settings (server/.env)

| Setting | Local (free) | Later in the cloud |
|---|---|---|
| `SMS_PROVIDER` | `console`: codes printed in the terminal | `msg91` / `firebase` |
| `STORAGE` | `local`: photos saved in `server/uploads` | `s3` |
| `AI_PROVIDER` | `local`: built-in fallback | `claude` + `ANTHROPIC_API_KEY` |
| `FACE_PROVIDER` | `local`: open-source model on the laptop | `rekognition` |

## Troubleshooting

- **"Can't reach the Soulink server"**
  - Check the server window is still running.
  - Check the phone is on the same Wi-Fi as the laptop.
  - Check the address in ⚙️ matches the one the server printed.
  - Allow Node.js through Windows Firewall.
- **"there is a problem with the database"** in the server window: check the **SQL Server (SQLEXPRESS)** service is running (Windows Services app), or run `SETUP-SOULINK.bat` again.
- **Windows says the network is Public:** Settings → Network & internet → Wi-Fi → your network → set it to **Private**, or your phone can't reach the laptop.
- **Expo Go says the SDK version isn't supported**: update Expo Go from the Play Store. This project uses Expo SDK 57.

## Milestone status

- [x] **M1 Foundation:** phone/email OTP sign-up, profile setup (18+), public and private accounts, follow requests, search, followers and following, block, report, activity notifications
- [x] **M2 Chat:** 1:1 and group chats, message requests, photos, voice notes, typing, Seen, unsend, group admin
- [ ] M3 Posts, feed, likes, comments, stories
- [ ] M4 Soul DNA, Match %, Discover, Premium report
- [ ] M5 Argue / AI referee
- [ ] M6 Face verification + opt-in face search
- [ ] M7 QA hardening, Google/Apple sign-in, move to cloud
