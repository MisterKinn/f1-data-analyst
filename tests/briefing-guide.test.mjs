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
 assert.match(en,/Copy Claude prompt/);assert.match(en,/Guide me step by step, from start to finish, through connecting Kongboda Motorsports/);
});
test('setup prompt asks F1/WEC (multi-select), schedules only picked series and offers the rest later',()=>{
 for(const key of ['claude','chatgpt']){
  const p=SETUP_PROMPTS[key];
  for(const part of ['F1’, ‘WEC','중복 선택','고른 종목만','꽁보다 F1 실시간 브리핑','꽁보다 WEC 실시간 브리핑','모든 종목 공통 규칙','plus.fiawec.com','언제든'])assert.ok(p.includes(part),key+' '+part);
 }
});
test('setup prompt runs as numbered stages and waits after each user click',()=>{
 for(const key of ['claude','chatgpt']){
  const p=SETUP_PROMPTS[key];
  for(const part of ['[진행 규칙]','[단계 1/4]','[단계 2/4]','[단계 3/4]','[단계 4/4]','한 번에 하나만','‘완료’','막힐 때','2-1.','3-1.','4-3.','체크리스트'])assert.ok(p.includes(part),key+' '+part);
  assert.doesNotMatch(p,/[<&]/,'prompt sits raw inside <pre>');
 }
});
test('F1 and WEC scheduled tasks share one card rule',()=>{
 for(const key of ['claude','chatgpt']){const p=SETUP_PROMPTS[key];
  assert.ok(p.split('카드(모든 종목 공통 규칙)').length>=3,key);
  assert.doesNotMatch(p,/account#fiawec/);}
});
