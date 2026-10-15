@echo off
rem Runs all of Soulink's automated server tests (about 5 minutes).
rem Uses the separate test database "soulink_test": your real app data is never touched.
rem SQL Server must be running (it starts with Windows).
cd /d "%~dp0server"
echo Running Soulink tests... this takes a few minutes.
echo.
call npm test > "%~dp0test-results.txt" 2>&1
type "%~dp0test-results.txt" | findstr /B /C:"# tests" /C:"# pass" /C:"# fail"
echo.
echo Full results saved in test-results.txt in the Soulink folder. Tell Claude when it is done.
pause
