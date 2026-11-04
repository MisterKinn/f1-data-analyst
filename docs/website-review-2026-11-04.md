# Kongboda Motorsports 수정·검증 보고서

작성일: 2026-11-04 (한국시간)  
상태: **최종 로컬 검증 통과. GitHub 반영 여부는 이 문서를 포함한 커밋·PR 이력으로 확인. 운영 배포 성공 여부는 별도로 검증하지 않았다. Vercel 설정·배포를 직접 변경하지 않음.**

## 1. 기준과 확인 범위

- 운영 사이트: https://kongboda-motorsports.vercel.app/
- 정식 저장소: MisterKinn/f1-data-analyst
- 인수인계 기준 커밋: `3d417ba92fa875ebf14130330f7c7c7f93f9b72f`
- 이전 대화: `01a1a343-bfab-7032-a20e-3727b7e184bb`
- 사용한 원본: 사용자가 첨부한 `TalkFile_kongboda-handoff.zip.zip`. 내부 handoff-state.json, source ZIP, 기존 patch, 한국어/영어 프리뷰 34개, before/final 검사 기록을 읽었다.
- 원격 main을 실제 조회하여 인수인계 기준 커밋과 동일함을 확인했다. 기존 GitHub 연결의 push 권한도 확인했다. 업로드 직전 기대 SHA를 지정해 다른 변경을 덮어쓰지 않는다. 운영 설정은 변경하지 않는다.
- 기존 146개 테스트와 Lighthouse 수치는 인수인계 기록이다. 현재 수정본은 별도의 테스트·실제 Chromium 화면 검사로 다시 확인했다. Lighthouse는 이번에 재실행하지 않았다.

## 2. 이번에 재현하거나 코드로 확인하여 수정한 문제

| ID | 문제와 확인 근거 | 수정 | 확인 방식 |
|---|---|---|---|
| UI-01 | 고정 여백과 큰 제목이 폭 경계에서 갑자기 바뀌고, 중간 PC 폭에서 메뉴 공간이 부족해질 구조 | clamp 기반 글자·여백·간격, 중간 PC 폭 2행 헤더, 작은 폭의 자연스러운 버튼 적층 | 320–1920px 경계 폭 및 한국어/영어 화면 |
| UI-02 | viewport만 보고 라이브 예시를 2열로 만들어 좁은 실제 카드 폭에 과도하게 밀집할 수 있음 | 예시 컨테이너 실제 폭 860px 이상에서 2열, 그 미만은 1열 | 창 크기 연속 변경 및 두 분석 모드 |
| UI-03 | ResizeObserver가 높이 변경에도 모든 그래프를 다시 그리고 전체 카드를 측정 | 폭 변경만 처리, 프레임당 1회 처리, resize 종료 120ms 후 공유 높이 측정, 보이는 카드의 그래프만 그림 | 정지 후 SVG DOM 변경 0, 높이만 바꾼 경우 redraw 0 |
| UI-04 | 폭이 줄 때 과거 PC 높이가 새로 줄바꿈한 내용에 남을 가능성 | resize 중 높이 auto, 종료 후 모드별 최대 높이 +24px; 모바일은 자연 높이 | 카드 20개를 PC·모바일에서 순회, 내용 높이·공유 높이 검사 |
| UI-05 | 메뉴 열림 상태와 포커스가 PC/모바일 경계를 넘을 때 부자연스러움 | 경계 변경 시 접기·inert 동기화, 숨겨질 메뉴 내부 포커스 이동, Escape 닫기 | 실제 키보드 및 viewport 변경 |
| UI-06 | reduced-motion에서도 JS 카드 페이드가 실행됨 | reduced-motion에서 카드 animation을 시작하지 않고 실행 중 모션도 중지 | OS 설정 에뮬레이션과 실행 animation 수 검사 |
| UI-07 | 긴 표 셀·섹터 수치·그리드 자식의 최소 폭이 작은 화면을 압박 | min-width:0, 표 셀 줄바꿈, 폭 고정 표, 최소 섹터 폭 제거; 전체 페이지 overflow를 감춰 해결하지 않음 | document scrollWidth와 viewport 비교 |
| DATA-01 | calendar/standings/results의 브라우저 요청에 종료 기한이 없어 body 응답이 멈추면 무한 대기 가능 | body JSON 파싱까지 포함한 취소·timeout helper. 달력 15초, 순위 25초 이내 요청과 전체 준비 대기 100초, 결과 45초 | 응답 header 후 body 정지·사용자 취소 단위 테스트 |
| DATA-02 | 첫 달력 요청 실패 시 새로고침 이외의 복구가 없음 | 같은 페이지 안에서 재시도 버튼 제공 | 503→정상 응답 모의 브라우저 검사 |
| DATA-03 | standings background 갱신도 표를 먼저 지워 실패하면 이전 정보까지 사라짐 | 이전 표 유지, 실패 문구와 재시도 표시, 60초 재확인; 새 category 직접 선택은 별도 로딩 | 정상 표→갱신 503 모의 검사 |
| DATA-04 | background 달력 실패에서 기존 자료를 최신처럼 오해할 가능성 | 이전 조회 일정임을 명시, 재확인 간격 유지 | 실제 스크립트와 모의 API 검사 |
| ACCOUNT-01 | F1·WEC 선호 목록을 Promise.all로 묶어 WEC 하나 실패해도 F1 편집까지 막힘 | 목록별 결과를 독립 처리, 저장된 팀·드라이버·제조사는 옵션에 유지, 실패한 목록만 재시도 안내 | 가짜 로그인 프로필과 WEC 503을 이용한 브라우저 검사 |
| ACCOUNT-02 | Vercel 탈퇴 응답이 과거 Sites 로그아웃 주소로 향하고 Firebase cookie를 지우지 않음 | Firebase 사이트는 /account?deleted=1로 이동하고 현재 Firebase/CSRF cookie 만료; 기존 Google 경로도 유지 | 현재 Vercel origin을 사용한 탈퇴 단위 테스트 |
| ACCOUNT-03 | 두 최초 로그인이 같은 provider identity를 동시에 못 찾으면 계정 2개가 생길 수 있음 | provider identity를 조건부 원자 생성으로 선점, 패배한 임시 계정 정리 후 승자 재사용 | 두 요청을 동일 지점에서 동기화한 모의 저장소 검사: 2개→1개 |
| ACCOUNT-04 | 탈퇴 후 OAuth access helper가 기존 token을 인정하고 refresh가 200으로 갱신됨 | 계정 tombstone과 OAuth grant generation을 검사. 탈퇴 시 해당 Google identity의 generation을 갱신해 기존 code/access/refresh를 무효화; 재가입해도 과거 grant는 복구되지 않음 | 탈퇴 전/후 진단 JSON, 실제 bearer/refresh 함수, 재가입 generation 테스트 |
| ACCOUNT-05 | OAuth 동의 문구가 read-only라고 하면서 개인 설정 저장도 허용한다고 설명 | 동의문에서 오해를 만드는 read-only 표현 제거. 기존 scope·crew 정책은 유지 | 소스 검토 및 기존 OAuth 흐름 회귀 테스트 |
| PREVIEW-01 | inherited export 코드의 String.replace 치환문에 들어간 $&가 </body>로 바뀌어 정규식/script를 손상 | 치환 문자열 대신 함수 반환으로 script 삽입. 각 asset의 helper도 IIFE로 격리 | 생성된 한국어/영어 HTML의 실제 inline JS 파싱과 브라우저 실행 |

| UI-08 | 시작 메뉴와 홈 버튼이 중복되고 분석 예시 버튼이 근거리 스크롤만 함 | 시작 메뉴·분석 예시 버튼 제거. 익명 홈은 Google 로그인, 로그인한 홈은 계정 설정 | 익명·인증·탈퇴 상태 HTML 검사 및 실제 생성 프리뷰 |
| UI-09 | 연결 주소 복사에 로그인 조건이 없음 | 익명·탈퇴 계정에는 Google 로그인 링크, 검증된 로그인에만 주소 복사 버튼 제공. 질문 복사는 공개 유지 | 홈·가이드 인증 상태 검사. 주소 자체를 비밀로 취급하지 않음 |
| UI-10 | 라이트 모드 부재 | 기본 시스템, 라이트·다크 선택과 기기별 저장, 시스템 변경 추적, 스크립트 차단 시 OS 색상 대응 | 24개 테마·복사·홈 검사; 주요 텍스트 및 기본 버튼 대비 4.5 이상 |
| DATA-05 | 배포된 일정 스냅샷을 재조회하는 것만으로는 자동 갱신되지 않음 | 고정 허용 출처만 읽는 일정 갱신 경로, JSON-LD/ICS·FastF1 스케줄 파서, 페이지 열 때 및 매일 06시 KST workflow 검사 | 파서·영구 저장·오류·24시간 만료 테스트. 각 실제 주최 측의 현재 구조와 운영 실행은 별도 미검증 |
| DATA-06 | 순위 stale 최대 7일, 결과 캐시는 인스턴스 내부만 공유 | 순위·일정·결과 24시간 한도, 마지막 확인 시각 유지, 경고 표시. 결과는 영구 저장소를 통한 공유 캐시 사용 | 다른 worker 인스턴스 재조회 및 정확히 24시간 경계 테스트. 브라우저의 장시간 실패 시 표 제거도 검사 |
| ACCOUNT-06 | 계정 연결·해제·선호 저장 중 여러 문서의 중간 상태 위험 | Firestore transaction으로 전체 연산 묶음. 쓰기를 마지막에 적용하여 read-before-write 준수 | 실제 어댑터를 이용한 동시 저장·rollback·조건부 저장 검사 |
| ACCOUNT-07 | 모든 기기 로그아웃 기능 없음 | 기존 기기 로그아웃과 별도로 Firebase refresh/session 폐기, 본인 OAuth grant generation 무효화 | 본인 uid만 revoke, Origin 거부, 쿠키 만료 테스트. 선원 권한은 유지 |

화면 테스트 도중 검사 환경에 한국어 글꼴이 없어서 글자가 네모로 보인 현상도 발견했다. 검사 환경에 무료 Noto 한국어 fallback을 준비한 후 다시 확인했다. 웹사이트 소스에 유료 글꼴이나 외부 글꼴 추적 요청을 추가한 것이 아니다. 실제 iPhone과 Windows의 native fallback 글꼴 차이는 남아 있다.

## 3. 인수인계 수정 사항의 유지·재검증

| 기존 수정 | 현재 상태·검증 범위 |
|---|---|
| 대회·팀 로고를 이름·색상으로 교체 | 공개 페이지/asset 테스트 유지. 상표 사용에 대한 법률 판단을 완료했다는 뜻은 아님 |
| 시작 버튼, 연결 안내, 질문 복사 | 실제 HTML에서 동작 확인. clipboard 권한은 브라우저/실행 문맥에 따라 달라짐 |
| 현재 라이브와 분석 예시 구분 | 예시 재구성·현재 라이브 아님 표시 유지. English UI의 기록 예시는 lang=ko로 구분 |
| 이름 손상 번역 수정 | 보호된 계정 이름과 기록명 테스트 통과. 전체 내용을 단어별 영문화하지 않음 |
| 일정만으로 LIVE 판단하는 표현 수정 | 일정 상태와 실제 feed 상태를 구분하는 테스트 유지 |
| 모바일 overflow·키보드·출처 크기 | 새 반응형 검사와 기존 회귀 테스트 통과 |
| 페이지 metadata, canonical, robots, sitemap, 404 | 기존 metadata·route 테스트 통과. production에 반영된 상태는 아님 |
| 초기 새로고침 제거, 예시 분리 로딩 | 기존 관련 테스트 유지. 프리뷰는 offline 리뷰를 위해 asset을 inline함 |

## 4. Firecrawl 운영 사이트 검사

사용자가 “crawl 돌리라고”라고 명시한 후 시작했다. 로그인·개인 계정·OAuth·API·MCP·display 경로는 crawl 대상에서 제외했다.

- Job ID: `01a1a391-9aa3-7729-aa79-d61d610f47fa`
- 상태: completed, 5/5 페이지
- 실제 페이지: `/`, `/about`, `/guide`, `/resources`, `/championships/f1`
- 페이지 응답: 모두 HTTP 200
- Job 보고 크레딧: **5**
- 조회 전 잔액: 1,025. 직후 잔액 API도 1,025를 반환했다. 반영 지연 또는 집계 차이를 확인하지 못했으므로 잔액을 임의로 1,020으로 계산해 확정하지 않았다.
- 원문 발췌/metadata: `verification/firecrawl-public-crawl.json`

| 운영 사이트에서 확인한 내용 | 판정 | 로컬 수정본과의 관계 |
|---|---|---|
| English 페이지 본문에 한국어 안내와 `Teams메이트`, `after` 등이 섞인 문장 | 실제 추출 결과에서 확인된 번역 품질 문제 | 로컬은 무분별한 단어 번역을 제거하고 기록 예시를 한국어로 명시; UI 문자열은 별도 처리 |
| 대회·팀의 /assets/*official 및 /assets/team/* 이미지 요청 | 실제 asset 사용 확인 | 로컬에서는 이름·색상으로 교체됨 |
| 홈 예시에 ‘현재 라이브 아님’ 구분이 새 로컬본처럼 명확하지 않음 | 운영/로컬 차이 | 로컬 disclaimer 유지 |
| 미래 대회들도 추출 내용에 LIVE와 ‘scheduled’ 설명으로 포함 | **기계 추출에서 확인된 의미 혼선**. hidden DOM까지 추출되므로 실제 화면에 보인다고 단정하지 않음 | 로컬은 일정 상태와 live feed를 구분하고 검증된 배지 규칙 유지 |
| metadata의 description이 일반 문구·혼합 언어로 관측됨 | crawler metadata에서 확인 | 로컬 page별 metadata 테스트 통과. processed HTML이 head 전체를 제공하지 않으므로 canonical/robots 누락을 이 crawl만으로 단정하지 않음 |
| F1 결과·순위 table과 provider/retrieved 시각이 추출됨 | 공개 데이터 표시가 존재함은 확인 | 실제 upstream 최신성·연속 갱신·장애 복구 완료의 증거는 아님 |
| 숨겨진 분석 카드와 접힌 표 행도 markdown에 포함됨 | crawler 추출 특성 | 시각적 clipping·모든 카드를 동시에 보여주는 UI 문제라는 근거로 쓰지 않음 |

이 crawl은 **아직 배포하지 않은 로컬 수정본의 검사 결과가 아니다**. 숨겨진 내용, SVG 그래프와 반응형 배치는 crawl 텍스트만으로 판단하지 않았다. Firecrawl Agent·대규모 전체 사이트 crawl·추가 유료 provider는 실행하지 않았다.

## 5. 자동 경고의 전체 분류

원본 ZIP의 일반 검사 14개(7개 route × PC/모바일)를 모두 읽었다. 아래 횟수는 **해당 과거 검사 기록의 검출 수**이며 현재 남은 결함 개수도, 사용자 수 영향도도 아니다.

| 경고 종류 | before | inherited final | 분류·처리 |
|---|---:|---:|---|
| ai-color-palette | 562 | 574 | 디자인 제안. 의도적으로 유지한 dark/mint 브랜드를 결함으로 집계하지 않음 |
| line-length | 12 | 0 | 기존 수정에서 해결된 가독성 문제. paragraph 폭 제한 유지 |
| layout-transition | 14 | 14 | max-height/padding-top 전환 규칙에 대한 경고. 이번에는 죽은 선언까지 제거했고 최종 소스 detector는 빈 배열 |
| edge-flush-cards | 6 | 6 | 수평 달력의 scroll container 경계에 대한 경고. 페이지 가로 넘침과 구분. 내부 여백·조작 버튼과 실제 scrollWidth를 검사 |
| pulsing-dot | 6 | 0 | 기존 수정에서 무한 점멸 제거. 이번 reduced-motion도 보강 |
| body-text-viewport-edge | 23 | 23 | offscreen carousel 카드까지 viewport 기준으로 계산한 경고. 전체 document overflow와 구분. 이번 viewport 검사에서 실제 페이지 overflow 없음 |
| tiny-text | 14 | 14 | 기존 11px metadata 경고. standings 보조 글씨·track map caption을 12px 이상으로 조정. 이 표의 과거 수치를 새 runtime detector 결과인 것처럼 바꾸지 않음 |
| low-contrast | 0 | 2 | 준비 중인 비활성 Google 버튼의 opacity stack. 비활성 control의 AA contrast 제외 조건을 무시한 자동 판정이므로 활성 본문 실패와 구분. 읽기 편의 개선 제안은 가능 |

원본 경고 637건→633건이라는 숫자를 품질 점수로 사용하지 않는다. palette 경고가 대부분이며 중복·비활성·offscreen 요소가 섞여 있다. 세부 항목은 `audit/audit-before`, `audit/audit-final`에 보존했다. `audit/warning-classification.json`은 개별 경고별 분류를 제공한다.

## 6. 데이터 수신 방식과 실패 처리

| 대상 | 최종 구현 | 확인 범위와 한계 |
|---|---|---|
| 일정 | BUCKET에 마지막 검증 결과 저장. 페이지 열 때 6시간 TTL에 따라 background 재확인, 매일 06시 KST GitHub workflow. 출처별 성공·실패·검증 시각 분리 | F1은 FastF1 schedule backend이며 FIA 직접 피드라고 표시하지 않음. 다른 대회는 고정 주최 측 주소의 구조화 자료만 파싱. 자료가 없거나 파싱 실패하면 검증 시각을 갱신하지 않음 |
| 일정 시간 | 시간대가 확실한 시각만 사용. 단순 Event 시작을 레이스 시작으로 만들지 않음. 날짜 변경 시 과거 세션 시각 제거 | UTC/명시 offset 없는 ICS 시간은 추측하지 않고 거부. 파서가 읽지 못하는 공식 출처는 실패 상태로 남고 24시간 이후 기존 일정 숨김 |
| 순위 | 5분 TTL, 영구 저장소 fallback. 오래된 값은 경고와 기존 조회 시각 표시, 24시간 이후 실패 시 제공 중단 | 최초 WEC 조회 지연·공식 문서 공개 시차가 있을 수 있음. upstream의 정확한 개정 시점과 반영 지연 전수 측정은 하지 않음 |
| 결과·타이어 | 인스턴스 요청 합치기 + 영구 공유 캐시, 24시간 한도. classification과 tyre archive 출처 구분 | 타이어 archive 미공개·불완전은 unavailable/partial 유지. 공식 결과가 있다는 이유로 타이어까지 완전하다고 표현하지 않음 |
| live | 기존 개인 수집기·공용 수집기 분리 유지 | 이번 코드 검증은 실제 활성 세션 수신·queue·latency 검증이 아님. 중단된 수집기 서비스를 재시작하지 않음 |

일정 workflow는 HTTP 200만으로 성공 처리하지 않고 출처별 마지막 검증 시각과 오류를 확인한다. upstream이 구조화 자료를 제공하지 않거나 차단하면 작업은 실패로 기록된다. **모든 대회 공식 사이트의 실제 최신 데이터 수집이 성공했다고 주장하지 않는다.** 기존 정적 일정을 읽었다는 이유로 검증 시각을 새로 찍지도 않는다. 실제 출처별 성공 여부는 배포된 환경에서 별도 확인해야 하며 이번 GitHub 업로드 요청으로 Vercel을 직접 조작하지 않는다.

## 7. 계정·권한 검토

- Firebase Google provider·verified email·최근 인증·세션 폐기 검증과 쿠키·CSRF·Origin 보호 유지.
- 계정 생성·자동 연결·연결 해제·선호 저장은 Firestore 다중 문서 transaction에 포함. 실패 시 중간 결과를 저장하지 않으며 다른 선호 필드와 선원 권한을 보존한다.
- 탈퇴 시 tombstone과 Google identity별 OAuth generation으로 기존 code/access/refresh 사용 차단. 재가입해도 과거 grant가 복구되지 않는다.
- 기본 로그아웃은 현재 기기, 추가 버튼은 이 서비스의 모든 Google 세션과 해당 사용자 OAuth 연결을 무효화한다. Google 계정 자체나 ChatGPT 호스트 로그인 전체를 종료한다는 뜻이 아니다.
- 외부 신원 헤더 제거, OAuth PKCE·일회 code·refresh rotation·redirect 검사·계정 격리 유지. 동의 문구의 오해를 줄였으며 기존 scope 이름을 임의로 migration하지 않았다.
- **선원 등록·비밀키/revision 검증·선원 이름 목록·운영자 공용 수집기 사용 허가를 별도 정책으로 보존했다.**
- 실제 Google 브라우저 로그인, 두 실제 기기 강제 로그아웃, 실제 계정 탈퇴, Firestore IAM·규칙·운영 로그 전수 검증은 미수행. 모의 계정 테스트를 운영 검증 또는 보안 인증으로 표현하지 않는다.

## 8. 검증과 증거 파일

- Node **22.23.4**, 현재 단위/회귀 테스트 **162/162개 통과**, 실패 0. 원문: `verification/node-tests-latest.log`.
- build 및 artifact 검증 통과: `verification/build-latest.log`.
- Python collector **80/80**, Discord **29/29** 회귀 테스트 통과. 수집기·봇을 시작한 것이 아님.
- 테마·시스템 변경·기기 저장·홈 진입 검사 **24/24** 통과. `verification/appearance-results.json`.
- 실제 worker 코드에서 한국어/영어 **34개 독립 HTML 프리뷰**를 다시 생성.
- 공개 34페이지를 390px와 1280px에서 확인하고 홈 두 언어는 320, 360, 390, 500, 700, 701, 800, 801, 860, 999, 1000, 1100, 1101, 1280, 1440, 1920px 및 복귀 순서로 검사.
- Chromium 검사: 페이지 폭 측정 **102회**, 카드/메뉴/동작을 포함한 **193개 check**. 최종 JSON의 failed 배열 참조.
- 모의 public API 및 가짜 계정 목록 검사: **10개 check**. 이 fixture는 실제 로그인 계정이나 실제 공식 결과를 대신하지 않음.
- 카드 20개 PC/모바일 순회, desktop 공유 높이, 내용 clipping, 탭/화살표, Escape, inert, reduced-motion, idle/height-only redraw를 확인.
- 기존 Lighthouse PC 99/100/100/100, 모바일 100/100/100/100은 **이전 로컬 단일 측정**. 이번 최종 수정본·운영 사이트 성능으로 재표기하지 않음.
- 실제 iPhone Safari·Android·Firefox·Edge, 200% zoom/스크린리더 전수, 실제 clipboard 권한, live session 수신은 미검증.
- source detector 재확인: `audit/resize-detector-final.json` 빈 배열. 정적 pattern detector이며 accessibility 전체 인증이 아님.

### GitHub CI에서 추가 확인한 날짜 경계

CI가 한국시간 11월 4일에 실행되면서 스냅샷의 24시간 한도가 지나 기존 일정 테스트가 실패했다. 프로덕션의 만료 조건은 유지하고, 스냅샷 내용 테스트의 시계를 해당 검증일로 고정했다. 정확히 24시간에 자료를 숨기는 별도 회귀 검사는 유지한다. 오프라인 프리뷰는 날짜가 표시된 소스 스냅샷을 명시적으로 읽어, 프리뷰를 여는 날짜 때문에 검토 자료가 사라지지 않게 수정했다.

## 9. 보존과 전달

원격 기준 tree와 실제 파일의 Git blob 해시를 비교해 줄바꿈만 다른 파일은 업로드에서 제외한다. collector 전체·crew/live 정책·Firebase 설정·환경 변수·연결 설정·기존 배포 workflow를 보존한다. API adapter와 Firestore adapter는 이번 로그아웃/transaction 구현 때문에 의도적으로 변경했다. 이를 변경하지 않았다고 보고하지 않는다.

- `source/`: 실제 최종 코드. 의존성·빌드 산출물은 업로드 및 ZIP에서 제외.
- `inherited-review.patch`: 사용자 제공 패치.
- `preview-updated/`: 수정 코드에서 다시 생성한 한국어/영어 독립 HTML 34개. 로그인·실시간 데이터는 offline preview에서 실행하지 않음.
- `review-index.html`: 중첩 iframe을 사용하지 않는 프리뷰 링크 모음. 과거 앱 차단 화면을 실제 홈페이지 장애로 분류하지 않음.
- `verification/`: 테스트·반응형·테마·모의 API 증거. 과거 검사와 최종 검사 파일을 구분.
- `release-state.json`: 작업 산출물에 기록한 GitHub 업로드 결과, commit SHA, 검증 상태. GitHub 업로드를 Vercel 배포 성공으로 표현하지 않는다.

필수 추가 디자인 선택은 없다. 기존 mint/charcoal은 유지하고 라이트에는 off-white/진한 teal을 적용했다. 이전 보고서의 ‘추가 시안이나 대규모 재설계 없음’은 기존 색상이 부적절하다는 판단이 아니었다.
