import assert from 'node:assert/strict';
import {liveRoutes,liveRead} from '../worker/live.js';
const entries=new Map();
const env={FASTF1_CLOUD_URL:'https://collector.example',FASTF1_CLOUD_KEY:'TEST-KEY',BUCKET:{put:async(k,v)=>entries.set(k,v),get:async k=>entries.has(k)?{json:async()=>JSON.parse(entries.get(k))}:null}};
const now=new Date().toISOString();
const snapshot={schema_version:1,producer:'fastf1-live-bridge',run_id:'test',sequence:1,generated_at:now,last_message_at:now,connected:true,topics:{SessionInfo:{Key:123},SessionStatus:{Status:'Started'}},recent_events:[]};
const request=(path,auth=true,origin='https://site.example')=>new Request('https://site.example/api/live/cloud/'+path,{method:'POST',headers:{origin,...(auth?{'oai-authenticated-user-id':'owner'}:{})}});
let calls=0;
globalThis.fetch=async(url,options)=>{
 calls++;
 assert.equal(new URL(url).host,'collector.example');
 assert.equal(options.headers.Authorization,'Bearer TEST-KEY');
 assert.equal(options.redirect,'manual');
 return new Response(JSON.stringify(new URL(url).pathname==='/stop'?{ok:true}:{snapshot,collector:{state:'recording',supported_sessions:['Race','Sprint'],next_session:{name:'Race',event:'Test Grand Prix',secret:'HIDDEN'},secret:'MUST NOT LEAK'}}));
};
assert.equal((await liveRoutes(request('poll',false),env)).status,401);
assert.equal((await liveRoutes(request('poll',true,'https://evil.example'),env)).status,403);
assert.equal(calls,0);
const response=await liveRoutes(request('poll'),env);
assert.equal(response.status,200);
const payload=await response.json();
assert.equal(payload.freshness.live,true);
assert.equal(payload.collector.secret,undefined);
assert.deepEqual(payload.collector.supported_sessions,['Race','Sprint']);
assert.equal(payload.collector.next_session.name,'Race');
assert.equal(payload.collector.next_session.secret,undefined);
assert.deepEqual(payload.collector.next_practice,payload.collector.next_session);
assert.ok(entries.has('live/sessions/123.json'));
assert.equal((await liveRoutes(request('stop'),env)).status,200);
assert.equal(JSON.parse(entries.get('live/current.json')).snapshot.connected,false);
globalThis.fetch=async()=>new Response('Unauthorized',{status:401});
assert.equal((await liveRoutes(request('poll'),env)).status,502);
globalThis.fetch=async()=>new Response(null,{status:302,headers:{Location:'https://other.example'}});
assert.equal((await liveRoutes(request('poll'),env)).status,502);
console.log('PASS: private cloud proxy, same-origin protection, secret filtering, storage, stop and upstream failure');


// Read-only collector synchronization works without browser polling.
let snapshotReads=0;
globalThis.fetch=async(url,options)=>{
 assert.equal(new URL(url).pathname,'/snapshot');
 assert.equal(options.method,'GET');
 snapshotReads++;
 return new Response(JSON.stringify({snapshot,collector:{automatic_collection:true,collection_enabled:true,supported_sessions:['Race']}}));
};
const synchronized=await liveRead(env,{});
assert.equal(snapshotReads,1);
assert.equal(synchronized.freshness.live,true);
assert.equal(synchronized.synchronization.collector.automatic_collection,true);
const old=new Date(Date.now()-120000).toISOString();
globalThis.fetch=async()=>new Response(JSON.stringify({snapshot:{...snapshot,generated_at:old,last_message_at:old}}));
assert.equal((await liveRead(env,{})).freshness.live,false);
globalThis.fetch=async()=>{throw Error('network failure');};
const unavailable=await liveRead(env,{});
assert.equal(unavailable.synchronization.ok,false);
assert.equal(unavailable.freshness.live,false);
console.log('PASS: collector read synchronization, automatic mode, stale feed and failure handling');
