@echo off
rem One-time setup for the chat translator (English, Hindi, Telugu, Bengali). Free, runs only on this laptop.
rem Needs internet once (about 2.5 GB). Takes 10-20 minutes.
echo.
echo  Installing the Soulink chat translator. Keep this window open until it says DONE.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\soulmoji-ai\install-translator.ps1"
echo.
pause
