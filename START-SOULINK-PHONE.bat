@echo off
rem Opens Soulink on your phone (iPhone or Android) through a secure https link. Works on Wi-Fi or mobile data.
rem Keep the Soulink windows open while testing. Close them to stop.
cd /d "%~dp0"
if not exist "tools\cloudflared.exe" (
  echo  First time only: downloading Cloudflare's free secure-link tool from github.com/cloudflare/cloudflared ...
  if not exist tools mkdir tools
  powershell -NoProfile -Command "Invoke-WebRequest 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'tools\cloudflared.exe' -UseBasicParsing"
  if not exist "tools\cloudflared.exe" ( echo  Download failed. Check your internet and try again. & pause & exit /b )
)
start "Soulink server" cmd /k "cd /d "%~dp0server" && npm run dev"
timeout /t 4 /nobreak >nul
start "Soulink app (browser)" cmd /k "cd /d "%~dp0mobile" && npx expo start --web --port 8081"
cd server
echo.
echo  Starting Soulink for your phone... the link and QR code appear below in about a minute.
echo  The FIRST open on the phone takes 1-2 minutes while the app loads. Later opens are quicker.
node tools\phone-link.js
pause
