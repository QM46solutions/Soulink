# Soulink QA: Baseline execution (Phase 5, server suite)

| | |
|---|---|
| Run | `RUN-QA.bat`, 20 Nov 2026 17:41 IST, on Sai's laptop |
| Code | branch `qa/foundation` = `main` @ `964cf9dc`, no source changes |
| Runtime | Node v24.21.0, npm 11.19.0, SQL Server Express service RUNNING, database `soulink_test` |
| Evidence | `docs/qa/results/run-20261120-1741/` (full-spec.txt, full-junit.xml, full-console.txt, per-file/*.txt, mobile-studio.txt) |

## Results

| Pass | Scope | Tests | PASS | FAIL | Cancelled |
|---|---|---|---|---|---|
| 1 | Full suite, one process (same as RUN-TESTS.bat) | 216 (61 suites, 43 files) | 216 | 0 | 0 |
| 2 | Each of the 43 files in its own process | 216 | 216 | 0 | 0 |
| — | Mobile Studio model test | 1 script | PASS (exit 0) | — | — |

Cross-checks done: spec summary = JUnit XML (216 `<testcase>`, 0 `<failure>`) = sum of the 43 per-file TAP summaries; console log has no deadlock, "Invalid object name" or unhandled errors. An independent run inside UPDATE-SOULINK.bat (update-log.txt, 20 Nov 11:40) also reports 216/216.

Duration 355 s. Slowest suites: Connect requests 15.1 s, Anonymous messages 13.7 s, Soul DNA 11.2 s.

## OBS-001 outcome

**Not reproduced.** The 19 Nov run (67 pass / 68 fail / 75 cancelled) failed on a deadlock while the test database was being reset, then on missing tables. Three later runs are fully green. Most likely the 19 Nov run overlapped another test run or process using `soulink_test` (UPDATE-SOULINK.bat and RUN-TESTS.bat both run the suite on the same database). This is unconfirmed.

Reclassified: **Low, test-harness hardening.** `dropAll()` is not protected against a concurrent run (no lock, no retry on SQL error 1205, no check that every table is gone before migrating). Planned: fail fast with a clear message if another run is using the test database, and retry/verify the reset. Repeat-run stability will be checked again in later regression cycles.

## What this baseline does and does not cover

- Covers: server API integration behaviour exercised by the 216 existing tests (single laptop, SQL Express).
- Does not cover: phone app UI (Android/iOS), web UI, cross-platform sync, multi-device, performance, security scanning, accessibility, production configuration. Those are NOT RUN.
- Coverage depth per feature is not yet measured: that is the next step (map the 216 tests onto the feature inventory to find untested features).

Note: `git` is not on the Windows PATH, so environment.txt could not record the commit; it was recorded from this session instead.
