import assert from 'node:assert/strict';
import vm from 'node:vm';
import worker,{buildLiveBriefing} from '../worker/index.js';
import {LIVE_APP_MIME,LIVE_APP_URI} from '../worker/mcp-app.js';

const rpc=(method,params={},id=1)=>new Request('https://example.test/mcp',{
 method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-id':'owner'},
 body:JSON.stringify({jsonrpc:'2.0',id,method,params})
});

const discovery=await (await worker.fetch(rpc('server/discover'),{})).json();
assert.deepEqual(discovery.result.capabilities.resources,{});
let response=await worker.fetch(rpc('initialize',{protocolVersion:'2025-06-18'}),{});
let payload=await response.json();
assert.deepEqual(payload.result.capabilities.resources,{});
response=await worker.fetch(rpc('resources/list'),{});
payload=await response.json();
assert.equal(payload.result.resources.find(item=>item.uri===LIVE_APP_URI).mimeType,LIVE_APP_MIME);
response=await worker.fetch(rpc('resources/read',{uri:LIVE_APP_URI}),{});
payload=await response.json();
const content=payload.result.contents[0];
assert.equal(content.mimeType,LIVE_APP_MIME);
assert.match(content.text,/ui\/notifications\/tool-result/);
assert.match(content.text,/event\.source!==window\.parent/);
assert.match(content.text,/d\.status\|\|/);
assert.deepEqual(content._meta.ui.csp,{connectDomains:[],resourceDomains:[]});
assert.doesNotMatch(JSON.stringify(content),/(api[_-]?key|access[_-]?token|password)/i);
response=await worker.fetch(rpc('tools/list'),{});
payload=await response.json();
const tool=payload.result.tools.find(item=>item.name==='kongboda_live_briefing');
assert.equal(tool._meta.ui.resourceUri,LIVE_APP_URI);
assert.equal(tool._meta['openai/outputTemplate'],LIVE_APP_URI);
assert.deepEqual(tool.securitySchemes,[{type:'oauth2',scopes:['mcp:read']}]);
assert.deepEqual(tool._meta.securitySchemes,[{type:'oauth2',scopes:['mcp:read']}]);
const unauthenticated=await (await worker.fetch(new Request('https://example.test/mcp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:9,method:'tools/call',params:{name:'kongboda_live_briefing',arguments:{}}})}),{})).json();
assert.equal(unauthenticated.result.isError,true);
assert.match(unauthenticated.result._meta['mcp/www_authenticate'][0],/resource_metadata=.*oauth-protected-resource.*error="insufficient_scope"/);
response=await worker.fetch(rpc('tools/call',{name:'kongboda_live_briefing',arguments:{recent_events:0}}),{BUCKET:{get:async()=>null}});
payload=await response.json();
assert.equal(payload.result.isError,false);
assert.equal(payload.result.structuredContent.available,false);
assert.equal(typeof payload.result.structuredContent.briefing,'string');
assert.match(payload.result.content[0].text,/LIVE|수신|세션|자료|확인/);

const sample={available:true,connected:true,received_at:'2026-11-01T20:15:42Z',source:'FastF1',
 freshness:{live:true,feed_age_seconds:2,stale_after_seconds:45},
 synchronization:{collector:{state:'recording',collector_running:true}},
 topics:{SessionInfo:{Key:11404,Meeting:{Name:'Mexico City Grand Prix'},Name:'Race',SessionStatus:'Started'},
 DriverList:{'16':{Tla:'LEC',TeamName:'Ferrari'},'63':{Tla:'RUS',TeamName:'Mercedes'}},
 TimingData:{Lines:{'16':{Position:'1',GapToLeader:'',LastLapTime:'1:21.234',NumberOfLaps:12},'63':{Position:'2',GapToLeader:'+2.345',IntervalToPositionAhead:'+2.345',LastLapTime:'1:21.420',NumberOfLaps:12}}},
 TimingAppData:{Lines:{'16':{Stints:{'0':{Compound:'MEDIUM',TotalLaps:12,New:true}}},'63':{Stints:{'0':{Compound:'HARD',TotalLaps:12,New:true}}}}},
 WeatherData:{AirTemp:24.5,TrackTemp:38.2,Humidity:42,Rainfall:'0',WindSpeed:2.1,WindDirection:180},
 TrackStatus:{Status:'1'},RaceControlMessages:{Messages:{'0':{Category:'Other',Message:'DRS ENABLED'}}},
 LapCount:{CurrentLap:12,TotalLaps:71}},
 topic_times:{TimingData:{received_at:'2026-11-01T20:15:40Z',source_time:'2026-11-01T20:15:40Z'},TimingAppData:{received_at:'2026-11-01T20:15:40Z',source_time:'2026-11-01T20:15:40Z'}}};
const ready=buildLiveBriefing(sample);
assert.equal(ready.schema_version,4);
assert.equal(ready.freshness.live,true);
assert.equal(ready.session.key,11404);
assert.match(ready.briefing,/12\/71/);
assert.match(ready.briefing,/1위 LEC/);
assert.ok(ready.details.length>=5);
assert.equal(ready.leaderboard.length,2);
assert.equal(ready.leaderboard[0].compound,'MEDIUM');
assert.equal(ready.strategy.length,2);
assert.equal(ready.weather.track_temperature,'38.2°C');
assert.equal(ready.race_control.message,'DRS ENABLED');
const stale=buildLiveBriefing({...sample,freshness:{...sample.freshness,feed_age_seconds:90}});
assert.equal(stale.freshness.live,false);
assert.equal(stale.status,'LIVE 미확인');
assert.equal(stale.leaderboard.length,0);
assert.equal(stale.strategy.length,0);
const noAge=buildLiveBriefing({...sample,freshness:{live:true,stale_after_seconds:45}});
assert.equal(noAge.freshness.live,false);
assert.match(content.text,/ui\/notifications\/size-changed/);
assert.match(LIVE_APP_URI,/live-analysis-v4/);
const el=()=>({textContent:'',className:'',hidden:false,children:[],attributes:{},listeners:{},classList:{toggle(){}},append(...xs){this.children.push(...xs);},replaceChildren(...xs){this.children=[...xs];},setAttribute(key,value){this.attributes[key]=value;},addEventListener(name,fn){this.listeners[name]=fn;}});
const nodes={};
let handler;const posted=[];
const fakeWindow={parent:{postMessage(msg){posted.push(msg);}},addEventListener(_event,fn){handler=fn;},openai:{toolOutput:ready}};
const fakeDocument={querySelector(selector){return nodes[selector]??=(el());},createElement(){return el();},documentElement:{scrollHeight:240},body:{}};
const script=content.text.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'MCP Apps HTML script must exist');
vm.runInNewContext(script,{window:fakeWindow,document:fakeDocument,setTimeout(){return 1;},clearTimeout(){},ResizeObserver:undefined});
assert.match(nodes['#summary'].textContent,/Mexico City Grand Prix/);
assert.equal(nodes['#status'].textContent,'LIVE');
assert.ok(nodes['#facts'].children.length>0);
assert.equal(nodes['#leaderboard'].children.length,2);
nodes['#tab-timing'].listeners.click();
assert.equal(nodes['#timing'].hidden,false);
assert.equal(nodes['#overview'].hidden,true);
assert.ok(posted.some(x=>x.method==='ui/initialize'));
handler({source:fakeWindow.parent,data:{jsonrpc:'2.0',id:1,result:{protocolVersion:'2026-01-26'}}});
assert.ok(posted.some(x=>x.method==='ui/notifications/initialized'));
assert.ok(posted.some(x=>x.method==='ui/notifications/size-changed'));

console.log('PASS: MCP Apps resource, concise briefing, stale guard, inline rendering and size handshake.');

const delayed=buildLiveBriefing({...sample,topic_times:{TimingData:{source_time:'2026-11-01T20:00:00Z'}}});
assert.equal(delayed.freshness.live,false);
assert.equal(delayed.status,'데이터 지연');
assert.match(delayed.analysis.join(' '),/보류/);
