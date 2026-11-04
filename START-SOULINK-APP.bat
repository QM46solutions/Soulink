@echo off
rem Opens the REAL Soulink phone app (not the website) on your iPhone or Android, through the free Expo Go app.
rem 1. Install "Expo Go" from the App Store / Play Store (free).  2. Run this file.  3. Scan the QR code with the iPhone camera.
rem The app uses the live Soulink server in the cloud, so your real account and data are there.
rem Works on Wi-Fi or mobile data (secure tunnel). Keep this window open while testing; close it to stop.
cd /d "%~dp0mobile"
echo.
echo  Starting the Soulink phone app... the QR code appears below in about a minute.
echo  First time only: if it asks to install "@expo/ngrok", type Y and press Enter.
echo  On the phone: open the iPhone Camera, point it at the QR code, tap the "Open in Expo Go" banner.
echo  The first open takes 1-2 minutes while the app loads. Shake the phone for the developer menu (Reload).
echo.
npx expo start --go --tunnel
pause
