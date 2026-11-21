# Soulink QA code change register

All changes on branch `qa/foundation` (from `main` @ `964cf9dc`). Nothing committed, merged or deployed without approval.

| # | Date | Files | Defect | Change | Tests | Result |
|---|---|---|---|---|---|---|
| 1 | 21 Nov 2026 | server/src/routes/connections.js | SLD-002 | Connect request check + insert in one transaction with an exclusive pair lock (`sp_getapplock`) and a locked re-check | SL-CONN-CON-001, full suite | PASS; regression 227/228 (run-20261121-1041) |
| 2 | 21 Nov 2026 | server/src/routes/safety.js | SLD-001 | Block also deletes the Connection and withdraws open Connect requests both ways; hides a hold chat | SL-SAFE-MU-002, m1/m2 block tests, full suite | PASS (p0-20261121-1106, 12/12); m1/m2 PASS; regression 227/228 (run-20261121-1041) |
