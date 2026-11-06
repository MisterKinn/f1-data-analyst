import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import {BRIEFING_PROMPTS} from '../worker/briefing-guide.js';
import {translateHtml} from '../worker/localization.js';

test('guide step 5 gives each AI a copyable setup prompt and a quick briefing prompt',async()=>{
 const html=await (await worker.fetch(new Request('https://kongboda.test/guide'),{})).text();
 const step=html.slice(html.indexOf('<li id="briefing">'));
 assert.ok(step.startsWith('<li id="briefing">'),'briefing step follows the AI guides');
 assert.ok(html.indexOf('ChatGPT 플러그인 열기')<html.indexOf('id="briefing"'));
 for(const id of ['prompt-claude-setup','prompt-claude-quick','prompt-chatgpt-setup','prompt-chatgpt-quick']){
  assert.match(step,new RegExp(`<pre id="${id}"`));assert.match(step,new RegExp(`data-copy-from="${id}"`));
 }
 assert.match(step,/3단계에서 복사한 연결 주소/,'signed-out prompts point to step 3');
 for(const key of ['claudeSetup','chatgptSetup'])for(const part of ['kongboda_live_briefing','https://kongboda-motorsports.vercel.app/mcp','매시간','직접'])assert.ok(BRIEFING_PROMPTS[key].includes(part),key+' '+part);
});

test('the briefing step is translated, prompts included',async()=>{
 const html=await (await worker.fetch(new Request('https://kongboda.test/guide'),{})).text();
 const en=translateHtml(html.slice(html.indexOf('<li id="briefing">'),html.indexOf('</li>',html.indexOf('<li id="briefing">'))+5),'en');
 assert.doesNotMatch(en,/[가-힣]/);
 assert.match(en,/Set up automatic live F1 briefings/);
});
