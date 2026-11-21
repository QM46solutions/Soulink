# Soulink QA automation

| What | Where | Run with |
|---|---|---|
| Server API tests (existing 216 + QA P0 checks) | `server/test/*.test.js`, QA ones `server/test/qa-*.test.js` | `RUN-QA.bat` (everything) · `RUN-QA-P0.bat` (QA checks only, ~2 min) |
| Android UI flows (Maestro) | `qa/maestro/flows/` | `RUN-ANDROID-QA.bat` (emulator running first) |
| Test-case repository | `docs/qa/testcases/TEST-CASES.csv` | rebuilt by `node docs/qa/testcases/build.mjs <run folder>` |

All runs write evidence to `docs/qa/results/<kind>-<date-time>/`. Every test name starts with its test-case ID.

Android flows run the app inside Expo Go with `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000` (the laptop server). Release/preview APKs can't be used against the laptop because Android blocks plain http in release builds.
