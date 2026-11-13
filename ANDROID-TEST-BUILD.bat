@echo off
rem Builds a new Android test app (APK) in Expo's cloud from the code on this laptop. Use it after native changes
rem (new permissions, Firebase, new packages). Ordinary code changes reach the phone by a normal push instead.
rem About 15-25 minutes. When it finishes you get a link + QR code: open it on the phone and install over the old app.
cd /d "%~dp0mobile"
set EAS_NO_VCS=1
call npx --yes eas-cli@latest build --platform android --profile preview
pause
