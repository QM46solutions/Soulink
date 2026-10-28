@echo off
rem Copies all accounts, posts, chats, Soul DNA, photos and voice notes from this laptop to the cloud.
rem The cloud copy is REPLACED by what is on this laptop.
cd /d "%~dp0server"
echo.
echo  This REPLACES everything in the cloud database with the data on this laptop.
set /p OK=Type YES to continue: 
if /I not "%OK%"=="YES" ( echo  Cancelled. & pause & exit /b )
echo.
echo  The cloud database is the LIVE one. Say why you are replacing it (kept in the audit log):
set /p REASON=Reason: 
node tools\copy-to-cloud.js --production-reason "%REASON%"
pause
