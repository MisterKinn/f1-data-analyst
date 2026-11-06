import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../worker/index.js';
import {distanceDelta} from '../worker/telemetry.js';
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
test('FastF1 lap telemetry tool is gone: completed sessions are OpenF1 only',async()=>{
 const request=new Request('https://test/mcp',{method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-id':'owner'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'fastf1_lap_telemetry',arguments:{session_key:123,session_part:'session',driver_number:'63'}}})});
 const response=await (await worker.fetch(request,env)).json();
 assert.equal(response.error.code,-32602);assert.match(response.error.message,/kongboda_tools/);
});
test('shared snapshot storage never retains high-frequency telemetry copies',async()=>{
 const entries=new Map();
 const s={schema_version:1,producer:'fastf1-live-bridge',run_id:'r',sequence:1,generated_at:new Date().toISOString(),last_message_at:null,connected:false,topics:{SessionInfo:{Key:123},'CarData.z':{Entries:[{sample:'private'}]},'Position.z':{}},recent_events:[]};
 const env={BUCKET:{get:async k=>entries.has(k)?{json:async()=>JSON.parse(entries.get(k))}:null,put:async(k,v)=>entries.set(k,v)}};
 await actionsPush(new Request('https://test/api/live/actions-push?window=2026-21-1',{method:'POST',headers:{authorization:'Bearer ok','content-type':'application/json'},body:JSON.stringify(s)}),env,{verify:async()=>{}});
 const saved=JSON.parse(entries.get('live/current.json'));assert.equal(saved.snapshot.topics['CarData.z'],undefined);assert.equal(saved.snapshot.topics['Position.z'],undefined);
});

test('FastF1 post-session history is retired: collectors are told it is done and uploads are dropped',async()=>{
 const entries=new Map([['live/current.json',JSON.stringify({snapshot:{topics:{SessionInfo:{Key:124}}},received_at:new Date(0).toISOString()})]]);
 const env={BUCKET:{get:async k=>entries.has(k)?{json:async()=>JSON.parse(entries.get(k))}:null,put:async(k,v)=>entries.set(k,v)}};
 const done=await actionsHistory(new Request('https://test/api/live/actions-history?window=2026-21-1',{headers:{authorization:'Bearer ok'}}),env,{verify:async()=>{}});
 const body=await done.json();assert.equal(body.done,true);assert.match(body.reason,/OpenF1/);
 const upload=await actionsHistory(new Request('https://test/api/live/actions-history?window=2026-21-1&session_key=123&kind=archive',{method:'POST',headers:{authorization:'Bearer ok','content-type':'application/json'},body:'{}'}),env,{verify:async()=>{}});
 assert.equal(upload.status,200);assert.equal((await upload.json()).stored,false);
 assert.deepEqual([...entries.keys()],['live/current.json']);
 const rejected=await actionsHistory(new Request('https://test/api/live/actions-history?window=2026-21-1&session_key=123&kind=done',{method:'POST',headers:{authorization:'Bearer bad'},body:'{}'}),env);
 assert.equal(rejected.status,401);
 const bad=await actionsHistory(new Request('https://test/api/live/actions-history?window=x',{headers:{authorization:'Bearer ok'}}),env,{verify:async()=>{}});
 assert.equal(bad.status,400);
});
