# 꽁보다 수집기 설치 도우미 (Windows). 1_설치하기.cmd 등에서 실행된다.
param([ValidateSet('install','check','uninstall')][string]$Action = 'install')
$ProgressPreference = 'SilentlyContinue'
$Root = Join-Path $env:LOCALAPPDATA 'Kongboda'
$Here = $PSScriptRoot
function Title($t) { Write-Host ''; Write-Host "==== $t ====" -ForegroundColor Cyan }
function LoadEnv { if (Test-Path "$Root\host.env") { Get-Content "$Root\host.env" -Encoding UTF8 | ForEach-Object { if ($_ -match '^([A-Z0-9_]+)=(.*)$') { [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process') } } } }

function Check([switch]$Wait) {
  if (-not (Test-Path "$Root\venv\Scripts\python.exe")) { Write-Host '수집기가 아직 설치되지 않았습니다. 1_설치하기 를 먼저 실행하세요.' -ForegroundColor Yellow; return }
  LoadEnv; $env:XDG_DATA_HOME = "$Root\data\auth"; $py = "$Root\venv\Scripts\python.exe"
  Push-Location "$Root\collector"
  Title '꽁보다 계정 연결'
  $regCode = "import host_runner as h; h.load_env_file(); r = h.register(); print('REG', r, h.LAST_REGISTRATION.get('link_url', ''))"
  $reg = (& $py -c $regCode 2>$null | Out-String)
  if ($reg -match 'REG needs_link (\S+)') {
    $url = $Matches[1]
    Write-Host '곧 인터넷 창이 열려요. 꽁보다에 Google로 로그인하고 "내 계정에 이 컴퓨터 연결" 버튼을 누르세요.' -ForegroundColor Yellow
    Write-Host "창이 안 열리면 이 주소를 인터넷 창에 붙여 넣으세요: $url"
    Start-Process $url
    if ($Wait) {
      Write-Host '버튼을 누르면 여기서 자동으로 다음으로 넘어가요. (최대 10분 기다림)' -ForegroundColor Yellow
      for ($i = 0; $i -lt 120 -and $reg -match 'REG needs_link'; $i++) { Start-Sleep -Seconds 5; $reg = (& $py -c $regCode 2>$null | Out-String) }
    }
  }
  if ($reg -match 'REG (approved|pending)') { Write-Host '등록됨: 세션 시간이 되면 자동으로 수집합니다.' -ForegroundColor Green }
  elseif ($reg -match 'REG needs_link') { Write-Host '아직 계정에 연결되지 않았어요. 열린 인터넷 창에서 연결 버튼을 누르면 끝나요.' -ForegroundColor Yellow }
  elseif ($reg -match 'REG paused') { Write-Host '사이트에서 일시정지된 PC입니다.' -ForegroundColor Yellow }
  elseif ($reg -match 'REG name_taken') { Write-Host '같은 이름의 다른 컴퓨터가 있습니다. 이 화면을 사진 찍어 정민이한테 보내 주세요.' -ForegroundColor Red }
  else { Write-Host '사이트에 연결하지 못했습니다. 인터넷을 확인하고 다시 해 보세요.' -ForegroundColor Red }
  Write-Host ("이 PC 이름: {0}" -f $env:HOST_NAME)
  Title 'F1 접속 점검'
  $env:PROBE = '1'; $out = (& $py host_runner.py 2>$null | Out-String); Remove-Item Env:PROBE
  $line = ($out -split "`n" | Where-Object { $_ -like '{"event": "probe"*' } | Select-Object -First 1)
  if ($line) {
    $p = $line | ConvertFrom-Json
    $ok = ($p.negotiate.token -and $p.negotiate.token[0] -eq 200) -and ($p.session_info.token -and $p.session_info.token[0] -eq 200)
    Write-Host ("회선: {0}" -f $p.network)
    if ($ok) { Write-Host 'F1 실시간 타이밍 접속: 가능' -ForegroundColor Green }
    elseif ($p.sign_in -eq 'shared_pending') { Write-Host 'F1 로그인: 계정 연결이 끝나면 정민이 계정 로그인을 자동으로 받아요.' -ForegroundColor Yellow }
    else { Write-Host 'F1 실시간 타이밍 접속: 불가 (VPN·회사·학교망이면 집 회선에서 다시 시도하세요)' -ForegroundColor Red }
  } else { Write-Host 'F1 점검 결과를 읽지 못했습니다. 이 화면을 사진 찍어 정민이한테 보내 주세요.' -ForegroundColor Red }
  Pop-Location
  Title '자동 실행'
  $task = Get-ScheduledTask -TaskName 'Kongboda Collector' -ErrorAction SilentlyContinue
  if ($task) { Write-Host ("자동 실행 작업: {0} (Windows 로그인 시 자동 시작)" -f $task.State) } else { Write-Host '자동 실행 작업이 없습니다. 1_설치하기 를 다시 실행하세요.' -ForegroundColor Yellow }
}

switch ($Action) {
  'install' {
    Title '1. 수집기 설치 (몇 분 걸립니다)'
    Write-Host '기다리기만 하면 돼요. 마지막에 인터넷 창에서 "내 계정에 이 컴퓨터 연결" 버튼만 누르세요.' -ForegroundColor Yellow
    $setup = Join-Path $env:TEMP 'kongboda-setup-windows.ps1'
    Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/MisterKinn/f1-data-analyst/main/collector/host/setup-windows.ps1' -OutFile $setup
    try { & $setup } catch { Write-Host "설치 중 오류: $_" -ForegroundColor Red; Write-Host '이 화면을 사진 찍어 정민이한테 보내 주세요.'; break }
    LoadEnv
    Check -Wait
    Title '끝'
    Write-Host '끝! 정민이한테 "설치했어" 라고 알려 주세요. 아무 키나 누르면 창이 닫혀요.' -ForegroundColor Green
  }
  'check' { Check }
  'uninstall' {
    Title '수집기 제거'
    $answer = Read-Host '이 PC에서 꽁보다 수집기를 지울까요? (y/n)'
    if ($answer -ne 'y') { Write-Host '취소했습니다.'; break }
    Unregister-ScheduledTask -TaskName 'Kongboda Collector' -Confirm:$false -ErrorAction SilentlyContinue
    Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*$Root*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 2
    if (Test-Path "$Root\venv\Scripts\python.exe") { Push-Location "$Root\collector"; & "$Root\venv\Scripts\python.exe" host_runner.py --forget-credentials 2>$null | Out-Null; Pop-Location }
    Remove-Item -Recurse -Force $Root -ErrorAction SilentlyContinue
    Write-Host '제거했습니다. 정민이한테 "지웠어" 라고 알려 주세요.' -ForegroundColor Green
    Write-Host '전원 설정(전원 연결 시 절전 안 함)은 Windows 설정 > 전원에서 되돌릴 수 있습니다.'
  }
}
