// Guide step 4: one copyable prompt per AI. Pasted into a new chat, it connects Kongboda where the AI
// can, walks the user through the clicks only they can make (adding the connector, Google approval),
// briefs once and books an hourly scheduled briefing. The prompt text stays hidden on the page; the
// connector cannot start a chat, so the scheduled task is what makes briefings arrive unasked.
// The MCP address is shown only to signed-in accounts (see install()); otherwise the prompts point to step 3.
const URL_MCP='https://kongboda-motorsports.vercel.app/mcp',NO_URL_KO='꽁보다 가이드 3단계에서 복사한 연결 주소',NO_URL_EN='the connection address from step 3 of the Kongboda guide';
const TASK_KO='“Kongboda Motorsports 커넥터의 kongboda_live_briefing 도구를 series f1로 불러 F1 카드를 받아. 카드를 맨 먼저 띄우고 앞에 요약을 쓰지 마. 순서는 현재 상황 → 플래그 이유 → 레이스 페이스 → 내 응원 팀이고, 순위표는 내가 요청할 때만 줘. 진행 중인 세션이 없으면 다음 F1 세션만 한 줄로 알려 줘. 공식 세션 시간 밖의 점검 기록은 결과로 쓰지 마.”';
const TASK_EN='"Call the kongboda_live_briefing tool of the Kongboda Motorsports connector with series f1 to get the F1 card. Show the card first with no summary before it. Order: right now, why the flags, race pace, my team; the ranking table only when I ask. If nothing is live, give the next F1 session in one line. Never report an off-schedule test record as a result."';
const WEC_TASK_KO='“Kongboda Motorsports 커넥터의 wec_live_status 도구로 WEC 상황을 확인하고, kongboda_my_preferences로 내가 응원하는 제조사를 확인해. live가 true이면 카드 한 장으로 보고해: 맨 위에 남은 시간을 크게, 세션 이름과 시각은 구석에 작게. 레드·옐로 플래그는 원인(차량 번호·코너)과 함께 바로 알리고, 원인이 발표되지 않았으면 그렇다고 밝혀. 노면 상황(비·노면 온도·습도)과 랩타임 영향, 롱런 페이스나 섹터 손익, 내가 응원하는 팀의 순위·격차·잃는 구간을 먼저 설명해. 순위표는 내가 요청할 때만 줘. live가 false이면 다음 WEC 세션 이름과 한국 시간 시작 시각만 한 줄로 알려 줘. next_step이 나오면 ‘직접 로그인’과 ‘링크 입력’ 두 개를 선택 박스로 띄워. 직접 로그인을 고르면 FIAWEC+ 로그인 화면(plus.fiawec.com/en → Account)까지 네가 열고, 나는 비밀번호와 CAPTCHA만 입력해.”';
const WEC_TASK_EN='"Use the wec_live_status tool of the Kongboda Motorsports connector to check WEC, and kongboda_my_preferences for the manufacturer I support. If live is true, report as one card: time left large at the top, session name and clock time small in a corner. Report red and yellow flags at once with their reason (car number, corner), or say no reason is published. Cover track condition (rain, track temperature, humidity) and its effect on lap times, long-run pace or sector gaps, and my team\'s position, gap and where it loses time, first. Give the ranking table only when I ask. If live is false, reply with one line: the next WEC session and its start time in my time zone. If next_step appears, show a choice box with two options: sign in myself, or paste the session link. If I choose sign in, open the FIAWEC+ sign-in page (plus.fiawec.com/en, Account) yourself; I only type the password and solve the CAPTCHA."';
const RULES_KO=`[진행 규칙]
- 전체는 4단계야: 1 연결 확인 → 2 커넥터 추가(필요할 때만) → 3 종목 선택과 첫 브리핑 → 4 자동 브리핑 예약.
- 매 답변 첫 줄에 ‘[단계 n/4] 단계 이름’을 써서 지금 어디인지 보여 줘.
- 네가 할 수 있는 일은 묻지 말고 바로 하고, 한 일과 결과를 한 줄로 알려 줘.
- 내가 직접 눌러야 하는 일은 한 번에 하나만, 번호(예: 2-1)를 붙여 한두 줄로 알려 줘. 내가 ‘완료’라고 하거나 화면에 보이는 것을 알려 주기 전에는 다음으로 넘어가지 마.
- 막히면 그 단계의 ‘막힐 때’부터 확인하고, 그래도 안 되면 원인과 내가 할 일을 한 줄씩 알려 줘.`;
const RULES_EN=`[How to run this]
- There are 4 stages: 1 check the connection → 2 add the connector (only if needed) → 3 pick series and first briefing → 4 book automatic briefings.
- Start every reply with "[Stage n/4] stage name" so I can see where we are.
- Do what you can yourself without asking, and tell me in one line what you did and the result.
- Give me the clicks only I can make one at a time, numbered (for example 2-1), in one or two lines. Do not move on until I reply "done" or tell you what I see.
- If something fails, check that stage's "If stuck" first; if it still fails, tell me the cause and what I should do, one line each.`;
const PICK_KO=`[단계 3/4] 종목 선택과 첫 브리핑
3-1. 실시간으로 받을 종목을 물어봐 줘: ‘F1’, ‘WEC’ 중 하나 또는 둘 다(중복 선택 가능). 내 답을 받기 전에는 다음으로 가지 마.
3-2. 고른 종목마다 지금 브리핑을 한 번 해 줘. F1은 kongboda_live_briefing, WEC는 wec_live_status 도구를 써.
막힐 때: F1·FIAWEC+ 계정 연결이 필요하다고 나오면 https://kongboda-motorsports.vercel.app/live 에서 연결하라고 알려 주고, 연결했다고 하면 3-2를 다시 해.`;
const PICK_EN=`[Stage 3/4] Pick series and first briefing
3-1. Ask me which series I want live: F1, WEC, or both (I can pick more than one). Do not go on until I answer.
3-2. For each series I picked, give me one briefing now: kongboda_live_briefing for F1, wec_live_status for WEC.
If stuck: if it says an F1 or FIAWEC+ account is needed, tell me to connect it at https://kongboda-motorsports.vercel.app/live, and run 3-2 again once I say it is connected.`;
const SCHEDULE_KO=`고른 종목만 매시간 실행되는 예약 작업으로 하나씩 만들어 줘. F1은 ‘꽁보다 F1 실시간 브리핑’, 작업 지침: ${TASK_KO} WEC는 ‘꽁보다 WEC 실시간 브리핑’, 작업 지침: ${WEC_TASK_KO}`;
const SCHEDULE_EN=`Create an hourly scheduled task only for each series I picked. F1: "Kongboda F1 live briefing" with these instructions: ${TASK_EN} WEC: "Kongboda WEC live briefing" with these instructions: ${WEC_TASK_EN}`;
const LATER_KO=`4-3. 마무리로 체크리스트를 보여 줘: 커넥터 연결, 고른 종목, 만든 예약 작업 이름(각각 완료/안 됨). 그리고 두 줄로 알려 줘: 고르지 않은 종목도 언제든 이 대화에서 ‘WEC 예약도 만들어 줘’처럼 말하면 추가할 수 있다는 것, 세션 중에 더 자주 보고 싶으면 그 대화에서 ‘업데이트’라고 보내면 된다는 것.`;
const LATER_EN=`4-3. Finish with a checklist: connector connected, series picked, scheduled tasks created by name (each done / not done). Then tell me in two lines that I can add a scheduled task for a series I did not pick at any time by saying, for example, "set up WEC too", and that I can send "update" in that chat for more frequent updates during a session.`;
const ko=url=>({
 claude:`꽁보다 모터스포츠(Kongboda Motorsports) 연결과 실시간 자동 브리핑(F1·WEC) 설정을 처음부터 끝까지 단계별로 안내해 줘.

${RULES_KO}

[단계 1/4] 연결 확인
1-1. 이 대화에서 Kongboda Motorsports 커넥터를 쓸 수 있는지 직접 확인해 줘. 쓸 수 있으면 단계 2를 건너뛰고 단계 3으로 가.

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
1-1. 이 대화에서 Kongboda Motorsports 앱을 쓸 수 있는지 직접 확인해 줘. 쓸 수 있으면 단계 2를 건너뛰고 단계 3으로 가.

[단계 2/4] 플러그인 추가 (내가 직접 하는 단계)
2-1. chatgpt.com 웹에서 ‘플러그인’(https://chatgpt.com/plugins)을 열고 ‘사용자 지정 MCP 서버 추가’를 누른다.
2-2. 이름: Kongboda Motorsports, 서버 URL: ${url} 을 넣는다.
2-3. 인증은 ‘OAuth’를 고르고 ‘고급 OAuth 설정’은 그대로 둔 채 ‘만들기’를 누른 뒤 Google 계정으로 승인한다.
2-4. 새 대화에서 ‘+’ 메뉴나 ‘@’로 Kongboda Motorsports를 고르고 이 프롬프트를 다시 붙여 넣는다. 이 안내를 한 뒤 여기서 멈춰 줘.
막힐 때: 도구가 안 보이면 플러그인 → Kongboda Motorsports → ‘관리’에서 ‘도구 새로고침’을 누르고 ‘권한’을 ‘읽기 전용 도구 허용’으로 바꾼다. Business·Enterprise·Edu 워크스페이스는 관리자가 먼저 허용해야 할 수 있다.

${PICK_KO}

[단계 4/4] 자동 브리핑 예약
4-1. ${SCHEDULE_KO}
4-2. 요금제 때문에 매시간 예약이 안 되거나(무료 요금제는 하루 1번까지) 예약 작업에서 이 앱을 쓸 수 없으면, 그 사실과 ‘Scheduled’ 페이지에서 직접 할 수 있는 방법을 한 번에 하나씩 알려 줘.
${LATER_KO}`
});
const en=url=>({
 claude:`Guide me step by step, from start to finish, through connecting Kongboda Motorsports and setting up automatic live briefings (F1 and WEC).

${RULES_EN}

[Stage 1/4] Check the connection
1-1. Check yourself whether the Kongboda Motorsports connector is available in this chat. If it is, skip stage 2 and go to stage 3.

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
1-1. Check yourself whether the Kongboda Motorsports app is available in this chat. If it is, skip stage 2 and go to stage 3.

[Stage 2/4] Add the plugin (I do this stage)
2-1. On chatgpt.com open Plugins (https://chatgpt.com/plugins) and click Add custom MCP server.
2-2. Enter Name: Kongboda Motorsports, server URL: ${url}
2-3. Choose OAuth, leave the advanced OAuth settings as they are, click Create and approve with my Google account.
2-4. In a new chat pick Kongboda Motorsports from the + menu or with @ and paste this prompt again. After telling me this, stop here.
If stuck: if the tools do not show, open Plugins → Kongboda Motorsports → Manage, click Refresh tools and set permissions to allow read-only tools. Business, Enterprise and Edu workspaces may need an admin to allow it first.

${PICK_EN}

[Stage 4/4] Book automatic briefings
4-1. ${SCHEDULE_EN}
4-2. If my plan cannot run hourly tasks (the free plan runs at most once a day) or scheduled tasks cannot use this app, tell me so and walk me, one click at a time, through what I can do from the Scheduled page.
${LATER_EN}`
});
export const SETUP_PROMPTS=ko(URL_MCP);
export const setupPrompts=withAddress=>withAddress?SETUP_PROMPTS:ko(NO_URL_KO);
export function aiSetupStep({withAddress=false}={}){
 const p=setupPrompts(withAddress);
 return `<li id="ai-setup"><h3>사용하는 AI에 추가하세요</h3><p>쓰는 AI의 프롬프트를 복사해 새 대화에 붙여 넣으세요.<br>연결부터 F1·WEC 중 고른 종목의 자동 브리핑 예약까지 AI가 4단계로 진행하고, 직접 누를 일은 한 번에 하나씩 안내합니다.</p><p class="prompt-links"><button class="link-copy" type="button" data-copy-from="prompt-claude">Claude용 프롬프트 복사</button><button class="link-copy" type="button" data-copy-from="prompt-chatgpt">ChatGPT용 프롬프트 복사</button></p><pre id="prompt-claude" hidden>${p.claude}</pre><pre id="prompt-chatgpt" hidden>${p.chatgpt}</pre><p class="fine">커넥터 추가와 Google 승인은 직접 눌러야 합니다. 자동 브리핑은 예약 작업을 쓰는 유료 요금제에서 1시간마다 옵니다.</p></li>`;
}
export const setupTranslations={
 '쓰는 AI의 프롬프트를 복사해 새 대화에 붙여 넣으세요.':'Copy the prompt for your AI and paste it into a new chat.',
 '연결부터 F1·WEC 중 고른 종목의 자동 브리핑 예약까지 AI가 4단계로 진행하고, 직접 누를 일은 한 번에 하나씩 안내합니다.':'Your AI goes through 4 stages, from connecting to booking automatic briefings for the series you pick (F1, WEC or both), and gives you the clicks only you can make one at a time.',
 'Claude용 프롬프트 복사':'Copy Claude prompt','ChatGPT용 프롬프트 복사':'Copy ChatGPT prompt',
 '커넥터 추가와 Google 승인은 직접 눌러야 합니다. 자동 브리핑은 예약 작업을 쓰는 유료 요금제에서 1시간마다 옵니다.':'You add the connector and approve Google sign-in yourself. Automatic briefings arrive hourly through scheduled tasks on paid plans.'
};
for(const [k,e] of [[ko(URL_MCP),en(URL_MCP)],[ko(NO_URL_KO),en(NO_URL_EN)]])for(const key of ['claude','chatgpt'])setupTranslations[k[key]]=e[key];
// Underlined text buttons: the prompts are the action, not more content to read.
// Scoped three classes deep so the theme's button fill (:root[data-theme] button) does not apply.
export const setupStepCss=`.prompt-links{display:flex;flex-wrap:wrap;gap:4px 28px;margin:0}.guide-steps .prompt-links .link-copy{appearance:none;min-height:44px;padding:0;border:0;border-radius:2px;background:none;box-shadow:none;font:inherit;font-size:17px;font-weight:700;color:var(--mint);text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:6px;cursor:pointer}.guide-steps .prompt-links .link-copy:hover{background:none;text-decoration-thickness:3px}.guide-steps .prompt-links .link-copy:focus-visible{outline:2px solid var(--mint);outline-offset:4px}`;
