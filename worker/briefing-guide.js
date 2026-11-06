// Guide step 4: one copyable prompt per AI. Pasted into a new chat, it connects Kongboda where the AI
// can, walks the user through the clicks only they can make (adding the connector, Google approval),
// briefs once and books an hourly scheduled briefing. The prompt text stays hidden on the page; the
// connector cannot start a chat, so the scheduled task is what makes briefings arrive unasked.
// The MCP address is shown only to signed-in accounts (see install()); otherwise the prompts point to step 3.
const URL_MCP='https://kongboda-motorsports.vercel.app/mcp',NO_URL_KO='꽁보다 가이드 3단계에서 복사한 연결 주소',NO_URL_EN='the connection address from step 3 of the Kongboda guide';
const TASK_KO='“Kongboda Motorsports 커넥터의 kongboda_live_briefing 도구로 F1 상황을 확인해. 세션이 진행 중이면 순위, 타이어, 날씨, 레이스 컨트롤 핵심을 한국어로 짧게 정리해. 진행 중인 세션이 없으면 다음 세션 이름과 한국 시간 시작 시각만 한 줄로 알려 줘.”';
const TASK_EN='"Use the kongboda_live_briefing tool of the Kongboda Motorsports connector to check F1. If a session is live, summarise the order, tyres, weather and race control briefly in English. If no session is live, reply with one line: the next session and its start time in my time zone."';
const ko=url=>({
 claude:`꽁보다 모터스포츠(Kongboda Motorsports) 연결과 F1 실시간 자동 브리핑 설정을 끝까지 도와줘. 네가 할 수 있는 건 직접 하고, 내가 눌러야 하는 단계는 한 번에 하나씩 짧게 알려 줘.
1. 이 대화에서 Kongboda Motorsports 커넥터를 쓸 수 있는지 확인해 줘. 쓸 수 있으면 3번으로 가.
2. 없으면 커넥터 추가는 내가 직접 해야 하니 이 순서로 안내하고 여기서 멈춰 줘.
- claude.ai 웹이나 데스크톱 앱에서 ‘사용자 지정 → 커넥터’(https://claude.ai/customize/connectors)를 연다.
- ‘+ 추가 → 커스텀 커넥터 추가’를 누르고 아래처럼 넣은 뒤 ‘계속’을 누른다. 이름: Kongboda Motorsports, MCP 서버 URL: ${url}
- 인증은 ‘지금 로그인’, OAuth 클라이언트는 ‘자동으로 등록’을 고른다(‘로그인 없음’이 선택돼 있으면 바꾼다). 요청 헤더는 비우고 ‘추가’를 누른다.
- ‘연결’을 누르고 꽁보다에 로그인한 Google 계정으로 ‘연결 승인’을 누른다.
- 새 대화의 ‘+ → 커넥터’에서 Kongboda Motorsports를 켜고 이 문장을 다시 보낸다.
- Team·Enterprise 요금제는 조직 소유자가 먼저 커스텀 커넥터를 허용해야 할 수 있다.
3. kongboda_live_briefing 도구로 지금 브리핑을 한 번 해 줘. F1 계정 연결이 필요하다고 나오면 https://kongboda-motorsports.vercel.app/live 에서 연결하라고 알려 줘.
4. ‘꽁보다 실시간 브리핑’ 예약 작업을 매시간 실행으로 만들어 줘. 작업 지침: ${TASK_KO}
5. 예약 작업을 만들 수 없으면 이유와 함께, 왼쪽 메뉴 ‘Scheduled’에서 위 지침으로 직접 만드는 방법을 알려 줘. 예약 작업은 Pro·Max·Team·Enterprise 요금제에서 쓸 수 있어.
6. 끝나면 세션 중에 더 자주 보고 싶을 때는 그 대화에서 ‘업데이트’라고 보내면 된다고 한 줄로 알려 줘.`,
 chatgpt:`꽁보다 모터스포츠(Kongboda Motorsports) 연결과 F1 실시간 자동 브리핑 설정을 끝까지 도와줘. 네가 할 수 있는 건 직접 하고, 내가 눌러야 하는 단계는 한 번에 하나씩 짧게 알려 줘.
1. 이 대화에서 Kongboda Motorsports 앱을 쓸 수 있는지 확인해 줘. 쓸 수 있으면 3번으로 가.
2. 없으면 플러그인 설치는 내가 직접 해야 하니 이 순서로 안내하고 여기서 멈춰 줘.
- chatgpt.com 웹에서 ‘플러그인’(https://chatgpt.com/plugins)을 열고 ‘사용자 지정 MCP 서버 추가’를 누른다.
- 아래처럼 넣는다. 이름: Kongboda Motorsports, 서버 URL: ${url}
- 인증은 ‘OAuth’를 고르고 ‘고급 OAuth 설정’은 그대로 둔 채 ‘만들기’를 누른 뒤 Google 계정으로 승인한다.
- 새 대화에서 ‘+’ 메뉴나 ‘@’로 Kongboda Motorsports를 고르고 이 문장을 다시 보낸다.
- 도구가 안 보이면 플러그인 → Kongboda Motorsports → ‘관리’에서 ‘도구 새로고침’을 누르고, ‘권한’을 ‘읽기 전용 도구 허용’으로 바꾼다.
- Business·Enterprise·Edu 워크스페이스는 관리자가 먼저 허용해야 할 수 있다.
3. kongboda_live_briefing 도구로 지금 브리핑을 한 번 해 줘. F1 계정 연결이 필요하다고 나오면 https://kongboda-motorsports.vercel.app/live 에서 연결하라고 알려 줘.
4. 매시간 실행되는 예약 작업을 만들어 줘. 작업 내용: ${TASK_KO}
5. 요금제 때문에 매시간 예약이 안 되거나(무료 요금제는 하루 1번까지) 예약 작업에서 이 앱을 쓸 수 없으면, 그 사실과 ‘Scheduled’ 페이지에서 직접 할 수 있는 방법을 알려 줘.
6. 끝나면 세션 중에 더 자주 보고 싶을 때는 그 대화에서 ‘업데이트’라고 보내면 된다고 한 줄로 알려 줘.`
});
const en=url=>({
 claude:`Help me connect Kongboda Motorsports and set up automatic live F1 briefings, all the way through. Do what you can yourself, and give me the clicks only I can make one at a time, briefly.
1. Check whether the Kongboda Motorsports connector is available in this chat. If it is, go to step 3.
2. If not, I have to add the connector myself, so walk me through this and stop here.
- In claude.ai on the web or the desktop app, open Customize → Connectors (https://claude.ai/customize/connectors).
- Click + Add → Add custom connector, fill in the fields below, then click Continue. Name: Kongboda Motorsports, MCP server URL: ${url}
- For authentication choose Sign in now, and for the OAuth client choose Register automatically (change it if No sign-in is selected). Leave request headers empty and click Add.
- Click Connect and approve with the Google account you use for Kongboda.
- Turn on Kongboda Motorsports under + → Connectors in a new chat and send this message again.
- On Team or Enterprise plans an organisation owner may need to allow custom connectors first.
3. Give me one briefing now with the kongboda_live_briefing tool. If it says an F1 account is needed, tell me to connect it at https://kongboda-motorsports.vercel.app/live.
4. Create an hourly scheduled task named "Kongboda live briefing" with these instructions: ${TASK_EN}
5. If you cannot create scheduled tasks here, tell me why and how to create it myself from Scheduled in the left sidebar with the instructions above. Scheduled tasks need a Pro, Max, Team or Enterprise plan.
6. When done, tell me in one line that I can send "update" in that chat for more frequent updates during a session.`,
 chatgpt:`Help me connect Kongboda Motorsports and set up automatic live F1 briefings, all the way through. Do what you can yourself, and give me the clicks only I can make one at a time, briefly.
1. Check whether the Kongboda Motorsports app is available in this chat. If it is, go to step 3.
2. If not, I have to install the plugin myself, so walk me through this and stop here.
- On chatgpt.com open Plugins (https://chatgpt.com/plugins) and click Add custom MCP server.
- Fill in the fields below. Name: Kongboda Motorsports, server URL: ${url}
- Choose OAuth, leave the advanced OAuth settings as they are, click Create and approve with my Google account.
- In a new chat pick Kongboda Motorsports from the + menu or with @ and send this message again.
- If the tools do not show, open Plugins → Kongboda Motorsports → Manage, click Refresh tools and set permissions to allow read-only tools.
- Business, Enterprise and Edu workspaces may need an admin to allow it first.
3. Give me one briefing now with the kongboda_live_briefing tool. If it says an F1 account is needed, tell me to connect it at https://kongboda-motorsports.vercel.app/live.
4. Create a scheduled task that runs every hour: ${TASK_EN}
5. If my plan cannot run hourly tasks (the free plan runs at most once a day) or scheduled tasks cannot use this app, tell me so and what I can do from the Scheduled page.
6. When done, tell me in one line that I can send "update" in that chat for more frequent updates during a session.`
});
export const SETUP_PROMPTS=ko(URL_MCP);
export const setupPrompts=withAddress=>withAddress?SETUP_PROMPTS:ko(NO_URL_KO);
export function aiSetupStep({withAddress=false}={}){
 const p=setupPrompts(withAddress);
 return `<li id="ai-setup"><h3>사용하는 AI에 추가하세요</h3><p>쓰는 AI의 프롬프트를 복사해 새 대화에 붙여 넣으세요.<br>연결부터 세션 자동 브리핑 예약까지 AI가 처리하고, 직접 누를 단계만 안내합니다.</p><p class="prompt-links"><button class="link-copy" type="button" data-copy-from="prompt-claude">Claude용 프롬프트 복사</button><button class="link-copy" type="button" data-copy-from="prompt-chatgpt">ChatGPT용 프롬프트 복사</button></p><pre id="prompt-claude" hidden>${p.claude}</pre><pre id="prompt-chatgpt" hidden>${p.chatgpt}</pre><p class="fine">커넥터 추가와 Google 승인은 직접 눌러야 합니다. 자동 브리핑은 예약 작업을 쓰는 유료 요금제에서 1시간마다 옵니다.</p></li>`;
}
export const setupTranslations={
 '쓰는 AI의 프롬프트를 복사해 새 대화에 붙여 넣으세요.':'Copy the prompt for your AI and paste it into a new chat.',
 '연결부터 세션 자동 브리핑 예약까지 AI가 처리하고, 직접 누를 단계만 안내합니다.':'Your AI handles everything from connecting to booking automatic session briefings and points out the clicks only you can make.',
 'Claude용 프롬프트 복사':'Copy Claude prompt','ChatGPT용 프롬프트 복사':'Copy ChatGPT prompt',
 '커넥터 추가와 Google 승인은 직접 눌러야 합니다. 자동 브리핑은 예약 작업을 쓰는 유료 요금제에서 1시간마다 옵니다.':'You add the connector and approve Google sign-in yourself. Automatic briefings arrive hourly through scheduled tasks on paid plans.'
};
for(const [k,e] of [[ko(URL_MCP),en(URL_MCP)],[ko(NO_URL_KO),en(NO_URL_EN)]])for(const key of ['claude','chatgpt'])setupTranslations[k[key]]=e[key];
// Underlined text buttons: the prompts are the action, not more content to read.
// Scoped three classes deep so the theme's button fill (:root[data-theme] button) does not apply.
export const setupStepCss=`.prompt-links{display:flex;flex-wrap:wrap;gap:4px 28px;margin:0}.guide-steps .prompt-links .link-copy{appearance:none;min-height:44px;padding:0;border:0;border-radius:2px;background:none;box-shadow:none;font:inherit;font-size:17px;font-weight:700;color:var(--mint);text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:6px;cursor:pointer}.guide-steps .prompt-links .link-copy:hover{background:none;text-decoration-thickness:3px}.guide-steps .prompt-links .link-copy:focus-visible{outline:2px solid var(--mint);outline-offset:4px}`;
