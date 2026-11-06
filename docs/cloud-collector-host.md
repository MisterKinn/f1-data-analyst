# 클라우드 수집기 호스트 (리눅스 서버)

F1은 일부 데이터센터 네트워크를 로그인 전에 403으로 막는다(FastF1 #988, 어느 곳이 막히는지는 비공개). 그래서 클라우드 서버도 호스트로 쓸 수 있게 하되, 서버가 스스로 확인해 사이트에 알린다. 집 호스트 전체 구조는 `home-collector-host.md`.

## 설치 (Ubuntu 24.04, x86·ARM 모두)

서버의 SSH 창에서:

```
curl -fsSL https://raw.githubusercontent.com/MisterKinn/f1-data-analyst/main/collector/host/setup-linux.sh | bash -s -- <이름>
```

- `~/kongboda`에 설치하고 systemd(`kongboda-collector`)로 부팅 시 자동 시작, 오류 시 재시작한다.
- F1 계정 칸에서 선원 서버는 Enter(운영자 공유 로그인).
- 마지막에 F1 접속 점검 결과(401 통과 / 403 차단)와 꽁보다 계정 연결 주소를 보여 준다. 연결한 뒤 계정 설정 → 수집기 호스트에서 1순위로 올린다.
- 로그 `~/kongboda/data/host.log`, 상태 `systemctl status kongboda-collector`.

## 차단 감지와 자동 전환

- 호스트는 3시간마다, 그리고 세션 창이 열릴 때 토큰 없이 `static/2026/Index.json`을 요청한다. 403이면 신호에 `f1_blocked`를 실어 보낸다.
- 사이트는 이 호스트를 바통·사후 자료 담당에서 맨 뒤로 보낸다(다른 호스트가 없을 때만 사용). 막혔다고 표시돼도 실제로 데이터를 받고 있으면 정상 호스트로 친다. 관리 화면 오류 칸에 'F1이 이 네트워크를 막음(403)'으로 표시된다.
- 권장 순서: 1순위 클라우드 서버, 2순위 운영자 PC. 클라우드가 막히면 바통이 자동으로 PC로 간다.

## 서버 선택

- 1차: Google Cloud 무료(e2-micro, us-west1·us-central1·us-east1, 표준 영구 디스크 30GB, 북미 발신 월 1GB, 종료일 없음).
- Google이 막히면 AWS(서울)로 같은 명령을 다시 실행한다.
- 부하(2시간 레이스 재생 시험): CPU 코어 1개의 약 0.2%, 메모리 약 120MB, 디스크 레이스당 약 33MB. 라이브 업로드는 10초마다(스냅샷 약 120KB)라 레이스 주말이 많은 달은 발신 1GB를 조금 넘을 수 있다.

## 세션 시간에만 켜기 (AWS 절전)

AWS 서버는 세션 전후에만 켜 두고 나머지 시간엔 꺼서(EC2 중지) 비용을 줄인다. 코드는 `collector/power.py`, 설정은 AWS CloudShell에서 한 번:

```
curl -fsSL https://raw.githubusercontent.com/MisterKinn/f1-data-analyst/main/collector/host/aws-power-setup.sh | bash -s -- <인스턴스 ID> kongboda-aws
```

- 켜기: 서버가 꺼지기 전에 Amazon EventBridge Scheduler에 자기 다음 시작 시각을 예약한다(`kongboda-wake-<호스트>`). 시각 = 수집기가 F1에 접속해야 하는 때(세션 시작 5분 전 창 열림 − 45분) − 20분. 부팅·수집기 준비가 끝나고도 여유가 남는다.
- 끄기: 세션을 끝까지(Finished/Finalised) 받으면 바로 끈다. 다음 세션 접속이 1시간 안이면 켜 둔다. 녹화 중이거나 예약 저장이 실패하면 절대 끄지 않는다(안 켜지는 것보다 켜져 있는 편이 낫다).
- 사후 자료(2026-11-06 변경): 끝난 세션은 OpenF1에서 질문할 때 불러오므로 서버가 세션 뒤에 올릴 것이 없다. 세션이 끝나면 바로 꺼지고, 창이 닫힐 때 다시 켜지지 않는다.
- 안전장치: 최대 12시간마다 자동으로 켜져 일정 변경을 확인(약 10분), 매일 12:00 KST 백업 시작 예약, 서버 안에서 끄면 항상 '중지'(종료 아님).
- 권한: 스케줄러 역할은 이 인스턴스 시작만, 서버 역할은 자기 `kongboda-wake-*` 예약 생성·수정과 그 역할 전달만 가능(+ SSM). 키 파일 없음.
- 끝난 세션 분석은 OpenF1에서 바로 불러오므로 서버가 꺼져 있어도 된다.
- WEC는 아직 호스트 작업(host_jobs)이 아니라 이 서버가 켜질 필요가 없다. WEC 작업이 추가되면 그 세션 창도 자동으로 깨우기 계산에 들어간다.
