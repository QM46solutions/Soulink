@echo off
rem Starts Soulink and opens it in your browser by itself. Keep the two black Soulink windows open while you use the app.
cd /d "%~dp0"
start "Soulink server" cmd /k "cd /d "%~dp0server" && npm run dev"
timeout /t 4 /nobreak >nul
start "Soulink app (browser)" cmd /k "cd /d "%~dp0mobile" && npx expo start --web --port 8081"
echo.
echo  Starting Soulink... your browser opens by itself when the app is ready.
echo  This can take 1-3 minutes (longer the first time after an update).
echo  This window closes by itself once the browser opens.
powershell -NoProfile -Command "$u='http://localhost:8081'; for($i=0;$i -lt 300;$i++){ try{ $r=Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 120; if($r.StatusCode -eq 200){ Start-Process $u; exit 0 } } catch { Start-Sleep 2 } }; Write-Host ''; Write-Host ' The app did not start. Look at the black window called Soulink app for an error.'; Read-Host ' Press Enter to close'"
