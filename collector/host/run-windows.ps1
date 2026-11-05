# Started at logon by the 'Kongboda Collector' task. Updates the code when idle, then runs
# host_runner.py; restarts it if it exits. -Probe only checks F1 access from this network.
param([string]$Root = (Join-Path $env:LOCALAPPDATA 'Kongboda'), [switch]$Probe)
$EnvFile = Join-Path $Root 'host.env'
Get-Content $EnvFile | ForEach-Object { if ($_ -match '^([A-Z0-9_]+)=(.*)$') { [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process') } }
$python = Join-Path $Root 'venv\Scripts\python.exe'
$env:PYTHONUNBUFFERED = "1"
$log = Join-Path $Root 'data\host.log'
if ($Probe) { $env:PROBE = '1'; & $python (Join-Path $Root 'collector\host_runner.py'); exit $LASTEXITCODE }
while ($true) {
  try { & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root 'collector\host\update-windows.ps1') -Root $Root *>> $log } catch {}
  & $python (Join-Path $Root 'collector\host_runner.py') *>> $log
  Start-Sleep -Seconds 30
}
