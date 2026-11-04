@echo off
rem ONE TIME, after you join the Apple Developer Program: makes the iPhone app signing keys and sends the first
rem iPhone build to TestFlight. It asks for your Apple ID login once. Later builds run in the cloud from GitHub.
cd /d "%~dp0mobile"
set EAS_NO_VCS=1
call npx --yes eas-cli@latest build --platform ios --profile production --auto-submit
pause
