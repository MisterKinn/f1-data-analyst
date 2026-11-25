# 2026-11-25 공개 결과 캐시 최적화 인계

- 상태: `perf/public-request-isolation`에서 공개 경기 결과 캐시만 변경. 아래 과거 기록과 구분할 것. 배포 여부는 이 브랜치의 PR/Production 상태로 확인.
- 결정: 동일 저장소 인스턴스에서 5분간 메모리 재사용, 저장소 읽기부터 동시 요청 병합. 최대 64개/직렬화 4MiB(실제 프로세스 메모리는 별도). 저장소별 격리. 장애 대체 데이터는 원래 검증 시각부터 24시간 미만만 제공.
- 변경 위치: `worker/published-cache.js`, `tests/public-request-costs.test.mjs`, `scripts/benchmark-public-cache.mjs`.
- 검증: 초기 전체 테스트 857 통과/0 실패/1 선택적 skip. 이후 MCP 경로 실험과 그 테스트는 제거하여 계정 초기화 동작 유지. 최종 표적 테스트 12개 통과, 빌드/산출물 검증 통과. Playwright PC/모바일 6개 시나리오 및 CSV 해시가 기존 버전과 동일.
- 측정: 모의 저장소 5ms 지연에서 warm 100회 읽기 100→0, 동시 20회 읽기 20→1. 네트워크/실제 Firestore 사용량 측정이 아니며 전체 사이트 성능·요금 절감률로 일반화하지 말 것.
- 최종 검증: main `e47daf9` 통합 후 전체 860개 중 859 통과/0 실패/1 선택적 skip. 동일 main 기준 직접 동등성 4개 및 PC/모바일 6개 시나리오 재검증 PASS. 기능 OFF 테스트 PASS. 운영 배포 전 정적 191개·OAuth/MCP·Google 팝업 점검 PASS.
- 다음 작업: PR/배포 검증 후 운영 요청량이 비슷한 구간에서 Firestore 읽기·Vercel CPU를 비교. 직전 Production은 `dpl_4mE9V6ZVw3GSyRJL5UjCVRmi3KLA`.
- 제약: 로그인/권한/계정 개인화·물리 모델·수집기·Sites·요금제는 변경하지 않음. 메모리는 인스턴스 간 공유되지 않음. 공개 데이터 외부 변경은 기존 5분 TTL 범위에서 지연 반영될 수 있음. 실제 Google 계정 로그인은 이번 브라우저 테스트 대상 아님.

# 과거 상태

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

## 2026-11-10 전체 테스 baseline 복구·axle 실험 재실행 준비

### 상태

- 정식 `main` 기준 `f486cf1`에서 기존 전체 테스 실패를 복구했습니다.
- 축 모델 F/G/H/I의 기존 작업은 340분 제한으로 종료됐고 결과 artifact가 없었습니다.
- 체크섬으로 고정한 입력으로 B/F/G/H/I를 병렬 재실행하고 B 대비 비교 artifact를 남기는 GitHub Actions 워크플로를 준비했습니다.
- 로컬 작업 브랜치는 `lapsim-exp/axle-screen`이며, push 시 실험 워크플로가 자동 시작됩니다. 아직 커밋·푸시·PR·병합·배포는 하지 않았습니다.

### 결정

- `/about`은 현재 홈 리다이렉트를 유지하고 정적 preview 대상에서 제외합니다.
- 계정 페이지에서 생성만 되고 출력되지 않던 crew/live-access 영역을 복구합니다.
- 3-round/100-iteration 결과는 빠른 선별용입니다. 우승 후보는 운영 반영 전에 full-settings 재검증합니다.

### 변경 위치

- 사이트·preview baseline: `worker/website.js`, `scripts/export-preview.mjs`, 관련 테스 3개
- 실험 구성·자동화: `scripts/sim/experiments.json`, `.github/workflows/lapsim-experiment.yml`
- 물리 인수인계: `docs/lapsim-handoff-physics.md`

### 검증

- Node 22 전체 테스 386/386 PASS
- 기능 비활성 모드 1/1 PASS
- build·artifact validate PASS
- Collector Python 183 PASS / 1 SKIP, Discord Python 29 PASS
- 워크플로 YAML, 실험 JSON, `git diff --check`, 변경 diff 민감정보 패턴 검사 PASS
- 고정 입력 archive 다운로드·SHA-256 검증 PASS
- 축 모델 최소 스모크 보정(1 round/1 iteration) PASS

### 다음 작업

1. 사용자 승인 후 로컬 변경을 커밋하고 `MisterKinn/f1-data-analyst` 새 브랜치에 push해 PR과 GitHub Actions 실험을 시작합니다.
2. B/F/G/H/I 선별 결과를 held-out gate로 비교합니다.
3. 개선 후보가 있으면 full-settings로 다시 확인한 뒤 별도 승인으로 병합·Production 배포합니다.

### 제약

- GitHub Actions 실제 실행 결과는 원격 push 전이므로 아직 없습니다.
- 로컬에 Docker가 없어 이미지 기반 검증은 수행하지 못했습니다.

## 2026-11-25 — 런타임 비용 리팩토링 인수인계

### 상태

- 작업 위치: 별도 `f1-data-analyst-refactor` 체크아웃, 로컬 브랜치 `refactor/runtime-costs`.
- 기준: canonical main `4e60d9fac17ab01b62afae0a5781f578e85e4a09`. 원래 체크아웃과 수정 중이던 문서는 보존했습니다.
- 기준 소스와 기존 handoff 백업은 형제 폴더 `f1-data-analyst-refactor-backup`에 있습니다. 해시는 `notes/runtime-refactor.md` 참조.
- 커밋·push·PR·배포·결제 변경·실데이터 이전은 하지 않았습니다.

### 결정

- 일반 Firestore 저장의 선행 읽기를 제거하고 요청 진단은 기본 2% 샘플링합니다. 조건부/계정 트랜잭션은 유지합니다.
- 시뮬레이터 준비 캐시와 동시 요청 병합을 추가했습니다. 물리 모델·보정 데이터는 변경하지 않았습니다.
- 정적 파일 191개만 `dist/public`에 생성합니다. 서버 번들과 hosting 설정은 공개 디렉터리 밖에 둡니다.
- 인증/전송/MCP/웹사이트/시뮬레이터 준비 모듈을 분리하고 계정·진단·공개 캐시의 논리적 저장 경계를 도입했습니다.
- 개인화 HTML과 즉시 탈퇴/권한 반영은 유지합니다. 공개 화면/개인 API의 비동기 분리 및 실제 컬렉션 이전은 후속 설계 대상입니다.

### 변경 위치

- `api/index.js`, `server/{firestore-bucket,request-diagnostics,firebase-session,http-transport}.js`
- `worker/routes/`, `worker/{simulation-cache,storage-domains,accounts,live-diagnostics,published-cache,website,ui-refinement,index}.js`
- `scripts/{build,build-static-assets,benchmark-runtime-cache}.mjs`, `vercel.json`, 관련 회귀 테스트
- 운영/검증 가이드: `docs/runtime-costs.md`, 체크포인트: `notes/runtime-refactor.md`

### 검증

- 원본 기준: 841 PASS, 0 FAIL, 1 SKIP (Node 22).
- 직접 비교: 공개/개인 화면 36개, 정적 파일 191개, MCP 응답 6개 상태·헤더·본문 일치.
- 시뮬레이터 HTML 동일성 및 20개 동시 요청의 준비/조회 각 1회 검증.
- 저장소 선택 기능 보존과 저장소 없는 공개 요청 병합 회귀를 발견·수정하고 재검증했습니다.
- 최종 전체 검사 결과는 `notes/runtime-refactor.md` 참조. 로그는 무시되는 `.cache/refactor/`에 있습니다.

### 다음 작업

1. 새 세션에서 이 인수인계를 읽고 원격 main이 기준 이후 변경되었는지 먼저 확인합니다.
2. 사용자 승인 후 커밋·push 및 Preview 배포를 진행합니다. Google 로그인/로그아웃, MCP, 시뮬레이터, 정적 파일 헤더/함수 우회를 확인합니다.
3. 별도 승인으로 Production 반영 후 동등한 트래픽 구간의 Firestore 읽기/쓰기 및 Vercel CPU를 비교합니다.
4. 개인 데이터 API 분리, 진단 보존 기간, 저장소별 실제 스키마와 비용 경보를 다음 단계로 설계합니다.

### 제약

- 로컬 검증은 모든 입력에 대한 100% 동등성이나 운영 Google 로그인 성공을 증명하지 않습니다.
- 비용 상한 차단 장치는 아닙니다. 샘플링으로 진단 문서 수가 의도적으로 줄어듭니다.
- 클라우드 권한·요금제·운영 장애 상태는 이번 로컬 리팩토링으로 변경하지 않았습니다.

## 2026-11-25 — 배포 검증 단계

- 상태: 사용자가 회귀 검증, Playwright 검증 통과 후 Production 배포를 승인했습니다. 이전 로컬 전용 범위는 이 요청으로 갱신합니다.
- 결정: 기존 Vercel 프로젝트와 GitHub main 자동 배포를 유지하며 PR Preview를 먼저 확인합니다. 물리 모델/실데이터/요금제는 변경하지 않습니다.
- 변경 위치: 위 런타임 리팩토링 및 `scripts/verify-runtime-browser.mjs`.
- 검증: 새 전체 테스트 851 PASS / 0 FAIL / 1 SKIP(원본과 같은 선택형 replay 데이터 부재), 빌드·ESM 검사 통과. Playwright PC/모바일 실조작 6개 시뮬레이터 상태와 CSV 동일; PC/모바일 스크린샷 각각 SHA-256 동일. 계정 진입·언어·SetupSim/BoPSim/AI/개인정보 페이지 확인. JS 오류와 실패한 자체 정적 파일 0개.
- 다음 작업: PR Preview에서 호스팅 경로/정적 파일/로그인 진입/MCP 검사 후 main 병합 및 운영 확인.
- 제약: 로컬 브라우저는 외부 네트워크를 차단해 조건을 통제했습니다. 실제 사용자 Google 인증 완료와 모든 입력의 동등성은 아직 증명하지 않았습니다. 운영 이전 복구 지점은 `dpl_CdrBQQh3MkDaCBPabStGb7zsoXWW`입니다.
