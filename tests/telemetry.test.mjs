import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../worker/index.js';
import {distanceDelta,telemetryRead} from '../worker/telemetry.js';
import {readBestLaps,actionsPush,actionsHistory} from '../worker/live.js';

test('distance delta stays inside common distance and refuses missing coverage',()=>{
 const a={driver_number:'63',complete_coverage:true,samples:[[0,0],[1,50],[2,100]]};
 const b={driver_number:'12',complete_coverage:true,samples:[[0,0],[1.1,50],[2.2,100]]};
 const delta=distanceDelta([a,b]);assert.equal(delta.points.at(-1)[1],0.2);
 assert.equal(delta.reference_driver,'63');
 assert.equal(distanceDelta([a,{...b,complete_coverage:false}]),null);
});

const info={Key:123,Path:'2026/event/session/'};
const snapshot={topics:{SessionInfo:info,TimingData:{Lines:{63:{BestLapTime:{Value:'1:00.000',Lap:3}}}}},telemetry_capture:{purged:true}};
const env={BUCKET:{get:async()=>({json:async()=>({snapshot})})}};
const lap={driver_number:'63',complete_coverage:true,samples:[[0,0],[1,50],[2,100]]};
const store=entries=>({BUCKET:{get:async k=>entries.has(k)?{json:async()=>JSON.parse(entries.get(k))}:null}});
test('after a session, telemetry comes from the published FastF1 archive',async()=>{
 const entries=new Map([['live/sessions/123.json',JSON.stringify({snapshot})],['live/history/123/archive.json','{}'],['live/history/123/telemetry/session-63.json',JSON.stringify({lap})]]);
 const result=await telemetryRead(store(entries),{session_key:123,session_part:'session',driver_number:'63'});
 assert.equal(result.state,'ready');assert.equal(result.laps[0].driver_number,'63');assert.match(result.source,/FastF1/);
});
test('before FastF1 publishes, telemetry says so and points to web search',async()=>{
 const s=structuredClone(snapshot);s.topics.SessionStatus={Status:'Finished'};
 const result=await telemetryRead(store(new Map([['live/sessions/123.json',JSON.stringify({snapshot:s})]])),{session_key:123,session_part:'session',driver_number:'63'});
 assert.equal(result.state,'not_published_yet');assert.match(result.reason,/web search/);
 const missing=await telemetryRead(store(new Map([['live/sessions/123.json',JSON.stringify({snapshot})],['live/history/123/archive.json','{}']])),{session_key:123,session_part:'session',driver_number:'63'});
 assert.equal(missing.state,'unavailable');assert.match(missing.reason,/web search/);
});
test('telemetry tool keeps authentication and crew boundaries',async()=>{
 const request=auth=>new Request('https://test/mcp',{method:'POST',headers:{'content-type':'application/json',...(auth?{'oai-authenticated-user-id':'owner'}:{})},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'fastf1_lap_telemetry',arguments:{session_key:123,session_part:'session',driver_number:'63'}}})});
 const blocked=await worker.fetch(request(false),env);assert.equal(blocked.status,200);const challenge=await blocked.json();assert.equal(challenge.result.isError,true);assert.ok(challenge.result._meta['mcp/www_authenticate']);
 const response=await (await worker.fetch(request(true),{...env,LIVE_ANALYSIS_KEY_HASH:'configured'})).json();
 assert.equal(response.result.isError,true);
});
test('shared snapshot storage never retains high-frequency telemetry copies',async()=>{
 const entries=new Map();
 const s={schema_version:1,producer:'fastf1-live-bridge',run_id:'r',sequence:1,generated_at:new Date().toISOString(),last_message_at:null,connected:false,topics:{SessionInfo:{Key:123},'CarData.z':{Entries:[{sample:'private'}]},'Position.z':{}},recent_events:[]};
 const env={BUCKET:{get:async k=>entries.has(k)?{json:async()=>JSON.parse(entries.get(k))}:null,put:async(k,v)=>entries.set(k,v)}};
 await actionsPush(new Request('https://test/api/live/actions-push?window=2026-21-1',{method:'POST',headers:{authorization:'Bearer ok','content-type':'application/json'},body:JSON.stringify(s)}),env,{verify:async()=>{}});
 const saved=JSON.parse(entries.get('live/current.json'));assert.equal(saved.snapshot.topics['CarData.z'],undefined);assert.equal(saved.snapshot.topics['Position.z'],undefined);
});

test('published FastF1 history does not replace another current session',async()=>{
 const saved=structuredClone(snapshot);saved.connected=false;saved.generated_at=new Date(0).toISOString();saved.last_message_at=null;saved.recent_events=[];
 const entries=new Map([['live/current.json',JSON.stringify({snapshot:{...saved,topics:{...saved.topics,SessionInfo:{Key:124}}},received_at:new Date(0).toISOString()})],['live/sessions/123.json',JSON.stringify({snapshot:saved,received_at:new Date(0).toISOString()})]]);
 const row={driver_number:'63',lap_time:'1:00.000',timing_lap_reference:3,status:'complete',validation:'complete',sectors:{S1:'20.000',S2:'20.000',S3:'20.000'},sector_source_times:['2026-10-30T22:00:20Z','2026-10-30T22:00:40Z','2026-10-30T22:01:00Z']};
 const env={BUCKET:{get:async k=>entries.has(k)?{json:async()=>JSON.parse(entries.get(k))}:null,put:async(k,v)=>entries.set(k,v)}};
 const post=(q,body)=>actionsHistory(new Request('https://test/api/live/actions-history?window=2026-21-1&session_key=123&'+q,{method:'POST',headers:{authorization:'Bearer ok','content-type':'application/json'},body:JSON.stringify(body)}),env,{verify:async()=>{}});
 assert.equal((await post('kind=archive',{session_info:info,topics:saved.topics,lap_archive:{version:1,session_key:123,records:[],best_laps:{session:{63:row}}}})).status,200);
 assert.equal((await post('kind=telemetry&part=session&driver=63',{...lap,samples:[]})).status,200);
 assert.equal((await post('kind=telemetry&part=Q9&driver=63',lap)).status,400);
 const result=await readBestLaps(env,{session_key:123,session_part:'session'});
 assert.equal(result.best_laps[0].status,'complete');assert.equal(result.freshness.live,false);assert.equal(result.history_recovery.state,'complete');
 assert.equal(JSON.parse(entries.get('live/current.json')).snapshot.topics.SessionInfo.Key,124);
 assert.equal((await post('kind=done',{telemetry_laps:1})).status,200);
 const done=await actionsHistory(new Request('https://test/api/live/actions-history?window=2026-21-1',{headers:{authorization:'Bearer ok'}}),env,{verify:async()=>{}});
 assert.equal((await done.json()).done,true);
 const rejected=await actionsHistory(new Request('https://test/api/live/actions-history?window=2026-21-1&session_key=123&kind=done',{method:'POST',headers:{authorization:'Bearer bad'},body:'{}'}),env);
 assert.equal(rejected.status,401);
});
