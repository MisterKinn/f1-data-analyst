import assert from 'node:assert/strict';
import {test} from 'node:test';
import {liveRead,resetLiveGuards} from '../worker/live.js';

function setup(){
 const entries=new Map();let puts=0,collectorCalls=0,seq=10;
 const bucket={get:async k=>entries.has(k)?{etag:entries.get(k).etag,json:async()=>JSON.parse(entries.get(k).body)}:null,
  put:async(k,v)=>{puts++;entries.set(k,{body:v,etag:'e'+puts});return {etag:'e'+puts};}};
 const env={FASTF1_CLOUD_URL:'https://collector.example',FASTF1_CLOUD_KEY:'K',BUCKET:bucket};
 const snap=()=>{const now=new Date().toISOString();return {schema_version:1,producer:'fastf1-live-bridge',run_id:'r',sequence:seq++,generated_at:now,last_message_at:now,connected:true,
  topic_times:{Heartbeat:{source_time:now,initial_snapshot:false},TimingData:{source_time:now,initial_snapshot:false}},
  topics:{Heartbeat:{},TimingData:{Lines:{}},SessionInfo:{Key:5},SessionStatus:{Status:'Started'}},recent_events:[]};};
 let behaviour='ok';
 globalThis.fetch=async()=>{collectorCalls++;if(behaviour==='down')throw Error('down');await new Promise(r=>setTimeout(r,20));return new Response(JSON.stringify({snapshot:snap(),collector:{state:'recording'}}));};
 return {env,stats:()=>({puts,collectorCalls}),set:b=>{behaviour=b;}};
}

test('questions arriving together share one collector request',async()=>{
 resetLiveGuards();const {env,stats}=setup();
 const answers=await Promise.all(Array.from({length:5},()=>liveRead(env)));
 assert.equal(stats().collectorCalls,1);
 assert.ok(answers.every(a=>a.available&&a.sequence===answers[0].sequence));
});

test('a busy session writes the shared document at most once every 5 seconds',async()=>{
 resetLiveGuards();const {env,stats}=setup();
 await liveRead(env);const first=stats().puts;
 for(let i=0;i<4;i++){await new Promise(r=>setTimeout(r,1200));const a=await liveRead(env);assert.equal(a.available,true);assert.equal(a.freshness.live,true,'answers still use the newest data');}
 assert.equal(stats().puts,first,'no extra writes within 5 s');
});

test('a collector that is down is skipped for 30 seconds instead of retried on every question',async()=>{
 resetLiveGuards();const {env,stats,set}=setup();
 await liveRead(env);set('down');
 const a=await liveRead(env);assert.equal(a.synchronization.ok,false);
 const calls=stats().collectorCalls;
 const b=await liveRead(env);
 assert.equal(stats().collectorCalls,calls,'not called again while paused');
 assert.equal(b.available,true,'saved data is still served');
 assert.match(b.synchronization.error,/일시|paused|skipped/i);
});

import {standingsRoute} from '../worker/standings.js';
import {raceResultsRoute} from '../worker/race-results.js';
test('successful public standings and results may be cached briefly; waiting or errors never',async()=>{
 const cached={get:async()=>({json:async()=>({checked_at:Date.now(),data:{series:'f1',season:new Date().getUTCFullYear(),round:19,provider:'Jolpica',retrieved_at:new Date().toISOString(),categories:[{id:'drivers',label:'드라이버',rows:[{position:1,name:'A',points:1}]}]}})}),put:async()=>{}};
 const ok=await standingsRoute(new Request('https://t/api/championship-standings?series=f1&kind=drivers'),{BUCKET:cached},{});
 assert.equal(ok.status,200);assert.match(ok.headers.get('cache-control'),/public, max-age=60, s-maxage=120/);
 const waiting=await standingsRoute(new Request('https://t/api/championship-standings?series=imsa&kind=drivers&category=default'),{BUCKET:{get:async()=>null,put:async()=>{}}},{waitUntil(){}});
 assert.equal(waiting.status,202);assert.match(waiting.headers.get('cache-control'),/no-store/);
 const bad=await raceResultsRoute(new Request('https://t/api/race-results?series=imsa'));
 assert.equal(bad.status,400);assert.match(bad.headers.get('cache-control'),/no-store/);
});
