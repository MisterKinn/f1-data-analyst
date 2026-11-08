import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import {FEATURES} from '../worker/features.js';

// Production runs with live timing and the full site switched off (worker/features.js).
// The code stays; these checks make sure it is hidden and unusable while off.
const page=async path=>{const r=await worker.fetch(new Request('https://kongboda.test'+path,{headers:{'accept-language':'ko'}}),{});return {status:r.status,html:await r.text()};};
const rpc=(method,params)=>new Request('https://kongboda.test/mcp',{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream','oai-authenticated-user-id':'u1','oai-authenticated-user-email':'a@example.invalid'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});

test('switched off: home shows only this week in motorsport, menu Home, F1, WEC and Kongboda AI; the intro and the name moved to the home; /about redirects home',async()=>{
 const saved={...FEATURES};Object.assign(FEATURES,{liveTiming:false,fullSite:false});
 try{
  const home=await page('/');
  assert.match(home.html,/data-race-calendar="week"/);
  const main=home.html.match(/<main[\s\S]*?<\/main>/)[0];
  assert.doesNotMatch(main,/id="championships"|connect-section|id="ci"/);
  assert.match(main,/라이트팬과 코어팬 사이의 그 계단을/);assert.match(main,/꽁보다, 무슨 뜻인가요/);
  const nav=home.html.match(/<nav id="navigation"[\s\S]*?<\/nav>/)[0];
  assert.deepEqual([...nav.matchAll(/href="([^"]+)"/g)].map(m=>m[1]),['/','/championships/f1','/championships/wec','/ai']);
  assert.equal((await page('/about')).status,301);
  assert.equal((await page('/guide')).status,404);
  for(const slug of ['f1','wec'])assert.doesNotMatch((await page('/championships/'+slug)).html,/href="\/guide"|연결 방법 보기/);
  assert.equal((await page('/status')).status,404);
  const live=await worker.fetch(new Request('https://kongboda.test/api/live/wec/connect/start',{method:'POST'}),{});
  assert.notEqual(live.status,200);
  const tools=(await (await worker.fetch(rpc('tools/list'),{})).json()).result.tools.map(t=>t.name);
  for(const name of ['kongboda_live_briefing','f1_live_snapshot','f1_live_diagnostics','wec_live_status','wec_live_discover','kongboda_collector_setup'])assert.ok(!tools.includes(name),name);
  assert.ok(tools.includes('fia_list_documents'));
  const call=await (await worker.fetch(rpc('tools/call',{name:'kongboda_live_briefing',arguments:{}}),{})).json();
  assert.ok(call.error||call.result?.isError);
 }finally{Object.assign(FEATURES,saved);}
});
