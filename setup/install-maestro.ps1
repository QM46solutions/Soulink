# Installs Maestro (Android UI testing) for Soulink QA. Safe to run again: it updates what is already there.
# Steps: Java 17+ (installs Temurin 17 with winget if missing) -> JAVA_HOME -> Maestro CLI in %USERPROFILE%\maestro
# -> Android SDK platform-tools (adb) on PATH -> checks. Log: docs\qa\results\maestro-install.txt
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$resDir = Join-Path $root 'docs\qa\results'
New-Item -ItemType Directory -Force -Path $resDir | Out-Null
Start-Transcript -Path (Join-Path $resDir 'maestro-install.txt') -Force | Out-Null

function Add-UserPath([string]$dir) {
  $p = [Environment]::GetEnvironmentVariable('Path', 'User'); if (-not $p) { $p = '' }
  if (($p -split ';') -notcontains $dir) {
    [Environment]::SetEnvironmentVariable('Path', ($p.TrimEnd(';') + ';' + $dir).TrimStart(';'), 'User')
    Write-Host "  added to PATH: $dir"
  }
  if (($env:Path -split ';') -notcontains $dir) { $env:Path = "$dir;$env:Path" }
}
function Java-Major([string]$javaExe) {
  try { $v = (& $javaExe -version 2>&1 | Out-String) } catch { return 0 }
  if ($v -match 'version "(\d+)') { return [int]$Matches[1] } else { return 0 }
}
function Find-Jdk {
  $dirs = @()
  foreach ($base in @("$env:ProgramFiles\Eclipse Adoptium", "$env:ProgramFiles\Microsoft", "$env:ProgramFiles\Java", "$env:ProgramFiles\Android\Android Studio")) {
    if (Test-Path $base) { $dirs += Get-ChildItem $base -Directory -ErrorAction SilentlyContinue | Where-Object { Test-Path (Join-Path $_.FullName 'bin\java.exe') } }
  }
  if (Test-Path "$env:ProgramFiles\Android\Android Studio\jbr\bin\java.exe") { $dirs += Get-Item "$env:ProgramFiles\Android\Android Studio\jbr" }
  $best = $null; $bestV = 0
  foreach ($d in $dirs) { $v = Java-Major (Join-Path $d.FullName 'bin\java.exe'); if ($v -ge 17 -and $v -gt $bestV) { $best = $d.FullName; $bestV = $v } }
  return $best
}

Write-Host "`n[1/4] Java 17 or newer"
$jdk = $null
if ($env:JAVA_HOME -and (Java-Major (Join-Path $env:JAVA_HOME 'bin\java.exe')) -ge 17) { $jdk = $env:JAVA_HOME }
if (-not $jdk) { $jdk = Find-Jdk }
if (-not $jdk) {
  Write-Host "  no Java 17+ found: installing Eclipse Temurin 17 with winget (a Windows prompt may appear)"
  winget install --id EclipseAdoptium.Temurin.17.JDK -e --silent --accept-package-agreements --accept-source-agreements
  $jdk = Find-Jdk
}
if (-not $jdk) { Write-Host "  FAILED: Java 17+ could not be installed. Install Temurin 17 from https://adoptium.net and run this again."; Stop-Transcript | Out-Null; exit 1 }
[Environment]::SetEnvironmentVariable('JAVA_HOME', $jdk, 'User'); $env:JAVA_HOME = $jdk
Add-UserPath (Join-Path $jdk 'bin')
Write-Host "  JAVA_HOME = $jdk (Java $(Java-Major (Join-Path $jdk 'bin\java.exe')))"

Write-Host "`n[2/4] Maestro CLI"
$zip = Join-Path $env:TEMP 'maestro.zip'
try {
  Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/mobile-dev-inc/maestro/releases/latest/download/maestro.zip' -OutFile $zip
  Expand-Archive -Path $zip -DestinationPath $env:USERPROFILE -Force
  Remove-Item $zip -Force -ErrorAction SilentlyContinue
} catch { Write-Host "  FAILED to download or unpack Maestro: $($_.Exception.Message)"; Stop-Transcript | Out-Null; exit 1 }
$mbin = Join-Path $env:USERPROFILE 'maestro\bin'
if (-not (Test-Path (Join-Path $mbin 'maestro.bat'))) { Write-Host "  FAILED: $mbin\maestro.bat not found after unpacking"; Stop-Transcript | Out-Null; exit 1 }
Add-UserPath $mbin
# no interactive analytics question on first run (it would stop unattended test runs)
[Environment]::SetEnvironmentVariable('MAESTRO_CLI_NO_ANALYTICS', '1', 'User'); $env:MAESTRO_CLI_NO_ANALYTICS = '1'
[Environment]::SetEnvironmentVariable('MAESTRO_CLI_ANALYTICS_NOTIFICATION_DISABLED', 'true', 'User'); $env:MAESTRO_CLI_ANALYTICS_NOTIFICATION_DISABLED = 'true'

Write-Host "`n[3/4] Android SDK (adb)"
$sdk = if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (Test-Path (Join-Path $sdk 'platform-tools\adb.exe')) {
  [Environment]::SetEnvironmentVariable('ANDROID_HOME', $sdk, 'User'); $env:ANDROID_HOME = $sdk
  Add-UserPath (Join-Path $sdk 'platform-tools')
  Write-Host "  ANDROID_HOME = $sdk"
} else { Write-Host "  WARNING: adb not found under $sdk. Open Android Studio > SDK Manager > SDK Tools and tick 'Android SDK Platform-Tools'." }

Write-Host "`n[4/4] Checks"
Write-Host "  java:    $((& (Join-Path $jdk 'bin\java.exe') -version 2>&1 | Select-Object -First 1))"
Write-Host "  maestro: $((& (Join-Path $mbin 'maestro.bat') --version 2>&1 | Select-Object -Last 1))"
if (Get-Command adb -ErrorAction SilentlyContinue) { Write-Host "  adb devices:"; adb devices 2>&1 | ForEach-Object { Write-Host "    $_" } }
Write-Host "`nDone. New terminal windows will see maestro, java and adb on PATH."
Stop-Transcript | Out-Null
