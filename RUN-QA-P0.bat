@echo off
rem Runs only the new QA P0 checks (server\test\qa-*.test.js, about 1-2 minutes) on the separate soulink_test database.
setlocal
cd /d "%~dp0server"
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmm"') do set STAMP=%%i
set OUT=%~dp0docs\qa\results\p0-%STAMP%
mkdir "%OUT%" >nul 2>&1
node --test --test-concurrency=1 --test-reporter=spec --test-reporter-destination="%OUT%\spec.txt" --test-reporter=junit --test-reporter-destination="%OUT%\junit.xml" "test/qa-*.test.js" > "%OUT%\console.txt" 2>&1
type "%OUT%\spec.txt"
echo DONE > "%OUT%\DONE.txt"
echo.
echo Results in docs\qa\results\p0-%STAMP%. Tell Claude "P0 run done".
pause
