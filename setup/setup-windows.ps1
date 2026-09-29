# Soulink one-time setup for Windows + SQL Server Express.
# Run it by double-clicking SETUP-SOULINK.bat (it asks once for administrator rights).
# Safe to run again: every step checks what is already done.

# Part "system" runs as administrator (SQL Server settings, database, firewall).
# Part "app" runs as you (packages, tables, tests), so the files stay owned by your account.
param([ValidateSet('system', 'app')][string]$Part = 'system')

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$Log = Join-Path $Root "setup-log-$Part.txt"
Start-Transcript -Path $Log -Force | Out-Null

function Step($n, $text) { Write-Host ""; Write-Host "[$n/8] $text" -ForegroundColor Magenta }
function Ok($text) { Write-Host "   OK  $text" -ForegroundColor Green }
function Warn($text) { Write-Host "   !!  $text" -ForegroundColor Yellow }
function Fail($text) {
  Write-Host ""; Write-Host "   SETUP STOPPED: $text" -ForegroundColor Red
  Write-Host "   Send Claude a screenshot of this window (a log was saved to setup-log-$Part.txt)." -ForegroundColor Red
  Stop-Transcript | Out-Null; Read-Host "Press Enter to close"; exit 1
}

$InstanceName = 'SQLEXPRESS'
$DbUser = 'soulink'
$Databases = @('soulink', 'soulink_test')
$Port = 1433

if ($Part -eq 'system') {
Write-Host "Soulink setup, part 1 of 2 (administrator)" -ForegroundColor Cyan
Write-Host "Folder: $Root"

# ---------- 1. Node.js ----------
Step 1 'Checking Node.js'
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Fail 'Node.js is not installed. Install the LTS version from https://nodejs.org and run this again.' }
Ok "Node.js $(node --version)"

# ---------- 2. Find SQL Server instance ----------
Step 2 "Finding SQL Server ($InstanceName)"
$namesKey = 'HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL'
try { $InstanceId = (Get-ItemProperty -Path $namesKey -Name $InstanceName -ErrorAction Stop).$InstanceName }
catch { Fail "SQL Server instance '$InstanceName' was not found. Install SQL Server Express and run this again." }
$serverKey = "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\$InstanceId\MSSQLServer"
$serviceName = "MSSQL`$$InstanceName"
Ok "Found $InstanceId (service $serviceName)"

# ---------- 3. Turn on network access (TCP 1433) and password logins ----------
Step 3 'Turning on network access (TCP port 1433) and username/password logins'
$changed = $false
$tcpKey = "$serverKey\SuperSocketNetLib\Tcp"
$ipAllKey = "$tcpKey\IPAll"
if ((Get-ItemProperty $tcpKey).Enabled -ne 1) { Set-ItemProperty $tcpKey -Name Enabled -Value 1; $changed = $true }
$ipAll = Get-ItemProperty $ipAllKey
if ($ipAll.TcpPort -ne "$Port" -or $ipAll.TcpDynamicPorts -ne '') {
  Set-ItemProperty $ipAllKey -Name TcpPort -Value "$Port"
  Set-ItemProperty $ipAllKey -Name TcpDynamicPorts -Value ''
  $changed = $true
}
if ((Get-ItemProperty $serverKey).LoginMode -ne 2) { Set-ItemProperty $serverKey -Name LoginMode -Value 2 -Type DWord; $changed = $true }
if ($changed) {
  Write-Host '   Restarting SQL Server to apply the settings...'
  Restart-Service -Name $serviceName -Force
} else {
  $svc = Get-Service -Name $serviceName
  if ($svc.Status -ne 'Running') { Start-Service -Name $serviceName }
}
Set-Service -Name $serviceName -StartupType Automatic
# Wait for the port to accept connections
$ready = $false
for ($i = 0; $i -lt 30 -and -not $ready; $i++) {
  try { $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1', $Port); $c.Close(); $ready = $true } catch { Start-Sleep -Seconds 1 }
}
if (-not $ready) { Fail "SQL Server is not answering on port $Port." }
Ok "SQL Server is listening on port $Port"

# ---------- 4. Database login and databases ----------
Step 4 'Creating the Soulink login and databases'
$envPath = Join-Path $Root 'server\.env'
$envExample = Join-Path $Root 'server\.env.example'
$password = $null
if (Test-Path $envPath) {
  $line = Select-String -Path $envPath -Pattern '^DB_PASSWORD=(.+)$' | Select-Object -First 1
  if ($line) { $password = $line.Matches[0].Groups[1].Value.Trim() }
}
if (-not $password) {
  $chars = [char[]]'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  $password = 'Sl' + (-join (1..22 | ForEach-Object { $chars | Get-Random })) + 'x9'
}
function Invoke-Sql($sqlText, $database = 'master') {
  $cs = "Server=tcp:127.0.0.1,$Port;Database=$database;Integrated Security=SSPI;TrustServerCertificate=True;Encrypt=False"
  $conn = New-Object System.Data.SqlClient.SqlConnection $cs
  $conn.Open()
  try { $cmd = $conn.CreateCommand(); $cmd.CommandText = $sqlText; $cmd.CommandTimeout = 120; [void]$cmd.ExecuteNonQuery() }
  finally { $conn.Close() }
}
$pwSql = $password.Replace("'", "''")
try {
  Invoke-Sql @"
IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'$DbUser')
  CREATE LOGIN [$DbUser] WITH PASSWORD = N'$pwSql', CHECK_POLICY = OFF, CHECK_EXPIRATION = OFF;
ELSE
  ALTER LOGIN [$DbUser] WITH PASSWORD = N'$pwSql', CHECK_POLICY = OFF;
ALTER LOGIN [$DbUser] ENABLE;
"@
  foreach ($db in $Databases) {
    Invoke-Sql "IF DB_ID(N'$db') IS NULL CREATE DATABASE [$db];"
    Invoke-Sql @"
IF USER_ID(N'$DbUser') IS NULL CREATE USER [$DbUser] FOR LOGIN [$DbUser];
ALTER ROLE db_owner ADD MEMBER [$DbUser];
"@ $db
    Ok "Database '$db' ready"
  }
} catch {
  Fail "Could not set up the databases: $($_.Exception.Message)`n   If it says 'Login failed', this Windows account is not a SQL Server administrator. Tell Claude which account installed SQL Server."
}

# ---------- 5. Server settings file ----------
Step 5 'Writing server settings (server\.env)'
if (-not (Test-Path $envPath)) { Copy-Item $envExample $envPath }
$envText = Get-Content $envPath -Raw
function Set-EnvValue([string]$text, [string]$key, [string]$value) {
  if ($text -match "(?m)^$key=") { return [regex]::Replace($text, "(?m)^$key=.*$", "$key=$value") }
  return $text.TrimEnd() + "`r`n$key=$value`r`n"
}
$envText = Set-EnvValue $envText 'DB_SERVER' 'localhost'
$envText = Set-EnvValue $envText 'DB_PORT' "$Port"
$envText = Set-EnvValue $envText 'DB_NAME' 'soulink'
$envText = Set-EnvValue $envText 'DB_USER' $DbUser
$envText = Set-EnvValue $envText 'DB_PASSWORD' $password
if ($envText -match '(?m)^JWT_SECRET=(change-me.*)?\s*$') {
  $secret = -join ((1..48) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
  $envText = Set-EnvValue $envText 'JWT_SECRET' $secret
}
[IO.File]::WriteAllText($envPath, $envText, (New-Object Text.UTF8Encoding $false))  # UTF-8 without BOM
Ok 'server\.env saved (the database password is stored only there)'

# ---------- 6. Firewall: let your phone reach the laptop ----------
Step 6 'Allowing your phone to reach the laptop on your home Wi-Fi'
foreach ($rule in @(@{Name='Soulink server (4000)'; Port=4000}, @{Name='Soulink app dev server (8081)'; Port=8081})) {
  if (-not (Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $rule.Name -Direction Inbound -Protocol TCP -LocalPort $rule.Port -Profile Private -Action Allow | Out-Null
  }
  Ok "$($rule.Name) allowed on private networks"
}
$profiles = Get-NetConnectionProfile -ErrorAction SilentlyContinue | Where-Object { $_.IPv4Connectivity -ne 'Disconnected' }
foreach ($p in $profiles) {
  if ($p.NetworkCategory -eq 'Public') {
    Warn "Your network '$($p.Name)' is set to Public, so your phone can't connect yet."
    Warn "Fix: Settings > Network & internet > Wi-Fi > $($p.Name) > set Network profile type to Private."
  }
}

}

if ($Part -eq 'system') {
  Write-Host ""
  Write-Host "Part 1 finished. Part 2 continues in the other window." -ForegroundColor Cyan
  Stop-Transcript | Out-Null
  Start-Sleep -Seconds 3
  exit 0
}

Write-Host "Soulink setup" -ForegroundColor Cyan
Write-Host "Part 1 needs administrator rights: click Yes on the Windows prompt."
try {
  $args1 = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-Part', 'system')
  $p1 = Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -PassThru -ArgumentList $args1
} catch { Fail 'Administrator rights were not given, so SQL Server could not be set up. Run SETUP-SOULINK.bat again and click Yes.' }
if ($p1.ExitCode -ne 0) { Fail 'Part 1 (SQL Server setup) did not finish. Check the other window or setup-log-system.txt.' }
Write-Host ""
Write-Host "Soulink setup, part 2 of 2" -ForegroundColor Cyan
# npm prints progress on stderr; don't treat that as a failure (exit codes are checked instead)
$ErrorActionPreference = 'Continue'
# ---------- 7. Install app packages ----------
Step 7 'Installing app packages (this takes a few minutes the first time)'
Push-Location (Join-Path $Root 'server')
npm install --no-fund --no-audit
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail 'npm install failed for the server.' }
Pop-Location
Ok 'Server packages installed'
Push-Location (Join-Path $Root 'mobile')
npm install --no-fund --no-audit
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail 'npm install failed for the mobile app.' }
Pop-Location
Ok 'Mobile app packages installed'

# ---------- 8. Create tables and run the automated tests ----------
Step 8 'Creating the Soulink tables and running the automated tests'
Push-Location (Join-Path $Root 'server')
npm run migrate
if ($LASTEXITCODE -ne 0) { Pop-Location; Fail 'Creating the tables failed.' }
npm test
$testsOk = ($LASTEXITCODE -eq 0)
Pop-Location
if ($testsOk) { Ok 'All automated tests passed' } else { Warn 'Some automated tests failed. Send Claude a screenshot or the setup-log-app.txt file.' }

Write-Host ""
Write-Host "Setup finished. Next: double-click START-SOULINK.bat" -ForegroundColor Cyan
Stop-Transcript | Out-Null
Read-Host "Press Enter to close"
