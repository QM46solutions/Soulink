@echo off
rem Erases ALL Soulink test data on this laptop (accounts, faces, Soul DNA, chats, photos) and starts fresh.
rem The code and your settings are not touched.
cd /d "%~dp0server"
echo.
echo  =====================================================
echo   This ERASES all Soulink accounts, faces, Soul DNA,
echo   follows, chats and photos on this laptop.
echo   It cannot be undone.
echo  =====================================================
echo.
set /p ok= Type YES and press Enter to erase everything: 
if /i not "%ok%"=="YES" (
  echo Cancelled. Nothing was erased.
  pause
  exit /b
)
node tools\reset-data.js
echo.
pause
