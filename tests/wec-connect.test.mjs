import test from 'node:test';
import assert from 'node:assert/strict';
import {saveSignIn,loadSignIn,signInMeta,wecConnectRoute,wecActionsAuth,connectionKey,connectInfo,canConnect} from '../worker/wec_connect.js';
import {wecActionsPush} from '../worker/wec_live.js';

const bucket=()=>{const m=new Map();return {m,get:async k=>m.has(k)?{json:async()=>JSON.parse(m.get(k))}:null,put:async(k,v)=>{m.set(k,v);},delete:async k=>{m.delete(k);}};};
const STATE={cookies:[{name:'appSession',value:'SECRET-COOKIE',domain:'plus.fiawec.com',path:'/'}],origins:[]};
const env=()=>({BUCKET:bucket(),FASTF1_CLOUD_URL:'https://collector.test',FASTF1_CLOUD_KEY:'k'.repeat(40)});
const post=(path,body,origin='https://site.test')=>new Request('https://site.test'+path,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body||{})});

test('a saved FIAWEC+ sign-in is encrypted per account and only that account can read it',async()=>{
 const e=env();
 await saveSignIn(e,'acct-1',STATE);
 const raw=e.BUCKET.m.get('wec/auth/acct-1.json');
 assert.doesNotMatch(raw,/SECRET-COOKIE/);
 assert.deepEqual(await loadSignIn(e,'acct-1'),STATE);
 e.BUCKET.m.set('wec/auth/acct-2.json',raw); // copied to another account: bound to its key, fails
 assert.equal(await loadSignIn(e,'acct-2'),null);
 assert.equal(await loadSignIn({...e,FASTF1_CLOUD_KEY:'x'.repeat(40)},'acct-1'),null);
 assert.equal((await signInMeta(e,'acct-1')).status,'connected');
});

test('crew use the owner connection unless they connect their own account',async()=>{
 assert.equal(connectionKey({mode:'crew',owner:false}),'operator');
 assert.equal(connectionKey({mode:'crew',owner:true,accountId:'o1'}),'operator');
 assert.equal(connectionKey({mode:'crew',owner:false,accountId:'c1'}),'c1');
 assert.equal(canConnect({mode:'crew',owner:false,accountId:'c1'}),true);
 assert.equal(connectionKey({mode:'personal',accountId:'a1'}),'a1');
 assert.equal(connectInfo({mode:'crew',owner:false}).by,'owner');
 assert.match(connectInfo({mode:'crew',owner:true}).url,/account#fiawec$/);
 const e=env();
 const crew=await wecConnectRoute(post('/api/live/wec/connect/start'),e,{mode:'crew',owner:false});
 assert.equal(crew.status,409);
 const info=await (await wecConnectRoute(new Request('https://site.test/api/live/wec/connection'),e,{mode:'crew',owner:false})).json();
 assert.equal(info.can_connect,false);
 assert.equal((await wecConnectRoute(post('/api/live/wec/connect/start',{}, 'https://evil.test'),e,{mode:'personal',accountId:'a1'})).status,403);
});

test('remote sign-in: frames pass through, the finished sign-in is stored and never sent to the browser',async()=>{
 const original=globalThis.fetch,calls=[];
 let reply={state:'signing_in',image:'QUJD',width:390,height:740,host:'auth.staylive.io'};
 globalThis.fetch=async(url,options)=>{calls.push({url:String(url),method:options.method,body:options.body});return Response.json(String(url).endsWith('/restore')?{state:'restored'}:reply);};
 try{
  const e=env(),access={mode:'personal',accountId:'acct-1'};
  const first=await (await wecConnectRoute(post('/api/live/wec/connect/start'),e,access)).json();
  assert.equal(calls[0].url,'https://collector.test/wec/signin/acct-1/start');
  assert.equal(first.image,'QUJD');assert.equal(first.state,'signing_in');
  await wecConnectRoute(post('/api/live/wec/connect/input',{op:'type',text:'me@example.invalid'}),e,access);
  assert.equal(calls[1].url,'https://collector.test/wec/signin/acct-1/input');assert.match(calls[1].body,/"op":"type"/);
  reply={state:'signed_in',storage_state:STATE};
  const res=await wecConnectRoute(new Request('https://site.test/api/live/wec/connect/frame'),e,access);
  const text=await res.text();
  assert.doesNotMatch(text,/SECRET-COOKIE|storage_state/);assert.equal(JSON.parse(text).state,'signed_in');
  assert.deepEqual(await loadSignIn(e,'acct-1'),STATE);
  assert.equal(calls.at(-1).url,'https://collector.test/personal/acct-1/wec/restore');
  const owner=await wecConnectRoute(post('/api/live/wec/connect/start'),e,{mode:'crew',owner:true});
  assert.equal(owner.status,200);assert.equal(calls.at(-1).url,'https://collector.test/wec/signin/operator/start');
  const off=await wecConnectRoute(post('/api/live/wec/disconnect'),e,access);
  assert.equal(off.status,200);assert.equal(await loadSignIn(e,'acct-1'),null);
 }finally{globalThis.fetch=original;}
});

test('the scheduled reader gets the owner sign-in with its workflow token and can save refreshed cookies',async()=>{
 const e=env(),ok=async()=>({}),req=(method,body)=>new Request('https://site.test/api/wec/actions-auth',{method,headers:{authorization:'Bearer t','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await wecActionsAuth(req('GET'),e,{verify:async()=>{throw Error('no');}})).status,401);
 assert.equal((await (await wecActionsAuth(req('GET'),e,{verify:ok})).json()).storage_state,null);
 assert.equal((await (await wecActionsAuth(req('POST',{storage_state:STATE}),e,{verify:ok})).json()).ok,false); // never connected: refresh ignored
 await saveSignIn(e,'operator',STATE);
 assert.deepEqual((await (await wecActionsAuth(req('GET'),e,{verify:ok})).json()).storage_state,STATE);
 const fresh={...STATE,cookies:[{...STATE.cookies[0],value:'NEW'}]};
 assert.equal((await (await wecActionsAuth(req('POST',{storage_state:fresh}),e,{verify:ok})).json()).ok,true);
 assert.equal((await loadSignIn(e,'operator')).cookies[0].value,'NEW');
 // A CAPTCHA or expired sign-in in a session asks the owner to reconnect on the account page.
 const id='wec-2026-11-07-monza-11070930';
 await wecActionsPush(new Request('https://site.test/api/wec/actions-push?window='+id,{method:'POST',headers:{authorization:'Bearer t'},body:JSON.stringify({window:id,state:'sign_in_expired'})}),e,{verify:ok});
 assert.equal((await signInMeta(e,'operator')).status,'needs_reconnect');
});

test('a lapsed connection alerts the Google account that connected it, once per lapse',async()=>{
 const {saveSubscription,b64u}=await import('../worker/web-push.js');
 const m=new Map();
 const BUCKET={m,get:async k=>m.has(k)?{json:async()=>JSON.parse(m.get(k))}:null,put:async(k,v)=>{m.set(k,v);},delete:async k=>{m.delete(k);},
  list:async({prefix})=>({objects:[...m.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key})),truncated:false})};
 const e={BUCKET,FASTF1_CLOUD_KEY:'k'.repeat(40)};
 const key=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const sub=who=>({endpoint:'https://fcm.googleapis.com/fcm/send/'+who,keys:{p256dh:b64u.encode(await_raw),auth:b64u.encode(new Uint8Array(16))}});
 const await_raw=new Uint8Array(await crypto.subtle.exportKey('raw',key.publicKey));
 await saveSubscription(e,'owner-sub',sub('owner'));
 await saveSubscription(e,'someone-else',sub('other'));
 await saveSignIn(e,'operator',STATE,{notify:'owner-sub'});
 const sent=[];const fetchImpl=async url=>{sent.push(String(url));return new Response(null,{status:201});};
 const {markSignIn}=await import('../worker/wec_connect.js');
 const tally=await markSignIn(e,'operator','needs_reconnect',{fetchImpl});
 assert.equal(tally.sent,1);assert.deepEqual(sent,['https://fcm.googleapis.com/fcm/send/owner']);
 assert.equal(await markSignIn(e,'operator','needs_reconnect',{fetchImpl}),null); // already lapsed: no second alert
 assert.equal(sent.length,1);
 await saveSignIn(e,'operator',STATE,{verified:true}); // reconnect keeps who to alert
 assert.equal((await signInMeta(e,'operator')).notify,'owner-sub');
});

test('the site admin (collector host owner) connects FIAWEC+ for the crew, from the site or an AI',async()=>{
 const {wecAccess}=await import('../worker/wec_live.js');
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('admin@example.invalid')))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const env={COLLECTOR_ADMIN_SHA256:hash,LIVE_ANALYSIS_KEY_HASH:'x'};
 const ai=new Request('https://site.test/mcp',{headers:{'oai-authenticated-user-id':'oauth:1','oai-authenticated-user-email':'Admin@example.invalid'}});
 assert.deepEqual(await wecAccess(ai,env),{mode:'crew',owner:true});
 assert.deepEqual(await wecAccess(new Request('https://site.test/account'),env,{email:'admin@example.invalid',sub:'g'}),{mode:'crew',owner:true});
});
