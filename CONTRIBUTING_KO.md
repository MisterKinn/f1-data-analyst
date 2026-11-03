# 함께 개발하기

이 저장소는 F1 Data Analyst의 공동 개발용 소스입니다. 초기 소스는 Sites 저장 버전 12, 커밋 `24e63b5ef05045ed4a1a7f59069c2664b00da25b`와 동일합니다. 공동 작업 안내와 비밀 파일 제외 규칙만 추가했습니다.

## 시작

1. GitHub 초대를 수락합니다.
2. 저장소를 복제한 폴더를 각자의 Codex에서 엽니다.
3. Node.js와 Python을 준비하고 아래 명령으로 확인합니다.

```sh
git clone https://github.com/kangjeongmin1229/f1-data-analyst.git
cd f1-data-analyst
npm ci
node --test tests/*.test.mjs
python -m unittest discover -s collector -p "test_*.py"
npm run build
npm run validate
```

Python 수집기 실행에 필요한 패키지는 `collector/requirements.txt`, 실행 방법은 `collector/README_KO.txt`를 참고합니다. 실제 외부 데이터 호출에는 별도의 환경 설정과 인증이 필요합니다. 테스트 통과가 실시간 데이터 수집 성공을 뜻하지는 않습니다.

## 작업 순서

- 작업 전 최신 main을 받습니다.
- 기능별 브랜치에서 수정합니다. 예: `feature/driver-comparison`.
- 테스트 후 GitHub Pull Request를 열고 상대방이 변경 내용을 검토합니다.
- 검토된 변경을 main에 합칩니다. 같은 파일을 동시에 수정했다면 충돌을 해결하고 다시 테스트합니다.

## 폴더 안내

- `worker/`: MCP 도구, Hyprace·FIA 데이터 조회, 실시간 데이터 처리
- `collector/`: FastF1 수집기와 Python 테스트
- `tests/`: 서버 동작을 확인하는 Node.js 테스트
- `scripts/`: 빌드와 배포 산출물 검증
- `.openai/hosting.json`: 기존 Sites 프로젝트 연결

## 공유 배포와 이벤트 연결

공동 개발의 기준 소스는 이 저장소의 `main`입니다. GitHub에서 직접 수정하거나 ChatGPT의 연결된 GitHub 도구로 수정한 코드가 main에 반영되면 같은 배포 경로를 사용합니다. PR은 main에 병합된 뒤 배포 대상이 됩니다. 작성자 제한은 없습니다.

1. main 변경 이벤트로 `.github/workflows/deploy.yml`이 실행됩니다.
2. Node·Python 테스트와 빌드·배포 산출물 검사를 통과하면 GitHub가 인증된 `plugin.release_ready` 이벤트를 보냅니다.
3. 소유자의 웹 ChatGPT 작업 **F1 공유 플러그인 자동 배포**가 커밋과 검사 결과를 다시 확인하고 기존 공유 Site에 배포합니다.
4. 배포한 GitHub SHA를 서버에 기록합니다. GitHub Actions는 해당 배포의 SHA 확인까지 성공해야 완료됩니다. 이벤트 수신만으로 배포 성공은 아닙니다.

15분 간격 확인 작업은 중지되어 있습니다. 위 작업은 변경 이벤트로만 시작하며, Actions의 상태 확인은 자신이 시작한 배포가 끝났는지 확인하는 용도입니다. 기존 **MisterKinn PR 병합 보고**는 별도의 보고 전용 작업입니다.

공통 주소는 https://kongboda-motorsports.nuttycabin128.chatgpt.site 이며 MCP 연결은 같은 주소의 `/mcp`입니다. 모든 허용된 사용자가 같은 서버를 이용하므로 서버 기능을 계정별로 복사하지 않습니다. 새 사용자는 소유자의 Site 접근 초대를 받은 뒤 자기 계정에서 이 공유 서버에 플러그인을 연결해야 합니다. GitHub 수정 권한은 별도로 부여받아야 합니다. 초대만으로 다른 계정에 플러그인이 자동 설치되지는 않습니다.

ChatGPT에서 수정할 때도 공유 플러그인의 `edit-shared-f1-plugin` 지침을 통해 이 저장소에 변경을 기록해야 합니다. 별도 Sites 대화에서 GitHub를 거치지 않고 직접 배포한 변경은 자동으로 역수입되지 않습니다. 개인 계정의 플러그인 설치 상태·권한·설정·대화·비밀값은 동기화 대상이 아닙니다. 도구 목록 자체가 바뀌면 사용하는 클라이언트에서 도구 새로 고침이 필요할 수 있습니다.

실패 시 GitHub Actions의 해당 실행과 웹 ChatGPT 배포 작업 결과를 확인합니다. 원인을 수정한 뒤 실패한 작업을 다시 실행합니다. 독립적인 Sites 변경이나 검증할 수 없는 소스가 있으면 강제로 덮어쓰지 않습니다. 자세한 검증·복구 절차는 `.github/DEPLOYMENT.md`를 참고합니다.


## 비밀값과 데이터

API 키, F1 로그인 정보, 인증 토큰, `.env`와 개인 수집 데이터는 커밋하지 않습니다. 실제 비밀값은 소유자의 배포 환경 또는 각자 로컬 환경에서 관리합니다. 이 저장소에는 운영 비밀값과 과거 Git 이력을 옮기지 않았습니다.

