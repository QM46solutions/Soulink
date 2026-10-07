@echo off
rem Saves your free cloud database details (Azure SQL) on this laptop and checks the connection.
rem See docs\CLOUD-HOSTING.md for the full step-by-step guide.
cd /d "%~dp0server"
node tools\cloud-setup.js
pause
