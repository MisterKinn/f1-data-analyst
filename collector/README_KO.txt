FastF1 라이브 연결 (Windows)

1. Python 3.12 이상이 없다면 https://www.python.org/downloads/windows/ 에서 설치합니다.
2. 압축을 풀고 START_WINDOWS.cmd를 실행합니다. 첫 실행 때 전용 환경에 FastF1을 설치합니다.
3. 프로그램이 요구하는 F1 이메일/비밀번호는 PC 터미널에 직접 입력합니다.
   ChatGPT에 비밀번호/토큰을 보내지 마세요. F1 구독 권한은 별도로 필요합니다.
   브라우저 인증을 원하면 터미널에서 .venv\Scripts\python.exe collector.py --auth-method browser 를 실행하세요.
4. 일반 Chrome/Edge에서 아래 개인 페이지에 ChatGPT 계정으로 로그인합니다.
   https://kongboda-motorsports.nuttycabin128.chatgpt.site/live
5. '수집 파일 연결'을 눌러 output 폴더의 snapshot.json을 선택합니다.
   이 페이지와 수집기 창을 열어 두면 데이터가 10초 간격으로 전달됩니다.
   브라우저 절전/탭 정지/페이지 종료 시 전달이 멈춥니다.
6. ChatGPT에서 F1 Data Analyst 플러그인을 사용하여 '지금 프랙티스 분석해줘'라고 요청합니다.
   이 프로그램은 스스로 AI 해설 메시지를 발송하지 않습니다.

종료: 페이지의 '연결 해제'와 수집기에서 Ctrl+C.
재연결: 스트림이 끊어졌다면 수집기를 다시 실행하고 파일을 다시 선택합니다.
데이터가 45초 이상 오래되면 플러그인은 실시간으로 간주하지 않습니다.

범위: 랩/섹터 타이밍, 타이어 스틴트 상태, 날씨, 레이스 컨트롤, 세션 상태.
연료량, 배터리 SOC, 타이어 온도, 차량 속도/스로틀 채널은 이 버전에 포함하지 않습니다.
시작 전 지난 랩 전부가 복원되지는 않습니다. 원시 변경 기록은 순서/지연을 검토해야 합니다.
이 코드는 FastF1 기록기를 사용하되 실시간 상태 정리는 별도 구현입니다.
가공 완료된 Session.laps와 동일한 품질/정확도를 보장하지 않습니다.

F1 인증은 FastF1이 관리합니다. 개인 페이지로 보내는 snapshot.json에는 인증값을 넣지 않습니다.
timing-raw.txt는 로컬 검토용이며 자동 업로드하지 않습니다.

확인: Python 상태 병합/세션 전환/오래된 데이터 판별 및 서버 접근제어 테스트.
한계: 작성 환경의 실시간 소켓 연결 실패로 실제 F1 계정 인증과 라이브 수신은 사용자 PC에서 검증해야 합니다.

실행 문제 (launcher v2)
- ZIP 안에서 실행하지 말고 '모두 추출' 후 실행하세요.
- 'Press any key to CLOSE'는 실패/종료 뒤 창을 닫는 안내입니다. 위의 오류를 확인하세요.
- PYTHON_NOT_FOUND: Python 3.12 이상 설치 후 PATH 옵션을 선택하고 다시 실행.
- EXTRACT_ZIP: collector.py, requirements.txt와 같은 폴더에서 실행.
- VENV_INVALID: 새 폴더에 다시 압축을 풀어 실행. 기존 데이터는 지우지 마세요.
- SETUP_FAILED: 같은 폴더의 setup.log 확인. 이 로그에는 설치 과정만 저장됩니다.
- 3/3 이후 오류: 마지막 오류 문장을 확인. 비밀번호/토큰은 공유하지 마세요.

