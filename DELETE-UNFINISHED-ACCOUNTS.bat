@echo off
rem Deletes Soulink test accounts that have NOT finished Soul DNA. Accounts with Soul DNA are kept.
cd /d "%~dp0server"
echo.
node tools\delete-unfinished.js
echo.
set /p ok= Type YES and press Enter to delete the accounts listed above: 
if /i not "%ok%"=="YES" (
  echo Cancelled. Nothing was deleted.
  pause
  exit /b
)
node tools\delete-unfinished.js --yes
echo.
pause
