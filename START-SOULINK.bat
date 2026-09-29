@echo off
rem Starts the Soulink server and the app. Keep both windows open while you use the app.
cd /d "%~dp0"
start "Soulink server" cmd /k "cd /d "%~dp0server" && npm run dev"
timeout /t 4 /nobreak >nul
start "Soulink app (scan the QR code with Expo Go)" cmd /k "cd /d "%~dp0mobile" && npx expo start --lan"
