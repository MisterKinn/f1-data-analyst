# 꽁보다 수집기 설치 도우미 (Windows). 1_설치하기.cmd 등에서 실행된다.
param([ValidateSet('install','check','uninstall')][string]$Action = 'install',
      [ValidateSet('primary','backup')][string]$Role = 'primary')
$ProgressPreference = 'SilentlyContinue'
$Root = Join-Path $env:LOCALAPPDATA 'Kongboda'
$Here = $PSScriptRoot
function Title($t) { Write-Host ''; Write-Host "==== $t ====" -ForegroundColor Cyan }
function LoadEnv { if (Test-Path "$Root\host.env") { Get-Content "$Root\host.env" | ForEach-Object { if ($_ -match '^([A-Z0-9_]+)=(.*)$') { [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], 'Process') } } } }

function Check {
  if (-not (Test-Path "$Root\venv\Scripts\python.exe")) { Write-Host '수집기가 아직 설치되지 않았습니다. 1_설치하기.cmd 를 먼저 실행하세요.' -ForegroundColor Yellow; return }
  LoadEnv; $env:XDG_DATA_HOME = "$Root\data\auth"; $py = "$Root\venv\Scripts\python.exe"
  Push-Location "$Root\collector"
  Title 'F1 접속 점검'
  $env:PROBE = '1'; $out = (& $py host_runner.py 2>$null | Out-String); Remove-Item Env:PROBE
  $line = ($out -split "`n" | Where-Object { $_ -like '{"event": "probe"*' } | Select-Object -First 1)
  if ($line) {
    $p = $line | ConvertFrom-Json
    $ok = ($p.negotiate.token -and $p.negotiate.token[0] -eq 200) -and ($p.session_info.token -and $p.session_info.token[0] -eq 200)
    Write-Host ("회선: {0} / F1 로그인: {1}" -f $p.network, $p.sign_in)
    if ($ok) { Write-Host 'F1 실시간 타이밍 접속: 가능' -ForegroundColor Green }
    else { Write-Host 'F1 실시간 타이밍 접속: 불가 (VPN·회사·학교망이면 집 회선에서 다시 시도하세요)' -ForegroundColor Red }
  } else { Write-Host 'F1 점검 결과를 읽지 못했습니다. F1 계정·구독(F1 TV Access 이상)을 확인하세요.' -ForegroundColor Red }
  Title '사이트 업로드 등록 확인'
  $auth = (& $py -c "import host_runner as h, actions_runner as r; h.load_env_file(); print('AUTH', r.site('GET', '2000-1-1')[0])" 2>$null | Out-String)
  if ($auth -match 'AUTH 200') { Write-Host '등록됨: 이 PC가 수집한 자료가 사이트에 올라갑니다.' -ForegroundColor Green }
  else { Write-Host '아직 등록 전입니다. 내_호스트_키.txt 를 운영자에게 보냈는지 확인하세요. (등록·배포까지 몇 분 걸립니다)' -ForegroundColor Yellow }
  Pop-Location
  Title '자동 실행'
  $task = Get-ScheduledTask -TaskName 'Kongboda Collector' -ErrorAction SilentlyContinue
  if ($task) { Write-Host ("자동 실행 작업: {0} (Windows 로그인 시 자동 시작)" -f $task.State) } else { Write-Host '자동 실행 작업이 없습니다. 1_설치하기.cmd 를 다시 실행하세요.' -ForegroundColor Yellow }
}

switch ($Action) {
  'install' {
    Title '1. 수집기 설치 (몇 분 걸립니다)'
    Write-Host 'F1 account email / password 를 물으면 본인 F1 계정을 입력하세요. 비밀번호는 입력해도 화면에 보이지 않습니다.'
    $setup = Join-Path $env:TEMP 'kongboda-setup-windows.ps1'
    Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/MisterKinn/f1-data-analyst/main/collector/host/setup-windows.ps1' -OutFile $setup
    try { & $setup -Role $Role } catch { Write-Host "설치 중 오류: $_" -ForegroundColor Red; Write-Host '이 화면을 캡처해 운영자에게 보내 주세요.'; break }
    LoadEnv
    if ($env:HOST_ROLE -and $env:HOST_ROLE -ne $Role) { Write-Host "참고: 이 PC는 이미 '$($env:HOST_ROLE)' 역할로 설치돼 있습니다. 역할을 바꾸려면 4_제거하기.cmd 후 다시 설치하세요." -ForegroundColor Yellow }
    Title '2. 내 호스트 키 만들기'
    $keyFile = Join-Path $Here '내_호스트_키.txt'
    $line = (& "$Root\venv\Scripts\python.exe" "$Root\collector\host_auth.py" keygen --name $env:HOST_NAME --out "$Root\host-key.pem" 2>$null | Select-Object -Last 1)
    if (-not $line) { Write-Host '키를 만들지 못했습니다. 위의 오류 화면을 캡처해 운영자에게 보내 주세요.' -ForegroundColor Red; break }
    @('아래 한 줄을 운영자에게 보내 주세요 (공개해도 되는 값입니다).', '', $line.Trim(), '', "역할: $Role") | Set-Content -Path $keyFile -Encoding UTF8
    Write-Host "키를 $keyFile 에 저장했습니다. 메모장으로 엽니다."
    Start-Process notepad.exe $keyFile
    Check
    Title '끝'
    Write-Host '이제 운영자가 키를 등록하면 끝입니다. 등록 후 3_상태_확인.cmd 로 "등록됨"이 나오는지 확인하세요.'
  }
  'check' { Check }
  'uninstall' {
    Title '수집기 제거'
    $answer = Read-Host '이 PC에서 꽁보다 수집기를 지울까요? (y/n)'
    if ($answer -ne 'y') { Write-Host '취소했습니다.'; break }
    Unregister-ScheduledTask -TaskName 'Kongboda Collector' -Confirm:$false -ErrorAction SilentlyContinue
    Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*$Root*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 2
    Remove-Item -Recurse -Force $Root -ErrorAction SilentlyContinue
    Write-Host '제거했습니다. 운영자에게 이 PC 키를 목록에서 빼 달라고 알려 주세요.' -ForegroundColor Green
    Write-Host '전원 설정(전원 연결 시 절전 안 함)은 Windows 설정 > 전원에서 되돌릴 수 있습니다.'
  }
}
