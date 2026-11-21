# Soulink Master QA Strategy (Phase 2)

Version 1.0 · 20 Nov 2026 · Branch `qa/foundation` · Inputs: 01-DISCOVERY-REPORT, 02-BASELINE-RESULTS, 03-COVERAGE-MAP

## 1. Objective and approach

Make Soulink release-ready by testing **behaviour as two or more real users see it**, not screens in isolation. Approach is **risk-based**: privacy, identity and data integrity first, because a failure there harms users or breaks the law; cosmetic issues last.

Three principles:
1. **Both sides of every interaction.** A like, Connect, message or block passes only when the actor, the receiver, the database row, the notification and a third (unrelated) user all show the right state.
2. **Executed or it didn't happen.** Status is PASS / FAIL / BLOCKED / NOT RUN. Generated test cases are not coverage.
3. **Production is never a test bed.** All write, load and security testing runs on the laptop or an isolated environment. Production gets read-only smoke checks only, with your approval.

## 2. Scope

**In scope:** API server (all 31 routers), phone app on Android and iOS, web app (desktop + mobile viewports), team console, database integrity, data export/restore, background/time-based jobs, release pipeline.

**Out of scope for now:** face search (on hold), real payments (Premium/ads payments are recorded, no gateway), Soulmoji AI image quality (judged by eye, not tests), store-review processes, production load testing.

## 3. Test environments (as they really are)

| Env | Used for | How tests reach it |
|---|---|---|
| **E1 Laptop** (Windows, SQL Express, `soulink_test`) | Server API, integration, multi-user, concurrency, restore, security (authz, ZAP), small-scale performance, web E2E against the local web build | Batch files you double-click (`RUN-QA.bat` and successors); I read results from `docs/qa/results/` |
| **E2 Android emulator** (Android Studio, on the laptop, pointing at E1) | Android UI flows | Maestro flows on the laptop, or I drive the emulator with computer use |
| **E3 Your iPhone** (preview build) | iOS UI flows, VoiceOver, Safari | Step-by-step manual scripts; you report results, I record them |
| **E4 Production** | Read-only smoke after a release (`/api/health`, app opens, login screen loads) | Only with your OK each time |
| *(E5 QA cloud copy, optional later)* | Realistic performance, true multi-device sync across real phones | Needs a paid Render + Azure SQL copy; decide before Phase 10 |

Limitation stated up front: iOS cannot be automated (no Mac); Safari is covered on your iPhone and by Playwright's WebKit engine; performance numbers from E1 show trends and regressions, not production capacity.

## 4. Tools (chosen to fit the Soulink stack)

| Area | Tool | Why this one |
|---|---|---|
| API, integration, multi-user, DB integrity | **Existing `node:test` + supertest** (`server/test`), extended | Already 216 green tests, same language as the server, multi-user helpers (`makeUser`, `makeDna`) exist; one framework to maintain |
| Authorization matrix | Data-driven node:test suite generated from `API-INVENTORY.md` | Systematic IDOR/BOLA coverage of ~295 handlers |
| Real-time | `socket.io-client` inside node:test | Already a mobile dependency |
| Web UI, cross-browser, visual, accessibility | **Playwright** (Chromium, Firefox, WebKit; desktop/tablet/phone viewports) + **@axe-core/playwright** | Web build is react-native-web; Playwright covers all three engines and screenshots |
| Android UI | **Maestro** (YAML flows) — Appium as fallback | Maestro handles React Native/Expo apps with far less setup than Appium on Windows; flows stay readable for you |
| iOS UI | Manual scripts (same IDs as the Maestro flows) | No Mac available |
| Performance | **k6** | Single Windows binary, scripts in JS, thresholds become pass/fail |
| Security | Custom authz/injection tests + **OWASP ZAP** baseline/API scan on E1 + `npm audit` + **MobSF** static scan of the APK | Code-level tests find logic flaws scanners miss |
| Reporting | JUnit XML + Markdown summaries in `docs/qa/results/` | Readable by you, parsable by CI later |

Laptop installs needed (I'll ask before each): Playwright browsers (~0.5 GB), Maestro (+Java 17), k6, ZAP, Docker Desktop only if MobSF is wanted.

## 5. Test levels and suites

| Suite | Contents | Run when | Target time |
|---|---|---|---|
| **S0 Smoke** | Health, login (email OTP), onboarding done-user loads home, create post, send message, upload image, notification created, DB reachable | Every change, every release | < 2 min |
| **S1 Sanity** | Changed module + its direct dependants (picked per fix) | After every fix | < 5 min |
| **S2 API regression** | All server tests (216 today, growing) | Every change | ~6–8 min |
| **S3 Multi-user & concurrency** | Two-sided checks, races, block matrix, privacy matrix | Daily during QA, before release | ~10 min |
| **S4 Security** | Authz matrix, injection, upload abuse, rate limits, ZAP | Before release, weekly | ~20 min |
| **S5 Web E2E** | Critical journeys × 3 engines × 3 viewports, axe, screenshots | Before release | ~20 min |
| **S6 Android E2E** | Critical journeys on the emulator | Before store/OTA release | ~20 min |
| **S7 iOS manual** | Same journeys on iPhone | Before store/OTA release | ~45 min (manual) |
| **S8 Performance** | Load, spike, soak, volume (scaled to E1) | Before release; after DB/query changes | 15–60 min |
| **S9 Restore/data integrity** | Export → modify → restore, repeated restore, interrupted restore, orphan scan | Before release | ~5 min |

## 6. Prioritisation

| Priority | Meaning | Examples |
|---|---|---|
| **P0** | Blocks release if failing | Login, face uniqueness, 18+ gate, privacy/visibility rules, block, chat delivery, data loss in restore/delete, authz |
| **P1** | Must run before release; fails need a decision | Connect/Hold flows, posts/Sparks/Moments, notifications, account pause/delete, copyright SLA |
| **P2** | Regular regression | Translator, Soulmoji, music, ads, console analytics |
| **P3** | Opportunistic | Shop, cosmetic layout |

Order of new work (from the coverage gaps): ① authorization + privacy + block matrix → ② two-sided social interactions and notifications → ③ concurrency/races → ④ real-time chat → ⑤ restore edge cases → ⑥ web E2E → ⑦ Android → ⑧ iOS manual → ⑨ performance → ⑩ scanners.

## 7. Test data and accounts

All test users are created fresh in `soulink_test` by the suites (never in your `soulink` dev data or production). Standard personas:

| Persona | Setup |
|---|---|
| A · Asha | Public, Soul DNA done (the actor) |
| B · Bala | Private, Soul DNA done (the receiver) |
| C · Chitra | Connected to A (Connection) |
| D · Dev | Follower of B only (not Connection) |
| E · Esha | Blocked by A |
| F · Farhan | No Soul DNA yet |
| G · Gita | Paused account; H · Hari: deletion pending; I · Irfan: deleted (within 6-month wait) |
| P · Priya | Premium |
| X · stranger | Unrelated user, checks nothing leaks |
| Console users | owner, viewer, support, ads |

The app on the emulator/iPhone uses the laptop's 6 demo accounts (`+91 90000 00100–105`) or a fresh set created by a seed script.

## 8. Test case standard

ID format `SL-<MODULE>-<TYPE>-<NNN>` (e.g. `SL-CHAT-FUN-014`, `SL-POST-SEC-003`). Fields as you specified: ID, module, scenario, preconditions, steps, test data, expected, actual, platform, environment, type, priority, severity, status, defect ID, evidence. Automated tests carry the ID in their name, so results map back to the repository automatically.

## 9. Defect management

Lifecycle exactly as in your brief: Identify → Document → Root cause → Fix (on `qa/foundation` or a `qa/fix-<id>` branch) → targeted test → retest → regression (S0 + S1 + S2 at minimum) → Close only with evidence. Register: `docs/qa/DEFECTS.md` (ID `SLD-NNN`). Severity: Critical / High / Medium / Low as you defined; fix order Critical → High → Medium → Low. Every fixed defect gets a regression test. Fixes that would change a business rule are written up for your approval first.

## 10. Entry and exit criteria

**Entry to execution (Phase 5 onward):** suite green on E1 (done: 216/216); personas fixture built; branch created (done).

**Exit / release gates** (your §13 targets, made measurable):

| Gate | Measure |
|---|---|
| Critical journeys covered | 100% of P0 journeys have ≥ 1 executed automated or manual case per platform |
| P0/P1 executed | 100% executed; every FAIL has a defect |
| Functional scenarios | ≥ 90% of scenarios in the repository executed |
| API | 100% of P0/P1 endpoints in the authz matrix executed |
| Defects | 0 open Critical; 0 open High in P0 journeys |
| Data integrity | 0 orphan/duplicate rows in the post-run integrity scan |
| Cross-platform | 0 Critical inconsistencies between web, Android, iOS |
| Smoke | S0 green on the release build |
| Performance | p95 API < 800 ms, error rate < 1% at target load on E1 (targets to confirm with you) |
| Security | 0 open Critical/High findings |

Code coverage (`node --test --experimental-test-coverage`) is reported separately and is not a gate.

## 11. Release pipeline (target)

Today: push to `main` deploys with no gate (OBS-002). Target (Phase 8, needs your approval): `RUN-QA.bat` S0+S2 green before any push; later a GitHub Actions job (SQL Server container) runs S0+S2 on every push and blocks the `deploy` branch and OTA `release-to-users` on failure.

## 12. Risks to the QA programme

| Risk | Mitigation |
|---|---|
| All execution depends on the laptop being on and you running batch files | Batch files are one double-click, write evidence automatically; GitHub Actions option kept open |
| iOS only manual | Short scripts, same IDs as Android flows; prioritise P0 |
| Laptop performance ≠ cloud | Report trends; optional E5 before launch |
| Fixes conflict with ongoing feature work on `main` | Small fixes, rebase `qa/foundation` before each cycle, your approval before any merge |

## 13. Decisions needed from you

1. Approve this strategy (or tell me what to change).
2. Performance targets: OK with p95 < 800 ms and < 1% errors for the first cycle, and how many concurrent users to aim for at launch (for example 200 or 1,000)?
3. Android tool: OK to install Maestro (+Java 17) on the laptop, or should I drive the emulator with computer use only?
