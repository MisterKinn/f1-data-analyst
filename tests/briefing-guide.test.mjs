import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import {SETUP_PROMPTS} from '../worker/briefing-guide.js';
import {translateHtml} from '../worker/localization.js';

const guide=async()=>(await worker.fetch(new Request('https://kongboda.test/guide'),{})).text();
const stepOf=html=>{const a=html.indexOf('<li id="ai-setup">');return html.slice(a,html.indexOf('</li>',a)+5);};

test('step 4 is one hidden, copyable setup prompt per AI and no separate briefing step',async()=>{
 const html=await guide(),step=stepOf(html);
 assert.ok(step.startsWith('<li id="ai-setup">'));
 assert.doesNotMatch(html,/id="briefing"/);
 for(const id of ['prompt-claude','prompt-chatgpt']){assert.match(step,new RegExp(`<pre id="${id}" hidden>`));assert.match(step,new RegExp(`class="link-copy" type="button" data-copy-from="${id}"`));}
 assert.match(step,/3단계에서 복사한 연결 주소/,'signed-out prompts point to step 3');
 for(const key of ['claude','chatgpt'])for(const part of ['kongboda_live_briefing','https://kongboda-motorsports.vercel.app/mcp','매시간','여기서 멈춰','/live'])assert.ok(SETUP_PROMPTS[key].includes(part),key+' '+part);
 assert.match(SETUP_PROMPTS.claude,/커스텀 커넥터 추가/);assert.match(SETUP_PROMPTS.chatgpt,/사용자 지정 MCP 서버 추가/);
});

test('step 4 is translated, hidden prompts included',async()=>{
 const en=translateHtml(stepOf(await guide()),'en');
 assert.doesNotMatch(en,/[가-힣]/);
 assert.match(en,/Copy Claude prompt/);assert.match(en,/Help me connect Kongboda Motorsports/);
});
