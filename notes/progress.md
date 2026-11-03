# 상태

- 2026-11-01 `migration/vercel-firebase` 브랜치에 Vercel + Firebase 이전 구조를 구현했습니다.
- 기존 ChatGPT Sites 프로덕션과 DNS는 변경하지 않았습니다.
- 로컬 테스트·빌드·Vercel 패키지링과 Firebase 규칙 배포는 통과했습니다.
- 구현 커밋 `68c4102`를 GitHub PR #33에 푸시했고 GitHub Actions 전체 검증이 통과했습니다.
- 기존 Vercel 운영 배포의 HTTP 500 원인을 `jwks-rsa@4.1.0`과 ESM 전용 `jose@6` 충돌로 확정했습니다.
- `jwks-rsa` 하위 `jose`를 호환 버전 4.15.9로 고정했고, Node 22 로컬·Vercel 패키징 검증을 통과했습니다.
- 신규 Preview `dpl_BdmxWPJx1pkMWUTrhbxgms6b6xkf`는 `READY`입니다. 보호 우회 요청에서 `/`·`/auth/google/start` 200, `/mcp`·`/api/mcp` 401, 5xx·error 로그 0건을 확인했습니다.
- Firebase 서비스 계정을 Vercel Preview·Production에 `sensitive` 변수로 등록했습니다.
- 서비스 계정 적용 Preview `dpl_G3fYKwpk3fEkJvYWL29UiAt9gKA4`가 `READY`이며 `/`·로그인 시작 200, MCP 경계 401, 5xx 0건입니다.
- Firebase Admin Auth·Firestore 읽기와 실제 저장 어댑터 쓰기·읽기·목록·삭제를 통과했습니다.
- Google 공급자 활성화와 운영·최신 Preview 승인 도메인을 API로 확인했습니다.
- 소유자 export ZIP과 내부 파일 해시를 검증하고, R2 147개 중 영구 객체 134개를 Firestore로 이전해 전수 본문 해시·ETag 검증을 통과했습니다.
- OAuth flow 4개, 구 세션 6개, 복구 불가능한 MCP token index 2개, 과거 pending event 1개는 재사용하지 않도록 제외했습니다.
- 기존 계정과 연결되도록 Firebase 로그인에서 검증된 Google 제공자 subject를 사용하게 수정했습니다.
- 커밋 `085ec3d`를 PR #33에 푸시했고 GitHub Actions `test`가 통과했습니다.
- 데이터 이전 반영 Preview `dpl_ABXv4M5HCErEBhC29FMzyRSYDpHK`가 `READY`이며 `/`·로그인 시작 200, MCP 경계 401, 5xx 0건입니다.
- 새 Preview 도메인을 Firebase 승인 목록에 추가했습니다. F1 순위 API는 미등록 수집기 설정 때문에 아직 HTTP 202 대기 상태입니다.
- 이전 계정 5개의 라이브 키 revision을 집계해 기존 값 `1`을 확인하고 Vercel Preview·Production에 등록했습니다.

# 결정

- Firebase 로그인은 웹 계정에만 쓰고 ChatGPT MCP 인증과 분리합니다.
- Firestore는 Vercel의 Firebase Admin만 접근하고 클라이언트 직접 접근은 전부 거부합니다.
- Firestore 문서 한계를 위해 호환 저장 값은 850,000바이트로 제한합니다. 더 큰 스냅샷은 Cloud Storage 분리 후 전환합니다.
- 기존 Sites 영구 데이터 134개를 Firestore로 이전했습니다. 원본 R2에 이후 쓰기가 있으면 cutover 전에 delta export·대조가 필요합니다.
- Vercel 웹과 ChatGPT MCP를 분리합니다. 웹은 Vercel+Firebase로 이전하고 MCP는 기존 Sites를 유지합니다.

# 변경 위치

- Vercel 엔트리·라우팅: `api/index.js`, `vercel.json`
- Firebase Admin·Firestore 호환 저장소: `server/`
- Firebase 프로젝트·보안 규칙: `.firebaserc`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`
- 인증·저장소 회귀 테스트: `tests/firebase-identity.test.mjs`, `tests/firestore-bucket.test.mjs`, `tests/r2-firestore-import.test.mjs`
- 검증 import 도구: `scripts/import-r2-export-to-firestore.mjs`
- 이전 운영 가이드: `docs/vercel-firebase-migration.md`, `README.md`

# 검증

- Node 테스트 95개 통과
- `npm run build`, `npm run validate`, `vercel build --target=preview` 통과
- Firebase Firestore 규칙 컴파일·배포 통과
- Git 백업 bundle·압축 생성 및 bundle 무결성 검증 통과
- GitHub Actions: Node·수집기 Python·Discord Python 테스트와 빌드·산출물 검증 통과
- 2026-11-02 Node 22.23.4: Node 테스트 95개, build, artifact validate, Vercel preview build 통과
- 2026-11-02 격리 Python 환경: Collector 65개, Discord 18개 통과
- Vercel 함수 번들: `jwks-rsa` 하위 `jose@4.15.9` 포함 확인
- npm 감사 대상 `zod`, `glob`, `minimatch`는 실제 서버리스 함수 번들에 포함되지 않음 확인
- `npm audit --omit=dev`: critical 0, high 4, moderate 6. high 4개는 `@vercel/functions`의 사용하지 않는 OIDC/CLI 하위 경로이며 현재 자동 안전 수정이 없습니다. 운영 전환 전 패치 가능 버전을 다시 확인합니다.
- R2 export: ZIP·내부 파일 SHA-256, JSONL 147개 구조·본문 해시 검증 PASS
- Firestore import: 영구 객체 134개 쓰기 후 전수 재조회 본문 해시·원본 ETag 검증 PASS
- 2026-11-02 로컬: Node 테스트 98개, Discord 테스트 18개, build, artifact validate, Vercel preview build PASS
- Collector 로컬 테스트는 시스템 Python 3.14에 `fastf1`이 없어 64 PASS / 1 환경 오류이며, GitHub Actions의 Python 3.11 전체 결과로 최종 판정합니다.

# 다음 작업

1. 변경을 PR #33에 푸시하고 GitHub Actions 전체 검증을 통과시킵니다.
2. 최신 Preview에서 실제 Google 로그인·로그아웃, 기존 계정 연결과 계정 격리를 검증합니다.
3. 기존 운영 비밀 6종을 값 노출 없이 Vercel Preview·Production으로 이관합니다.
4. 원본 R2가 export 후 변경됐다면 cutover delta를 다시 이관합니다.
5. MCP는 기존 Sites에 유지하고, 사용자 승인 후 기본 Vercel 도메인으로 Production 전환합니다.

# 제약

- export 이후 원본 R2 변경 여부는 현재 연결 계정에서 확인할 수 없습니다.
- 영구 수집기와 Discord 봇은 기존 외부 호스트를 계속 사용하며 이번 Vercel 함수로 이전하지 않습니다.
