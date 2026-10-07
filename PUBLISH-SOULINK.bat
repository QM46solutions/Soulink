@echo off
rem Puts the latest Soulink online: uploads the code to GitHub, which builds it and Render goes live by itself
rem (about 5-8 minutes). See docs\CLOUD-HOSTING.md.
cd /d "%~dp0"
where git >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Git is not installed. Install it free from https://git-scm.com/download/win
  echo  ^(keep all the default options^), then double-click this file again.
  pause
  exit /b
)
git remote get-url origin >nul 2>nul
if errorlevel 1 call :firsttime
git add -A
git -c user.name="Soulink Dev" -c user.email=dev@soulink.local commit -q -m "Publish" >nul 2>nul
echo.
echo  Uploading to GitHub... (the first time a GitHub sign-in window opens)
git push -u origin main
if errorlevel 1 (
  echo.
  echo  Upload failed. Check your internet and GitHub sign-in, then try again.
  pause
  exit /b
)
echo.
echo  Uploaded. GitHub is building the new version now and Render puts it online in about 5-8 minutes.
echo  Progress: your GitHub repository ^> Actions tab, then Render ^> soulink ^> Events.
pause
exit /b

:firsttime
echo.
echo  First time only: paste the address of your EMPTY private GitHub repository,
echo  for example  https://github.com/yourname/soulink.git
set /p REPO=GitHub address: 
git remote add origin "%REPO%"
exit /b
