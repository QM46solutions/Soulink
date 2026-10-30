@echo off
rem Makes the separate face key once (saved in server\cloud.env, copied to the clipboard) for Render's FACE_KEY setting.
cd /d "%~dp0server"
node tools\make-face-key.js
pause
