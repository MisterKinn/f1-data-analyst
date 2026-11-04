import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import {accountIdentity} from '../worker/accounts.js';

const origin='https://kongboda-motorsports.jeongmin480.chatgpt.site';
const digest=async s=>Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))).toString('hex');
test('registered crew read one shared collector through ChatGPT MCP and Google website login',async()=>{
 const data=new Map();
 const env={LIVE_ANALYSIS_KEY_HASH:'configured',GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test',FASTF1_CLOUD_URL:'https://collector.example/',FASTF1_CLOUD_KEY:'test',BUCKET:{get:async k=>data.has(k)?{json:async()=>JSON.parse(data.get(k))}:null,put:async(k,v)=>data.set(k,v),delete:async k=>data.delete(k)}};
 const platformHeaders={'oai-authenticated-user-id':'crew-chat','oai-authenticated-user-email':'crew@example.test'};
 const platform=new Request(origin+'/account',{headers:platformHeaders});
 const {account}=await accountIdentity(platform,env,null,{create:true});
 data.set('website-accounts/account/'+account.id+'.json',JSON.stringify({...account,liveAnalysisAccess:{revision:'1'}}));
 const token='a'.repeat(43),google={provider:'google',sub:'crew-google',email:'crew@example.test'};
 await accountIdentity(platform,env,google,{create:true});
 data.set('website-auth/google/session/'+await digest(token)+'.json',JSON.stringify({...google,issuedAt:Date.now(),expires:Date.now()+60000}));
 const googleHeaders={cookie:'__Host-kongboda-google='+token};
 const now=new Date().toISOString(),snapshot={schema_version:1,producer:'fastf1-live-bridge',run_id:'crew-test',sequence:1,generated_at:now,last_message_at:now,connected:true,topic_times:{Heartbeat:{source_time:now,initial_snapshot:false},TimingData:{source_time:now,initial_snapshot:false}},topics:{Heartbeat:{},TimingData:{Lines:{}},SessionInfo:{Key:123,Name:'Practice 1',Meeting:{Name:'Mexico City Grand Prix'}},SessionStatus:{Status:'Started'}},recent_events:[]};
 const realFetch=globalThis.fetch;let reads=0;
 globalThis.fetch=async(url,options)=>{assert.equal(String(url),'https://collector.example/snapshot');assert.equal(options.method,'GET');assert.equal(options.headers.Authorization,'Bearer test');reads++;return Response.json({snapshot,collector:{automatic_collection:true,collection_enabled:true}});};
 try{
  const rpc=headers=>new Request(origin+'/mcp',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'fastf1_live_snapshot',arguments:{recent_events:0}}})});
  const mcp=await (await worker.fetch(rpc(platformHeaders),env)).json();
  assert.equal(mcp.result.isError,false);
  const first=JSON.parse(mcp.result.content[0].text);
  const website=await worker.fetch(new Request(origin+'/api/live/snapshot',{headers:googleHeaders}),env);
  assert.equal(website.status,200);const second=await website.json();
  assert.equal(first.run_id,second.run_id);assert.equal(second.freshness.live,true);assert.equal(second.synchronization.collector.automatic_collection,true);assert.equal(reads,2);
  assert.equal((await worker.fetch(new Request(origin+'/api/live/snapshot'),env)).status,401);
  const outsider={'oai-authenticated-user-id':'outsider','oai-authenticated-user-email':'other@example.test'};
  // Every signed-in account now reads the same shared F1 data.
  const outsiderResponse=await (await worker.fetch(new Request(origin+'/api/live/snapshot',{headers:outsider}),env)).json();assert.equal(outsiderResponse.available,true);assert.equal(outsiderResponse.run_id,first.run_id);
  assert.equal(JSON.parse((await (await worker.fetch(rpc(outsider),env)).json()).result.content[0].text).available,true);
  env.LIVE_ANALYSIS_KEY_REVISION='2';
  // A revoked crew key no longer gives collector controls, but live data stays readable.
  assert.equal((await (await worker.fetch(new Request(origin+'/api/live/snapshot',{headers:googleHeaders}),env)).json()).available,true);
  env.LIVE_ANALYSIS_KEY_REVISION='1';
  assert.equal((await worker.fetch(new Request(origin+'/api/live/cloud/stop',{method:'POST',headers:{...googleHeaders,origin}}),env)).status,403);
  snapshot.generated_at=new Date(Date.now()-120000).toISOString();
  const stale=await (await worker.fetch(new Request(origin+'/api/live/snapshot',{headers:googleHeaders}),env)).json();
  assert.equal(stale.synchronization.ok,false);assert.equal(stale.freshness.live,true);
 }finally{globalThis.fetch=realFetch;}
});
