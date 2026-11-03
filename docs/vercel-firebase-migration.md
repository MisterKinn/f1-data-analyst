# Vercel + Firebase 이전

## 안전 경계

- 기존 ChatGPT Sites 프로덕션, 도메인, DNS, 수집기와 저장소는 건드리지 않는다.
- `migration/vercel-firebase` 브랜치와 Vercel 프리뷰에서 먼저 검증한다.
- Firebase 웹 로그인은 웹 계정 전용이다. 검증된 Firebase 세션을 ChatGPT MCP 인증으로 승격하지 않는다.
- Firestore 클라이언트 규칙은 전부 거부하고 Vercel의 Firebase Admin만 접근한다.

## 구성

- Vercel Node 함수: `api/index.js`
- 기존 Worker 호환 저장소: `server/firestore-bucket.js`
- Firebase Admin 초기화: `server/firebase-admin.js`
- Firestore 리전: `asia-northeast3`
- Firebase 프로젝트: `kongboda-motorsports-2026`
- Vercel 프로젝트: `kongboda-motorsports`

Firestore 문서 한도를 고려해 호환 저장소의 단일 값은 850,000바이트로 제한한다. 그보다 큰 라이브 스냅샷이나 파일이 실제로 필요하면 Cloud Storage로 분리한 뒤 전환한다.

## 배포 전 사람 확인

Firebase Console에서 다음 두 가지를 완료해야 웹 로그인과 서버 저장소를 실제 프리뷰에서 검증할 수 있다.

1. Authentication에서 Google 공급자를 활성화하고 지원 이메일을 선택한다.
2. 프로젝트 설정의 서비스 계정에서 전용 키를 발급해 Vercel의 `FIREBASE_SERVICE_ACCOUNT_JSON` 환경 변수에 직접 등록한다. 키 값은 채팅, Git, 로컬 문서에 붙여 넣지 않는다.

프리뷰 도메인과 최종 도메인은 Firebase Authentication의 승인된 도메인에 각각 추가한다. 운영 전환은 프리뷰의 로그인, 계정 저장, 라이브 읽기, 오류 처리와 모바일·데스크톱 화면 검증 후 별도 승인으로 진행한다.

## 2026-11-01 실행 상태

- `origin/main` 전체 Git bundle과 스냅샷 압축을 프로젝트 밖 `f1-data-analyst-backups/2026-11-01-pre-vercel-firebase/`에 저장했다.
- 원격 복구용 브랜치 `backup/pre-vercel-firebase-20261101`를 GitHub에 푸시했다.
- Firebase 프로젝트 `kongboda-motorsports-2026`의 Firestore를 `asia-northeast3`에 생성했고, 클라이언트 직접 읽기·쓰기를 전부 거부하는 규칙을 배포했다.
- Vercel 프로젝트 `kongboda-motorsports`와 공개 Firebase 웹 설정 환경 변수를 구성했다. 서비스 계정 비밀 키는 저장하지 않았다.
- 로컬 Vercel 빌드는 통과했지만, Vercel 원격 Preview/Production 배포는 빌드 로그 없이 `UNKNOWN`에 멈춰 실제 HTTP 검증을 완료하지 못했다. 이 상태에서 DNS나 기존 Sites 운영 배포는 변경하지 않는다.
- 현재 연결된 Sites 계정으로는 기존 Site 객체와 저장 데이터를 조회할 수 없어 자동 백업·이전하지 못했다. 소유자 계정의 export 또는 신규 Firestore로 시작한다는 결정이 필요하다.

Vercel 원격 배포가 `Ready`로 전환되면 `/`, `/auth/google/start`, `/mcp`, `/api/mcp`를 검증한다. 스푸핑한 `oai-authenticated-user-*`와 `x-kongboda-*` 헤더가 인증으로 받아들여지지 않는지도 확인한다.
