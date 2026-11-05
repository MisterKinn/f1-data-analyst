# 집 수집기 호스트

2026년 10월부터 F1은 GitHub Actions 같은 데이터센터 IP의 실시간 타이밍 접속을 로그인 전에 막는다(FastF1 #988, 403). 그래서 F1 수집은 집 회선의 컴퓨터(호스트)에서 돌린다. GitHub 예약 수집은 꺼 두고, 수동 접속 점검(probe)만 남겼다.

## 구조

- `collector/host_runner.py`: 계속 실행된다. 1분마다 일정을 보고, 세션 45분 전부터 수집해 사이트에 올린다. 세션이 없으면 끝난 세션의 FastF1 사후 자료를 올린다(같은 세션은 10분 간격으로만 재시도).
- 업로드 인증: 호스트마다 Ed25519 키를 만든다. 공개키만 `worker/collector-hosts.js`에 넣는다(공개해도 되는 값). 요청마다 메서드·경로·서명한 쿼리·시각·본문 해시에 서명하고(호스팅이 경로 재작성 때 덧붙이는 쿼리는 서명 대상이 아니고, 서명한 쿼리 값은 실제 요청과 정확히 같아야 한다), 서버는 5분 넘은 서명과 등록되지 않은 호스트를 거부한다. GitHub OIDC 경로는 그대로 남아 있다.
- 여러 대(바통 방식, `worker/collector-fleet.js`): 세션 창 동안 모든 호스트가 5초마다 사이트에 신호(`/api/live/host-beat`)를 보낸다. 운영자 순서에서 살아 있는 위쪽 두 대(`warm_count`, 1~5, 기본 2)가 F1에 같이 접속해 기록하고, 바통을 가진 한 대만 올린다(다른 호스트의 업로드는 409). 나머지는 F1에 접속하지 않고 기다린다.
- 바통은 처음 데이터를 받는 호스트(우선 1순위)에게 가고, 그 세션 동안 유지된다. 바통 호스트의 신호가 15초 끊기면 같이 기록하던 호스트가 바로 이어서 올리고(넘겨받는 즉시 업로드), 다음 순위가 새 예비로 F1에 접속한다. 끊겼던 호스트는 그 세션에서 은퇴 처리돼 다시 맡지 않는다(다른 호스트가 모두 없을 때만 마지막 수단). 상태는 `collector/baton/<series>/<window>.json`.
- 공백 대책: 예비는 세션 처음부터 같이 받고 있으므로 넘겨받는 순간 전체 현재 상태(순위·격차·타이어·레이스 컨트롤 전체)를 올린다. 늦게 접속한 호스트는 F1 공식 세션 스트림에서 놓친 랩을 채우고(recovery.py), 그 채우기가 끝나야 `ready`로 친다. 텔레메트리와 위치는 세션 뒤 FastF1 공식 데이터로 올린다.
- 바통을 가진 호스트가 데이터를 받지 못하면(예: F1 로그인 실패) 데이터를 받는 다른 호스트로 넘어간다(은퇴 아님).
- 사후 자료(FastF1 아카이브)는 켜져 있는 호스트 중 가장 높은 순위 한 대만 올린다(5분마다 신호).
- ‘예비 순서 맨 뒤’(cold) 호스트는 다른 호스트가 모자랄 때만 예비가 된다.
- 운영자 화면: 계정 설정 → ‘개발자 설정 · 수집기 호스트’(collector-hosts.js의 관리자 이메일 해시와 같은 계정에만 보임). 상태·주인 계정·마지막 신호·OS·버전을 보고 순서 변경(순위 선택·끌어서 놓기·▲▼), 일시정지, 삭제, 수집 항목(F1·WEC), 대기 방식, 지금 업데이트를 한다. 저장은 `collector/fleet.json`, 신호는 `collector/beat/<이름>.json`.
- 코드 갱신: 호스트는 쉬는 동안 6시간마다(또는 관리 화면의 ‘지금 업데이트’로) GitHub main을 받아 온다. 세션 수집 중에는 갱신하지 않는다.
- 서명된 릴리스만 설치: 받은 collector/ 파일 전체의 SHA-256에 대해 저장소 루트 `collector-release.json`의 Ed25519 서명을 확인하고, 이미 설치된 `release_verify.py`와 `collector/host/release-keys.txt`(운영자 공개키)로 검사한다. 서명이 없거나 파일이 바뀌었으면 설치하지 않는다(main에 누가 코드를 넣어도 참여자 PC에서 실행되지 않음). 서명은 운영자 PC의 업로드 스크립트가 `%APPDATA%\Kongboda-release\release-key.pem`으로 한다. 이 키를 잃으면 새 키를 넣은 릴리스를 각 PC에 다시 설치해야 하므로 따로 백업한다.
- F1 비밀번호: 처음 시작할 때 host.env에서 Windows 자격 증명 관리자 / macOS 키체인(keyring)으로 옮기고 파일에서 지운다. 제거할 때 함께 지운다.

## Windows 설치

PowerShell에서 한 줄(설치 위치 `%LOCALAPPDATA%\Kongboda`):

```
irm https://raw.githubusercontent.com/MisterKinn/f1-data-analyst/main/collector/host/setup-windows.ps1 -OutFile $env:TEMP\kb.ps1; powershell -ExecutionPolicy Bypass -File $env:TEMP\kb.ps1
```

1. Python 3.12가 없으면 winget으로 설치하고, 코드와 FastF1을 받는다.
2. F1 계정은 이 창에만 입력한다. 이 Windows 사용자만 읽을 수 있는 `host.env`에 저장된다.
3. 업로드 키를 만든다. 수집기가 처음 시작할 때 사이트에 스스로 등록 요청(`/api/live/host-register`, 그 키로 서명)을 보내고, 설치한 사람이 꽁보다 계정에 연결하면 바로 등록돼 세션 시간에 자동으로 수집한다.
4. 전원 연결 시 절전·최대 절전을 끄고 덮개를 닫아도 계속 켜져 있게 한다.
5. 로그인할 때 숨김 창으로 자동 시작하는 작업(Kongboda Collector)을 등록한다.

접속 점검: `run-windows.ps1 -Probe`가 F1 negotiate·SessionInfo·아카이브 응답 코드를 출력한다(비밀값은 출력하지 않음). 로그는 `data\host.log`, `data\run-log.jsonl`.

## macOS 설치

터미널에 한 줄(설치 위치 `~/Library/Application Support/Kongboda`):

```
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/MisterKinn/f1-data-analyst/main/collector/host/kit-mac.sh)" - install
```

`setup-mac.sh`가 Python 3.12(없으면 Homebrew 또는 python.org 설치 파일), 코드·FastF1·certifi, F1 계정(`host.env`, 600 권한), 업로드 키, `pmset -c sleep 0`(충전 중 잠자기 끔, Mac 비밀번호 1회), 로그인 시 자동 시작(launchd `com.kongboda.collector` → `run-mac.sh`)을 준비한다. 세션 동안에는 `caffeinate`로 잠자기를 막는다. 맥북은 덮개를 닫으면 잠든다(외부 모니터 연결 시 제외, Apple 규칙). `- check`는 F1 접속·등록 상태, `- uninstall`은 제거.

## 설치 키트 (다른 사람용 zip)

`python scripts/build-host-kit.py`가 `collector/host/kit/`로 `kongboda-collector-setup.zip`을 만든다. Windows는 `1_설치하기.cmd`(설치) · `2_상태_확인.cmd`(F1 접속·사이트 등록 확인) · `3_제거하기.cmd`, 설명은 `설치방법.txt`. Mac은 `Mac에서_설치하기.txt`의 줄을 터미널에 붙여 넣는다.

## 호스트 추가

호스트 수 제한은 30대(계정 연결 대기 10대)다.

1. 그 컴퓨터에서 키트로 설치한다. 이름은 컴퓨터 이름으로 정해진다(Windows `-Name`, Mac은 `setup-mac.sh 이름`으로 바꿀 수 있음).
2. 설치 마지막에 등록을 요청하고, 받은 1회용 연결 주소(`/account?host_link=XXXX-XXXX`, 24시간 유효)를 브라우저로 연다. 설치한 사람이 꽁보다에 Google로 로그인해 ‘내 계정에 이 컴퓨터 연결’을 누르면 그 계정(이름·이메일)이 컴퓨터에 붙는다. 계정에 연결하는 순간 등록되며(운영자 승인 없음), 순서 맨 뒤에 붙는다. 계정이 연결되지 않은 컴퓨터는 F1에 접속하지도, 올리지도 않는다.
3. 운영자는 호스트 목록에서 주인 계정을 보고 필요하면 순서를 바꾸거나 일시정지·삭제한다. 연결한 사람은 자기 계정 설정의 ‘내 수집기’에서 상태를 본다.
4. 빼려면 목록에서 삭제한다. 키가 유출됐을 때도 삭제(또는 일시정지)로 즉시 막는다. `worker/collector-hosts.js`의 기본 호스트는 지울 수 없고 일시정지만 된다.

권장 구성: 1순위 상시 PC 1대 + 다른 집 회선의 예비 1~2대.

## 주의

- 세션 45분 전부터 끝날 때까지 수집기가 자동 절전을 막는다(Windows는 배터리 포함, Mac은 `caffeinate`). 덮개 닫기·전원 버튼은 OS 설정을 따른다.
- 로그인 기반 자동 시작이라 Windows에 로그인해 있어야 한다(화면 잠금은 괜찮음).
- 노트북은 들고 나가면 수집이 멈춘다. 그래도 바통이 다음 순위로 넘어간다.
- 같은 F1 계정으로 두 호스트가 동시에 접속해도 되는지는 확인하지 않았다. 같은 계정을 쓰는 두 컴퓨터가 동시에 예비가 되지 않게, 하나는 ‘예비 순서 맨 뒤’로 둔다.
- Mac은 로그인해 있어야 하고(화면 잠금은 괜찮음), 충전기에 꽂아 둔다.
