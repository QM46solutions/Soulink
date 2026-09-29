@echo off
rem Writes face-report.txt (accounts + stored face fingerprints). Read-only.
cd /d "%~dp0server"
node tools\face-report.js
echo.
echo Done. Tell Claude, or open face-report.txt in the Soulink folder.
pause
