# Started at logon by the 'Kongboda Collector' task. Updates the code when idle, then runs
# host_runner.py; restarts it if it exits. -Probe only checks F1 access from this network.
param([string]$Root = (Join-Path $env:LOCALAPPDATA 'Kongboda'), [switch]$Probe)
$EnvFile = Join-Path $Root 'host.env'
Get-Content $EnvFile | ForEach-Object { if ($_ -match '^([A-Z0-9_]+)=(.*)$') { [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process') } }
$python = Join-Path $Root 'venv\Scripts\python.exe'
$env:PYTHONUNBUFFERED = "1"
$log = Join-Path $Root 'data\host.log'
# Older installs only start at logon. Add the 5-minute watchdog trigger once, so a collector
# that stops (closed console, crash) is started again without anyone logging in again.
if (-not $Probe) {
  try {
    $task = Get-ScheduledTask -TaskName 'Kongboda Collector' -ErrorAction Stop
    if (-not ($task.Triggers | Where-Object { $_.Repetition -and $_.Repetition.Interval })) {
      $watch = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
      Set-ScheduledTask -TaskName 'Kongboda Collector' -Trigger (@($task.Triggers) + $watch) | Out-Null
    }
  } catch {}
}
if ($Probe) { $env:PROBE = '1'; & $python (Join-Path $Root 'collector\host_runner.py'); exit $LASTEXITCODE }
while ($true) {
  try { & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Root 'collector\host\update-windows.ps1') -Root $Root *>> $log } catch {}
  # Keep the log small: past 5 MB the old log becomes host.log.1 (one generation kept).
  if ((Test-Path $log) -and ((Get-Item $log).Length -gt 5MB)) { Move-Item $log "$log.1" -Force }
  & $python (Join-Path $Root 'collector\host_runner.py') *>> $log
  Start-Sleep -Seconds 30
}
