@echo off
rem ONE TIME: connects the Soulink phone app to your free Expo account, so it can be built and updated in the cloud.
rem Before running: create a free account at https://expo.dev/signup (use the Soulink / QM46 email).
cd /d "%~dp0mobile"
set EAS_NO_VCS=1
echo.
echo  Step 1 of 3: log in to Expo (type your Expo email and password when asked)
call npx --yes eas-cli@latest login
echo.
echo  Step 2 of 3: create the Soulink project in your Expo account (answer Y if asked)
call npx --yes eas-cli@latest init
echo.
echo  Step 3 of 3: switch on over-the-air updates
call npx --yes eas-cli@latest update:configure
echo.
echo  Done. Now open GitHub Desktop, commit the changed app.json and push.
echo  Then add the EXPO_TOKEN secret on GitHub (see docs\PHONE-APP.md, step 3).
pause
