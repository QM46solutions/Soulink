@echo off
rem One-time setup for Soulink on this laptop. Safe to run again.
rem It asks once for administrator rights (for the SQL Server settings), then installs everything else as you.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup\setup-windows.ps1" -Part app
