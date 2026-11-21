# Soulink master test-case repository (Phase 3)

`TEST-CASES.csv` opens in Excel (UTF-8, one row per case, 17 columns: ID, Module, Scenario, Preconditions, Steps, Test data, Expected result, Actual result, Platform, Environment, Type, Priority, Severity, Status, Defect ID, Evidence, Automation).

| Source | Rows | Status |
|---|---|---|
| Planned cases (`cases-part1..3.txt`, written from the code, product decisions and the coverage gaps) | 204 | NOT RUN |
| Existing automated server tests (from `results/run-20261120-1741/full-junit.xml`) | 216 | PASS (executed 20 Nov 2026) |
| **Total** | **420** | |

- IDs: `SL-<MODULE>-<TYPE>-<NNN>`; existing automated tests are `SL-<MODULE>-AUTO-<NNN>`.
- Automated tests default to P1; they have not been individually re-prioritised yet.
- Planned cases are written at the level of "what must be true for both users". Exact click paths for the phone are written into the Maestro flows and iOS scripts in Phase 4, which carry the same IDs.
- Edit the `cases-part*.txt` files (pipe-separated), then rebuild: `node docs/qa/testcases/build.mjs docs/qa/results/<latest run>`. Editing the CSV by hand is fine for Actual result / Status / Evidence, but a rebuild overwrites it, so record execution results through the runners instead.

Environments: E1 laptop (API, Web), E2 Android emulator, E3 iPhone (manual).
