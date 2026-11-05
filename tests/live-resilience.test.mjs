import assert from 'node:assert/strict';
import {test} from 'node:test';
import {liveRead,actionsPush} from '../worker/live.js';
import {standingsRoute} from '../worker/standings.js';
import {raceResultsRoute} from '../worker/race-results.js';

function setup(){
 const entries=new Map();let puts=0,collectorCalls=0,seq=10;
 const bucket={get:async k=>entries.has(k)?{etag:entries.get(k).etag,json:async()=>JSON.parse(entries.get(k).body)}:null,
  put:async(k,v)=>{puts++;entries.set(k,{body:v,etag:'e'+puts});return {etag:'e'+puts};}};
 const env={FASTF1_CLOUD_URL:'https://collector.example',FASTF1_CLOUD_KEY:'K',BUCKET:bucket};
 const snap=()=>{const now=new Date().toISOString();return {schema_version:1,producer:'fastf1-live-bridge',run_id:'r',sequence:seq++,generated_at:now,last_message_at:now,connected:true,
  topic_times:{Heartbeat:{source_time:now,initial_snapshot:false},TimingData:{source_time:now,initial_snapshot:false}},
  topics:{Heartbeat:{},TimingData:{Lines:{}},SessionInfo:{Key:5},SessionStatus:{Status:'Started'}},recent_events:[]};};
 nextSnapshot=snap;
 let behaviour='ok';
 globalThis.fetch=async()=>{collectorCalls++;if(behaviour==='down')throw Error('down');await new Promise(r=>setTimeout(r,20));return new Response(JSON.stringify({snapshot:snap(),collector:{state:'recording'}}));};
 return {env,stats:()=>({puts,collectorCalls}),set:b=>{behaviour=b;}};
}
let nextSnapshot=null;

test('a busy session writes the shared document at most once every 5 seconds',async()=>{
 const {env,stats}=setup();
 const push=()=>actionsPush(new Request('https://site.example/api/live/actions-push?window=2026-21-1',{method:'POST',headers:{authorization:'Bearer ok','content-type':'application/json'},body:JSON.stringify(nextSnapshot())}),env,{verify:async()=>{}});
 await push();const first=stats().puts;
 for(let i=0;i<3;i++){await new Promise(r=>setTimeout(r,1200));assert.equal((await push()).status,200);}
 assert.equal(stats().puts,first,'no extra writes within 5 s');
 assert.equal((await liveRead(env)).available,true);
});

test('F1 live reads never call the old pull server',async()=>{
 const {env,stats}=setup();
 await liveRead(env);await liveRead(env);
 assert.equal(stats().collectorCalls,0);
});

test('successful public standings and results may be cached briefly; waiting or errors never',async()=>{
 const cached={get:async()=>({json:async()=>({checked_at:Date.now(),data:{series:'f1',season:new Date().getUTCFullYear(),round:19,provider:'Jolpica',retrieved_at:new Date().toISOString(),categories:[{id:'drivers',label:'드라이버',rows:[{position:1,name:'A',points:1}]}]}})}),put:async()=>{}};
 const ok=await standingsRoute(new Request('https://t/api/championship-standings?series=f1&kind=drivers'),{BUCKET:cached},{});
 assert.equal(ok.status,200);assert.match(ok.headers.get('cache-control'),/public, max-age=60, s-maxage=120/);
 const waiting=await standingsRoute(new Request('https://t/api/championship-standings?series=imsa&kind=drivers&category=default'),{BUCKET:{get:async()=>null,put:async()=>{}}},{waitUntil(){}});
 assert.equal(waiting.status,202);assert.match(waiting.headers.get('cache-control'),/no-store/);
 const bad=await raceResultsRoute(new Request('https://t/api/race-results?series=imsa'));
 assert.equal(bad.status,400);assert.match(bad.headers.get('cache-control'),/no-store/);
});
