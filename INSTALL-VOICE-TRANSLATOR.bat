@echo off
rem One-time setup for the voice translator in chat: speak in your language, send text or voice in theirs.
rem Free, runs only on this laptop. Needs the chat translator first (INSTALL-CHAT-TRANSLATOR.bat).
rem Needs internet once (about 1.6 GB). Takes 10-20 minutes.
echo.
echo  Installing the Soulink voice translator. Keep this window open until it says DONE.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\soulmoji-ai\install-voice.ps1"
echo.
pause
