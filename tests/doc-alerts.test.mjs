import test from 'node:test';
import assert from 'node:assert/strict';
import {classify,currentF1Event,runCheck,officialUpdates,parseSummary,factsOnly,stateKey,saveAiKey} from '../worker/doc-alerts.js';
import {saveSubscription,b64u} from '../worker/web-push.js';
import {alertsRoute,alertsPageBody,ALERTS_SCRIPT} from '../worker/doc-alerts-web.js';
import {memoryBucket} from './helpers/memory-bucket.mjs';
import worker from '../worker/index.js';

// Real FIA list for the 2026 São Paulo GP as published on 5 Nov 2026.
const base='https://www.fia.com/system/files/decision-document/2026_sao_paulo_grand_prix_-_';
const docs=[
 ['6',"Doc 6 - Race Director's Competition Notes",'race_directors_competition_notes.pdf'],['5','Doc 5 - Timetable V3','timetable_v3.pdf'],['4','Doc 4 - Car Display Procedure','car_display_procedure.pdf'],
 ['3','Doc 3 - Power Unit Information','power_unit_information.pdf'],['2','Doc 2 - Competition Notes - Pirelli Preview','competition_notes_-_pirelli_preview.pdf'],['1','Doc 1 - Competition Visa','competition_visa.pdf']
].map(([n,title,f])=>({document_number:n,title,url:base+f,published:'Published on 05.11.26 20:23 CET',recalled:false,version:null}));
const listDocs=async()=>({event:'São Paulo Grand Prix',url:'https://www.fia.com/...',records:docs});
const PU_TEXT='POWER AND ENERGY LIMITS Maximum Recharge per lap Race Overtake not active 8.0 MJ Overtake active 8.5 MJ Qualifying 9.0 MJ';
const NOW=Date.parse('2026-11-06T00:00:00Z');

function claude(calls){
 return async(url,init)=>{
  if(url.startsWith('https://api.anthropic.com/')){const body=JSON.parse(init.body);calls.push(body);const pu=/Power Unit/.test(body.messages[0].content);
   return Response.json({content:[{type:'text',text:JSON.stringify({notify:true,category:pu?'pu':'other',ko:{headline:pu?'상파울루 GP PU 운용 한도 공개':'상파울루 GP 문서',facts:pu?['레이스 랩당 최대 충전량은 8.0 MJ, 오버테이크 활성 시 8.5 MJ입니다.']:['요약'],interpretation:pu?'긴 가속 구간을 위한 에너지 배분이 관전 포인트입니다.':''},en:{headline:pu?'São Paulo GP: PU limits published':'Doc',facts:['Race max recharge 8.0 MJ per lap.'],interpretation:''}})}]});}
  calls.push({push:url});return new Response(null,{status:201});
 };
}

test('titles are sorted into alert categories; routine documents are skipped',()=>{
 assert.deepEqual(docs.map(d=>classify(d.title)),['race_director','skip','skip','pu','pirelli','skip']);
 assert.equal(classify('Doc 31 - Decision - Car 23 - Unsafe release'),'decision');
 assert.equal(classify('Doc 12 - Car Presentation Submissions'),'updates');
 assert.equal(classify('Doc 40 - Provisional Race Classification'),'skip');
});

test('the current weekend comes from the calendar',()=>{
 const ev=currentF1Event(NOW);
 assert.equal(ev.name,'São Paulo Grand Prix');assert.equal(ev.short_ko,'상파울루 GP');assert.equal(ev.year,2026);
 assert.equal(currentF1Event(Date.parse('2026-08-12T00:00:00Z')),null,'summer break');
 assert.equal(stateKey(ev),'doc-alerts/f1/2026/sao-paulo-grand-prix');
});

test('new documents become Claude-written alerts and reach every device once',async()=>{
 const env={BUCKET:memoryBucket(),ANTHROPIC_API_KEY:'sk-ant-test',ANTHROPIC_MODEL:'claude-test'},calls=[];
 const keys=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 await saveSubscription(env,'g-1',{endpoint:'https://fcm.googleapis.com/fcm/send/phone',keys:{p256dh:b64u.encode(await crypto.subtle.exportKey('raw',keys.publicKey)),auth:b64u.encode(new Uint8Array(16).fill(7))}},'ko');
 const io={now:NOW,listDocs,readText:async url=>url.includes('power_unit')?PU_TEXT:'text',fetchImpl:claude(calls)};
 const first=await runCheck(env,io);
 assert.equal(first.state,'checked');assert.equal(first.new_alerts,3);assert.equal(first.pending,0);
 const ai=calls.filter(c=>c.model);assert.equal(ai.length,3,'only the 3 important documents are summarised');
 assert.equal(ai[0].model,'claude-test');assert.match(ai[0].system,/NOT a parts-usage list/);
 assert.equal(calls.filter(c=>c.push).length,3,'one push per alert');
 const state=JSON.parse(env.BUCKET.data.get('doc-alerts/f1/2026/sao-paulo-grand-prix').body);
 const pu=state.alerts.find(a=>a.category==='pu');assert.equal(pu.ko.headline,'상파울루 GP PU 운용 한도 공개');assert.equal(pu.push.sent,1);
 assert.equal((await runCheck(env,{...io,now:NOW+60_000})).state,'throttled');
 const again=await runCheck(env,{...io,now:NOW+5*60_000});assert.equal(again.new_alerts,0,'never alerts twice');
 assert.equal(calls.filter(c=>c.push).length,3);
 const updates=await officialUpdates(env,{now:NOW+10*60_000,account:'g-2',origin:'https://site'});
 assert.equal(updates.alerts.length,3);assert.equal(updates.alerts_setup,undefined,'alerts are owner-only: no setup link for users');
 assert.match(await alertsPageBody(env,{now:NOW+10*60_000}),/상파울루 GP PU 운용 한도 공개/);
});

test('without an AI key important documents still alert with the title only',async()=>{
 const env={BUCKET:memoryBucket()};
 const out=await runCheck(env,{now:NOW,listDocs,readText:async()=>{throw Error('should not read');},fetchImpl:async()=>new Response(null,{status:201})});
 assert.equal(out.new_alerts,3);assert.equal(out.ai,false);
 const state=JSON.parse(env.BUCKET.data.get('doc-alerts/f1/2026/sao-paulo-grand-prix').body);
 assert.ok(state.alerts.some(a=>a.ko.headline==='상파울루 GP PU 정보 공개'&&a.ai===false));
});

test('summary parsing keeps limits and falls back safely',()=>{
 const ev=currentF1Event(NOW),fb=factsOnly(ev,docs[3],'pu');
 const s=parseSummary('Sure: {"notify":true,"category":"weird","ko":{"headline":"'+'가'.repeat(100)+'","facts":["a","b","c","d"]}}',fb);
 assert.equal(s.category,'pu');assert.equal(s.ko.facts.length,3);assert.ok(s.ko.headline.length<=70);assert.deepEqual(s.en,fb.en);
 assert.throws(()=>parseSummary('no json',fb));
});

test('owner-only AI key, public throttled run, browser assets',async()=>{
 const env={BUCKET:memoryBucket()},req=(path,init={})=>new Request('https://kongboda.test'+path,{...init,headers:{'content-type':'application/json',origin:'https://kongboda.test',...(init.headers||{})}});
 await assert.rejects(saveAiKey(env,'not-a-key'),/형식/);
 assert.equal((await alertsRoute(req('/api/doc-alerts/ai',{method:'POST',body:'{"key":"sk-ant-aaaaaaaaaaaaaaaaaaaaaaaa"}'}),env,{google:{sub:'u',email:'u@x'},owner:false})).status,403);
 assert.equal((await alertsRoute(req('/api/push/subscribe',{method:'POST',body:'{}'}),env,{})).status,401);
 assert.equal((await alertsRoute(req('/api/push/subscribe',{method:'POST',body:'{}'}),env,{google:{sub:'u'},owner:false})).status,403,'push is owner-only');
 assert.equal((await alertsRoute(req('/api/push/subscribe',{method:'POST',body:'{}',headers:{origin:'https://evil.test'}}),env,{google:{sub:'u'}})).status,403);
 const run=await alertsRoute(req('/api/doc-alerts/run',{method:'POST',body:'{}',headers:{origin:''}}),env,{});assert.ok([200,502].includes(run.status),'no network here: errors come back as JSON');assert.ok((await run.json()).state);
 const sw=await alertsRoute(req('/sw.js'),env,{});assert.match(await sw.text(),/showNotification/);
 const manifest=await (await alertsRoute(req('/manifest.webmanifest'),env,{})).json();assert.equal(manifest.display,'standalone');
 assert.match(ALERTS_SCRIPT,/kb-alert-optin/);
});

test('alerts stay off public pages; the connector lists the new tools',async()=>{
 const home=await worker.fetch(new Request('https://kongboda.test/'),{});
 const html=await home.text();assert.doesNotMatch(html,/alerts\.js|data-kb-user/);
 const guide=await (await worker.fetch(new Request('https://kongboda.test/guide'),{})).text();assert.doesNotMatch(guide,/scheduled-alerts|예약 작업/);
 assert.notEqual((await worker.fetch(new Request('https://kongboda.test/alerts'),{})).status,200,'/alerts is owner-only');
 const list=await (await worker.fetch(new Request('https://kongboda.test/mcp',{method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-id':'owner'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})}),{})).json();
 const names=list.result.tools.map(t=>t.name);
 for(const n of ['fia_event_updates','openf1_race_control','openf1_race_gaps','openf1_strategy','openf1_result','openf1_weather','openf1_team_radio'])assert.ok(names.includes(n),n);
});
