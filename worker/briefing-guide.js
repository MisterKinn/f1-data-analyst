// Guide step 4: one copyable prompt per AI. Pasted into a new chat, it connects Kongboda where the AI
// can, walks the user through the clicks only they can make (adding the connector, Google approval),
// briefs once and books one calendar-timed scheduled briefing per series. The prompt text stays hidden on the page; the
// connector cannot start a chat, so the scheduled task is what makes briefings arrive unasked.
// The MCP address is shown only to signed-in accounts (see install()); otherwise the prompts point to step 3.
const URL_MCP='https://kongboda-motorsports.vercel.app/mcp',NO_URL_KO='꽁보다 가이드 3단계에서 복사한 연결 주소',NO_URL_EN='the connection address from step 3 of the Kongboda guide';
const RULES_KO=`[진행 규칙]
- 전체는 4단계야: 1 연결 확인 → 2 커넥터 추가(필요할 때만) → 3 종목 선택·미리 로그인·첫 브리핑 → 4 자동 브리핑 예약.
- 매 답변 첫 줄에 ‘[단계 n/4] 단계 이름’을 써서 지금 어디인지 보여 줘.
- 네가 할 수 있는 일은 묻지 말고 바로 하고, 한 일과 결과를 한 줄로 알려 줘.
- 내가 직접 눌러야 하는 일은 한 번에 하나만, 번호(예: 2-1)를 붙여 한두 줄로 알려 줘. 내가 ‘완료’라고 하거나 화면에 보이는 것을 알려 주기 전에는 다음으로 넘어가지 마.
- 막히면 그 단계의 ‘막힐 때’부터 확인하고, 그래도 안 되면 원인과 내가 할 일을 한 줄씩 알려 줘.`;
const RULES_EN=`[How to run this]
- There are 4 stages: 1 check the connection → 2 add the connector (only if needed) → 3 pick series, sign in early, first briefing → 4 book automatic briefings.
- Start every reply with "[Stage n/4] stage name" so I can see where we are.
- Do what you can yourself without asking, and tell me in one line what you did and the result.
- Give me the clicks only I can make one at a time, numbered (for example 2-1), in one or two lines. Do not move on until I reply "done" or tell you what I see.
- If something fails, check that stage's "If stuck" first; if it still fails, tell me the cause and what I should do, one line each.`;
// Stage 3 also offers both sign-ins up front (F1 account, FIAWEC+), each with a skip option, so
// the first live session does not stop at a login screen. Passwords and CAPTCHAs stay with the user.
const PICK_KO=`[단계 3/4] 종목 선택, 미리 로그인, 첫 브리핑
3-1. 실시간으로 받을 종목을 물어봐 줘: ‘F1’, ‘WEC’ 중 하나 또는 둘 다(중복 선택 가능). 내 답을 받기 전에는 다음으로 가지 마.
3-2. 미리 로그인: 세션 중에 로그인 화면에서 멈추지 않도록, 고른 종목마다 지금 로그인할지 선택 박스(객관식 질문 도구, 없으면 번호 목록)로 한 번에 물어봐 줘. 각 종목 선택지는 ‘지금 로그인’과 ‘나중에(건너뛰기)’ 두 개야. 먼저 확인해서 이미 되는 종목은 묻지 말고 ‘로그인 필요 없음’으로 알려 줘(F1: kongboda_live_briefing에 공용 데이터 안내가 없으면 됨, WEC: wec_live_status에 next_step·access_choice가 없으면 됨).
 - F1 지금 로그인: https://kongboda-motorsports.vercel.app/live 를 브라우저로 네가 열고(브라우저 도구가 없으면 링크만), 나는 그 화면에서 내 F1 계정 연결만 해. 내가 ‘완료’라고 하면 kongboda_live_briefing으로 다시 확인해.
 - WEC 지금 로그인: FIAWEC+ 로그인 화면(plus.fiawec.com/en → Account)을 브라우저로 네가 열어. 이미 ‘Signed in to FIAWEC+’면 건너뛰고, 아니면 나는 비밀번호와 CAPTCHA만 입력해(네가 대신 입력하지 마). 로그인이 끝난 것은 화면으로 직접 확인해.
 - 건너뛰기: 그 종목은 그대로 두고, 세션이 시작될 때 브리핑 카드에서 다시 물어본다고 한 줄로 알려 줘.
3-3. 고른 종목마다 지금 브리핑을 한 번 해 줘(kongboda_live_briefing, series f1 또는 wec).
막힐 때: 로그인 화면이 열리지 않으면 링크를 주고 내가 직접 열게 해. 연결이 안 되면 원인과 내가 할 일을 한 줄씩 알려 주고, 건너뛰어도 다음 단계로 갈 수 있다고 말해 줘.`;
const PICK_EN=`[Stage 3/4] Pick series, sign in early, first briefing
3-1. Ask me which series I want live: F1, WEC, or both (I can pick more than one). Do not go on until I answer.
3-2. Sign in early: so a live session does not stop at a login screen, ask me once, as a choice box (the multiple-choice question tool, or a numbered list), whether to sign in now for each series I picked. Each series has two options: "Sign in now" and "Later (skip)". Check first and do not ask for a series that already works; say "no sign-in needed" (F1: kongboda_live_briefing shows no shared-data notice; WEC: wec_live_status has no next_step or access_choice).
 - F1 sign in now: open https://kongboda-motorsports.vercel.app/live in the browser yourself (just the link if you have no browser tool); I only connect my F1 account there. When I say "done", check again with kongboda_live_briefing.
 - WEC sign in now: open the FIAWEC+ sign-in page (plus.fiawec.com/en, Account) in the browser yourself. If it already shows "Signed in to FIAWEC+", skip; otherwise I only type my password and solve the CAPTCHA (never type them for me). Check on screen yourself that sign-in finished.
 - Skip: leave that series as it is and tell me in one line that the briefing card will ask again when a session starts.
3-3. For each series I picked, give me one briefing now (kongboda_live_briefing with series f1 or wec).
If stuck: if the sign-in page does not open, give me the link to open myself. If connecting fails, tell me the cause and what to do, one line each, and say I can skip and still go on.`;
// One scheduled task per series. Each run happens 5 minutes after a session starts (times from
// the Kongboda calendar), posts the card, keeps posting until the session ends, then re-books
// itself for the next session of that series. No hourly polling, no per-session task list.
const SERIES_TASK_KO=(series,name,team)=>`“꽁보다 ${series} 실시간 브리핑. 이 예약 작업 하나가 모든 ${series} 세션을 맡는다. 세션 시간은 꽁보다 캘린더(kongboda_live_briefing 결과의 next_sessions)를 기준으로 한다. 1) Kongboda Motorsports 커넥터의 kongboda_live_briefing을 series ${series.toLowerCase()}로 불러(도구에 series 인자가 없으면 kongboda_call로). 2) 카드를 맨 먼저 띄우고 앞에 요약을 쓰지 마(카드 뒤엔 한 줄까지). 순서는 지금 상황 → 플래그 이유(시각·코너·원인, 조사·페널티) → 세션별 분석(퀄리파잉이면 섹터별 랩 비교·섹터 최고·탈락선, 프랙티스면 퀄리 시뮬 비교와 롱런을 나눠서, 레이스면 앞차·선두와 최근 랩 페이스; 그 밖에 상황을 설명하는 자료도, 아직 판단 불가면 이유) → 내 응원 ${team}(kongboda_my_preferences)이고, 순위표는 내가 요청할 때만. 공식 세션 시간 밖의 점검 기록은 결과로 쓰지 마.${series==='WEC'?' access_choice가 나오면 ‘직접 로그인’·‘링크 입력’을 선택 박스로 띄우고 알림을 보내. 직접 로그인을 고르면 FIAWEC+ 로그인 화면(plus.fiawec.com/en → Account)까지 네가 열고, 나는 비밀번호와 CAPTCHA만 입력해.':''} 3) 카드에 follow_up이 있으면 세션이 끝날 때까지 이 대화로 10분마다 다음 브리핑을 예약해(send_later 등) 새 카드를 보내고, 끝나면 마지막 카드에 총평을 담아. 4) 마지막에 반드시 이름이 ‘${name}’인 이 예약 작업의 1회 실행 시각을 캘린더의 다음 ${series} 세션 시작 5분 뒤로 바꿔(30분 안에 이어지는 세션은 한 묶음으로 보고 첫 세션만).”`;
const SERIES_TASK_EN=(series,name,team)=>`"Kongboda ${series} live briefing. This one scheduled task covers every ${series} session. Session times come from the Kongboda calendar (next_sessions in the kongboda_live_briefing result). 1) Call kongboda_live_briefing of the Kongboda Motorsports connector with series ${series.toLowerCase()} (through kongboda_call if the tool has no series argument). 2) Show the card first with no summary before it (at most one line after). Order: right now, why the flags (time, corner, reason, investigations or penalties), the session analysis (qualifying: sector-by-sector lap gaps, sector owners, cut line; practice: quali sims against rivals and long runs kept apart; race: recent lap pace against the car ahead and the leader; plus anything else that explains the session; say why when not readable yet), my ${team} (kongboda_my_preferences); the ranking table only when I ask. Never report an off-schedule test record as a result.${series==='WEC'?' If access_choice appears, show sign in / paste link as a choice box and notify me. If I choose sign in, open the FIAWEC+ sign-in page (plus.fiawec.com/en, Account) yourself; I only type the password and solve the CAPTCHA.':''} 3) If the card has follow_up, schedule the next briefing back into this conversation every 10 minutes (send_later or similar) until the session ends, then end with a short session summary. 4) Always finish by moving the one-time run of this task (named '${name}') to 5 minutes after the start of the next ${series} session in the calendar (sessions less than 30 minutes apart count as one block)."`;
const SCHEDULE_KO=`고른 종목마다 예약 작업을 딱 하나씩 만들어 줘: ‘꽁보다 F1 실시간 브리핑’, ‘꽁보다 WEC 실시간 브리핑’. 매시간 실행하거나 세션마다 따로 만들지 마. 만들기 전에 기존 예약 작업 목록을 확인해서, 같은 이름이 있으면 새로 만들지 말고 지침과 시각만 바꾸고, 예전 방식의 ‘꽁보다 실시간 브리핑’(매시간)과 ‘… 실시간 브리핑 · 세션’ 작업은 지워.
 각 작업은 1회 실행으로 만들고, 실행 시각은 캘린더(kongboda_live_briefing 결과의 next_sessions)에서 그 종목의 다음 세션 시작 5분 뒤로 정해. 시각은 한국시간으로 보여 줘. 작업은 실행될 때마다 스스로 다음 세션으로 다시 예약된다.
 F1 작업 지침: ${SERIES_TASK_KO('F1','꽁보다 F1 실시간 브리핑','팀·드라이버')}
 WEC 작업 지침: ${SERIES_TASK_KO('WEC','꽁보다 WEC 실시간 브리핑','제조사')}
 자동 승인으로 만들 수 있으면 그렇게 하고, 아니면 작업 설정에서 ‘Automatically approve’를 켜는 방법을 알려 줘. 알림(push)은 켜. 고른 종목만 만들어.`;
const SCHEDULE_EN=`Create exactly one scheduled task per series I picked: "Kongboda F1 live briefing" and "Kongboda WEC live briefing". Do not run them hourly and do not create one task per session. First check my existing scheduled tasks: if one with the same name exists, update its instructions and time instead of creating another, and delete old-style tasks ("Kongboda live briefing" hourly, "... live briefing · session").
 Make each a one-time task set to 5 minutes after the start of that series' next session in the calendar (next_sessions in the kongboda_live_briefing result), shown in my time zone. Each run re-books itself for the next session.
 F1 task instructions: ${SERIES_TASK_EN('F1','Kongboda F1 live briefing','team and drivers')}
 WEC task instructions: ${SERIES_TASK_EN('WEC','Kongboda WEC live briefing','manufacturer')}
 Use automatic approval if you can; otherwise tell me how to turn on "Automatically approve" in the task settings. Turn on push notifications. Only for the series I picked.`;
const LATER_KO=`4-3. 마무리로 체크리스트를 보여 줘: 커넥터 연결, 고른 종목, 만든 예약 작업 이름(각각 완료/안 됨). 그리고 두 줄로 알려 줘: 고르지 않은 종목도 언제든 이 대화에서 ‘WEC 예약도 만들어 줘’처럼 말하면 추가할 수 있다는 것, 세션 중에 더 자주 보고 싶으면 그 대화에서 ‘업데이트’라고 보내면 된다는 것.`;
const LATER_EN=`4-3. Finish with a checklist: connector connected, series picked, scheduled tasks created by name (each done / not done). Then tell me in two lines that I can add a scheduled task for a series I did not pick at any time by saying, for example, "set up WEC too", and that I can send "update" in that chat for more frequent updates during a session.`;
const ko=url=>({
 claude:`꽁보다 모터스포츠(Kongboda Motorsports) 연결과 실시간 자동 브리핑(F1·WEC) 설정을 처음부터 끝까지 단계별로 안내해 줘.

${RULES_KO}

[단계 1/4] 연결 확인
1-1. 이 대화에서 Kongboda Motorsports 커넥터를 쓸 수 있는지 직접 확인해 줘. 쓸 수 있으면 kongboda_my_preferences를 불러 계정 등록 여부도 확인해. 이미 연결·계정 등록이 돼 있으면 [빠른 설정]으로 가: 단계 2와 3-1 질문을 건너뛰고, 종목은 F1·WEC 둘 다로 정해(계정 설정에 응원 팀이 한쪽 종목만 있으면 그 종목만), 3-2 미리 로그인은 아직 안 되는 종목만 선택 박스로 한 번 묻고(건너뛰기 가능), 그 밖에는 묻지 말고 3-3 첫 브리핑과 단계 4 예약 작업을 바로 만든 뒤 4-3 체크리스트만 보여 줘. 계정 등록이 안 돼 있으면 단계 2를 건너뛰고 단계 3으로 가.

[단계 2/4] 커넥터 추가 (내가 직접 하는 단계)
2-1. claude.ai 웹이나 데스크톱 앱에서 ‘사용자 지정 → 커넥터’(https://claude.ai/customize/connectors)를 연다.
2-2. ‘+ 추가 → 커스텀 커넥터 추가’를 누르고 이름: Kongboda Motorsports, MCP 서버 URL: ${url} 을 넣은 뒤 ‘계속’을 누른다.
2-3. 인증은 ‘지금 로그인’, OAuth 클라이언트는 ‘자동으로 등록’을 고른다(‘로그인 없음’이 선택돼 있으면 바꾼다). 요청 헤더는 비우고 ‘추가’를 누른다.
2-4. ‘연결’을 누르고 꽁보다에 로그인한 Google 계정으로 ‘연결 승인’을 누른다.
2-5. 새 대화를 열고 ‘+ → 커넥터’에서 Kongboda Motorsports를 켠 뒤 이 프롬프트를 다시 붙여 넣는다. 이 안내를 한 뒤 여기서 멈춰 줘.
막힐 때: 메뉴가 안 보이면 웹(claude.ai)에서 해 본다. Team·Enterprise 요금제는 조직 소유자가 먼저 커스텀 커넥터를 허용해야 할 수 있다.

${PICK_KO}

[단계 4/4] 자동 브리핑 예약
4-1. ${SCHEDULE_KO}
4-2. 예약 작업을 만들 수 없으면 이유와 함께, 왼쪽 메뉴 ‘Scheduled’에서 위 지침으로 직접 만드는 방법을 한 번에 하나씩 알려 줘. 예약 작업은 Pro·Max·Team·Enterprise 요금제에서 쓸 수 있어.
${LATER_KO}`,
 chatgpt:`꽁보다 모터스포츠(Kongboda Motorsports) 연결과 실시간 자동 브리핑(F1·WEC) 설정을 처음부터 끝까지 단계별로 안내해 줘.

${RULES_KO}

[단계 1/4] 연결 확인
1-1. 이 대화에서 Kongboda Motorsports 앱을 쓸 수 있는지 직접 확인해 줘. 쓸 수 있으면 kongboda_my_preferences를 불러 계정 등록 여부도 확인해. 이미 연결·계정 등록이 돼 있으면 [빠른 설정]으로 가: 단계 2와 3-1 질문을 건너뛰고, 종목은 F1·WEC 둘 다로 정해(계정 설정에 응원 팀이 한쪽 종목만 있으면 그 종목만), 3-2 미리 로그인은 아직 안 되는 종목만 선택 박스로 한 번 묻고(건너뛰기 가능), 그 밖에는 묻지 말고 3-3 첫 브리핑과 단계 4 예약 작업을 바로 만든 뒤 4-3 체크리스트만 보여 줘. 계정 등록이 안 돼 있으면 단계 2를 건너뛰고 단계 3으로 가.

[단계 2/4] 플러그인 추가 (내가 직접 하는 단계)
2-1. chatgpt.com 웹에서 ‘플러그인’(https://chatgpt.com/plugins)을 열고 ‘사용자 지정 MCP 서버 추가’를 누른다.
2-2. 이름: Kongboda Motorsports, 서버 URL: ${url} 을 넣는다.
2-3. 인증은 ‘OAuth’를 고르고 ‘고급 OAuth 설정’은 그대로 둔 채 ‘만들기’를 누른 뒤 Google 계정으로 승인한다.
2-4. 새 대화에서 ‘+’ 메뉴나 ‘@’로 Kongboda Motorsports를 고르고 이 프롬프트를 다시 붙여 넣는다. 이 안내를 한 뒤 여기서 멈춰 줘.
막힐 때: 도구가 안 보이면 플러그인 → Kongboda Motorsports → ‘관리’에서 ‘도구 새로고침’을 누르고 ‘권한’을 ‘읽기 전용 도구 허용’으로 바꾼다. Business·Enterprise·Edu 워크스페이스는 관리자가 먼저 허용해야 할 수 있다.

${PICK_KO}

[단계 4/4] 자동 브리핑 예약
4-1. ${SCHEDULE_KO}
4-2. 요금제 때문에 예약이 안 되거나 예약 작업에서 이 앱을 쓸 수 없으면, 그 사실과 ‘Scheduled’ 페이지에서 직접 할 수 있는 방법을 한 번에 하나씩 알려 줘.
${LATER_KO}`
});
const en=url=>({
 claude:`Guide me step by step, from start to finish, through connecting Kongboda Motorsports and setting up automatic live briefings (F1 and WEC).

${RULES_EN}

[Stage 1/4] Check the connection
1-1. Check yourself whether the Kongboda Motorsports connector is available in this chat. If it is: Also call kongboda_my_preferences to check that my account is registered. If it is already connected and registered, go to [Quick setup]: skip stage 2 and the 3-1 question, use both F1 and WEC (or only the series my account settings have a favourite for, if only one), ask the 3-2 early sign-in choice box once only for series that do not work yet (skip allowed), and otherwise without asking run the 3-3 first briefing and create the stage 4 scheduled tasks, then show only the 4-3 checklist. If my account is not registered yet, skip stage 2 and go to stage 3.

[Stage 2/4] Add the connector (I do this stage)
2-1. In claude.ai on the web or the desktop app, open Customize → Connectors (https://claude.ai/customize/connectors).
2-2. Click + Add → Add custom connector, enter Name: Kongboda Motorsports, MCP server URL: ${url} and click Continue.
2-3. For authentication choose Sign in now, and for the OAuth client choose Register automatically (change it if No sign-in is selected). Leave request headers empty and click Add.
2-4. Click Connect and approve with the Google account you use for Kongboda.
2-5. Open a new chat, turn on Kongboda Motorsports under + → Connectors and paste this prompt again. After telling me this, stop here.
If stuck: if the menu is missing, try it on the web (claude.ai). On Team or Enterprise plans an organisation owner may need to allow custom connectors first.

${PICK_EN}

[Stage 4/4] Book automatic briefings
4-1. ${SCHEDULE_EN}
4-2. If you cannot create scheduled tasks here, tell me why and walk me, one click at a time, through creating them myself from Scheduled in the left sidebar with the instructions above. Scheduled tasks need a Pro, Max, Team or Enterprise plan.
${LATER_EN}`,
 chatgpt:`Guide me step by step, from start to finish, through connecting Kongboda Motorsports and setting up automatic live briefings (F1 and WEC).

${RULES_EN}

[Stage 1/4] Check the connection
1-1. Check yourself whether the Kongboda Motorsports app is available in this chat. If it is: Also call kongboda_my_preferences to check that my account is registered. If it is already connected and registered, go to [Quick setup]: skip stage 2 and the 3-1 question, use both F1 and WEC (or only the series my account settings have a favourite for, if only one), ask the 3-2 early sign-in choice box once only for series that do not work yet (skip allowed), and otherwise without asking run the 3-3 first briefing and create the stage 4 scheduled tasks, then show only the 4-3 checklist. If my account is not registered yet, skip stage 2 and go to stage 3.

[Stage 2/4] Add the plugin (I do this stage)
2-1. On chatgpt.com open Plugins (https://chatgpt.com/plugins) and click Add custom MCP server.
2-2. Enter Name: Kongboda Motorsports, server URL: ${url}
2-3. Choose OAuth, leave the advanced OAuth settings as they are, click Create and approve with my Google account.
2-4. In a new chat pick Kongboda Motorsports from the + menu or with @ and paste this prompt again. After telling me this, stop here.
If stuck: if the tools do not show, open Plugins → Kongboda Motorsports → Manage, click Refresh tools and set permissions to allow read-only tools. Business, Enterprise and Edu workspaces may need an admin to allow it first.

${PICK_EN}

[Stage 4/4] Book automatic briefings
4-1. ${SCHEDULE_EN}
4-2. If my plan cannot run scheduled tasks or scheduled tasks cannot use this app, tell me so and walk me, one click at a time, through what I can do from the Scheduled page.
${LATER_EN}`
});
export const SETUP_PROMPTS=ko(URL_MCP);
export const setupPrompts=withAddress=>withAddress?SETUP_PROMPTS:ko(NO_URL_KO);
export function aiSetupStep({withAddress=false}={}){
 const p=setupPrompts(withAddress);
 return `<li id="ai-setup"><h3>사용하는 AI에 추가하세요</h3><p>쓰는 AI의 프롬프트를 복사해 새 대화에 붙여 넣으세요.<br>연결부터 F1·WEC 중 고른 종목의 자동 브리핑 예약까지 AI가 4단계로 진행하고, 직접 누를 일은 한 번에 하나씩 안내합니다.</p><p class="prompt-links"><button class="link-copy" type="button" data-copy-from="prompt-claude">Claude용 프롬프트 복사</button><button class="link-copy" type="button" data-copy-from="prompt-chatgpt">ChatGPT용 프롬프트 복사</button></p><pre id="prompt-claude" hidden>${p.claude}</pre><pre id="prompt-chatgpt" hidden>${p.chatgpt}</pre><p class="fine">커넥터 추가와 Google 승인은 직접 눌러야 합니다. 자동 브리핑은 예약 작업을 쓰는 유료 요금제에서 캘린더의 세션 시작에 맞춰 옵니다.</p></li>`;
}
export const setupTranslations={
 '쓰는 AI의 프롬프트를 복사해 새 대화에 붙여 넣으세요.':'Copy the prompt for your AI and paste it into a new chat.',
 '연결부터 F1·WEC 중 고른 종목의 자동 브리핑 예약까지 AI가 4단계로 진행하고, 직접 누를 일은 한 번에 하나씩 안내합니다.':'Your AI goes through 4 stages, from connecting to booking automatic briefings for the series you pick (F1, WEC or both), and gives you the clicks only you can make one at a time.',
 'Claude용 프롬프트 복사':'Copy Claude prompt','ChatGPT용 프롬프트 복사':'Copy ChatGPT prompt',
 '커넥터 추가와 Google 승인은 직접 눌러야 합니다. 자동 브리핑은 예약 작업을 쓰는 유료 요금제에서 캘린더의 세션 시작에 맞춰 옵니다.':'You add the connector and approve Google sign-in yourself. Automatic briefings arrive at each session start from the calendar, through scheduled tasks on paid plans.'
};
for(const [k,e] of [[ko(URL_MCP),en(URL_MCP)],[ko(NO_URL_KO),en(NO_URL_EN)]])for(const key of ['claude','chatgpt'])setupTranslations[k[key]]=e[key];
// Underlined text buttons: the prompts are the action, not more content to read.
// Scoped three classes deep so the theme's button fill (:root[data-theme] button) does not apply.
export const setupStepCss=`.prompt-links{display:flex;flex-wrap:wrap;gap:4px 28px;margin:0}.guide-steps .prompt-links .link-copy{appearance:none;min-height:44px;padding:0;border:0;border-radius:2px;background:none;box-shadow:none;font:inherit;font-size:17px;font-weight:700;color:var(--mint);text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:6px;cursor:pointer}.guide-steps .prompt-links .link-copy:hover{background:none;text-decoration-thickness:3px}.guide-steps .prompt-links .link-copy:focus-visible{outline:2px solid var(--mint);outline-offset:4px}`;
