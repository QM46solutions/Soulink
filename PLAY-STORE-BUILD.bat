@echo off
rem Builds the Play Store version of Soulink (.aab) in Expo's cloud and sends it to the Closed testing track as a draft.
rem Before the first run: Play Console app created, and the Google service account key added in expo.dev (see the steps Claude gave).
cd /d "%~dp0mobile"
set EAS_NO_VCS=1
call npx --yes eas-cli@latest build --platform android --profile production --auto-submit
pause
