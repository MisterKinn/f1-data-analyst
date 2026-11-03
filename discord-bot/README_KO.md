# 꽁보다 모터스포츠 Discord 봇

F1 FP·퀄리·레이스 순위, 여러 시리즈의 챔피언십 순위, 실시간 브리핑과 질의응답을 제공합니다. 기존 접근 정책대로 DISCORD_OWNER_ID 한 명만 명령을 실행합니다. 서버 회원 전체에게 권한을 주거나 개인 계정을 자동 연결하지 않습니다.

| 명령 | 기능 |
| --- | --- |
| /fp event:21 practice:FP1 year:2026 | GP 라운드별 FP1·FP2·FP3 순위 |
| /qualifying event:21 year:2026 | 게시된 분류 순서와 Q1·Q2·Q3. sprint:true는 스프린트 퀄리 |
| /race event:21 year:2026 | 게시된 레이스 순위·주행 랩·완주 상태·포인트. sprint:true는 스프린트 |
| /standings kind:drivers series:f1 | 사이트와 동일한 챔피언십 순위. kind는 drivers·constructors |
| /standings series:wec category:hypercar-drivers | WEC 부문 선택. IMSA·Formula E·NLS·ELMS·ALMS도 사이트 지원 범위에서 조회 |
| /live | 현재 F1 타이밍 상위 순위·랩·타이어·레이스 컨트롤 |
| /briefing action:once | 간결한 현재 브리핑 |
| /briefing action:start | 이 채널의 브리핑 메시지를 30초마다 갱신. action:stop으로 중단 |
| /ask question:… | 수신 타이밍·사후 세션 결과·챔피언십·일정에 근거한 한국어 답변 |
| /schedule, /status | 일정(KST), 봇·수집기 상태 |

year:0 또는 생략은 UTC 현재 연도입니다. FP·퀄리·레이스 사후 명령과 라이브는 현재 F1 전용입니다. 모든 MCP 도구·텔레메트리 분석·다른 시리즈의 세션 결과를 지원한다고 보장하지 않습니다. Q&A는 위 읽기 도구를 사용하며 방송·팀 무전을 듣지 않습니다.

## 데이터와 표시

- 라이브는 운영 수집기의 /snapshot을 읽고 원본 시각·수신 시각·세션 상태를 검증합니다. 오래된 기록을 라이브라고 표시하지 않습니다.
- 사후 결과는 같은 수집기의 인증된 /session-results?year=…&event=…&session=…에서 FastF1 자료를 별도 작업으로 로딩합니다. 이 엔드포인트를 포함한 수집기 버전이 실제 서버에서 실행되어야 합니다. Vercel 사이트 배포만으로 Python 수집기가 갱신되지는 않습니다.
- 로더는 한 번에 한 건만 실행하고 최대 16개 결과를 짧게 보관합니다. 라이브 수집 시작·정지·인증을 바꾸지 않습니다. 로딩 중·실패·게시 지연을 완료와 구분합니다.
- 구 FastF1에서 FP 분류가 없으면 삭제되지 않은 베스트랩 순서로 계산하고 표시합니다. 퀄리 전체를 베스트랩으로 재정렬하지 않고 Q3 미진출을 0초로 채우지 않습니다.
- 챔피언십은 공식 사이트 /api/championship-standings의 동일 데이터·출처·잠정/확정·캐시 상태를 사용합니다. 수집기 키는 공개 사이트 API로 보내지 않습니다.
- 결과는 1,900자 이하 메시지로 나눠 모든 참가자를 표시합니다. 멘션은 비활성화합니다.
- 자동 브리핑은 소유자가 시작한 뒤에만 작동하고 재시작하면 꺼집니다. 같은 메시지를 갱신하며 연결 실패도 표시합니다. 매 30초 유료 AI를 호출하지 않는 짧은 타이밍 요약입니다. 해석은 /ask로 요청합니다.

## 실행 준비

1. Discord Developer Portal에서 앱·봇을 만들고 bot, applications.commands 범위로 서버에 초대합니다. 채널 보기·메시지 보내기 권한이 필요하며 관리자 권한이나 Message Content Intent는 필요하지 않습니다.
2. 호스트 비밀 환경 변수에 DISCORD_TOKEN, DISCORD_OWNER_ID, 현재 운영 수집기의 COLLECTOR_URL·COLLECTOR_READ_KEY를 설정합니다. 테스트 서버 DISCORD_GUILD_ID는 선택입니다. 토큰을 채팅이나 Git에 올리지 마세요.
3. Q&A에는 ANTHROPIC_API_KEY와 계정에서 사용 가능한 ANTHROPIC_MODEL ID가 필요합니다. ChatGPT 구독은 이 API 인증·비용을 제공하지 않습니다. 키가 없으면 Q&A만 꺼집니다.
4. DISCORD_ALERT_CHANNEL_ID는 기존 세션 시작·종료와 FIA 알림용 선택 설정입니다. 실제 전송 성공 후에만 중복 방지 상태를 기록합니다. WEC 문서 알림은 미구현입니다.

.env.example을 참고하세요. .env 파일 자체를 자동으로 읽지는 않습니다. 폐기한 Render/구 수집기를 다시 실행하지 마세요.

```bash
node discord-bot/export_schedule.mjs
python -m pip install -r discord-bot/requirements.txt
cd discord-bot
python -m kongboda_bot
```

계속 켜져 있는 호스트가 필요합니다. Vercel 사이트 함수는 Discord Gateway 프로세스를 실행하지 않습니다. state.json은 중복 방지 기록이므로 영구 디스크에 두세요.

저장소 루트에서 Docker 이미지로 실행할 수도 있습니다. 이미지에는 비밀값을 넣지 않습니다.

```bash
docker build -f discord-bot/Dockerfile -t kongboda-discord .
docker run --env-file /secure/kongboda-discord.env -v kongboda-discord-state:/data --restart unless-stopped kongboda-discord
```

## 업데이트와 검증

사이트 API·수집기는 같은 주소·호환 응답을 유지하면 다음 조회에 서버 변경이 반영됩니다. 봇 코드·새 명령·로컬 일정·공통 답변 정책은 봇 호스트에서 최신 Git 이미지 재빌드/재시작이 필요합니다. 시작 시 명령을 자동 동기화하며 Q&A마다 같은 저장소 docs/answer-principles.md를 읽습니다. ChatGPT 플러그인 스킬을 Discord가 직접 실행하는 구조는 아닙니다.

호스트의 Git 자동 배포를 이 저장소에 연결하면 재빌드/재시작을 자동화할 수 있습니다. 소스 추가만으로 호스트 연결·토큰 등록·Discord 설치·실제 전달이 완료되지는 않습니다.

```bash
python -m unittest discover -s collector -p 'test_*.py'
cd discord-bot && python -m unittest discover -s tests
```

실제 운영 완료에는 Discord 연결·명령 등록·운영 수집기 엔드포인트·여섯 기능 응답·브리핑 갱신/중지 확인이 필요합니다. 키 없는 테스트를 실제 전달 성공이라고 표시하지 않습니다.

