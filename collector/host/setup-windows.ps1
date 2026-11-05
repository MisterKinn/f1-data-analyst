# Kongboda collector host setup for Windows (run once; safe to run again).
#   One line in PowerShell:
#   irm https://raw.githubusercontent.com/MisterKinn/f1-data-analyst/main/collector/host/setup-windows.ps1 -OutFile $env:TEMP\kb.ps1; powershell -ExecutionPolicy Bypass -File $env:TEMP\kb.ps1
# Installs into %LOCALAPPDATA%\Kongboda, asks for the F1 login (typed only here), creates
# this computer's upload key, keeps the PC awake on AC power and starts the collector at logon.
param([string]$Name = $env:COMPUTERNAME.ToLower(), [ValidateSet('primary','backup')][string]$Role = 'primary')
$ErrorActionPreference = 'Stop'
$Root = Join-Path $env:LOCALAPPDATA 'Kongboda'
$Code = Join-Path $Root 'collector'
$Data = Join-Path $Root 'data'
$EnvFile = Join-Path $Root 'host.env'
New-Item -ItemType Directory -Force -Path $Root, $Data | Out-Null
$Name = ($Name -replace '[^a-z0-9-]', '-').Trim('-')

Write-Host '[1/6] Python 3.12+'
$py = $null
foreach ($candidate in @('py -3', 'python')) {
  try { & cmd /c "$candidate -c ""import sys; sys.exit(0 if sys.version_info >= (3,12) else 1)""" 2>$null; if ($LASTEXITCODE -eq 0) { $py = $candidate; break } } catch {}
}
if (-not $py) {
  Write-Host 'Installing Python 3.12 with winget...'
  winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements --silent
  $py = 'py -3'
}

Write-Host '[2/6] Collector code (GitHub main)'
$zip = Join-Path $env:TEMP 'kongboda-main.zip'; $tmp = Join-Path $env:TEMP 'kongboda-main'
Invoke-WebRequest -UseBasicParsing 'https://codeload.github.com/MisterKinn/f1-data-analyst/zip/refs/heads/main' -OutFile $zip
if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
Expand-Archive -Path $zip -DestinationPath $tmp -Force
New-Item -ItemType Directory -Force -Path $Code | Out-Null
robocopy (Join-Path $tmp 'f1-data-analyst-main\collector') $Code /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
Remove-Item -Recurse -Force $tmp, $zip
if (-not (Test-Path (Join-Path $Root 'venv\Scripts\python.exe'))) { & cmd /c "$py -m venv ""$Root\venv""" }
& "$Root\venv\Scripts\python.exe" -m pip install --upgrade pip -q
& "$Root\venv\Scripts\python.exe" -m pip install -q fastf1==3.9.0 signalrcore==1.0.2

Write-Host '[3/6] F1 account (typed here only, stored for this Windows user)'
if (-not (Test-Path $EnvFile)) {
  $user = Read-Host 'F1 account email'
  $secure = Read-Host 'F1 account password' -AsSecureString
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
  [IO.File]::WriteAllLines($EnvFile, [string[]]@("F1_USERNAME=$user", "F1_PASSWORD=$plain", "HOST_NAME=$Name", "HOST_ROLE=$Role", "DATA_DIR=$Data", "HOST_KEY_FILE=$Root\host-key.pem"))
  icacls $EnvFile /inheritance:r /grant:r "${env:USERNAME}:(R,W)" | Out-Null
}

Write-Host '[4/6] Upload key'
& "$Root\venv\Scripts\python.exe" (Join-Path $Code 'host_auth.py') keygen --name $Name --out "$Root\host-key.pem"
icacls "$Root\host-key.pem" /inheritance:r /grant:r "${env:USERNAME}:(R,W)" | Out-Null

Write-Host '[5/6] Power: stay awake on AC, lid close does nothing on AC'
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0
powercfg /setactive SCHEME_CURRENT

Write-Host '[6/6] Start at logon'
$runner = Join-Path $Code 'host\run-windows.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""$runner"" -Root ""$Root"""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
Register-ScheduledTask -TaskName 'Kongboda Collector' -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Write-Host ''
Write-Host 'Done. Send the line above (name + key) to be added to worker/collector-hosts.js.'
Write-Host 'Check F1 access now:  powershell -ExecutionPolicy Bypass -File "' (Join-Path $Code 'host\run-windows.ps1') '" -Root "' $Root '" -Probe'
