@echo off
rem Soulink QA baseline run (read-only for your real data: tests use the separate "soulink_test" database).
rem Pass 1 = the full suite exactly as RUN-TESTS.bat runs it (the true baseline).
rem Pass 2 = every test file on its own, in a fresh process (shows which failures come from the test set-up).
rem Results go to docs\qa\results\run-<date-time>\. Takes about 10-15 minutes. SQL Server must be running.
setlocal
cd /d "%~dp0server"
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmm"') do set STAMP=%%i
set OUT=%~dp0docs\qa\results\run-%STAMP%
mkdir "%OUT%\per-file" >nul 2>&1

echo Soulink QA run %STAMP% > "%OUT%\environment.txt"
node -v >> "%OUT%\environment.txt" 2>&1
call npm -v >> "%OUT%\environment.txt" 2>&1
git -C "%~dp0." rev-parse --short HEAD >> "%OUT%\environment.txt" 2>&1
git -C "%~dp0." status --short >> "%OUT%\environment.txt" 2>&1
sc query "MSSQL$SQLEXPRESS" | findstr STATE >> "%OUT%\environment.txt" 2>&1

echo.
echo [1/2] Full suite (about 5 minutes)...
node --test --test-concurrency=1 --test-reporter=spec --test-reporter-destination="%OUT%\full-spec.txt" --test-reporter=junit --test-reporter-destination="%OUT%\full-junit.xml" "test/**/*.test.js" > "%OUT%\full-console.txt" 2>&1
findstr /B /C:"# tests" /C:"# pass" /C:"# fail" /C:"ℹ tests" /C:"ℹ pass" /C:"ℹ fail" "%OUT%\full-spec.txt"

echo.
echo [2/2] Each test file on its own (about 6-8 minutes)...
for %%f in (test\*.test.js) do (
  echo    %%~nf
  node --test --test-reporter=tap "%%f" > "%OUT%\per-file\%%~nf.txt" 2>&1
)

cd /d "%~dp0mobile"
node test\studio.test.mjs > "%OUT%\mobile-studio.txt" 2>&1
echo exit code %ERRORLEVEL% >> "%OUT%\mobile-studio.txt"

echo DONE > "%OUT%\DONE.txt"
echo.
echo Finished. Results are in docs\qa\results\run-%STAMP%
echo Tell Claude "QA run done".
pause
