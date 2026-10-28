@echo off
rem Deletes every account in the LIVE cloud database except the ones listed below. It first shows the list
rem and asks before deleting anything. Uses the app's own account deletion (photos, chats, face data erased).
cd /d "%~dp0server"
set KEEP=nikhil.cheedella,sairaghava.r,akhii,sai.charan,harshavardhan.reddy
echo.
echo  Accounts to KEEP: %KEEP%
node tools\keep-only-accounts.js --keep "%KEEP%"
if errorlevel 1 ( pause & exit /b )
echo.
echo  Every account in the DELETE list above will be erased from the live app. This cannot be undone.
set /p OK=Type DELETE to continue: 
if not "%OK%"=="DELETE" ( echo  Cancelled. Nothing was deleted. & pause & exit /b )
set /p REASON=Reason (kept in the audit log): 
node tools\keep-only-accounts.js --keep "%KEEP%" --yes --production-reason "%REASON%"
pause
