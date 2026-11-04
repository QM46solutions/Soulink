@echo off
rem ONE TIME: makes the Android signing key (kept safely in your Expo account) and builds the first Android test app.
rem When it finishes you get a link + QR code to install Soulink on any Android phone. Later builds run from GitHub.
cd /d "%~dp0mobile"
set EAS_NO_VCS=1
echo.
echo  If it asks "Generate a new Android Keystore?" type Y and press Enter.
echo  The build runs in Expo's cloud (about 15-25 minutes). You can close this window once it says the build is queued.
echo.
call npx --yes eas-cli@latest build --platform android --profile preview
pause
