@echo off
rem Soulink Android UI tests (Maestro) on the Android Studio emulator, against the server on THIS laptop (never production).
rem Before: start the emulator (Android Studio > Device Manager > play button). Then double-click this file.
rem It opens two windows (Soulink server, Metro) if they are not already running; leave them open until it finishes.
setlocal
cd /d "%~dp0"
set PATH=%USERPROFILE%\maestro\bin;%LOCALAPPDATA%\Android\Sdk\platform-tools;%PATH%
set MAESTRO_CLI_NO_ANALYTICS=1
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmm"') do set STAMP=%%i
set OUT=%~dp0docs\qa\results\android-%STAMP%
mkdir "%OUT%" >nul 2>&1

adb devices > "%OUT%\devices.txt" 2>&1
findstr /R /C:"emulator-[0-9]*[ 	]*device" "%OUT%\devices.txt" >nul || ( echo No running emulator found. Start it in Android Studio first. & type "%OUT%\devices.txt" & pause & exit /b 1 )

powershell -NoProfile -Command "try{ (Invoke-WebRequest http://localhost:4000/health -UseBasicParsing -TimeoutSec 3) | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo Starting the Soulink server window...
  start "Soulink server (QA)" cmd /k "cd /d "%~dp0server" && npm run dev"
)
powershell -NoProfile -Command "try{ (Invoke-WebRequest http://localhost:8090/status -UseBasicParsing -TimeoutSec 3) | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo Starting Metro for the phone app ^(port 8090, laptop server^); it installs Expo Go on the emulator if needed...
  start "Soulink Metro (QA)" cmd /k "cd /d "%~dp0mobile" && set EXPO_PUBLIC_API_URL=http://10.0.2.2:4000&& npx expo start --go --android --port 8090"
)
echo Waiting for the server and Metro...
powershell -NoProfile -Command "for($i=0;$i -lt 150;$i++){ try{ Invoke-WebRequest http://localhost:4000/health -UseBasicParsing -TimeoutSec 3 | Out-Null; Invoke-WebRequest http://localhost:8090/status -UseBasicParsing -TimeoutSec 3 | Out-Null; exit 0 } catch { Start-Sleep 2 } }; exit 1"
if errorlevel 1 ( echo Server or Metro did not start. Look at their windows for errors. & pause & exit /b 1 )

echo Running the Android flows... (first run builds the app bundle: a few minutes)
call maestro test "qa\maestro\flows" -e EXPO_URL=exp://10.0.2.2:8090 -e PHONE=9000000100 --format junit --output "%OUT%\junit.xml" --debug-output "%OUT%\debug" > "%OUT%\maestro.txt" 2>&1
call maestro hierarchy > "%OUT%\last-screen-hierarchy.json" 2>nul
adb exec-out screencap -p > "%OUT%\last-screen.png"
type "%OUT%\maestro.txt" | findstr /C:"Passed" /C:"Failed" /C:"[Passed]" /C:"[Failed]"
echo DONE > "%OUT%\DONE.txt"
echo.
echo Finished. Results in docs\qa\results\android-%STAMP%. Tell Claude "Android run done".
pause
