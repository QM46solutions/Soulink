# Run after Claude delivers new code: installs any new packages, updates the database tables,
# and runs the automated tests. No administrator rights needed. Results: update-log.txt
$Root = Split-Path -Parent $PSScriptRoot
$Log = Join-Path $Root 'update-log.txt'
Start-Transcript -Path $Log -Force | Out-Null
$ok = $true
function Run($title, $folder, $cmd) {
  Write-Host ""; Write-Host "== $title ==" -ForegroundColor Magenta
  Push-Location (Join-Path $Root $folder)
  cmd /c "$cmd 2>&1" | ForEach-Object { Write-Host $_ }
  $code = $LASTEXITCODE
  Pop-Location
  if ($code -ne 0) { Write-Host "   FAILED: $title" -ForegroundColor Red; $script:ok = $false }
  else { Write-Host "   OK  $title" -ForegroundColor Green }
}
Write-Host "Soulink update" -ForegroundColor Cyan
Run 'Server packages' 'server' 'npm install --no-fund --no-audit'
Run 'App packages' 'mobile' 'npm install --no-fund --no-audit'
Run 'Database tables' 'server' 'npm run migrate'
Run 'Automated tests' 'server' 'npm test'
Write-Host ""
if ($ok) { Write-Host "Update finished: everything passed. Start the app with START-SOULINK.bat" -ForegroundColor Cyan }
else { Write-Host "Something failed. Tell Claude: it can read update-log.txt in the Soulink folder." -ForegroundColor Yellow }
Stop-Transcript | Out-Null
Read-Host "Press Enter to close"
