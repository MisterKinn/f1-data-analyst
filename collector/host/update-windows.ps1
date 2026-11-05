# Refresh %LOCALAPPDATA%\Kongboda\collector from GitHub main. Skips while a session is
# being recorded (data\active-window.json exists) unless -Force.
param([string]$Root = (Join-Path $env:LOCALAPPDATA 'Kongboda'), [switch]$Force)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'  # PowerShell 5.1 downloads crawl while drawing a progress bar
$active = Join-Path $Root 'data\active-window.json'
if ((Test-Path $active) -and -not $Force) { Write-Host 'Recording in progress; update skipped.'; exit 0 }
$zip = Join-Path $env:TEMP 'kongboda-main.zip'
$tmp = Join-Path $env:TEMP 'kongboda-main'
Invoke-WebRequest -UseBasicParsing 'https://codeload.github.com/MisterKinn/f1-data-analyst/zip/refs/heads/main' -OutFile $zip
if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
Expand-Archive -Path $zip -DestinationPath $tmp -Force
$src = Join-Path $tmp 'f1-data-analyst-main\collector'
if (-not (Test-Path (Join-Path $src 'host_runner.py'))) { throw 'Downloaded code has no host_runner.py' }
$dst = Join-Path $Root 'collector'
New-Item -ItemType Directory -Force -Path $dst | Out-Null
robocopy $src $dst /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
Remove-Item -Recurse -Force $tmp, $zip
Write-Host 'Collector code updated.'
