# Soulink: existing automated coverage mapped to the feature inventory

Source: JUnit XML of run-20261120-1741 (216 tests). Tests were mapped to modules from their names (approximate: one test is counted once, in its main module). "Depth" judges what the tests exercise, not code coverage %.

| # | Module (01-DISCOVERY-REPORT §4) | Tests | Depth | Main gaps |
|---|---|---|---|---|
| 1 | Auth, OTP, sessions, devices | 32 | Good | Rate-limit lockout across IPs, token theft/replay, concurrent logins on many devices |
| 2 | Face ID + onboarding | 7 | Thin | Duplicate-face across accounts end to end, bad/unclear photos, 18+ boundary dates (exactly 18 today), camera denial (app) |
| 3 | Soul DNA | 18 | Good (scoring) | Question-set variety per user, retake, Premium vs non-Premium visibility |
| 4 | Profile | 3 | Thin | Edit-profile validation, avatar replace/delete, private-profile view by each relation type |
| 5 | Connect / Follow | 17 | Good | Hold reminder + auto-suspend timing in cloud mode (OBS-005), simultaneous Connect both ways, request after block/unblock |
| 6 | Feed & posts | 23 | Good | Feed ordering/pagination, delete cascade (likes, comments, saves, shares), 11-photo upload limits |
| 7 | Sparks, Studio, Casting, Open Mic | 12 | Medium | 100 MB upload, shrink failure, builder offline |
| 8 | Moments | 4 | Medium | 24 h expiry at the boundary, blocked viewer, Follower-not-Connection visibility |
| 9 | Messaging | 29 | Good (API) | **Real-time (Socket.IO): 0 tests**; ordering under concurrent sends, offline delivery, blocked-user mid-conversation, group admin removal |
| 10 | Anonymous messages | 6 | Good | — |
| 11 | Argue | 4 | Medium | Both-sides close rule edge cases |
| 12 | Search & Discover | 3 | **Thin** | Discover filters/search: 0 tests; private/blocked users hidden in search |
| 13 | Notifications & push | 3 | **Thin** | Notification is created for the *other* user on each social action; push delivery; unread counts |
| 14 | Events | 0 | **None** | Everything |
| 15 | Soulmoji | 6 | Medium | AI worker timeout/fallback |
| 16 | Safety (block, report, restrict, bans) | 3 (+ some in other modules) | **Thin** | Block matrix: after a block, every surface (profile, posts, Moments, chat, search, comments, notifications, Sparks) |
| 17 | Legal, copyright, grievances | 12 | Good | 36 h SLA reminder timing |
| 18 | Settings, pause, deletion | 9 | Medium | 7-day cooling cancel by login, 6-month rejoin block with same face/phone/email |
| 19 | Data export & restore | 8 | Good | Large account (many posts/media), interrupted restore (partial-failure rollback), restore on a different device/platform |
| 20 | Ads | 4 | Medium | Frequency caps, city/hour targeting boundaries |
| 21 | Shop (3D) | 0 | None | Client-only; UI tests only |
| 22 | Update App, telemetry | 8 | Good | Mandatory-update screen in the app |
| 23 | Team console | 4 (+ legal/ads ones above) | Medium | Role matrix: each role × each console endpoint |
| 24 | Share links (guest) | 1 | Thin | Private/deleted post via link, 15 s preview enforcement |
| | **Total** | **216** | | |

## Cross-cutting gaps (all modules)

| Area | Existing | Note |
|---|---|---|
| Concurrency (two users / two devices at once) | 0 tests use parallel requests | Duplicate likes, double Connect, race on accept/withdraw |
| Real-time (Socket.IO) | 0 | Typing, live message, live notification |
| Authorization negative tests | 40 × 403, 41 × 404, 22 × 401 assertions | Not yet a systematic "user B tries every endpoint on user A's objects" matrix |
| Phone app UI (Android / iOS) | 0 automated | — |
| Web UI | 0 automated | — |
| Cross-platform sync | 0 | — |
| Performance / load | 0 | — |
| Security scanning (ZAP, MobSF) | 0 | npm audit run once (20 Nov) |
| Accessibility | 0 | — |
