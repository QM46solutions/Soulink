# Soulink defect register

Severity: Critical / High / Medium / Low (strategy §9). Status: OPEN → FIX IN PROGRESS → FIXED (awaiting retest) → CLOSED (retest + regression passed) · BLOCKED.

| ID | Title | Module | Platform | Severity | Priority | Status | Found by | Fix |
|---|---|---|---|---|---|---|---|---|
| SLD-001 | Blocking keeps the Connection: after unblock, the old Connection can regain private access | Safety / Connect | API (all platforms) | High | P0 | **CLOSED** 21 Nov (retest 12/12 PASS + regression 227/228) | SL-SAFE-MU-002 (run p0-20261121-1029) | server/src/routes/safety.js |
| SLD-002 | Two people sending Connect to each other at the same moment creates two open requests | Connect | API (all platforms) | Medium | P1 | **CLOSED** 21 Nov (retest PASS + regression 227/228) | SL-CONN-CON-001 (run p0-20261121-1029) | server/src/routes/connections.js |

---

## SLD-001 · Blocking keeps the Connection

- **Environment / build:** E1 laptop, branch `qa/foundation` @ `964cf9dc`, `soulink_test`
- **Steps:** 1) C sends A a Connect request, A accepts with Connect back (Connections). 2) A blocks C. 3) Check `connections`. 4) A unblocks C. 5) C opens A's profile, posts, Moments, starts a chat.
- **Expected:** blocking ends the relationship in both directions; after unblock they start from nothing (C must Connect again).
- **Actual (confirmed):** after step 2 the `connections` row is still there (assert `1 !== 0`). Remaining steps are measured by the widened test in the next run.
- **Root cause:** `POST /blocks/:id` (`server/src/routes/safety.js`) deletes rows in `follows` only. The comment says "Blocking removes follows (and requests)", but neither `connections` nor open `connection_requests` are touched. Visibility (`canViewContent` uses `rel.connected`), Moments (`connectionBetween`) and chat (`connectionBetween`) all trust the `connections` row, so once the block is lifted, access comes back without consent. While the block is active, the checks for "blocked either way" hide content, so the leak is after unblock (and in counts during the block).
- **Product rule (Sai, 21 Nov 2026):** start from zero. Block removes the Connection and open requests; after unblock a new Connect request is needed.
- **Fix:** in the block transaction, also delete the `connections` row and mark open `connection_requests` (both ways) `withdrawn` (no cooldown is applied, so a new request is possible after unblock). If a request was on Hold, its hold chat is hidden with the existing `closeHeldChat`, as when a hold is rejected. Normal chat history is kept (same as Disconnect) and stays unreachable while blocked.
- **Files changed:** `server/src/routes/safety.js` (+10 / −2)
- **Tests:** SL-SAFE-MU-002 widened to check every surface after unblock (Connection row, open requests, counts, profile, posts, Moments, new chat, old request). Regression: block/report suite (m1, m2), Connect suites, full suite.
- **Retest (run-20261121-1041):** Connection row removed, open requests withdrawn, counts, profile, private posts, Moments, old request: all PASS. Still flagged: "C can start a chat after unblock". Cause: the test environment turns the chat gate off (`connectRequired` is false when NODE_ENV=test, see OBS-010); production has it on, and `conversations.js:296/404` refuse once the Connection is gone. Test now switches the gate on for this check and also tries writing in the old chat. Regression: 227/228, no other failures.
- **Final retest (p0-20261121-1106):** SL-SAFE-MU-002 PASS with the production chat gate on (new chat and old chat both refused after unblock); all 12 QA P0 checks PASS. **Closed.**
- **Evidence:** `results/p0-20261121-1029/spec.txt`

## SLD-002 · Simultaneous Connect creates two open requests

- **Steps:** A and B (both with Soul DNA, not connected) send a Connect request to each other in parallel.
- **Expected:** exactly one open request between them; the second sender is told the other already sent one.
- **Actual:** 2 open requests (assert `2 !== 1`).
- **Root cause:** `POST /connections/requests` checks for open requests in both directions, then inserts, with no transaction or lock: a classic check-then-act race. In the app this is two people tapping Connect on each other within the same fraction of a second.
- **Fix:** the check and the insert now run in one transaction that holds an exclusive app lock on the pair (`sp_getapplock`, key = sorted pair of user ids) and re-checks open requests under `UPDLOCK, HOLDLOCK`. Same error messages and codes as before. No schema change.
- **Files changed:** `server/src/routes/connections.js` (+15 / −4)
- **Tests:** SL-CONN-CON-001 (existing failing test, unchanged). Regression: Connect suites (m4, m7, m11, m12, m37…), full suite.
- **Retest (run-20261121-1041):** SL-CONN-CON-001 PASS. Regression: full suite 227/228, per-file 227/228; the single failure is SL-SAFE-MU-002 (SLD-001), unrelated. No deadlocks. **Closed.**

---

## Observations raised during execution

| ID | Observation | Severity | Action |
|---|---|---|---|
| OBS-010 | The test environment runs with the "chat/Moments/Argue need a Connection" gate off (`CONNECT_REQUIRED` defaults to false when NODE_ENV=test). The 216 existing tests therefore never exercise the production gate on chat, Moment replies and Argue invites | Medium (coverage gap) | QA tests switch the gate on where it matters; planned: a gated variant of the chat suites |

## Test corrections (not product defects)

| Test | Problem in the test | Correction |
|---|---|---|
| SL-SAFE-MU-002 (chat check) | Ran with the test-only chat gate off, so a new chat after unblock looked allowed | Check now runs with `config.connectRequired = true`, as in production, and also tries the old chat |
| SL-PROF-MU-001 | Expected 403/404 for a stranger listing a private account's posts. The API answers 200 with `{ posts: [], private: true }` by design, and nothing leaks | Assertion now accepts either a refusal or an empty, private-marked answer |
