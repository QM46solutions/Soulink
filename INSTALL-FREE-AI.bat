@echo off
rem Installs the FREE local AI for the Argue Referee: Ollama (ollama.com) + the Llama 3.2 3B model (~2 GB).
rem Runs entirely on this laptop: no account, no key, no cost. Run once. Ollama then starts with Windows.
setlocal
set MODEL=llama3.2:3b
set OLLAMA=%LOCALAPPDATA%\Programs\Ollama\ollama.exe
echo.
echo  Soulink free AI setup
echo  =====================
if exist "%OLLAMA%" goto haveollama
where ollama >nul 2>nul && (set OLLAMA=ollama& goto haveollama)
echo  Step 1/2: installing Ollama (free, from ollama.com)...
where winget >nul 2>nul
if %errorlevel%==0 (
  winget install --id Ollama.Ollama -e --accept-source-agreements --accept-package-agreements
) else (
  echo  Downloading the Ollama installer from ollama.com ...
  powershell -NoProfile -Command "Invoke-WebRequest 'https://ollama.com/download/OllamaSetup.exe' -OutFile \"$env:TEMP\OllamaSetup.exe\" -UseBasicParsing"
  "%TEMP%\OllamaSetup.exe"
)
if not exist "%OLLAMA%" (
  where ollama >nul 2>nul && (set OLLAMA=ollama) || (echo  Ollama did not install. Try again, or install it from https://ollama.com/download & pause & exit /b)
)
:haveollama
echo  Step 2/2: downloading the AI model %MODEL% (about 2 GB, one time only)...
start "" /min "%OLLAMA%" serve
timeout /t 5 /nobreak >nul
"%OLLAMA%" pull %MODEL%
if errorlevel 1 ( echo  The download failed. Check your internet and run this again. & pause & exit /b )
echo.
echo  Done! The Argue Referee now uses the free AI on this laptop.
echo  Restart Soulink (close the black windows, then START-SOULINK-WEB) to pick it up.
pause
