# 집 수집기 호스트

2026년 10월부터 F1은 GitHub Actions 같은 데이터센터 IP의 실시간 타이밍 접속을 로그인 전에 막는다(FastF1 #988, 403). 그래서 F1 수집은 집 회선의 컴퓨터(호스트)에서 돌린다. GitHub 예약 수집은 꺼 두고, 수동 접속 점검(probe)만 남겼다.

## 구조

- `collector/host_runner.py`: 계속 실행된다. 1분마다 일정을 보고, 세션 45분 전부터 수집해 사이트에 올린다. 세션이 없으면 끝난 세션의 FastF1 사후 자료를 올린다(같은 세션은 10분 간격으로만 재시도).
- 업로드 인증: 호스트마다 Ed25519 키를 만든다. 공개키만 `worker/collector-hosts.js`에 넣는다(공개해도 되는 값). 요청마다 메서드·경로·서명한 쿼리·시각·본문 해시에 서명하고(호스팅이 경로 재작성 때 덧붙이는 쿼리는 서명 대상이 아니고, 서명한 쿼리 값은 실제 요청과 정확히 같아야 한다), 서버는 5분 넘은 서명과 등록되지 않은 호스트를 거부한다. GitHub OIDC 경로는 그대로 남아 있다.
- 여러 대: `HOST_ROLE=primary`(주 호스트)와 `HOST_ROLE=backup`(예비)을 둘 수 있다. 예비는 세션 시작 2분 뒤 다른 호스트가 최근 2분 안에 올렸는지 보고, 올리고 있으면 대기한다. 서버는 더 최신 스냅샷만 저장한다.
- 코드 갱신: 호스트는 쉬는 동안 6시간마다 재시작하면서 GitHub main을 받아 온다. 세션 수집 중에는 갱신하지 않는다.

## Windows 설치

PowerShell에서 한 줄(설치 위치 `%LOCALAPPDATA%\Kongboda`):

```
irm https://raw.githubusercontent.com/MisterKinn/f1-data-analyst/main/collector/host/setup-windows.ps1 -OutFile $env:TEMP\kb.ps1; powershell -ExecutionPolicy Bypass -File $env:TEMP\kb.ps1
```

1. Python 3.12가 없으면 winget으로 설치하고, 코드와 FastF1을 받는다.
2. F1 계정은 이 창에만 입력한다. 이 Windows 사용자만 읽을 수 있는 `host.env`에 저장된다.
3. 업로드 키를 만들고 `{name:'…',key:'…'}` 한 줄을 출력한다. 이 줄을 `worker/collector-hosts.js`에 추가해 main에 병합해야 업로드가 받아들여진다.
4. 전원 연결 시 절전·최대 절전을 끄고 덮개를 닫아도 계속 켜져 있게 한다.
5. 로그인할 때 숨김 창으로 자동 시작하는 작업(Kongboda Collector)을 등록한다.

접속 점검: `run-windows.ps1 -Probe`가 F1 negotiate·SessionInfo·아카이브 응답 코드를 출력한다(비밀값은 출력하지 않음). 로그는 `data\host.log`, `data\run-log.jsonl`.

## 설치 키트 (다른 사람용 zip)

`python scripts/build-host-kit.py`가 `collector/host/kit/`로 `kongboda-collector-setup.zip`을 만든다. 압축을 풀고 `1_설치하기.cmd`(예비는 `2_예비_PC로_설치하기.cmd`)를 실행하면 설치되고, `내_호스트_키.txt`가 열린다. 그 내용을 받아 `worker/collector-hosts.js`에 추가하면 된다. `3_상태_확인.cmd`는 F1 접속과 등록 여부를, `4_제거하기.cmd`는 제거를 한다. 사용자 설명은 키트의 `설치방법.txt`.

## 호스트 추가 (다른 PC)

호스트 수에는 코드상 제한이 없다. PC마다 다음만 하면 된다.

1. 그 PC에서 Windows 설치 한 줄을 실행한다. 예비로 쓸 PC는 `-Role backup`을 붙인다(`... -File $env:TEMP\kb.ps1 -Role backup`). 이름은 컴퓨터 이름으로 자동 지정된다(`-Name`으로 바꿀 수 있음).
2. 출력된 `{name:'…',key:'…'}` 줄을 `worker/collector-hosts.js`에 추가해 main에 병합한다. 이름은 호스트마다 달라야 한다.
3. 시작 로그(`data\run-log.jsonl`의 `host_start`)에서 `upload_auth: 200`이면 업로드가 받아들여진다. 401이면 키 등록이나 배포를 확인한다.
4. 호스트를 빼려면 그 줄을 지운다. 키가 유출됐을 때도 같은 방법으로 즉시 막는다.

권장 구성: 주 호스트 1대 + 예비 1~2대. 같은 F1 계정으로 여러 호스트가 동시에 접속해도 되는지는 확인하지 않았으므로, 주 호스트 외에는 `backup`으로 둔다.

## 주의

- 세션 45분 전부터 끝날 때까지 수집기가 Windows 자동 절전을 막는다(배터리 포함). 덮개 닫기·전원 버튼은 Windows 설정을 따른다.
- 로그인 기반 자동 시작이라 Windows에 로그인해 있어야 한다(화면 잠금은 괜찮음).
- 노트북은 들고 나가면 수집이 멈춘다. 상시 운영은 미니 PC를 주 호스트로, 노트북을 예비로 두는 구성을 권장한다.
- 같은 F1 계정으로 두 호스트가 동시에 접속해도 되는지는 확인하지 않았다. 예비 모드가 동시 접속을 줄인다.
