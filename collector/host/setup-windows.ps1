# Kongboda collector host setup for Windows (run once; safe to run again).
#   One line in PowerShell:
#   irm https://raw.githubusercontent.com/MisterKinn/f1-data-analyst/main/collector/host/setup-windows.ps1 -OutFile $env:TEMP\kb.ps1; powershell -ExecutionPolicy Bypass -File $env:TEMP\kb.ps1
# Installs into %LOCALAPPDATA%\Kongboda (F1 login: the owner's shared login, or -OwnF1), creates
# this computer's upload key, keeps the PC awake on AC power and starts the collector at logon.
# The collector registers itself on the site; the owner approves it and sets its priority
# in Account settings. (-Role is accepted for older launchers and ignored.)
param([string]$Name = $env:COMPUTERNAME.ToLower(), [string]$Role = '', [switch]$OwnF1)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'  # PowerShell 5.1 downloads crawl while drawing a progress bar
$Root = Join-Path $env:LOCALAPPDATA 'Kongboda'
$Code = Join-Path $Root 'collector'
$Data = Join-Path $Root 'data'
$EnvFile = Join-Path $Root 'host.env'
New-Item -ItemType Directory -Force -Path $Root, $Data | Out-Null
$Name = ($Name -replace '[^a-z0-9-]', '-').Trim('-')

Write-Host '[1/6] Python 3.12+'
function Find-Python {
  # The installer's py launcher and python.exe are both on PATH after a PATH refresh.
  foreach ($candidate in @('py -3', 'python')) {
    try { & cmd /c "$candidate -c ""import sys; sys.exit(0 if sys.version_info >= (3,12) else 1)""" 2>$null; if ($LASTEXITCODE -eq 0) { return $candidate } } catch {}
  }
  return $null
}
$py = Find-Python
if (-not $py) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw 'Python 3.12+ not found and winget is unavailable. Install Python from https://www.python.org/downloads/windows/ (tick "Add python.exe to PATH"), then run setup again.'
  }
  Write-Host 'Installing Python 3.12 with winget...'
  winget install -e --id Python.Python.3.12 --scope user --accept-package-agreements --accept-source-agreements --silent
  # The new install is not on this window's PATH yet.
  $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
  $py = Find-Python
  if (-not $py) { throw 'Python was installed but could not be started. Close this window and run setup again.' }
}
Write-Host "Using $py"

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
& "$Root\venv\Scripts\python.exe" -m pip install -q fastf1==3.9.0 signalrcore==1.0.2 keyring

# Hosts use the owner's shared F1 login (sent by the site after the account link), so no
# F1 account is asked. Only the owner's own computer passes -OwnF1 to type one.
Write-Host '[3/6] Settings'
if (-not (Test-Path $EnvFile)) {
  $lines = @("HOST_NAME=$Name", "DATA_DIR=$Data", "HOST_KEY_FILE=$Root\host-key.pem")
  if ($OwnF1) {
    $user = Read-Host 'F1 account email'
    $secure = Read-Host 'F1 account password' -AsSecureString
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
    $lines = @("F1_USERNAME=$user", "F1_PASSWORD=$plain") + $lines
  }
  [IO.File]::WriteAllLines($EnvFile, [string[]]$lines)
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
# At logon, plus a 5-minute watchdog: if the collector ever stops, the task starts it
# again (a running instance is left alone).
$trigger = @((New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME),
  (New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)))
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
Register-ScheduledTask -TaskName 'Kongboda Collector' -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Write-Host ''
Write-Host "Done. This PC is '$Name'. It asks the site for approval on its first start."
Write-Host 'Check F1 access now:  powershell -ExecutionPolicy Bypass -File "' (Join-Path $Code 'host\run-windows.ps1') '" -Root "' $Root '" -Probe'
