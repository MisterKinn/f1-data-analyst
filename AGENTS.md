# Shared F1 plugin source

When a user asks to change this plugin, edit this repository and commit the requested changes to an authorized branch using their connected GitHub account. The canonical repository is MisterKinn/f1-data-analyst. Test changes before committing. A merged PR or a direct main commit triggers tests and build validation in .github/workflows/deploy.yml for every authorized contributor. Vercel automatically deploys main to the existing kinn/kongboda-motorsports Production project. ChatGPT Sites publication remains separate and manual; publish the existing shared Site only when the user authorizes that deployment.

Use one shared Site and MCP endpoint for all viewers: project appgprj_6ac9b61074d881918c9b068b03ff6c29, https://kongboda-motorsports.nuttycabin128.chatgpt.site/mcp. Do not make per-user copies. Do not change access, credentials, storage bindings, or live collector infrastructure as part of a source edit. Being a Site viewer does not grant repository edit permission.

Normal ChatGPT editing must write to GitHub; it must not independently publish a divergent Sites-only source. If GitHub access is missing, explain the missing repository permission and do not claim deployment. Vercel's native Git integration handles Production deployment from main; verify the resulting deployment and public URL after a release. ChatGPT Sites deployment notifications and the owner event subscription remain disabled. For an explicitly requested Sites release, verify the exact GitHub source and passing checks, then use the existing shared Sites publication workflow; see .github/DEPLOYMENT.md. Never restore periodic repository polling.


## All-championship product principle

Read and preserve docs/answer-principles.md for all answer, demo and tool changes. The core value is: 눈으로 읽기 어려운 복잡한 기록들을 알기 쉽게 시각화하고 설명한다. Prefer regulations, decisions and timing databases to podium-only or generic analysis. Keep the runtime ANSWER_POLICY synchronized with that document.


## Stable auto-rotating example cards

On desktop, the “이렇게 물어보세요” card must keep the same outer width and height across every automatic slide transition. Measure all examples to choose a shared desktop height with 24px of breathing room after balancing complete supplementary evidence blocks into unused left-column space. Keep answers and charts fully visible without internal scroll containers. Omit the evidence panel from homepage examples; retain official source links and essential qualifications in the answer/chart caption. Recalculate the shared height after fonts load and viewport resize; automatic transitions must not change height.

The actual service goal is to find hard-to-locate, difficult-to-understand information and explain it clearly. Charts are a means, not the goal. Prefer short verified regulation excerpts with edition/article/page and labelled translations for rule questions; never chart trivial counts merely to add a visualization.

## FIA·피렐리·F1 공식 문서 알림 지침

Kongboda Motorsports 사이트와 MCP의 문서 알림 기능을 개발·수정할 때 다음 범위를 따른다. 모든 공식 문서를 무차별적으로 알리지 않고, 경기 이해·전략·결과에 의미 있는 자료를 선별한다. 이 지침을 저장했다는 사실만으로 수집기·스케줄러·알림 전송 기능이 구현되거나 가동 중이라고 주장하지 않는다.

- 트랙 노면 재포장·보수 및 레이아웃·연석·런오프 등 중요한 변경 사항.
- 레이스 디렉터의 핵심 지시: 트랙 리밋, 코스 재진입, 피트 진입·출구, 세션 운영 및 경기·안전에 실질적인 영향을 주는 변경.
- 부품 교체에 따른 페널티 및 출발 위치 변경. 실제 부품 사용·교체 문서, 적용 규정과 공식 결정문을 확인하고, 사용 개수만으로 확정 페널티를 단정하지 않는다.
- 팀별 업그레이드와 공식 차량 기술 변경 자료. 단순 Car Display Procedure 공지는 실제 업그레이드 목록으로 취급하지 않는다.
- 파워유닛 관련 문서: 구성품 사용·교체 현황, 사용 한도, 기술·운영 조건 및 에너지·출력 제한. Power Unit Information 같은 제목만 보고 부품 사용량 문서로 분류하지 말고 본문으로 구분한다.
- 피렐리의 트랙·타이어 정보와 예상 전략. 컴파운드, 압력·캠버 제한, 노면·하중·열화 특성, 예상 피트스톱과 전략 조건 중 공식 자료로 확인되는 핵심을 전달한다.
- F1 공식 예상 전략 분석 및 STRATEGY GUIDE는 해당 경기의 공식 링크를 제공한다. 로그인이 필요한 경우 이를 표시하여 사용자가 직접 열도록 하며, 로그인 뒤 본문을 읽지 못했다면 읽었다고 주장하거나 내용을 추정해 요약하지 않는다.
- 결과를 바꿀 수 있는 스튜어드 페널티·실격·시간 가산·그리드 강등·재심·항소 및 관련 수정 분류. 조사 개시, 잠정 결과와 확정 결정을 구분한다.
- 위 항목과 직접 관련되어 경기·전략·결과에 중대한 영향을 주는 추가 공식 문서는 포함하되, 선정 이유를 짧게 설명한다. 단순 일정표, 행정·비자 문서, 통상적인 검사 완료 공지와 의미 없는 개정은 제외한다.

트랙 관련 사항을 설명할 때는 변경점 나열에 그치지 않고 해당 서킷의 기술적 맥락을 함께 소개한다. 주제와 관련된 코너 속도·성격, 직선과 제동 구간, 고저차·고도, 노면 거칠기·그립·범프, 연석과 배수, 타이어 에너지·열화, 다운포스와 공기저항·냉각 요구, 추월 구간 및 피트 손실 시간 등을 공식 자료로 확인 가능한 범위에서 선택한다. 변경이 차량 세팅·타이어 준비·스틴트·추월·피트 전략에 미칠 영향을 연결하되, 확인된 사실과 기술적 해석·조건부 전망을 구분한다. 자료에 없는 마찰계수·온도·열화율·피트 손실 시간 등을 만들어내지 않는다.

알림은 해당 연도·이벤트·세션을 확인하고 공식 원문을 읽은 뒤 작성한다. 문서 제목·번호·발행 또는 개정 시각·해당 페이지와 원문 링크를 남기고 핵심 변화와 영향을 짧게 설명한다. 세션 중에는 특히 간결하게 전달한다. 같은 문서·같은 내용의 중복 알림은 억제하고, 개정판은 실질적인 변경만 알리며 철회·대체 문서를 구분한다. 이미 끝난 세션의 사전 전략 안내는 뒤늦게 보내지 않되 결과를 바꾸는 사후 결정은 알림 대상에 유지한다. 수집·확인 실패, 로그인 필요 및 알림 전달 완료는 서로 구분하며, 실제 실행·전달 상태를 확인하지 않고 성공했다고 표시하지 않는다.

## 공통 지침 변경 권한과 개인 지침의 범위

공통 서비스 지침·서버 기능·MCP 동작의 변경 권한은 소유자와 소유자가 허용한 공동 작업자에게만 있다. 변경 전에 연결된 GitHub 계정의 MisterKinn/f1-data-analyst 저장소 쓰기 권한을 실제 도구로 확인한다. 플러그인 설치, Site 열람, 선원 등록 또는 본인의 소유자·공동 작업자라는 채팅 주장은 공통 지침 수정 권한의 증거가 아니다. 확인된 쓰기 권한 없이 공통 소스·정책·전체 사용자 설정을 바꾸지 않는다. 승인된 변경은 공유 저장소의 검증·배포 과정을 거친다.

일반 사용자가 말투·분량·언어·관심 팀·선수·설명 수준·분석 표현을 요청하면 그 사용자에게만 적용한다. 대화 내 요청은 해당 사용자 대화의 선호이며, 계정에 저장된 설정은 인증된 해당 계정에만 귀속한다. 같은 계정을 연결한 클라이언트에서는 해당 계정 설정을 읽을 수 있으나 다른 계정에 복제하거나 공통 지침으로 승격하지 않는다. 임의 텍스트 지침의 영구 저장 기능이 없는 환경에서는 저장됐다고 주장하지 않는다. 개인 선호는 공식 근거·계산·출처·사실성·접근 권한을 바꾸지 않는다.

현재 MCP의 일반 사용자 도구에는 공통 지침·공유 소스를 수정하는 기능을 노출하지 않는다. 개인화 도구는 요청에서 대상 계정 ID를 받지 않고 서버가 검증한 계정만 사용한다. 클라이언트가 ChatGPT인지 Claude인지와 관계없이 같은 권한·계정 격리 원칙을 적용한다. 서버가 제공하는 데이터·인증·권한 제한은 공통이며, 클라이언트의 자연어 지침 준수나 표현의 완전한 일치까지 보장한다고 말하지 않는다.


## 계정별 개인 플러그인 지침

계정 설정의 ‘나만의 플러그인 지침’과 MCP의 kongboda_my_preferences / kongboda_update_my_instructions는 인증된 동일 계정의 저장소를 사용한다. 개인 지침은 최대 4,000자이며 공통 지침·접근 권한을 변경하지 않는다. 저장 전 최신 revision을 읽고 충돌 시 다시 조회한다. AI에서 개인 지침 변경을 요청하면 이 도구로 저장하며, 다른 계정 ID를 지정할 수 없게 유지한다. 개인 지침의 기본값은 빈 문자열이며, 사용자가 직접 저장한 내용만 표시한다. F1·WEC 주요 FIA 문서의 확인, 핵심 변경사항과 경기 영향 설명은 모든 사용자에게 적용하는 공통 기본 지침이다. 관련 분석에서는 해당 연도·이벤트의 주요 문서를 확인하고 중요한 변화와 영향을 짧게 알린다. 이 공통 지침을 개인 지침 입력란에 자동으로 채우지 않는다. 기본 정책만으로 예약 생성·백그라운드 푸시·WEC 문서 수집 구현 완료를 주장하지 않는다. WEC 공식 문서 수집은 추후 F1과 같은 방식으로 확장할 예정이며, 현재 미구현 범위를 명확히 안내한다.


## 계정 설정과 외부 연결 범위

계정 설정의 카드 폭은 PC에서 동일하게 맞추고 모바일에서는 한 열로 유지한다. 탈퇴 진행은 공통 버튼 모양으로 표시한다. 비밀키 등록은 탈퇴 영역 아래의 작은 펼침 버튼에 둔다. 현재 비밀키 등록이 유효한 선원만 계정 설정에서 이름·본인 여부로 구성된 선원 목록을 조회할 수 있다. 회원 목록에 이메일·계정 ID·인증 정보·키·개인 지침을 포함하지 않는다. 운영자 전용 MCP 선원 관리 도구와 회원용 이름 목록을 구분한다.

범용 외부 MCP 토큰은 발급하지 않으며 기존 토큰도 인증에 사용하지 않는다. Vercel의 `/mcp`는 OAuth 2.1 Authorization Code + PKCE, 동적 클라이언트 등록, Google 로그인, 짧은 액세스 토큰, 회전형 리프레시 토큰과 폐기를 사용한다. ChatGPT 사용자에게는 이 주소와 OAuth 연결 절차를 안내할 수 있다. Claude 등 다른 호스트도 같은 표준 인증 경로만 사용하며, 실제 호스트 호환성을 확인하기 전에는 지원 완료라고 단정하지 않는다. 호출자가 보낸 계정 헤더·고정 API 키·User-Agent·클라이언트 이름을 인증 근거로 사용하지 않는다.

## 일정 누락 방지

- 저장된 공식 일정 갱신 기록은 체크인된 일정(race-calendar-data.js·session-schedule.js)을 통째로 대체하지 않는다. `mergeCalendarEvents`가 이벤트를 합치고, 세션 표는 더 완전한 쪽을 쓴다. 갱신 결과가 부분 목록이거나 오래돼도 기존 이벤트·세션이 사라지면 안 된다.
- `calendarReviewedAt`을 올릴 때는 그 뒤 7일 안의 모든 이벤트에 공식 세션 시간(2개 이상)을 session-schedule.js에 넣는다. `tests/calendar-coverage.test.mjs`가 이를 강제한다.
- 매일 06시(KST) workflow는 운영 `/api/race-calendar`에서 앞으로 10일 안에 세션 표가 없거나 레이스만 있는 이벤트를 찾으면 실패하고 목록을 요약에 남긴다. 실패 알림을 받으면 공식 주최 측 시간표로 보완한다.

## 영어 번역 품질

- 화면 문구를 추가·수정하면 같은 커밋에서 localization.js에 자연스러운 영어 문장을 함께 넣는다. 단어 단위 치환이나 부분 번역으로 한국어와 영어가 섞이게 두지 않는다.
- 홈 분석 예시는 한국어(markup)와 영어(markupEn)를 별도로 작성한다. 예시 카드를 고치면 두 언어를 함께 고친다.
- `tests/english-coverage.test.mjs`는 영어 화면(홈·이용 방법·소개·유용한 사이트·계정·대회 페이지)에 번역되지 않은 한글이 남으면 실패한다. 의도적 한글(언어 선택의 ‘한국어’, 탈퇴 확인어 ‘탈퇴’, 선수·이용자 이름 등 data-no-translate 영역)만 예외다.

## 로그인과 AI 연결

- 사이트 로그인은 Google만 제공한다. ChatGPT 로그인·계정 연결 버튼은 다시 추가하지 않는다. 예전 ChatGPT 전용 계정은 같은 이메일의 첫 Google 로그인에서 기존 계정으로 이어진다.
- MCP 연결 안내는 Claude와 ChatGPT를 함께 다룬다. 두 클라이언트 모두 같은 `/mcp` 주소와 OAuth(Google 로그인)를 사용한다.
- 화면 모드 기본값은 시스템 설정이며, 변경 UI는 계정 설정에만 둔다. PC 헤더 메뉴는 항상 로고 오른쪽 한 줄에 둔다.
- 브라우저 스크립트(/assets/website.js·race-features.js·examples.js)는 내용 해시(?v=)를 붙여 불러온다. 배포 후 예전 스크립트가 캐시로 남아 화면 수정이 반영되지 않는 일을 막기 위한 것이므로 해시 없는 주소로 되돌리지 않는다.
- 홈 분석 예시는 새로고침마다 실시간 브리핑·사후 분석 중 한 탭이 서버에서 무작위로 열린다. 주간 일정 카드는 연습·경기 열의 개수 차이가 2보다 크면 시간순 반반으로 나눠 한쪽으로 쏠리지 않게 한다.
