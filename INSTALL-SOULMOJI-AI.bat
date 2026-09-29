@echo off
rem One-time setup for Soulmoji AI: changes the expression on your real photo without damaging it.
rem Free, runs only on this laptop. Needs internet once (about 2-3 GB). Takes 10-30 minutes.
echo.
echo  Installing Soulmoji AI (LivePortrait). Keep this window open until it says DONE.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\soulmoji-ai\install.ps1"
echo.
pause
