# Kongboda Motorsports

## 꽁보다 모터스포츠 웹 UI

홈페이지는 민트색 로고와 반응형 대회 카드, 소개·설치 안내로 구성됩니다.
`/about`에서 브랜드 의미와 이용 방법을 확인할 수 있습니다.
`/championships/f1`은 기존 `/live` 연결 및 시즌별 드라이버·팀 순위 조회,
`/championships/wec`는 Al Kamel 시즌 → 이벤트 → 문서 → CSV/PDF 조회를 제공합니다.
브라우저 데이터 조회도 기존 인증된 `/mcp`를 사용하며 접근 권한은 바뀌지 않습니다.

대회 카드는 `worker/website.js`의 `championships` 목록 한 곳에서 관리합니다.
현재 지원 모드는 `f1`, `wec`이며 새 대회는 실제 데이터 기능과 브라우저 어댑터를
먼저 구현한 뒤 목록에 추가합니다. 지원하지 않는 대회를 라이브로 표시하지 않습니다.
브랜드 벡터는 `worker/brand.js`, 페이지/반응형 스타일/클라이언트는 `worker/website.js`에 있습니다.
현재 설치 이름은 Kongboda Motorsports이며 공유 서비스 초대와 플러그인 연결이 별도로 필요합니다.

공동 개발 시작 및 배포 절차: [한국어 협업 안내](CONTRIBUTING_KO.md)

## Vercel + Firebase 이전

기존 ChatGPT Sites 운영 서비스는 DNS를 바꾸기 전까지 그대로 유지합니다. 새 경로는 Vercel Node 함수, Firebase Authentication, 서버 전용 Firestore 저장소로 구성하며 Firebase 웹 로그인을 ChatGPT MCP 인증으로 승격하지 않습니다. 현재 이전 상태, 사람이 해야 할 콘솔 설정, 전환 조건은 [Vercel + Firebase 이전 문서](docs/vercel-firebase-migration.md)를 따릅니다.

One authenticated MCP server with 65 tools (version 2.0.0), including a read-only MCP Apps live briefing card and account-scoped preference updates. FastF1 supplies live session timing through the owner's PC collector or authenticated free-cloud polling page; published F1 records come from FIA documents, championship standings and cited web search. FIA official documents provide authoritative regulations, technical submissions, PU usage, driver meeting notes, steward decisions and public ADUO announcements.

Live session requests go directly to `f1_live_snapshot`. Check session identity, freshness, topic timestamps, raw event order and race-control deletions before analysis. Missing, disconnected or stale feeds are reported explicitly. Live sessions have no telemetry-provider fallback. After a session, `f1_sessions`, `f1_laps` and `f1_lap_telemetry` read the TracingInsights archive first (free, not locked while another session is live) and OpenF1 when it has no data; OpenF1's free tier answers 401 to every request while an F1 session is live.

The FastF1 bridge supports raw lap/sector state, tyre stints, session status, weather, race-control messages and actual received car-data samples. Historical FastF1 reload provides verified post-session laps and telemetry when officially available. It does not expose fuel load or battery SOC and does not send unsolicited AI commentary. See `collector/README_KO.txt` for local setup; the existing collector download and snapshot format remain compatible.

FIA tools discover actual archive season/event URLs, list event documents and regulation versions, list one news index page, and extract official PDF/HTML content. No additional FIA key is required. PDF extraction returns numbered pages and approximate positioned cells (no OCR). Follow next_page/next_offset; cite original URL, publication date, document/version and page. Recalled documents default to excluded; versions are retained for applicability checks. ADUO private measurements and performance gains are never inferred from public summaries. News filtering is per page, not a comprehensive search; older announcements can be found through FIA-restricted web search and read with fia_read_document.

FIA retrieval permits only official FIA HTTPS hosts and checks redirects, response sizes and page limits. ChatGPT platform authentication remains required for data-bearing MCP calls.

Install pinned dependencies from package-lock.json, run node --test tests/*.test.mjs, then node scripts/build.mjs and node scripts/validate-artifact.mjs. esbuild bundles the serverless unpdf/PDF.js parser and worker into dist/server/index.js; .openai/hosting.json preserves the existing project. The legacy Sites workflow remains available until the Vercel preview is accepted and a separate production cutover is approved.

## Free cloud collection

Deploy collector/cloud.py and collector/collector.py with requirements.txt as a Python web service on Render Free. Build: pip install -r requirements.txt. Start: python cloud.py serve. Health path: /healthz. Set DATA_DIR=/tmp/fastf1, PYTHON_VERSION=3.12.14 and a random COLLECTOR_READ_KEY of at least 32 characters. The owner enters F1_USERNAME and F1_PASSWORD only in Render secrets. Existing F1 TV access is required; no additional subscription is purchased by this setup. Never commit secrets, token caches or timing files.

Set Site secrets FASTF1_CLOUD_URL (HTTPS origin) and FASTF1_CLOUD_KEY (matching read key). The updated collector automatically starts eligible sessions while its host is running (`AUTO_COLLECT=true`, the default). No browser lease is needed in this mode. Set `AUTO_COLLECT=false` only to retain the older 90-second page-lease mode; scheduled practice, qualifying, sprint qualifying/shootout, sprint and race windows collect. Windows open 5 minutes before the scheduled start; race windows close 4 hours after the start and other sessions after 3 hours. Finished, Finalised, Cancelled/Canceled or Aborted status stops the session without starting another live connection. Transient failures retry within a five-minute budget; authentication failures fail closed. Closing the page stops only lease-mode collection. `/stop` pauses collection persistently until `/poll` resumes it. A sleeping host cannot start itself at the scheduled time. Old sessions, disconnected flags and stale timestamps must never be reported as live. Render storage is ephemeral; the Site keeps the latest uploaded snapshot and a bounded last snapshot per session, not a durable full raw feed archive.

Use only the free web plan, no paid workers, cron jobs, databases or disks. Render bandwidth/build allowances still apply; an account without a payment method is suspended rather than charged when the applicable free allowance is exhausted. Check account billing settings before promising zero additional fees.

## Preserved best-lap sectors (1.6.0)

The collector now observes fresh ordered S1/S2/S3 completion patches and matches them to LastLapTime (sector sum within 3 ms). Initial snapshots, missing/out-of-order sectors, cross-segment candidates and mismatched sums are excluded. Each completed lap retains event timestamps and provenance. The published best lap is selected independently for Q1/Q2/Q3 or practice; this is not the sum of personal-best sectors.

The authenticated `f1_live_best_laps` tool returns actual best-lap sectors, matched tyre-stint data, status and coverage. Only `status=complete` is suitable for sector comparison. Deleted/unresolved/missing laps return null sectors. Fuel, SOC and corner telemetry remain unavailable.

A local atomic lap-archive.json checkpoint preserves completed observations across process reconnects. Render's filesystem is still ephemeral; the existing owner-private Site R2 session objects retain validated best-lap records across uploads and deploys when the browser polls or the live snapshot MCP tool synchronizes the configured collector. Current feed references and deletion messages are rechecked before retaining an old record. Previously unobserved sectors cannot be recovered retroactively. Stop/start or cold deployments may lose incomplete laps; do not claim uninterrupted capture.

Validation: Python unittest test_collector test_cloud test_lap_archive; Node --test tests/*.test.mjs; build and artifact validation. The downloadable Windows collector includes lap_archive.py.


## Collector updates and synchronization

Race support requires deploying the updated `collector/cloud.py` to the existing collector host as well as publishing the Site through the GitHub event pipeline. Sites publication alone does not update the separate Python service. Use the existing host’s linked GitHub deployment (root directory `collector`) or its existing deployment process; preserve credentials and data settings. The supervisor refreshes its schedule on startup. Confirm `supported_sessions` includes `Race` in the authenticated collector status, then confirm a matching Race SessionInfo and fresh timestamps before calling reception successful. `next_session` is the canonical upcoming-session field; `next_practice` remains a compatibility alias. Automatic collection is enabled by default on the updated Python host. `f1_live_snapshot` reads `/snapshot` and synchronizes validated data into Site storage without starting a page lease; sync failures and stale timestamps are reported. Unattended start requires an awake host: this code does not bypass free-host suspension or provision a paid plan. The collector keeps local snapshots/archives while running; Site synchronization happens on reads, not as a guaranteed continuous upload.


## WEC 종료 세션: Al Kamel 공식 결과

WEC 경기·연습·예선·하이퍼폴이 끝난 뒤에는 Al Kamel 공식 WEC 결과 아카이브를 사용합니다. F1은 FastF1·FIA 경로를 쓰고, 부족한 사후 기록은 출처를 밝힌 웹 검색으로 보완합니다.

1. wec_list_archive로 공개 시즌 ID를 확인하고 season_id로 이벤트의 정확한 이름을 조회합니다.
2. wec_list_documents에 시즌 ID와 이벤트를 지정합니다. session, query, format 필터와 next_offset을 사용해 Classification, Analysis, PitStops, Weather, TrackLimits와 포인트 자료 중 필요한 파일을 찾습니다.
3. wec_read_document로 발견한 CSV/PDF를 읽습니다. CSV는 car_number, driver, category 필터와 행 페이지, PDF는 start_page/page_count를 지원합니다. 차량 번호와 원문 열은 문자열로 보존합니다.

공식 공개 인덱스는 https://files.alkamelcloud.com/wec/manifests/results.json 이며 https://fiawec.alkamelsystems.com 의 새 사이트가 사용하는 공개 매니페스트입니다. URL/시즌/세션 경로를 추측하지 않습니다. 공식 출처 URL, 파일 수정 시각, 조회 시각을 반환하고 중간 Hour N 자료와 최종/잠정 결과를 구별합니다. 최종 여부는 원문에서 확인합니다. 미공개 타이어/텔레메트리/페널티 원인을 추정 데이터로 채우지 않습니다. 인증·유료 접근이 필요하면 이를 알리고 우회하지 않습니다. 이 도구는 종료 세션 자료이며 라이브 데이터가 아닙니다.


## Persistent research evidence (1.8.0)

The live snapshot now carries cited, conditional interpretation checklists from ten reviewed, commercially reusable article summaries. research_lookup exposes source, license and application limits; pending sources remain ineligible. research_pit_scenario implements a documented linear tyre-loss comparison with explicit assumptions, not a trained or validated race predictor. See [research evidence and access queue](knowledge/README.md). No raw paper PDFs, private datasets or model weights are bundled.
