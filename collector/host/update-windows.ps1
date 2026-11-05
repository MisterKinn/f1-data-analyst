# Refresh %LOCALAPPDATA%\Kongboda\collector from GitHub main. Skips while a session is
# being recorded (data\active-window.json exists) unless -Force. New code is installed only
# when collector-release.json carries the owner's release signature for exactly these files
# (checked with the verifier and keys already installed here; see release_verify.py).
# If host.env sets KIT_FOLDER, that folder's setup kit is refreshed too.
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
$repo = Join-Path $tmp 'f1-data-analyst-main'
$src = Join-Path $repo 'collector'
if (-not (Test-Path (Join-Path $src 'host_runner.py'))) { throw 'Downloaded code has no host_runner.py' }
$dst = Join-Path $Root 'collector'
$python = Join-Path $Root 'venv\Scripts\python.exe'
$verifier = Join-Path $dst 'release_verify.py'
$manifest = Join-Path $repo 'collector-release.json'
$installed = Join-Path $Root 'data\release.json'
if ((Test-Path $verifier) -and (Test-Path $python)) {
  & $python $verifier check $src $manifest (Join-Path $dst 'host\release-keys.txt')
  if ($LASTEXITCODE -ne 0) { Remove-Item -Recurse -Force $tmp, $zip; Write-Host 'Unsigned or changed code: update refused.'; exit 0 }
}
$same = (Test-Path $installed) -and (Test-Path $manifest) -and ((Get-Content $installed -Raw) -eq (Get-Content $manifest -Raw))
if (-not $same) {
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  robocopy $src $dst /MIR /NFL /NDL /NJH /NJS /NP | Out-Null
  if (Test-Path $manifest) { Copy-Item -Force $manifest $installed }
  # Packages added in later versions (keyring keeps the F1 password in Windows Credential Manager).
  if (Test-Path $python) { & $python -c "import keyring" 2>$null; if ($LASTEXITCODE -ne 0) { & $python -m pip install -q keyring 2>$null | Out-Null } }
  Write-Host 'Collector code updated.'
} else { Write-Host 'Collector code is current.' }
Remove-Item -Recurse -Force $tmp, $zip
# Optional: keep the owner's kit folder current (KIT_FOLDER=... in host.env, UTF-8).
$kit = (Get-Content (Join-Path $Root 'host.env') -Encoding UTF8 -ErrorAction SilentlyContinue | Where-Object { $_ -like 'KIT_FOLDER=*' } | Select-Object -First 1)
if ($kit -and -not $same) {
  try {
    $folder = $kit.Substring(11).Trim()
    $kz = Join-Path $env:TEMP 'kongboda-kit.zip'; $kt = Join-Path $env:TEMP 'kongboda-kit'
    Invoke-WebRequest -UseBasicParsing 'https://kongboda-motorsports.vercel.app/download/kongboda-collector-setup.zip' -OutFile $kz
    if (Test-Path $kt) { Remove-Item -Recurse -Force $kt }
    Expand-Archive -Path $kz -DestinationPath $kt -Force
    Copy-Item -Force (Join-Path $kt 'kongboda-collector-setup\*') $folder
    $dist = Join-Path $folder '설치 키트 (다른 사람용)'
    New-Item -ItemType Directory -Force -Path $dist | Out-Null
    Copy-Item -Force $kz (Join-Path $dist 'kongboda-collector-setup.zip')
    Remove-Item -Recurse -Force $kt, $kz
    Write-Host 'Kit folder refreshed.'
  } catch { Write-Host "Kit folder refresh skipped: $_" }
}
