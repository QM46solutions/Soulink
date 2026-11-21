# Soulink QA Programme: Phase 1 Discovery Report

| | |
|---|---|
| Date | 20 Nov 2026 |
| Repository | `C:\Users\Sai raghava\Documents\Soulink` (origin `QM46solutions/Soulink`), branch `main` @ `964cf9dc`, working tree clean |
| Mode | Read-only. No source code, database, branch or deployment was changed. Only new files are under `docs/qa/` (untracked). |
| Status of every feature below | **NOT RUN** unless stated. "Exists in code" is not the same as "works". |

---

## 1. Architecture

```
 Phone app (Expo SDK 57 / React Native 0.86, expo-router)      Team console (admin/, static JS)
   ├─ Android  app.soulink.mobile  (EAS builds, Play internal test)   └─ Vercel: soulink-console → soulinkconsole.qm46.in
   ├─ iOS      app.soulink.mobile  (EAS builds, not yet on App Store)        │
   └─ Web      same code via react-native-web, exported to server/web        │ /console/*
                  │  HTTPS + JWT (Bearer)  + Socket.IO (typing, live events)  │
                  ▼                                                           ▼
 API server: Node 22, Express 5, ESM  (server/src, ~295 route handlers, 41 services)
   Render free plan, Singapore, branch `deploy`, 512 MB (heap capped 320 MB)
   ├─ SQL Server: local SQLEXPRESS (soulink, soulink_test) / Azure SQL Basic 5 DTU in prod
   │     64 forward-only migrations, 92 tables
   ├─ Files: STORAGE=db in prod (files stored in the database), Azure Blob path built but off
   ├─ Face ID: @vladmandic/face-api + tfjs-wasm, in-process; encrypted embeddings (faceCrypto)
   ├─ Push: Expo push tokens + Web Push (VAPID)
   ├─ Email OTP: Resend (Gmail API fallback); SMS OTP: MSG91 / Message Central (PHONE_LOGIN=false in prod)
   ├─ Translator: Azure Translator + Azure Speech (voice)
   ├─ AI referee (Argue): basic rules engine; Claude/Ollama optional
   └─ External workers: Soulmoji AI (soulmoji-cloud, Python LivePortrait, Azure Container Apps)
                        Video builder (builder/, Docker, Azure Container Apps)
```

Background work (server/src/index.js): hourly job batch only while users are active (scheduled deletions, ban purges, copyright restores/reminders, legal-deadline reminders, telemetry/audit purges, backup-job expiry, unfinished-signup purge, Blob migration); per-minute Hold and Anonymous-reveal timers; a due-timer that wakes only for the next due event (armed at boot **only when not in the cloud**).

## 2. Platform inventory

| Platform | How it is built | Where it runs today | Can I test it from this session? |
|---|---|---|---|
| Web desktop / mobile web | `expo export --platform web` in GitHub Actions → `deploy` branch → Render | https://soulink-xvbd.onrender.com (production; health check returned `ok, db ready` today) | Yes, with Playwright (Chromium, Firefox, WebKit) once a **non-production** target exists |
| Android | EAS (`preview` APK, `production` AAB → Play `alpha` draft) + OTA via Expo Updates | Play internal testing; Android Studio emulator on your laptop | Partly: via computer-use on the emulator window, or Appium if run on the laptop |
| iOS | EAS `production` build → TestFlight | Your and Nikhil's iPhones | No simulator possible (needs a Mac). Manual/guided testing on a real iPhone only |
| Team console | Static site on Vercel | soulinkconsole.qm46.in | Yes, with Playwright against a non-production API |

## 3. Environment inventory

| Environment requested | Exists? | Details |
|---|---|---|
| Local development | **Yes** | Windows laptop, SQLEXPRESS, DBs `soulink` (dev data, 6 demo accounts `+91 90000 00100–105`) and `soulink_test` (wiped per test file) |
| Development server | No | — |
| QA / Testing | No | — |
| Staging | No | EAS `preview` channel is a test **app** channel, but it talks to the production API |
| Production-like | No | — |
| Production | Yes | Render + Azure SQL. **Out of bounds for write, load or security testing** |

Consequence: today there is nowhere other than your laptop to run multi-user, performance or security tests safely. See Section 9.

## 4. Feature inventory (by module)

83 screens in `mobile/src/app`, ~88 shared components, 31 API routers. Grouped:

| # | Module | Screens (mobile/src/app) | API | Key business rules found in code / memory notes |
|---|---|---|---|---|
| 1 | Welcome, Log in, Create account, OTP | (auth)/index, login, signup, verify, server | /auth/otp/*, /auth/options, google/apple (stubbed) | Email OTP live; phone OTP off in prod; reviewer fixed number; test-login targets; start-up refuses unsafe prod config |
| 2 | Face ID + onboarding | setup, FaceScan component | /face/check, /face/enroll, /users/me/complete-onboarding, /users/me/accept-terms | 18+ only; one face per account; 6-month rejoin wait after deletion; unfinished sign-up cleared after 1 h |
| 3 | Soul DNA (games) | soul, soul-pair, soul-filters | /soul/* (8) | Versions v2→v6 coexist; scores across versions; Premium-only full report |
| 4 | Profile | (tabs)/profile, user/[username], edit-profile, follows/[id] | /users/* (24) | Private/public; avatar; username rules |
| 5 | Connect / Follow model | connect/[userId], connections/requests, requests | /connections/* (12), /users/:id/follow | Intent visible to receiver; Accept/Reject/Hold with reminder + auto-suspend; chat only after accepted Connect; Moments only for Connections |
| 6 | Home feed, Posts | (tabs)/index, create-post, post/[id], p/[id], post-likes, share-post | /feed, /posts/* (28) | Edit, hide likes, comments off, music, pin, archive, save, offense marks, spread (paid boost) |
| 7 | Sparks (≤30 s reels), Studio, Casting, Open Mic | (tabs)/sparks, spark/* (9) | /sparks/* (35) | 720p shrink; builder service; up to 100 MB uploads |
| 8 | Moments (stories) | moment/new, moment/[userId] | /moments/* (8) | 24 h; chat Moments open once / replay once |
| 9 | Messaging | (tabs)/inbox, messages/*, chat/[id], chat/info/[id], join/[code] | /conversations/* (33), Socket.IO | 1:1, groups, invites, media/docs/voice, reactions, polls, replies, private (vanishing) chat, translate, paid message, read state |
| 10 | Anonymous messages | anon/[id] | /anon/* (7) | Timed reveal |
| 11 | Argue (AI referee) | argue/* | /argue/* (4) | Either side opens, both needed to close |
| 12 | Search & Discover | (tabs)/search, (tabs)/discover | /search/users, /discover/* | Face search on hold |
| 13 | Activity, Notifications, Push | (tabs)/activity, settings/notifications | /notifications/*, /push/* | Expo + Web Push |
| 14 | Events | (tabs)/events | (via users/events-notify) | — |
| 15 | Soulmoji | (components) | /soulmoji/* | Rate-limited; external AI worker |
| 16 | Safety | blocked, settings/people, hidden-words, limits, complaint | /blocks, /reports, /privacy/* | Block hides both ways; restrict/mute tables |
| 17 | Legal, copyright, grievances | legal/[doc], copyright, admin/copyright | /copyright/*, /grievances/*, /admin/* | 36 h copyright SLA; strikes; legal orders |
| 18 | Settings & account | settings/* (24) | /account/*, /users/me/* | Sessions/devices, pause, deletion with 7-day cooling, location, time limits, Pulse viewers |
| 19 | **Data export & restore** | settings/backup, settings/restore-data | /account/backup/* (7), /users/me/export, /users/me/restore | ZIP export with signature (exportSign), restore validate→start→status; latest commits touched this |
| 20 | Ads | ads/index, ads/mine | /ads/* (9), /console/ads/* | Hourly booking model, frequency caps |
| 21 | Shop (3D) | shop/index | — (client assets) | 109 asset files |
| 22 | Update App / telemetry | settings/update-app, report-problem | /app/version, /telemetry/* | Minimum version gate; crash + problem reports |
| 23 | Team console | admin/ (Vercel) | /console/* (46) | Roles: owner, viewer, support, ads |
| 24 | Share links (guest) | p/[id], s/[id] | /share/* | 15 s guest preview; deep links /p /s /join |

Full endpoint list: `docs/qa/API-INVENTORY.md`.

## 5. Database overview

- SQL Server, 64 ordered migrations (`server/migrations`), applied once each inside a transaction, tracked in `schema_migrations`.
- 92 tables. Core: `users`, `user_sessions`, `otp_codes`, `face_embeddings`, `banned_identities`, `deleted_accounts`; social graph `follows`, `connections`, `connection_requests`, `blocks`, `user_mutes`, `user_restricts`; content `posts`, `comments`, `post_likes`, `sparks` (+12 spark tables), `moments`, `stories`; chat `conversations`, `conversation_members`, `messages`, `message_reactions`, `poll_votes`, `anon_threads`; Soul DNA `soul_answers`, `soul_dna`, `soul_profiles`; files `stored_files`; backup `account_backups`; console/ads/legal/telemetry tables.
- Release rule documented in docs/RELEASES.md: migrations must be additive.

## 6. Existing quality assets

| Asset | State |
|---|---|
| Server integration tests | 61 suites / 210 tests (`node:test` + supertest) against `soulink_test` |
| Last recorded full run (19 Nov 2026 16:54, `test-results.txt`) | **67 pass, 68 fail, 75 cancelled** — see OBS-001 |
| Tests re-run today (no DB needed) | m25, m30, soulv6 (9), translate: **12/12 PASS**; mobile `studio.test.mjs`: **PASS** |
| Mobile automated UI tests | None |
| Lint | `expo lint` script exists; not wired into CI |
| Manual checklists | docs/test-plans/M1.md, M2.md (early milestones only) |
| CI (GitHub Actions) | deploy (web+API to `deploy` branch), mobile (EAS OTA + builds), builder & soulmoji images (builder has a smoke test), keep-awake cron. **No unit/API test, lint or audit gate on any pipeline.** |
| Dependency audit (today) | server: 1 moderate. mobile: 1 critical, 7 high, 7 moderate (mostly Expo/Metro build tooling; needs triage) |

I could not run the 198 database-backed tests today: this session's shell runs in a sandbox on your laptop that cannot reach your Windows SQL Server instance.

## 7. Initial observations (candidate defects, not yet confirmed)

| ID | Area | Observation | Proposed severity | Evidence / root-cause hypothesis |
|---|---|---|---|---|
| OBS-001 | Test harness | 19 Nov run: 143 of 210 failed/cancelled. **Update 20 Nov: not reproduced, 216/216 PASS twice (see 02-BASELINE-RESULTS.md); downgraded to Low hardening** | Low | Deadlock (SQL error 1205) during `dropAll()` in `test/helpers.js resetDb()` while fire-and-forget writes from the previous file (e.g. `last_active_at`, session touches) were still running. Partial drop leaves `schema_migrations` saying 001–015 applied while `follows` is gone → "Migration 016 failed: Invalid object name 'follows'" for every later file. 26 such `query(...).catch(() => {})` writes exist. Needs reproduction. |
| OBS-002 | CI/CD | Pushing to `main` builds and deploys the web/API and publishes an OTA preview with no test gate | High (process) | `.github/workflows/deploy.yml`, `mobile.yml` |
| OBS-003 | Environments | No QA/staging; test app channel uses the production API | High (process) | render.yaml, app.json |
| OBS-004 | Dependencies | 1 critical / 7 high advisories in mobile dependency tree | Medium until triaged | `npm audit --omit=dev` |
| OBS-005 | Time-based features | In the cloud the due-timer is not armed at boot (`if (!cloud) scheduleNext()`); Hold expiry and anonymous reveals may depend on someone being active | To verify | server/src/index.js:65 |
| OBS-006 | Auth | Session JWTs carry no expiry; revocation relies on the `user_sessions` check on every request | To assess (design choice) | lib/auth.js, middleware/auth.js |
| OBS-007 | Performance | Face recognition (tfjs) runs inside the 512 MB Render process and files are stored in the database (`STORAGE=db`); 100 MB Spark uploads | Risk | render.yaml |
| OBS-008 | Secrets hygiene | `mobile/google-services.json` is committed (normal for Firebase, but key restrictions must be checked); `server/.env` and `cloud.env` correctly ignored | Low | git ls-files |
| OBS-009 | Safety / privacy | Blocking deletes follows but not the `connections` row (safety.js POST /blocks/:id). After unblock, the old Connection may silently regain Connection-level access (private posts, Moments, chat) without a new request; Connection counts include blocked people. Existing block test only covers plain follows | High (to confirm) | Code reading, 20 Nov; test SL-SAFE-MU-002 |

## 8. Initial risk assessment (what to test first)

1. **Account & identity**: OTP, face uniqueness, 18+ gate, sessions across devices, deletion cooling period and 6-month block. Highest impact (access, privacy, legal).
2. **Authorization across the social graph**: who can see posts, Moments, profiles, chats, and media links for private accounts, blocked users, plain followers vs Connections. IDOR checks on ~295 handlers.
3. **Data export / restore**: just changed (commits `07375e8d`, `964cf9dc`); duplicates, ghost references, partial-failure rollback.
4. **Messaging**: ordering, read state, vanishing chat, blocked users, group membership changes.
5. **Media pipeline**: uploads up to 100 MB on a 512 MB server with DB-backed storage.
6. **Time-based logic**: Hold reminders/auto-suspend, anonymous reveal, 24 h Moments, scheduled deletion.
7. **Release safety**: no CI gate, OTA updates to real users.

## 9. Access requirements and blockers

| # | Needed for | What I need | Options |
|---|---|---|---|
| B1 | Running the 210 server tests, all API/E2E/multi-user automation | A SQL Server I can reach | **(A, recommended)** GitHub Actions job with a SQL Server 2022 container: free, isolated, repeatable, becomes the CI gate. Needs your OK to push a `qa/…` branch. **(B)** You double-click a `RUN-QA.bat` I write and I read the results. **(C)** A paid QA copy on Render + Azure SQL |
| B2 | Creating the dedicated QA branch on your laptop | Permission to delete files in the Soulink folder (git removes its own lock files) | One approval prompt |
| B3 | Browser automation and performance/security scans | A non-production API URL | Comes with B1-A (server started inside CI) or C |
| B4 | Android UI testing | Emulator running on your laptop | I drive it with computer use, or Appium on the laptop |
| B5 | iOS testing | Your iPhone with the TestFlight/preview build | Guided manual scripts; I record results you report. No simulator without a Mac |
| B6 | Real Safari | iPhone/Mac | Playwright WebKit covers engine-level checks only |
| B7 | Production checks | Your explicit approval per activity | Read-only smoke checks only (e.g. `/api/health`) |

## 10. Proposed execution plan

| Step | Work | Needs |
|---|---|---|
| 1 | Create branch `qa/foundation` from `main`, record baseline | B2 |
| 2 | Reproduce OBS-001 and fix the test harness so the 210 tests give a trustworthy baseline (first defect through the full lifecycle) | B1 |
| 3 | Master QA strategy + test-case repository (per module above, P0/P1 first) | — |
| 4 | Automation framework: `qa/` folder with API client + multi-user fixtures (A/B/C accounts, private/public, blocked), Playwright web E2E incl. axe-core, k6 scripts, ZAP baseline config | B1, B3 |
| 5 | CI workflow: tests + lint + audit on every push; deploy only after they pass (draft for your approval) | approval |
| 6 | Execute, log defects, fix Critical/High on the QA branch, retest, regress | B1 |
| 7 | Android (emulator) and iOS (guided) passes; cross-platform sync checks | B4, B5 |
| 8 | Performance and security on the isolated environment; readiness report | B3 |

Nothing will be committed, merged, pushed or deployed without your approval.
