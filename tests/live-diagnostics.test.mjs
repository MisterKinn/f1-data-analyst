import assert from 'node:assert/strict';
import test from 'node:test';
import {freshness,validateSnapshot,liveRead,liveRoutes} from '../worker/live.js';
import {METRICS,validateDiagnostics,readDiagnostics} from '../worker/live-diagnostics.js';
import {beginRequestMeasurement,saveRequestMeasurement} from '../server/request-diagnostics.js';
import worker from '../worker/index.js';

const now='2026-11-06T15:40:00Z',old='2026-11-06T15:05:00Z';
const base=()=>({schema_version:1,producer:'fastf1-live-bridge',run_id:'r',sequence:2,connected:true,generated_at:now,last_message_at:now,
 topics:{SessionInfo:{Key:123},SessionStatus:{Status:'Started'},Heartbeat:{},TimingData:{Lines:{}}},topic_times:{Heartbeat:{source_time:now,initial_snapshot:false},TimingData:{source_time:now,initial_snapshot:false}},recent_events:[]});
const record=()=>({version:1,session_key:123,run_id:'12345678-1234-1234-1234-123456789012',interval_seconds:10,
 samples:[{sequence:1,at:now,...Object.fromEntries(METRICS.map(key=>[key,null])),process_cpu_percent_one_core:100}]});
const bucket=()=>{const entries=new Map();return {entries,get:async key=>entries.has(key)?{etag:entries.get(key).etag,json:async()=>JSON.parse(entries.get(key).body)}:null,
 put:async(key,body,options={})=>{const current=entries.get(key),condition=options.onlyIf;if(condition?.etagMatches&&condition.etagMatches!==current?.etag||condition?.etagDoesNotMatch==='*'&&current)return null;const etag=String(Number(current?.etag??0)+1);entries.set(key,{body,etag});return {etag};},
 list:async({prefix})=>({objects:[...entries.keys()].filter(key=>key.startsWith(prefix)).map(key=>({key})),truncated:false})};};

test('recent receipt cannot disguise 35-minute-old source, missing/initial clocks or future clocks',()=>{
 const s=base(),at=Date.parse(now);assert.equal(freshness(s,now,at).live,true);
 for(const topic of ['Heartbeat','TimingData']){
  for(const change of [{source_time:old},{source_time:'invalid'},{initial_snapshot:true},{source_time:'2026-11-06T16:40:00Z'},{source_time:'2026-11-06T15:40:00'}]){
   const changed=structuredClone(s);Object.assign(changed.topic_times[topic],change);assert.equal(freshness(changed,now,at).live,false);
  }
 }
 assert.equal(freshness({...s,topic_times:{}},now,at).live,false);
 const missing=structuredClone(s);delete missing.topics.TimingData;assert.equal(freshness(missing,now,at).live,false);
});

test('cloud sync archives CPU history, exposes summary and refuses stale generated times and sequences',async()=>{
 const store=bucket(),env={BUCKET:store,FASTF1_CLOUD_URL:'https://collector.example/',FASTF1_CLOUD_KEY:'test'};
 const s=base();s.diagnostics=record();const original=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({snapshot:s});
 try{
  await liveRead(env);let saved=(await (await store.get('live/current.json')).json()).snapshot;
  assert.equal(saved.diagnostics.latest.process_cpu_percent_one_core,100);assert.equal(saved.diagnostics.samples,undefined);
  const history=await readDiagnostics(env,new URLSearchParams({session_key:'123'}));assert.equal(history.samples.length,1);
  s.generated_at=old;s.sequence=3;assert.equal((await liveRead(env)).synchronization.ok,false);
  s.generated_at=now;s.sequence=1;assert.equal((await liveRead(env)).synchronization.ok,false);
  saved=(await (await store.get('live/current.json')).json()).snapshot;assert.equal(saved.sequence,2);
  const unauth=await liveRoutes(new Request('https://site.test/api/live/diagnostics?session_key=123'),env);assert.equal(unauth.status,401);
  const denied=await worker.fetch(new Request('https://site.test/api/live/diagnostics?session_key=123',{headers:{'oai-authenticated-user-id':'outsider'}}),{...env,LIVE_ANALYSIS_KEY_HASH:'configured'});assert.equal(denied.status,403);
  const rpc=new Request('https://site.test/mcp',{method:'POST',headers:{'oai-authenticated-user-id':'owner','content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'fastf1_diagnostics',arguments:{session_key:123}}})});
  assert.equal(JSON.parse((await (await worker.fetch(rpc,env)).json()).result.content[0].text).samples.length,1);
 }finally{globalThis.fetch=original;}
});

test('diagnostic schema bounds data, session identity and numeric measurements',()=>{
 const s=record();s.samples[0].untrusted='do not store';assert.equal(validateDiagnostics(s,123).samples[0].untrusted,undefined);
 assert.throws(()=>validateDiagnostics(s,124));s.samples[0].rss_bytes=Infinity;assert.throws(()=>validateDiagnostics(s,123));
 const snapshot=base();snapshot.diagnostics=record();snapshot.diagnostics.password='accidental credential';assert.throws(()=>validateSnapshot(snapshot));
});

test('a concurrent newer write wins and an older upload reports conflict',async()=>{
 const store=bucket(),s=base();await store.put('live/current.json',JSON.stringify({snapshot:s,received_at:now}));
 const put=store.put;let injected=false;
 store.put=async(key,body,options)=>{
  if(key==='live/current.json'&&!injected){injected=true;await put(key,JSON.stringify({snapshot:{...s,sequence:4},received_at:now}));}
  return put(key,body,options);
 };
 const request=new Request('https://site.test/api/live/snapshot',{method:'POST',headers:{'content-type':'application/json','origin':'https://site.test','oai-authenticated-user-id':'owner'},body:JSON.stringify({...s,sequence:3})});
 assert.equal((await liveRoutes(request,{BUCKET:store})).status,409);
 assert.equal((await (await store.get('live/current.json')).json()).snapshot.sequence,4);
});

test('a CPU-history storage failure does not block otherwise valid timing',async()=>{
 const store=bucket(),put=store.put;
 store.put=async(key,...args)=>{if(key.startsWith('live/diagnostics/'))throw Error('storage failure');return put(key,...args);};
 const s=base();s.diagnostics=record();const original=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({snapshot:s});
 try{
  const result=await liveRead({BUCKET:store,FASTF1_CLOUD_URL:'https://collector.example/',FASTF1_CLOUD_KEY:'test'});
  assert.equal(result.available,true);assert.equal(result.diagnostics.persistence.ok,false);
 }finally{globalThis.fetch=original;}
});

test('Vercel request CPU survives in bucket and has an explicit process-only scope',async()=>{
 const store=bucket(),start=beginRequestMeasurement();await saveRequestMeasurement(store,start,'a'.repeat(40));
 const result=await readDiagnostics({BUCKET:store},new URLSearchParams({scope:'vercel',date:start.at.slice(0,10)}));
 assert.equal(result.samples.length,1);assert.ok(result.samples[0].process_cpu_user_ms>=0);assert.match(result.samples[0].scope,/Not host CPU saturation/);
 assert.equal(JSON.stringify(result).includes('Authorization'),false);
});
