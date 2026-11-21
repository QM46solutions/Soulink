@echo off
rem Installs Maestro for Soulink's Android app tests (Java 17 + Maestro + adb on PATH). Safe to run again.
rem Tip: start the Android emulator in Android Studio first, so the last check can see it.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup\install-maestro.ps1"
echo.
echo Log saved to docs\qa\results\maestro-install.txt. Tell Claude "Maestro installed".
pause
