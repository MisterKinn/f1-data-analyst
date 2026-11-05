import assert from 'node:assert/strict';
import {liveRead,boundedStoredText,actionsPush} from '../worker/live.js';
import {sessionCheck} from '../api/index.js';
import {accountIdentity} from '../worker/accounts.js';

// 1. Session check strength: assets skip, public GETs verify the signature only,
//    account/OAuth/MCP/live routes and all writes keep the revocation check.
for(const path of ['/assets/website.js','/assets/fonts/x.woff2'])assert.equal(sessionCheck('GET',path),'skip');
for(const path of ['/','/guide','/about','/championships/f1','/api/race-calendar','/api/championship-standings'])assert.equal(sessionCheck('GET',path),'signature');
for(const path of ['/account','/account/preferences','/oauth/authorize','/auth/google/start','/mcp','/api/live/snapshot','/api/status','/live','/download/fastf1-live.zip'])assert.equal(sessionCheck('GET',path),'revocation');
for(const method of ['POST','PUT','DELETE'])assert.equal(sessionCheck(method,'/'),'revocation');
assert.equal(sessionCheck('GET','/accounting-like'),'signature');

// 2. Trimming an oversized snapshot gives the same result as the original
//    "drop 20 events and re-encode" loop.
const original=value=>{
 let stored=JSON.stringify(value);
 while(new TextEncoder().encode(stored).length>840000&&value.snapshot.recent_events.length){value.snapshot.recent_events=value.snapshot.recent_events.slice(20);stored=JSON.stringify(value);}
 return stored;
};
for(const [count,size] of [[10,100],[400,2500],[400,3000],[333,4100]]){
 const make=()=>({received_at:'t',source:'s',snapshot:{topics:{TimingData:{Lines:{'1':{Position:'1'}}}},recent_events:Array.from({length:count},(_,i)=>({sequence:i,patch:'가'.repeat(size/3)+'x'.repeat(i%7)}))}});
 assert.equal(boundedStoredText(make()),original(make()),`trim ${count}x${size}`);
}

// 3. Repeated questions with no new collector data do not rewrite storage.
const entries=new Map();let puts=0;
const bucket={get:async k=>entries.has(k)?{etag:entries.get(k).etag,json:async()=>JSON.parse(entries.get(k).body)}:null,
 put:async(k,v)=>{puts++;entries.set(k,{body:v,etag:'e'+puts});return {etag:'e'+puts};}};
const env={FASTF1_CLOUD_URL:'https://collector.example',FASTF1_CLOUD_KEY:'K',BUCKET:bucket};
const now=new Date().toISOString();
let snapshot={schema_version:1,producer:'fastf1-live-bridge',run_id:'r',sequence:5,generated_at:now,last_message_at:now,connected:true,
 topic_times:{Heartbeat:{source_time:now,initial_snapshot:false},TimingData:{source_time:now,initial_snapshot:false}},
 topics:{Heartbeat:{},TimingData:{Lines:{}},SessionInfo:{Key:77},SessionStatus:{Status:'Started'}},recent_events:[]};
const push=()=>actionsPush(new Request('https://site.example/api/live/actions-push?window=2026-21-1',{method:'POST',headers:{authorization:'Bearer ok','content-type':'application/json'},body:JSON.stringify(snapshot)}),env,{verify:async()=>{}});
await push();const first=await liveRead(env);
assert.equal(first.available,true);
assert.equal(puts,2,'first sync writes current + session copy');
await push();const second=await liveRead(env);
assert.equal(puts,2,'same sequence: no rewrite');
assert.equal(second.received_at,first.received_at);
assert.equal(second.sequence,5);
snapshot={...snapshot,sequence:6,generated_at:new Date(Date.now()+1000).toISOString()};
await push();
assert.equal(puts,2,'the shared document is written at most every 5 s');
for(const [k,v] of entries){const d=JSON.parse(v.body);d.received_at=new Date(Date.now()-6000).toISOString();entries.set(k,{...v,body:JSON.stringify(d)});}
await push();
assert.equal(puts,4,'new data is written once 5 s have passed');
snapshot={...snapshot,connected:false};
await push();
assert.equal(puts,6,'a connection change is written even without new packets');
assert.equal(JSON.parse(entries.get('live/current.json').body).snapshot.connected,false);

// 4. Existing accounts are read without a Firestore transaction; new accounts still
//    use the transaction.
const store=new Map();let transactions=0;
const plain={get:async k=>store.has(k)?{json:async()=>JSON.parse(store.get(k))}:null,put:async(k,v,o)=>{if(o?.onlyIf?.etagDoesNotMatch==='*'&&store.has(k))return null;store.set(k,v);return {};},delete:async k=>store.delete(k)};
const accountEnv={BUCKET:{...plain,atomic:async callback=>{transactions++;return callback(plain);}}};
const request=new Request('https://site.example/');
const google={provider:'google',sub:'g-1',email:'a@test',name:'Kim Jeongmin'};
const created=await accountIdentity(request,accountEnv,google,{create:true});
assert.ok(created.account?.id);
assert.equal(transactions,1,'first visit creates the account in a transaction');
const again=await accountIdentity(request,accountEnv,google,{create:true});
assert.equal(again.account.id,created.account.id);
assert.equal(transactions,1,'repeat visit: no transaction');
await accountIdentity(request,accountEnv,{...google,name:'Lee Minho'},{create:true});
assert.equal(transactions,2,'a name change still goes through the transaction');
console.log('cpu savings: ok');
