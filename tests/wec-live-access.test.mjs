import test from 'node:test';
import assert from 'node:assert/strict';
import {wecActionsPush,wecLiveView,wecLiveAccessCall,wecLoginRoute,WEC_COLLECTOR_WORKFLOW} from '../worker/wec_live.js';

const bucket=()=>{const m=new Map();return {m,get:async k=>m.has(k)?{json:async()=>JSON.parse(m.get(k))}:null,put:async(k,v)=>{m.set(k,v);}};};
const ok=async()=>({});
const push=(env,query,body,method='POST')=>wecActionsPush(new Request('https://site.test/api/wec/actions-push?'+query,{method,headers:{authorization:'Bearer t','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env,{verify:ok});

test('WEC push is accepted only from the WEC workflow token and stores a sanitised table',async()=>{
 assert.match(WEC_COLLECTOR_WORKFLOW,/wec-live-collector\.yml@refs\/heads\/main$/);
 const env={BUCKET:bucket()};
 const rejected=await wecActionsPush(new Request('https://site.test/api/wec/actions-push?window=wec-2026-11-06-monza-11060930',{method:'POST',body:'{}'}),env,{verify:async()=>{throw Error('no');}});
 assert.equal(rejected.status,401);
 assert.equal((await push(env,'window=../x',{})).status,400);
 const id='wec-2026-11-06-monza-11060930';
 assert.equal((await push(env,'window='+id,{window:'wec-other-2026-11060930'})).status,400);
 const r=await push(env,'window='+id,{window:id,state:'reading',records:[{'No.':'007',Lap:'4',password:'x'}],rows_changed_at:new Date().toISOString(),window_open:'2026-11-06T09:20:00Z',window_close:'2026-11-06T11:15:00Z',timing_url:'https://plus.fiawec.com/en/livestream/s-6-hours-of-monza-free-practice-1-78gtpr'});
 assert.equal(r.status,200);
 const stored=JSON.parse(env.BUCKET.m.get('wec/live/current.json'));
 assert.equal(stored.records[0]['No.'],'007');assert.equal('password' in stored.records[0],false);
 assert.equal(stored.timing_url,'https://plus.fiawec.com/en/livestream/s-6-hours-of-monza-free-practice-1-78gtpr');
 assert.equal((await (await push(env,'window='+id,null,'GET')).json()).done,false);
 await push(env,'window='+id+'&final=1',{window:id,state:'session_window_closed'});
 assert.equal((await (await push(env,'window='+id,null,'GET')).json()).done,true);
});

test('WEC is live only while the window is open and the table keeps changing',()=>{
 const now=Date.parse('2026-11-06T10:00:00Z');
 const base={state:'reading',records:[{'No.':'7'}],window_open:'2026-11-06T09:20:00Z',window_close:'2026-11-06T11:15:00Z',received_at:'2026-11-06T09:59:55Z'};
 assert.equal(wecLiveView({...base,rows_changed_at:'2026-11-06T09:59:30Z'},now).live,true);
 assert.equal(wecLiveView({...base,rows_changed_at:'2026-11-06T09:55:00Z'},now).live,false); // still table
 assert.equal(wecLiveView({...base,rows_changed_at:null},now).live,false); // one observation only
 assert.equal(wecLiveView({...base,rows_changed_at:'2026-11-06T09:59:30Z',state:'timing_waiting_start'},now).live,false);
 assert.equal(wecLiveView({...base,rows_changed_at:'2026-11-06T09:59:30Z'},Date.parse('2026-11-06T12:00:00Z')).live,false); // window closed
 assert.equal(wecLiveView(null,now).state,'not_started');
});

test('personal WEC calls go to the account own collector path; crew read the scheduled reader',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url:String(url),options});return Response.json({state:'credentials_required',live:false,records:[]});};
 try{
  const env={FASTF1_CLOUD_URL:'https://collector.test',FASTF1_CLOUD_KEY:'k'};
  const result=JSON.parse((await wecLiveAccessCall('wec_live_status',{},env,{mode:'personal',accountId:'acct-1'})).content[0].text);
  assert.equal(calls[0].url,'https://collector.test/personal/acct-1/wec/snapshot');
  assert.equal(result.state,'credentials_required');assert.match(result.verification_note,/\/live/);
  await wecLiveAccessCall('wec_discover_live',{event:'Monza'},env,{mode:'personal',accountId:'acct-1'});
  assert.equal(calls[1].url,'https://collector.test/personal/acct-1/wec/discover');
  const crewEnv={...env,BUCKET:bucket()};
  crewEnv.BUCKET.m.set('wec/live/current.json',JSON.stringify({state:'reading',records:[{'No.':'8'}],received_at:new Date().toISOString(),rows_changed_at:new Date().toISOString(),window_open:new Date(Date.now()-60000).toISOString(),window_close:new Date(Date.now()+60000).toISOString()}));
  const crew=JSON.parse((await wecLiveAccessCall('wec_live_status',{},crewEnv,{mode:'crew'})).content[0].text);
  assert.equal(crew.live,true);assert.equal(calls.length,2); // no collector call for crew status
 }finally{globalThis.fetch=original;}
});

test('WEC login route: same-origin, personal accounts only, password forwarded once and never echoed',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url:String(url),body:options.body});return Response.json({state:'authenticated',expires_in_seconds:28800});};
 try{
  const env={FASTF1_CLOUD_URL:'https://collector.test',FASTF1_CLOUD_KEY:'k'};
  const req=(origin,body)=>new Request('https://site.test/api/live/wec/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await wecLoginRoute(req('https://evil.test',{}),env,{mode:'personal',accountId:'a'})).status,403);
  assert.equal((await wecLoginRoute(req('https://site.test',{}),env,{mode:'crew'})).status,409);
  assert.equal((await wecLoginRoute(req('https://site.test',{username:'x'}),env,{mode:'personal',accountId:'a'})).status,400);
  const r=await wecLoginRoute(req('https://site.test',{username:' me@x.y ',password:'pw'}),env,{mode:'personal',accountId:'a'});
  const text=await r.text();
  assert.equal(calls[0].url,'https://collector.test/personal/a/wec/login');assert.deepEqual(JSON.parse(calls[0].body),{username:'me@x.y',password:'pw'});
  assert.equal(text.includes('pw'),false);assert.equal(JSON.parse(text).state,'authenticated');
 }finally{globalThis.fetch=original;}
});

test('blocked WEC access asks the user to sign in or give the session link, and briefings follow the card rules',async()=>{
 const {publicWecStatus,WEC_LIVE_INSTRUCTIONS}=await import('../worker/wec_live.js');
 for(const state of ['authentication_action_required','credentials_required'])assert.match(publicWecStatus({state}).next_step,/sign in to FIAWEC\+ themselves in a browser you open.*session link/);
 assert.equal(publicWecStatus({state:'reading'}).next_step,undefined);
 for(const part of ['time left first','with its reason','track condition','kongboda_my_preferences','never type a password','token expires'])assert.ok(WEC_LIVE_INSTRUCTIONS.includes(part),part);
});

test('a stored snapshot from before the change still offers the sign-in-or-link choice',async()=>{
 const {wecLiveView}=await import('../worker/wec_live.js');
 assert.match(wecLiveView({state:'authentication_action_required',received_at:new Date().toISOString()}).next_step,/session link/);
 assert.equal(wecLiveView({state:'reading',received_at:new Date().toISOString()}).next_step,undefined);
});
