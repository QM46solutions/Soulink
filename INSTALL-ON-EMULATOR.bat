@echo off
rem Installs the latest Soulink Android test app on the Android emulator (Android Studio) and opens it.
rem First start the emulator: Android Studio > Device Manager > the play button next to your phone.
cd /d "%~dp0mobile"
set EAS_NO_VCS=1
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set ANDROID_SDK_ROOT=%LOCALAPPDATA%\Android\Sdk
set PATH=%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\emulator;%PATH%
if not exist "%ANDROID_HOME%\platform-tools\adb.exe" ( echo  Android Studio tools not found. Open Android Studio once and let it finish "SDK setup", then try again. & pause & exit /b )
echo.
echo  Installing the newest Soulink test app on the running emulator...
call npx --yes eas-cli@latest build:run --platform android --latest
pause
