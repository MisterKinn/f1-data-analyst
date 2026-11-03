# 꽁보다 모터스포츠 Discord 봇

사이트 소유자 한 명만 쓰는 비공개 봇입니다. 사이트 Worker·인증·접근 설정은 건드리지 않고, 수집기의 읽기 키(`COLLECTOR_READ_KEY`)로 `/snapshot`, `/championship/*`를 직접 읽습니다. 사이트 MCP를 거치지 않아 더 빠르고, 키와 Discord 계정 ID를 가진 소유자만 쓸 수 있습니다.

## 기능

| 명령 | 설명 |
| --- | --- |
| `/live` | 현재 세션 상위 순위, 베스트·마지막 랩, 타이어. 피드가 끊겼거나 60초 넘게 오래됐으면 "라이브 아님"으로 표시 |
| `/schedule [days] [series]` | 앞으로의 세션 일정(KST). `worker/session-schedule.js`와 같은 데이터 사용 |
| `/standings` | F1 드라이버·컨스트럭터 순위 |
| `/ask` | Claude가 `live_snapshot`, `standings`, `upcoming_sessions` 도구로 확인한 데이터만 근거로 답변 (`ANTHROPIC_API_KEY` 필요) |
| `/status` | 수집기·알림·FIA 확인 상태 |

자동 알림(`DISCORD_ALERT_CHANNEL_ID` 설정 시):

- 세션 시작 10분 전 알림, 세션 종료(`SessionStatus` Finished/Finalised) 알림. 전송에 성공한 뒤에만 중복 방지 기록을 남기므로 실패하면 다시 시도합니다.
- FIA 공식 문서 알림(15분마다 확인): `AGENTS.md`의 선별 범위(트랙 변경, 레이스 디렉터 지시, 부품 교체·그리드, 업그레이드, 스튜어드 결정, 피렐리 전략)만 알립니다. PU·업그레이드 문서는 제목만으로 판단하지 않고 PDF 본문을 읽어 확인합니다. 본문을 읽지 못하면 요약을 만들지 않고 그 사실을 알림에 적습니다. 처음 실행할 때 이미 게시된 문서는 기준선으로만 기록하고 뒤늦은 새 알림처럼 쏟아내지 않습니다.

## 아직 안 된 것

- **WEC 문서 알림은 구현되지 않았습니다.** `AGENTS.md`도 WEC 문서 수집을 추후 확장 범위로 두고 있고, Al Kamel 매니페스트 구조를 확인한 뒤 같은 방식으로 추가해야 합니다.
- F1 외 시리즈는 일정 알림만 되며 라이브 요약은 수집기가 모으는 F1 피드 기준입니다.
- Discord 서버에 실제로 연결해 본 적은 없습니다. 로직은 단위 테스트로만 검증했습니다.

## 실행

1. [Discord Developer Portal](https://discord.com/developers/applications)에서 앱·봇을 만들고 토큰을 발급합니다. 서버에는 `bot`, `applications.commands` 범위로 초대합니다(권한은 메시지 보내기만 필요).
2. 환경 변수를 `.env.example`을 참고해 설정합니다. 토큰과 키는 저장소에 커밋하지 마세요.
3. 일정 파일을 만들고 실행합니다.

```bash
node discord-bot/export_schedule.mjs          # worker/session-schedule.js → schedule.json
pip install -r discord-bot/requirements.txt
cd discord-bot && python -m kongboda_bot
```

일정이 바뀌면 `export_schedule.mjs`를 다시 실행하고 봇을 재시작하세요.

## 호스팅 주의

알림을 보내려면 프로세스가 계속 떠 있어야 합니다. Render 무료 웹 서비스는 유휴 시 잠들기 때문에 알림이 빠질 수 있어요. 슬래시 명령만 쓸 때는 잠깐 깨어 있을 때 응답하지 못할 수 있습니다. 항상 켜 둘 수 있는 환경(개인 PC, 소형 서버 등)을 권장합니다. `state.json`은 재시작 후 중복 알림을 막는 기록이라 디스크가 휘발성인 호스트에서는 재시작할 때 사라집니다.

## 테스트

```bash
cd discord-bot && python -m unittest discover -s tests
```
