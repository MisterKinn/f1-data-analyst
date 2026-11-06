// Guide step 5: how to get live briefings. The connector cannot start a chat, so each AI gets
// two copyable prompts: a one-time setup (checks the connection, briefs now, creates an hourly
// scheduled task, and explains the steps only the user can do) and a quick "start briefing".
// The MCP address is shown only to signed-in accounts (see install()); otherwise the prompts point to step 3.
const URL_MCP='https://kongboda-motorsports.vercel.app/mcp',NO_URL_KO='꽁보다 가이드 3단계에서 복사한 연결 주소',NO_URL_EN='the connection address from step 3 of the Kongboda guide';
const TASK_KO='“Kongboda Motorsports 커넥터의 kongboda_live_briefing 도구로 F1 상황을 확인해. 세션이 진행 중이면 순위, 타이어, 날씨, 레이스 컨트롤 핵심을 한국어로 짧게 정리해. 진행 중인 세션이 없으면 다음 세션 이름과 한국 시간 시작 시각만 한 줄로 알려 줘.”';
const TASK_EN='"Use the kongboda_live_briefing tool of the Kongboda Motorsports connector to check F1. If a session is live, summarise the order, tyres, weather and race control briefly in English. If no session is live, reply with one line: the next session and its start time in my time zone."';
const ko=(URL_MCP)=>({
 claudeSetup:`꽁보다 실시간 F1 브리핑을 자동으로 받게 설정해 줘. 순서대로 진행하고, 네가 할 수 없는 단계는 내가 할 일을 짧게 알려 줘.
1. 이 대화에서 Kongboda Motorsports 커넥터를 쓸 수 있는지 확인해 줘. 없으면 커넥터는 내가 직접 추가해야 하니 이렇게 안내해 줘: claude.ai의 ‘사용자 지정 → 커넥터’에서 ‘+ 추가 → 커스텀 커넥터 추가’를 누르고, 이름 Kongboda Motorsports, URL ${URL_MCP} 를 넣은 뒤 ‘연결’을 눌러 Google 계정으로 승인. 끝나면 새 대화에서 커넥터를 켜고 이 문장을 다시 보내라고 해 줘.
2. 커넥터가 있으면 kongboda_live_briefing 도구로 지금 브리핑을 한 번 해 줘.
3. ‘꽁보다 실시간 브리핑’ 예약 작업을 매시간 실행으로 만들어 줘. 작업 지침: ${TASK_KO}
4. 여기서 예약 작업을 만들 수 없으면 이유와 함께, 왼쪽 메뉴 ‘Scheduled’에서 위 지침으로 직접 만드는 방법을 알려 줘.`,
 chatgptSetup:`꽁보다 실시간 F1 브리핑을 자동으로 받게 설정해 줘. 순서대로 진행하고, 네가 할 수 없는 단계는 내가 할 일을 짧게 알려 줘.
1. 이 대화에서 Kongboda Motorsports 앱을 쓸 수 있는지 확인해 줘. 없으면 플러그인은 내가 직접 설치해야 하니 이렇게 안내해 줘: chatgpt.com의 ‘플러그인’에서 ‘사용자 지정 MCP 서버 추가’를 누르고, 이름 Kongboda Motorsports, 서버 URL ${URL_MCP}, 인증 OAuth를 고른 뒤 ‘만들기’를 눌러 Google 계정으로 승인. 끝나면 새 대화에서 ‘@Kongboda Motorsports’를 고르고 이 문장을 다시 보내라고 해 줘.
2. 앱이 있으면 kongboda_live_briefing 도구로 지금 브리핑을 한 번 해 줘.
3. 매시간 실행되는 예약 작업을 만들어 줘. 작업 내용: ${TASK_KO}
4. 요금제 때문에 매시간 예약이 안 되거나 예약 작업에서 이 앱을 쓸 수 없으면, 그 사실과 ‘Scheduled’ 페이지에서 직접 할 수 있는 방법을 알려 줘.`,
 quick:'Kongboda Motorsports로 브리핑 시작'
});
const en=(URL_MCP)=>({
 claudeSetup:`Set up automatic live F1 briefings from Kongboda. Go step by step, and for any step you cannot do, tell me briefly what I need to do.
1. Check whether the Kongboda Motorsports connector is available in this chat. If not, I have to add it myself, so tell me: in claude.ai open Customize → Connectors, click + Add → Add custom connector, enter the name Kongboda Motorsports and the URL ${URL_MCP}, then click Connect and approve with my Google account. Then tell me to turn the connector on in a new chat and send this message again.
2. If the connector is available, give me one briefing now with the kongboda_live_briefing tool.
3. Create an hourly scheduled task named "Kongboda live briefing" with these instructions: ${TASK_EN}
4. If you cannot create scheduled tasks here, tell me why and how to create it myself from Scheduled in the left sidebar with the instructions above.`,
 chatgptSetup:`Set up automatic live F1 briefings from Kongboda. Go step by step, and for any step you cannot do, tell me briefly what I need to do.
1. Check whether the Kongboda Motorsports app is available in this chat. If not, I have to install the plugin myself, so tell me: on chatgpt.com open Plugins, click Add custom MCP server, enter the name Kongboda Motorsports, the server URL ${URL_MCP}, choose OAuth, then click Create and approve with my Google account. Then tell me to pick @Kongboda Motorsports in a new chat and send this message again.
2. If the app is available, give me one briefing now with the kongboda_live_briefing tool.
3. Create a scheduled task that runs every hour: ${TASK_EN}
4. If my plan cannot run hourly tasks or scheduled tasks cannot use this app, tell me so and what I can do from the Scheduled page.`,
 quick:'Start a Kongboda Motorsports briefing'
});
export const BRIEFING_PROMPTS=ko(URL_MCP);
export const briefingPrompts=withAddress=>withAddress?BRIEFING_PROMPTS:ko(NO_URL_KO);
const block=(id,label,text,button,quick)=>`<div class="prompt-copy${quick?' prompt-quick':''}"><p class="prompt-label">${label}</p><pre id="${id}" class="prompt-text">${text}</pre><button class="button" type="button" data-copy-from="${id}">${button}</button></div>`;
export function briefingGuide({withAddress=false}={}){
 const p=briefingPrompts(withAddress);
 return `<li id="briefing"><h3>세션 전에 브리핑을 받으세요</h3><p>커넥터는 먼저 말을 걸 수 없어서, 브리핑은 요청한 순간의 상황으로 한 번 만들어집니다. 아래 설정 문장을 새 대화에 한 번 보내 두면 AI가 매시간 꽁보다를 확인하고, 세션 중이면 브리핑을 먼저 보내 줍니다.</p><div class="client-guides briefing-guides"><div class="client-guide client-guide-claude"><h4>Claude</h4>${block('prompt-claude-setup','자동 브리핑 설정',p.claudeSetup,'설정 문장 복사')}${block('prompt-claude-quick','지금 바로 받기',p.quick,'브리핑 문장 복사',true)}<p class="fine">커넥터 추가와 Google 승인은 직접 해야 합니다. 예약 작업은 Pro·Max·Team·Enterprise 요금제에서 쓸 수 있고, 컴퓨터가 꺼져 있어도 실행됩니다.</p><a href="https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork" target="_blank" rel="noopener noreferrer">Claude 예약 작업 도움말 ↗</a></div><div class="client-guide"><h4>ChatGPT</h4>${block('prompt-chatgpt-setup','자동 브리핑 설정',p.chatgptSetup,'설정 문장 복사')}${block('prompt-chatgpt-quick','지금 바로 받기',p.quick,'브리핑 문장 복사',true)}<p class="fine">플러그인 설치와 Google 승인은 직접 해야 합니다. 매시간 예약은 유료 요금제에서 되고, 무료 요금제는 하루 1번까지입니다.</p><a href="https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt" target="_blank" rel="noopener noreferrer">ChatGPT 예약 작업 도움말 ↗</a></div></div><p class="fine">예약 작업은 가장 짧게 1시간마다 실행됩니다. 세션 중에 더 자주 보려면 그 대화에서 ‘업데이트’라고 보내세요. 실시간 브리핑에는 2단계의 F1 계정 연결이 필요합니다.</p></li>`;
}
export const briefingTranslations={
 '세션 전에 브리핑을 받으세요':'Get briefed before each session',
 '커넥터는 먼저 말을 걸 수 없어서, 브리핑은 요청한 순간의 상황으로 한 번 만들어집니다. 아래 설정 문장을 새 대화에 한 번 보내 두면 AI가 매시간 꽁보다를 확인하고, 세션 중이면 브리핑을 먼저 보내 줍니다.':'The connector cannot start a conversation, so each briefing is a single snapshot made when you ask. Send the setup message below once in a new chat and your AI will check Kongboda every hour and brief you first while a session is live.',
 '자동 브리핑 설정':'Automatic briefings','지금 바로 받기':'Brief me now','설정 문장 복사':'Copy setup message','브리핑 문장 복사':'Copy briefing message',

 '커넥터 추가와 Google 승인은 직접 해야 합니다. 예약 작업은 Pro·Max·Team·Enterprise 요금제에서 쓸 수 있고, 컴퓨터가 꺼져 있어도 실행됩니다.':'You add the connector and approve Google sign-in yourself. Scheduled tasks need a Pro, Max, Team or Enterprise plan and run even when your computer is off.',
 'Claude 예약 작업 도움말 ↗':'Claude scheduled tasks help ↗',
 '플러그인 설치와 Google 승인은 직접 해야 합니다. 매시간 예약은 유료 요금제에서 되고, 무료 요금제는 하루 1번까지입니다.':'You install the plugin and approve Google sign-in yourself. Hourly tasks need a paid plan; the free plan runs tasks at most once a day.',
 'ChatGPT 예약 작업 도움말 ↗':'ChatGPT scheduled tasks help ↗',
 '예약 작업은 가장 짧게 1시간마다 실행됩니다. 세션 중에 더 자주 보려면 그 대화에서 ‘업데이트’라고 보내세요. 실시간 브리핑에는 2단계의 F1 계정 연결이 필요합니다.':'Scheduled tasks run at most once an hour. For more frequent updates during a session, send "update" in that chat. Live briefings need the F1 account from step 2.'
};
// The quick prompt reads as the message you send: a chat bubble. Setup prompts are quiet, scrollable text.
export const briefingGuideCss=`.briefing-guides{margin:4px 0 0}.prompt-copy{display:grid;gap:8px;justify-items:start}.prompt-label{margin:0;font-size:14px;font-weight:700;color:var(--text)}.prompt-text{margin:0;width:100%;max-height:11.5em;overflow:auto;white-space:pre-wrap;word-break:keep-all;overflow-wrap:anywhere;font:inherit;font-size:14px;line-height:1.65;color:var(--muted);padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--bg);user-select:all}.prompt-text:focus-visible{outline:2px solid var(--mint);outline-offset:2px}.prompt-quick .prompt-text{width:auto;max-height:none;padding:9px 16px;border:1.5px solid var(--mint);border-radius:18px 18px 18px 4px;background:var(--surface);color:var(--text);font-weight:650}.client-guide .prompt-copy .button{margin-top:0}`;
for(const [k,e] of [[ko(URL_MCP),en(URL_MCP)],[ko(NO_URL_KO),en(NO_URL_EN)]])for(const key of ['claudeSetup','chatgptSetup','quick'])briefingTranslations[k[key]]=e[key];
