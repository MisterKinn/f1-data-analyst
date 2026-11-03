# F1 Data Analyst 최종 배포 Handoff

## 한눈에 보는 현재 상태

- 기준 시각: 2026-11-02 11:17 KST
- 저장소: `kangjeongmin1229/f1-data-analyst`
- 로컬 경로: `/Users/kinn/Desktop/BAI-workspace/10-projects/f1-data-analyst`
- 작업 브랜치: `migration/vercel-firebase`
- 배포 소스 커밋: `085ec3d` (`feat: migrate Sites data to Firestore`)
- 구현 커밋: `68c4102` (`feat: prepare Vercel Firebase migration`)
- PR: [#33 Vercel + Firebase migration groundwork](https://github.com/kangjeongmin1229/f1-data-analyst/pull/33)
- PR 상태: **OPEN / GitHub Actions PASS**
- 최종 판정: **R2 → Firestore 영구 데이터 이전 PASS, Firebase 실제 로그인과 Production 전환은 BLOCKED**

| 영역 | 상태 | 확인된 내용 |
|---|---|---|
| Git·PR·CI | PASS | PR #33 병합 가능, 커밋 `085ec3d`의 `test` 체크 성공 |
| 로컬 빌드 | PASS | Node 테스트 98개, Discord 테스트 18개, build, artifact validate, Vercel preview build 통과 |
| Firebase 기반 | 부분 완료 | 프로젝트·Firestore·거부 규칙·웹 앱 생성 완료 |
| Firebase 인증 | 부분 PASS | Google 공급자 활성 확인, 운영·최신 Preview 승인 도메인 확인. 실제 브라우저 로그인은 남음 |
| Vercel 환경 변수 | 부분 완료 | Firebase Admin·키 revision 등록. 기존 Sites 운영값 5종은 원본 확인 대기 |
| Vercel Preview | PASS | 새 Preview `READY`; `/`·로그인 시작 200, `/mcp`·`/api/mcp` 401, 5xx 0건 |
| Vercel Production | BLOCKED | 기존 공개 alias는 실패한 구 배포를 가리킴. Firebase 설정·실로그인 검증 전 전환 금지 |
| 데이터 이전 | PASS | R2 147개 중 영구 객체 134개 이전·전수 해시/ETag 검증. 재사용 불가 임시 객체 13개 제외 |
| ChatGPT MCP | 확정·유지 | 웹만 Vercel+Firebase로 이전하고 ChatGPT MCP는 기존 Sites 주소에 유지 |
| 기존 운영 서비스 | 정상·유지 | 기존 ChatGPT Site `/` 200, 익명 `/mcp` 401. 수집기·Render·Discord 미변경 |

여기서 말하는 **최종 배포 완료**는 PR 병합이나 Vercel의 `Ready` 표시만 뜻하지 않는다. 웹, 인증, 저장소, 라이브 데이터, ChatGPT MCP 경계, 모바일·PC 화면을 실제 주소에서 확인하고, 사용자 승인 아래 운영 트래픽을 전환한 뒤 롤백 경로까지 확인한 상태를 뜻한다.

## 절대 지켜야 할 안전 경계

- 기존 ChatGPT Sites 프로덕션과 기존 MCP 주소는 신규 Vercel 검증이 끝날 때까지 유지한다.
- PR 병합, 운영 배포, 도메인·연결 주소 전환, 기존 서비스 종료는 각각 별도 외부 변경이다. 최종 검증 결과를 보고한 뒤 사용자의 명시적 승인을 받는다.
- 기존 Render 수집기, Discord 봇, Firebase 외 다른 운영 저장소는 이번 이전에서 변경하지 않는다.
- Firebase 서비스 계정 JSON, API 키, 토큰, 사용자 데이터는 채팅·Git·문서·로그에 출력하지 않는다.
- `UNKNOWN` 배포를 원인 확인 없이 반복 생성하지 않는다.
- 기존 Sites 데이터의 export가 불가능한 상태에서 덮어쓰기·삭제·초기화를 하지 않는다.

## 현재 운영 구조와 목표 구조

### 현재 운영

- 공유 ChatGPT Site: `https://kongboda-motorsports.nuttycabin128.chatgpt.site`
  - 실제 요청은 `https://kongboda-motorsports.jeongmin480.chatgpt.site`로 이동한다.
  - 2026-11-01 확인: `/` HTTP 200, 익명 `/mcp` HTTP 401.
- 공유 MCP 주소: `https://kongboda-motorsports.nuttycabin128.chatgpt.site/mcp`
- 영구 수집기·Render·Discord 봇은 기존 외부 호스트를 계속 사용한다.
- GitHub Actions는 테스트·빌드 검증만 수행한다. 자동 게시와 배포 알림은 비활성 상태다.

### 신규 Vercel/Firebase 후보

- Vercel 계정·프로젝트: `kinn/kongboda-motorsports`
- Vercel 프로젝트 ID: `prj_NTuO5SkPc304FU1S8MWDL4qLALi4`
- 공개 기본 주소: `https://kongboda-motorsports.vercel.app`
- Firebase 프로젝트: `kongboda-motorsports-2026`
- Firestore: `(default)`, `asia-northeast3`, Standard, delete protection 활성
- 웹 앱 ID: `1:809974086674:web:aef0d567ef2f8ea4abeccb`
- 서버 진입점: `api/index.js`
- 저장소 어댑터: `server/firestore-bucket.js`

## 완료된 작업

### 백업과 복구 기반

- 로컬 백업: `/Users/kinn/Desktop/BAI-workspace/10-projects/f1-data-analyst-backups/2026-11-01-pre-vercel-firebase`
- `f1-data-analyst-all.bundle`: 전체 Git 히스토리, bundle 무결성 검증 완료
  - SHA256: `dcc6d3f3e24d49774b53fa1ab9ba1f83252777a55ef035427f87ddc13a3b2fb4`
- `origin-main-c6d75b4.tar.gz`
  - SHA256: `dd156dfcbb30781f5dd5b594858804a7279334c80066ba5c2943be24dc03dbfd`
- `feature-backlog-685a223.tar.gz`
  - SHA256: `d93672458713e9786eb963d22b0ca705afa08c8133a650771b33d54944c2bdb2`
- GitHub 원격 복구 브랜치: `backup/pre-vercel-firebase-20261101`
- 제약: 현재 연결된 Sites 계정에서 기존 Site 객체·저장 데이터가 보이지 않아 Site 데이터는 백업하지 못했다.

### Vercel 이식 코드

- Node 서버리스 진입점과 전체 경로 rewrite를 추가했다.
- Firebase 웹 로그인 페이지, CSRF, 검증된 이메일, 최근 인증 시각, 세션 쿠키 검증을 추가했다.
- 외부 요청의 `oai-authenticated-user-*`, `x-kongboda-*` 헤더를 제거하고, Firebase Admin으로 검증한 신원만 내부 Firebase 헤더로 전달한다.
- Firebase 웹 로그인을 ChatGPT `/mcp` 신원으로 승격하지 않는다.
- 공개 Firebase 웹 설정 4종을 Development·Preview·Production에 등록했다.

### Firebase·Firestore

- Firebase 프로젝트와 웹 앱을 생성했다.
- Firestore 클라이언트 직접 읽기·쓰기를 전부 거부하는 규칙을 배포했다.
- Firebase Admin 초기화와 기존 R2 형태 호환 Firestore 저장소를 구현했다.
- Firestore 문서 한도를 고려해 단일 저장 값은 850,000바이트로 제한했다.
- 검증된 R2 export에서 영구 객체 134개를 `objectStore`로 이전하고 전수 재조회 검증했다.
- 기존 계정 매핑과 호환되도록 Firebase 로그인 신원은 내부 UID가 아니라 검증된 Google 제공자 subject를 사용한다.

### R2 → Firestore 이전 결과

- 원본 ZIP SHA-256과 ZIP 내부 5개 파일의 SHA-256을 제공된 체크섬과 대조해 모두 일치함을 확인했다.
- JSONL 147개 레코드의 키 중복, base64, JSON 파싱, 본문 SHA-256, 크기 제한을 검사했다.
- 영구 객체 134개, 디코딩 본문 2,016,369바이트를 Firestore `objectStore`에 이전했다.
- 제외 13개는 OAuth flow 4개, 구 도메인 로그인 session 6개, 복구 불가능하게 비밀 필드가 제거된 MCP token index 2개, 과거 pending crew event 1개다.
- 이전 후 134개를 모두 재조회해 본문 SHA-256과 원본 R2 ETag를 대조했다.
- 계정 객체 5개와 identity 매핑 6개를 확인했으며, 끊어진 identity 매핑은 0개다.
- 원본 R2에는 쓰기·삭제·이동을 하지 않았다. 원본이 계속 변경된다면 운영 전환 직전에 소유자 계정에서 delta export를 다시 받아 대조해야 한다.

### 검증 기록

- Node 22.23.4 `node --test tests/*.test.mjs`: 95/95 PASS
- Node 22.23.4 build와 artifact validate: PASS
- Node 22.23.4 `vercel build --target=preview`: PASS
- 실제 Vercel 함수 번들의 `jwks-rsa` 하위 `jose@4.15.9` 확인: PASS
- 격리 Python 환경(실제 `collector/requirements.txt`) Collector 테스트: 65/65 PASS
- Discord Python 테스트: 18/18 PASS
- Firebase Firestore 규칙 컴파일·배포: PASS
- `git diff --check`: PASS
- 스테이징 비밀정보 검사: PASS
- GitHub Actions PR #33: Node·수집기 Python·Discord Python 테스트·빌드·산출물 검증 PASS
- `npm audit --omit=dev`: critical 0, high 4, moderate 6
  - high 4개는 `@vercel/functions`의 사용하지 않는 OIDC/CLI 하위 경로에서 확인됐다.
  - 감사 대상 `zod`, `glob`, `minimatch`는 실제 Vercel 서버리스 함수 번들에 포함되지 않음을 확인했다.
  - 운영 전환 직전에 패치 가능 버전을 다시 확인한다.

### 2026-11-02 신규 Preview 결과

- 배포 ID: `dpl_BdmxWPJx1pkMWUTrhbxgms6b6xkf`
- Preview: `https://kongboda-motorsports-3ht01bufc-kinn.vercel.app`
- 소스 커밋: `41e1749`
- 상태: `READY`, 함수 번들 5.6MB, Node 22 계약 적용
- Vercel 보호 우회 실제 요청: `/` 200, `/auth/google/start` 200, `/mcp` 401, `/api/mcp` 401
- 외부 비로그인 요청: Deployment Protection으로 302
- 배포 후 5xx 로그 0건, error 로그 0건
- 홈 문서 제목과 Google 로그인 화면 마커 확인 완료

### 2026-11-02 Firebase 서비스 계정 적용 결과

- 다운로드한 서비스 계정 JSON의 프로젝트 ID와 필수 키 구조를 값 노출 없이 검증했다.
- 로컬 파일 권한을 소유자 전용 `600`으로 제한했다.
- `FIREBASE_SERVICE_ACCOUNT_JSON`을 Vercel `sensitive` 변수로 Preview·Production에 함께 등록했다.
- 서비스 계정 적용 후 Preview `dpl_G3fYKwpk3fEkJvYWL29UiAt9gKA4`를 새로 생성했다.
- Preview: `https://kongboda-motorsports-h3vxsalad-kinn.vercel.app`
- 상태: `READY`; `/`·`/auth/google/start` 200, `/mcp`·`/api/mcp` 401, 5xx 로그 0건.
- Firebase Admin Auth 읽기와 Firestore 읽기를 확인했다. 현재 Auth 사용자와 Firestore 컬렉션은 모두 0건이었다.
- 실제 `createFirestoreBucket` 경로로 임시 객체 쓰기·읽기·목록·삭제를 확인했고, 삭제 후 `objectStore`가 빈 상태임을 재확인했다.
- Google 공급자 `enabled=true`와 운영 도메인 승인을 API로 확인했다.
- 새 Preview 도메인을 기존 승인 목록을 보존한 채 추가하고 적용 결과를 재확인했다.

### 2026-11-02 데이터 이전 반영 Preview 결과

- 배포 ID: `dpl_ABXv4M5HCErEBhC29FMzyRSYDpHK`
- Preview: `https://kongboda-motorsports-o7wbhelqi-kinn.vercel.app`
- 소스 커밋: `085ec3d`
- 상태: `READY`; `/`·`/auth/google/start` 200, `/mcp`·`/api/mcp` 401, 5xx 로그 0건.
- 새 Preview 도메인을 Firebase 승인 목록에 추가하고 재조회로 확인했다.
- F1 순위 API는 현재 HTTP 202 대기 응답이다. Firestore 이전 실패가 아니라 아직 Vercel에 없는 `FASTF1_CLOUD_URL`·`FASTF1_CLOUD_KEY` 등 운영 수집기 설정이 남은 직접적인 배포 차단 요소다.

## 지금 확인된 배포 장애

### P0-1. 공개 Vercel 주소의 기존 HTTP 500 — Preview 수정 검증 완료, 운영 전환 대기

- `https://kongboda-motorsports.vercel.app`는 초기 Production 배포 `dpl_38Fzx74MNUeVSwqerNEQjBVYW973`을 가리킨다.
- 해당 배포는 Vercel 표시상 `Ready`지만 `/`, `/auth/google/start`, `/mcp`, `/api/mcp`가 모두 500이다.
- 2026-11-01 런타임 로그의 직접 원인:
  - `jwks-rsa@4.1.0`의 CommonJS 코드가 ESM 전용 `jose@6.2.14`를 `require()`하여 `ERR_REQUIRE_ESM`으로 함수 시작 전에 종료한다.
- `package.json`과 `pnpm-workspace.yaml` override로 `jwks-rsa` 하위 `jose`를 Firebase Admin이 안내한 호환 버전 `4.15.9`로 고정했다.
- Node 22 테스트·빌드·Vercel 패키징과 실제 함수 번들 버전 확인까지 통과했다.
- 기존 운영 alias는 아직 실패한 이전 배포를 가리키므로, 새 Preview HTTP 확인 전에는 원격 장애가 해소됐다고 표시하지 않는다.

### 해결됨. 후속 Vercel 배포가 `UNKNOWN`

- Preview `dpl_2vUKc1x9vmKGwz1SZtezqxjTTizk`
  - `https://kongboda-motorsports-p1asu0a7x-kinn.vercel.app`
- Production `dpl_B5ofnapZdfWF4uuKpUZNkpuFsCsh`
  - `https://kongboda-motorsports-5grorjw96-kinn.vercel.app`
- 그 밖의 Preview 3개도 `UNKNOWN`이다.
- `vercel inspect`에는 빌드가 `.` 0ms로만 표시되고 유효한 빌드 로그가 없다.
- 원인을 Dashboard의 배포 이벤트·프로젝트 상태·계정 빌드 큐에서 확인한 뒤, 실패 원인을 해결하고 Preview **하나만** 새로 생성한다.
- 2026-11-02 정상 소스 배포 한 건을 새로 생성해 `READY`와 실제 HTTP 응답을 확인했다. 기존 `UNKNOWN` 배포는 삭제하지 않았다.

### P0-3. Node 런타임 설정 불일치 — 코드 계약으로 해소

- `package.json` 계약은 Node `22.x`다.
- Vercel 프로젝트 조회값은 Node `26.x`다.
- Vercel 로컬 빌드가 `package.json`의 `engines.node=22.x`가 프로젝트 설정 26.x를 덮어쓰고 실제 Node 22를 사용한다고 확인했다.
- Dashboard 표시값을 바꾸는 것은 필수 조건이 아니지만, 혼동 방지를 위해 사용자가 원하면 22.x로 정렬할 수 있다.

### P0-4. Vercel 운영 환경 변수 미완성

현재 Vercel에는 다음 공개 Firebase 변수와 Firebase Admin 서비스 계정이 등록돼 있다.

- `FIREBASE_PROJECT_ID`
- `FIREBASE_WEB_API_KEY`
- `FIREBASE_WEB_AUTH_DOMAIN`
- `FIREBASE_WEB_APP_ID`
- `FIREBASE_SERVICE_ACCOUNT_JSON` — Preview·Production, `sensitive`

다음 변수는 기존 Sites 소유 계정에서 원본을 확인한 뒤 Vercel에 이관해야 한다. 값은 문서나 터미널 출력으로 복사하지 않는다. `LIVE_ANALYSIS_KEY_REVISION=1`은 이전된 계정 5개의 revision 분포(1: 3개, 미설정: 2개)를 확인한 뒤 Preview·Production에 등록했다.

| 변수 | 용도 | 배포 전 처리 |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Admin·Firestore·세션 검증 | Preview와 Production에 필수 |
| `DEPLOY_OWNER_EMAIL` | 운영자 판별·선원 관리 | 기존 운영값을 안전하게 이관 |
| `FASTF1_CLOUD_URL` | 기존 Render 수집기 연결 | Preview·Production에서 회귀 검증 |
| `FASTF1_CLOUD_KEY` | 수집기 인증 | 비밀값으로 직접 등록 |
| `LIVE_ANALYSIS_KEY_HASH` | 선원 라이브 접근 확인 | 기존 해시를 안전하게 이관 |
| `LIVE_ANALYSIS_KEY_REVISION` | 선원 키 버전 | Preview·Production 등록 완료 |
| `RAPIDAPI_KEY` | 외부 레이스 API 기능 | 해당 기능을 유지한다면 필수 |

`GOOGLE_CLIENT_ID`와 `GOOGLE_CLIENT_SECRET`은 기존 Sites용 자체 OAuth 경로다. Vercel은 Firebase 인증 경로를 사용하므로 무조건 복사하지 말고, Firebase 경로 검증 후 레거시 OAuth가 실제로 필요한 경우에만 별도 검토한다.

### P0-5. Firebase Console 설정 미완료

1. [완료] Authentication Google 공급자 활성화와 클라이언트 설정을 API로 확인했다.
2. [사용자 완료 보고] 지원 이메일을 선택했다.
3. [완료] Firebase 전용 서비스 계정을 Vercel Preview·Production에 등록했다.
4. [완료] 최신 Preview와 운영 Vercel 도메인을 승인 목록에서 확인했다.
5. 로그인·로그아웃·세션 만료·토큰 철회가 실제 브라우저에서 동작하는지 확인한다.

### P0-6. ChatGPT MCP 운영 구조 확정

- `api/index.js`는 위조 방지를 위해 들어오는 모든 `oai-authenticated-user-*` 헤더를 제거한다.
- Firebase 신원은 웹 경로에서만 사용하며 `/mcp`에서는 의도적으로 사용하지 않는다.
- 따라서 현재 Vercel 어댑터만으로는 공식 ChatGPT 신원을 검증해 `/mcp`에 전달할 방법이 없고, Vercel `/mcp`는 정상 사용자에게도 인증되지 않는다.

운영안은 **웹만 Vercel+Firebase로 이전하고 ChatGPT MCP는 검증된 기존 Sites 주소에 유지**하는 것으로 확정했다. 향후 MCP까지 Vercel로 이전하려면 지원되는 OAuth 2.1 또는 동등한 서버 검증 인증을 별도 설계·구현·호스트 검증해야 한다.

### P0-7. 데이터 이전 완료, cutover delta 확인 필요

- 소유자 계정에서 생성한 검증 export를 받아 영구 객체 134개를 Firestore로 이전했다.
- 전체 147개 중 인증 세션·OAuth flow·복구 불가능한 token index·과거 pending event 13개는 안전상 제외했다.
- 850,000바이트 초과 객체는 없었고, 이전된 모든 객체의 본문 해시와 원본 ETag를 재검증했다.
- export는 원자적 스냅샷이 아니므로 원본 R2에 이후 쓰기가 발생했다면 운영 cutover 직전에 delta export·대조가 필요하다.

### P1. Preview 접근·운영 주소 결정

- 생성된 Vercel Preview/Production 고유 주소는 현재 Deployment Protection 때문에 비로그인 요청이 Vercel 로그인으로 이동한다.
- 테스트 담당자가 Preview를 열 수 있도록 보호 정책 또는 안전한 테스트 방법을 정하되, 운영 주소는 공개 접근 가능해야 한다.
- 최종 웹 주소를 `kongboda-motorsports.vercel.app`으로 쓸지 별도 도메인을 연결할지 결정한다.
- 최종 주소가 정해진 뒤 Firebase 승인 도메인, 앱 링크, 문서, CORS/origin, 모니터링 대상을 같은 값으로 맞춘다.

## 최종 배포 실행 순서

### 1단계 — 장애 수정과 설정 정렬

- [ ] 현재 브랜치와 PR HEAD가 `468eae6`인지 다시 확인한다.
- [ ] 기존 미커밋 사용자 변경을 보존한다.
- [x] Vercel 500의 `jwks-rsa`/`jose` ESM 충돌을 재현하고 최소 수정한다.
- [x] `package.json`의 Node 22 계약이 Vercel 프로젝트 설정을 덮어쓰는지 빌드 로그로 확인한다.
- [ ] `UNKNOWN` 배포의 Dashboard 이벤트와 계정·빌드 큐 원인을 확인한다.
- [x] `npm audit --omit=dev`를 다시 실행하고 신규 안전 패치 가능 여부를 확인한다.
- [x] 수정 후 Node·Python 수집기·Discord 테스트, build, artifact validate, `vercel build --target=preview`, `git diff --check`를 실행한다.
- [ ] 실제 diff에서 인증 우회, 계정 간 데이터 유출, 비밀정보, 불필요한 범위 확대를 독립 검토한다.

**통과 기준:** 로컬과 CI가 모두 PASS이고, 서버 함수가 Vercel 번들에서 시작 가능하다.

### 2단계 — Firebase·Vercel 비밀 설정

- [ ] Firebase Google 로그인 공급자와 지원 이메일을 활성화한다.
- [ ] 서비스 계정 키를 Vercel Preview·Production에 직접 등록한다.
- [ ] 운영 기능 변수 7종의 필요 여부와 기존 값의 출처를 확인해 환경별로 등록한다.
- [ ] 변수 이름과 적용 환경만 확인하고 값은 출력하지 않는다.
- [ ] Preview 및 최종 운영 도메인을 Firebase 승인 도메인에 추가한다.
- [ ] 기존 키의 회전 필요성과 최소 권한을 검토한다.

**통과 기준:** 비밀값 노출 없이 Preview가 Firebase Admin, Firestore, 기존 수집기에 접근할 준비가 된다.

### 3단계 — Preview 한 건 배포

- [x] 원인이 해결된 뒤 새 Preview를 한 번만 배포한다.
- [x] 상태가 `Ready`인지 확인하고 immutable deployment ID와 commit SHA를 기록한다.
- [x] 함수 로그에 `ERR_REQUIRE_ESM`, 자격 증명 오류, 반복 재시작이 없는지 확인한다.
- [x] Vercel 인증 우회 방식으로 Preview 접근을 확보하고, 일반 외부 요청은 Deployment Protection 302임을 확인한다.

**통과 기준:** Preview `/`가 HTTP 200이고 5xx가 발생하지 않는다.

### 4단계 — Preview 실제 기능 검증

| 검증 항목 | 기대 결과 |
|---|---|
| `/`와 정적 자산 | 200, 깨진 자산·혼합 콘텐츠·콘솔 치명 오류 없음 |
| `/auth/google/start` | 200, Firebase Google 로그인 화면 표시 |
| 로그인·로그아웃 | 검증된 이메일만 허용, CSRF·origin 검사, 쿠키 발급·삭제 정상 |
| 세션 만료·철회 | 만료·철회 세션은 익명 처리 또는 재로그인 요구 |
| 계정 설정 | 저장·재조회·수정·삭제·동시성 충돌 처리 정상 |
| Firestore 규칙 | 브라우저 직접 read/write 거부, 서버 Admin 경로만 성공 |
| 위조 헤더 | 외부 `oai-*`, `x-kongboda-*`로 권한 획득 불가 |
| `/api/mcp` | HTTP 401, 범용 외부 MCP 토큰 경로 계속 차단 |
| Vercel `/mcp` | Firebase 웹 로그인만으로 인증되지 않음 |
| 기존 Sites `/mcp` | 권장 안전안 선택 시 ChatGPT에서 정상 연결·도구 호출 |
| 수집기 | 기존 Render 상태, 최신성, 인증 실패 처리 정상 |
| 라이브·기록 | F1/WEC 스냅샷, 최고 랩, 텔레메트리, FIA 조회 회귀 없음 |
| MCP Apps UI | ChatGPT에서 리소스·텍스트 대체 응답·앱 UI 확인 |
| 화면 | 390px·768px·1440px, 가로 넘침·잘림·팝업·계정 화면 확인 |
| 저장 크기 | 실제 객체가 850,000바이트 제한을 넘지 않음 |
| 개인정보 | 계정 간 격리, 회원 목록 최소 정보, 로그에 비밀·개인정보 없음 |

실제 활성 세션이 필요한 라이브 수신과 실제 신규 FIA 문서 알림 지연은 배포 시점에 재현할 수 없으면 **미검증**으로 분리 기록한다. 테스트 통과를 실전 수신 성공으로 표현하지 않는다.

### 5단계 — 데이터·주소·MCP 전환안 확정

- [x] 기존 Sites 데이터를 검증 export하고 영구 객체 134개를 Firestore로 이전했다.
- [x] 초기 운영 웹 도메인은 Vercel 기본 도메인을 사용한다.
- [x] MCP는 기존 Sites에 유지한다.
- [ ] 수집기 callback/origin, Firebase 승인 도메인, 사용자 안내 링크를 최종 주소와 대조한다.
- [ ] 전환 시간, 담당자, 실패 시 복귀 기준을 정한다.

**통과 기준:** 데이터 손실과 인증 단절 없이 어떤 트래픽을 어디로 옮기는지 한 문장으로 설명할 수 있다.

### 6단계 — 승인 후 병합·Production 배포

아래는 사용자의 명시적 승인 후에만 수행한다.

- [ ] Preview 검증 결과와 남은 미검증 항목을 사용자에게 보고한다.
- [ ] PR #33 병합 승인을 받는다.
- [ ] `main` CI 성공과 정확한 merge commit SHA를 확인한다.
- [ ] Production 배포 승인을 별도로 받는다.
- [ ] 검증된 동일 소스를 Production에 배포하고 deployment ID·commit SHA를 기록한다.
- [ ] 운영 alias가 새 정상 배포를 가리키는지 확인한다.
- [ ] Firebase 승인 도메인과 운영 환경 변수가 Production에 적용됐는지 확인한다.
- [ ] 결정된 경우에만 웹 도메인·링크를 전환한다.
- [ ] MCP 안전안에서는 기존 Sites MCP 주소를 그대로 유지한다.

### 7단계 — 배포 직후 확인

- [ ] 운영 `/`·로그인·계정 저장·로그아웃을 다시 확인한다.
- [ ] 익명 `/mcp`, `/api/mcp`, 위조 헤더 거부 경계를 다시 확인한다.
- [ ] 기존 ChatGPT MCP에서 대표 도구 호출과 MCP Apps UI를 확인한다.
- [ ] F1/WEC·FIA·텔레메트리·일정·순위 대표 기능을 확인한다.
- [ ] Vercel 함수 5xx, 인증 실패율, Firestore 오류, 수집기 오류를 집중 관찰한다.
- [ ] PC·모바일 실제 화면을 육안 확인한다.
- [ ] 기존 Sites와 백업은 안정화 확인 전 삭제하지 않는다.

## 롤백 계획

### 롤백 조건

다음 중 하나라도 발생하면 신규 트래픽 전환을 중단하거나 되돌린다.

- 운영 5xx 또는 함수 시작 실패
- 로그인 불가, 세션 고정, CSRF/origin 우회
- 다른 계정 데이터 노출 또는 권한 상승
- Firestore 저장·조회·삭제 불일치 또는 데이터 손실
- 공식 ChatGPT MCP 연결·도구·Apps UI 실패
- 기존 수집기 라이브 기능의 중대한 회귀
- 비밀정보나 개인정보의 로그 노출

### 복구 방법

- 전환 전에는 기존 ChatGPT Site와 MCP를 계속 운영하므로 신규 Vercel을 공개하지 않고 원인 수정으로 돌아간다.
- 전환 후 웹 장애 시 운영 alias·도메인을 직전 검증 배포로 되돌린다. 현재는 정상 Vercel 운영 배포가 아직 없으므로 최초 전환 전 반드시 정상 rollback 후보를 만든다.
- MCP는 별도 인증이 검증되기 전 기존 Sites 주소를 유지한다.
- Firestore 규칙과 데이터는 롤백 중 삭제하지 않는다. 쓰기를 중단하고 스냅샷·로그를 보존한다.
- Git 코드는 `backup/pre-vercel-firebase-20261101`과 로컬 bundle로 복구할 수 있다.

## 배포 완료 기준

다음이 전부 충족돼야 `최종 배포 완료`로 표시한다.

- [ ] Vercel Runtime Node 22.x와 의존성 호환 확인
- [ ] Preview와 Production 모두 `Ready`, `/` HTTP 200, 5xx 없음
- [ ] Firebase Google 로그인·로그아웃·세션 검증 PASS
- [x] Firestore 저장·조회·삭제와 이전 객체 전수 무결성 PASS
- [ ] 운영 기능 환경 변수의 이름·범위·회전 정책 확인
- [ ] 수집기·라이브·FIA/WEC·텔레메트리 회귀 검증 PASS
- [ ] `/api/mcp`와 위조 헤더 차단 PASS
- [x] ChatGPT MCP 운영 위치를 기존 Sites로 확정하고 연결 호출 PASS
- [ ] PC·태블릿·모바일 육안 검토 PASS
- [x] 기존 Sites 영구 데이터 134개 이전 이행
- [ ] 비밀정보·개인정보·의존성 최종 검토 PASS
- [ ] PR 병합·Production 배포·트래픽 전환 각각 사용자 승인 확보
- [ ] 정상 rollback 후보와 복귀 절차 확인
- [ ] 배포 commit SHA·deployment ID·검증 결과 기록

## 다음 세션 첫 실행 순서

1. `AGENTS.md`, 이 문서, `notes/progress.md`, `docs/vercel-firebase-migration.md`를 읽는다.
2. `git status --short --branch`, `gh pr view 33`, `gh pr checks 33`, `vercel ls kongboda-motorsports`로 상태를 새로 확인한다.
3. Preview `dpl_ABXv4M5HCErEBhC29FMzyRSYDpHK`와 Firebase Admin 환경을 확인한다.
4. Preview에서 실제 Google 로그인·기존 계정 연결·계정 격리·로그아웃을 확인한다.
5. 운영 비밀 6종을 원본 소유자에게 받아 값 노출 없이 Vercel에 등록한다.
6. 원본 R2가 export 후 변경됐는지 확인하고, 변경됐다면 cutover delta를 재이관한다.
7. MCP는 기존 Sites에 유지하고, 사용자 승인 후 초기 운영 주소 `kongboda-motorsports.vercel.app`으로 전환한다.

## 참고 파일

- `api/index.js`
- `server/firebase-admin.js`
- `server/firestore-bucket.js`
- `scripts/import-r2-export-to-firestore.mjs`
- `worker/accounts.js`
- `worker/index.js`
- `worker/live.js`
- `vercel.json`
- `firebase.json`
- `firestore.rules`
- `.env.example`
- `.github/DEPLOYMENT.md`
- `docs/vercel-firebase-migration.md`
- `notes/progress.md`

## 중단 조건

- 인증 공급자 권한이나 약관을 우회해야 하는 경우
- 비밀번호·토큰·서비스 계정 키를 코드·로그·문서에 남겨야 하는 경우
- 기존 사용자 변경 또는 데이터를 덮어써야 하는 경우
- 실제 데이터가 없는데 성공으로 표시해야 하는 경우
- 데이터 이전, MCP 인증, 최종 도메인처럼 사용자 판단이 필요한 항목을 임의 결정해야 하는 경우
- PR 병합, 운영 배포, DNS·주소 전환, 기존 서비스 종료처럼 별도 승인이 필요한 외부 변경에 도달한 경우

이 조건에서는 범위를 확대하지 말고, 확인된 영향·복구 방법·필요한 결정을 사용자에게 보고한다.
