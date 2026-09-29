@echo off
rem Run this after Claude delivers new code. Installs new packages, updates the database, runs the tests.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup\update-windows.ps1"
