import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {hostMessage,hostCollectorRoute} from '../worker/collector-auth.js';
import {chooseHolder,decideBaton,chooseLead,readFleet,fleetAdminRoute,hostLinkRoute,findLinkCode,linkHost,isOwner,BEAT_FRESH_MS} from '../worker/collector-fleet.js';

const b64u=b=>Buffer.from(b).toString('base64url');
const SITE='https://kongboda-motorsports.vercel.app';
async function makeHost(name){
 const {publicKey,privateKey}=await crypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
 const key=b64u(await crypto.subtle.exportKey('raw',publicKey));
 const sign=async(method,url,body='')=>{const u=new URL(url),ts=Math.floor(Date.now()/1000);const msg=hostMessage(method,u.pathname+u.search,String(ts),createHash('sha256').update(body).digest('hex'));return `KongbodaHost name=${name},ts=${ts},q=${b64u(u.search.slice(1))},sig=${b64u(await crypto.subtle.sign({name:'Ed25519'},privateKey,new TextEncoder().encode(msg)))}`;};
 const call=async(env,method,path,body)=>{const url=SITE+path,text=body===undefined?'':typeof body==='string'?body:JSON.stringify(body);
  const r=await hostCollectorRoute(new Request(url,{method,headers:{authorization:await sign(method,url,text),'content-type':'application/json'},...(method==='POST'?{body:text}:{})}),env);return [r.status,await r.json()];};
 return {name,key,sign,call};
}
function memoryEnv(extra={}){const store=new Map();return {store,env:{COLLECTOR_ADMIN_SHA256:'c8cd3c6427301eaf6665bccacd65ddb614527acc843a15463e3faba57124c351',BUCKET:{get:async k=>store.has(k)?{json:async()=>JSON.parse(store.get(k))}:null,put:async(k,v)=>{store.set(k,typeof v==='string'?v:JSON.stringify(v));},delete:async k=>{store.delete(k);}},...extra}};}
const snapshot=seq=>JSON.stringify({schema_version:1,producer:'fastf1-live-bridge',run_id:'r1',sequence:seq,generated_at:new Date(Date.now()+seq).toISOString(),last_message_at:new Date().toISOString(),connected:true,topics:{SessionInfo:{Key:9999,Name:'Practice 1'},SessionStatus:{Status:'Started'}},recent_events:[]});
const W='2026-20-1';

test('baton: two hosts record, one publishes; failover is sticky and retires the silent host',()=>{
 const H=(name,extra={})=>({name,status:'approved',...extra});
 const hosts=[H('h1'),H('h2'),H('h3'),H('h4')];let now=Date.parse('2026-11-06T16:00:00Z');
 const beats={};const beat=(name,ready=true,window=W)=>{(beats[name]??={}).f1={at:new Date(now).toISOString(),window,ready};};
 const run=(prev,opts={})=>decideBaton(opts.hosts||hosts,beats,'f1',W,prev,{now,warmCount:opts.warm??2});
 // Session start: nobody receives yet -> rank 1 holds, ranks 1-2 record.
 for(const n of ['h4','h3','h2','h1'])beat(n,false);
 let r=run(null);assert.equal(r.holder,'h1');assert.deepEqual([...r.warm],['h1','h2']);
 // Rank 1 receives: it keeps the baton for the session.
 beat('h1');beat('h2');r=run(r.state);assert.equal(r.holder,'h1');
 // Rank 1 loses power: its beat ages out -> rank 2 publishes, rank 3 becomes the new spare.
 now+=BEAT_FRESH_MS+1000;for(const n of ['h2','h3','h4'])beat(n);
 r=run(r.state);assert.equal(r.holder,'h2');assert.deepEqual([...r.warm],['h2','h3']);assert.deepEqual(r.state.retired,['h1']);
 // Rank 1 comes back: no switch mid-session, and it stays off F1.
 beat('h1');r=run(r.state);assert.equal(r.holder,'h2');assert.ok(!r.warm.has('h1'));
 // Rank 2 dies too: rank 3 publishes, rank 4 is the spare.
 now+=BEAT_FRESH_MS+1000;for(const n of ['h1','h3','h4'])beat(n);
 r=run(r.state);assert.equal(r.holder,'h3');assert.deepEqual([...r.warm],['h3','h4']);
 // Rank 3 publishes with no fresh spare left: retired rank 1 fills the spare slot.
 r=run(r.state);assert.deepEqual([...r.warm],['h3','h4']);
 now+=BEAT_FRESH_MS+1000;for(const n of ['h1','h3'])beat(n);r=run(r.state);assert.deepEqual([...r.warm],['h3','h1']);
 // Everyone but the retired rank 1 is gone: it is the last resort.
 now+=BEAT_FRESH_MS+1000;beat('h1');r=run(r.state);assert.equal(r.holder,'h1');
 // A single computer is enough.
 for(const k of Object.keys(beats))delete beats[k];beat('h3');
 r=run(null);assert.equal(r.holder,'h3');assert.deepEqual([...r.warm],['h3']);
 // A holder that never receives (F1 login broken) hands over to one that does.
 for(const k of Object.keys(beats))delete beats[k];beat('h1',false);beat('h2',true);
 r=run({holder:'h1',since:new Date(now).toISOString(),retired:[]});assert.equal(r.holder,'h2');assert.deepEqual(r.state.retired,[]);
 // Cold hosts are spares only after the others; warm_count 1 = only the publisher records.
 for(const k of Object.keys(beats))delete beats[k];for(const n of ['h1','h2','h3'])beat(n);
 r=run(null,{hosts:[H('h1'),H('h2',{cold:true}),H('h3')]});assert.deepEqual([...r.warm],['h1','h3']);
 r=run(null,{warm:1});assert.deepEqual([...r.warm],['h1']);
 // Paused hosts and other windows are ignored.
 r=run(null,{hosts:[H('h1',{enabled:false}),H('h2'),H('h3')]});assert.equal(r.holder,'h2');
 beat('h1',true,'2026-20-2');r=run(null);assert.equal(r.holder,'h2');
 assert.equal(chooseLead(hosts,{h2:{_:{at:new Date(now-60_000).toISOString()}},h3:{_:{at:new Date(now).toISOString()}}},now),'h2');
});

test('built-in hosts come first and keep their code key',async()=>{
 const {env,store}=memoryEnv();
 store.set('collector/fleet.json',JSON.stringify({revision:3,hosts:[{name:'friend',key:'A'.repeat(43),status:'approved',enabled:true}]}));
 const fleet=await readFleet(env,[{name:'mine',key:'B'.repeat(43)}]);
 assert.deepEqual(fleet.hosts.map(h=>h.name),['mine','friend']);assert.equal(fleet.revision,3);
});

test('end to end: register, approve, baton gating, failover and hand-back',async()=>{
 const {env,store}=memoryEnv();
 const mine=await makeHost('mine'),friend=await makeHost('friend'),stranger=await makeHost('stranger');
 const {COLLECTOR_HOSTS}=await import('../worker/collector-hosts.js');
 const saved=COLLECTOR_HOSTS.splice(0,COLLECTOR_HOSTS.length,{name:'mine',key:mine.key});
 try{
  // A new computer registers itself and waits for approval.
  const [rs,reg]=await friend.call(env,'POST','/api/live/host-register',{name:'friend',key:friend.key,os:'macOS 15'});
  assert.equal(rs,202);assert.equal(reg.status,'pending');assert.equal(reg.linked,false);
  assert.match(reg.link_code,/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);assert.equal(reg.link_url,SITE+'/account?host_link='+reg.link_code);
  const again=(await friend.call(env,'POST','/api/live/host-register',{name:'friend',key:friend.key}))[1];
  assert.equal(again.link_code,reg.link_code,'same code until it expires');
  assert.equal((await friend.call(env,'POST','/api/live/host-beat',{window:W,ready:true}))[0],401,'pending host cannot beat');
  const twin=await makeHost('friend');
  assert.equal((await twin.call(env,'POST','/api/live/host-register',{name:'friend',key:twin.key}))[0],409,'name taken by another computer');
  const forged=await stranger.call(env,'POST','/api/live/host-register',{name:'other',key:friend.key});
  assert.equal(forged[0],401,'cannot register a key it does not hold');
  // Owner approves on the account page.
  const owner={email:'owner@example.com',provider:'google',sub:'o'};
  const admin=(body,who=owner)=>fleetAdminRoute(new Request(SITE+'/account/hosts',{method:body?'POST':'GET',headers:{origin:SITE,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env,who);
  assert.equal((await admin(null,{email:'someone@example.com'})).status,403);
  assert.equal((await admin({action:'approve',name:'friend'},{email:'someone@example.com'})).status,403);
  const early=await admin({action:'approve',name:'friend'});
  assert.equal(early.status,400,'not linked to an account yet');
  assert.equal((await friend.call(env,'POST','/api/live/host-beat',{window:W,ready:true}))[0],401,'unlinked host cannot collect');
  assert.deepEqual(await findLinkCode(env,reg.link_code),{code:reg.link_code,name:'friend',os:'macOS 15'});
  assert.equal(await findLinkCode(env,'ABCD-EFGH'),null);
  assert.equal(await linkHost(env,reg.link_code,{id:'acc-friend',name:'민수',email:'minsu@example.com'}),'friend');
  await assert.rejects(linkHost(env,reg.link_code,{id:'acc-other'}),/만료/,'code is single-use');
  const linked=(await friend.call(env,'POST','/api/live/host-register',{name:'friend',key:friend.key}))[1];
  assert.equal(linked.linked,true);assert.equal(linked.account_name,'민수');assert.equal(linked.link_code,undefined);
  // Linking registers it: no owner approval needed.
  const approved=await (await admin(null)).json();
  assert.equal(approved.hosts[1].status,'approved');
  assert.deepEqual(approved.hosts[1].account,{name:'민수',email:'minsu@example.com'});
  assert.equal(approved.hosts[0].account.email,null,'built-in host belongs to the owner');
  assert.deepEqual(approved.hosts.map(h=>[h.name,h.status,h.priority]),[['mine','approved',1],['friend','approved',2]]);
  // Session: both record, mine publishes, friend stands by.
  let [s,b]=await mine.call(env,'POST','/api/live/host-beat',{window:W,ready:true,os:'Windows 11',version:'v1'});
  assert.equal(s,200);assert.equal(b.active,true);
  [s,b]=await friend.call(env,'POST','/api/live/host-beat',{window:W,ready:true,os:'macOS 15'});
  assert.equal(b.active,false);assert.equal(b.holder,'mine');assert.equal(b.priority,2);
  const push=(h,seq)=>h.call(env,'POST','/api/live/actions-push?window='+W,snapshot(seq));
  assert.equal((await push(mine,1))[0],200);
  const refused=await push(friend,2);assert.equal(refused[0],409);assert.equal(refused[1].holder,'mine');
  // My PC goes quiet: its last beat ages out, the friend takes over.
  const beat=JSON.parse(store.get('collector/beat/mine/f1.json'));beat.at=new Date(Date.now()-BEAT_FRESH_MS-1000).toISOString();store.set('collector/beat/mine/f1.json',JSON.stringify(beat));
  [s,b]=await friend.call(env,'POST','/api/live/host-beat',{window:W,ready:true});
  assert.equal(b.active,true);assert.equal((await push(friend,3))[0],200);
  // My PC comes back mid-session: it does not take the baton back (no switching
  // mid-session) and does not even reconnect, since two hosts already record.
  [s,b]=await mine.call(env,'POST','/api/live/host-beat',{window:W,ready:true});
  assert.equal(b.active,false);assert.equal(b.retired,true);assert.equal(b.holder,'friend');
  assert.equal((await push(mine,4))[0],409);assert.equal((await push(friend,5))[0],200);
  const status=await (await admin(null)).json();
  assert.equal(status.holders['f1:'+W],'friend');assert.equal(status.hosts[1].state,'publishing');
  await admin({action:'up',name:'friend',revision:status.revision});
  [s,b]=await friend.call(env,'POST','/api/live/host-beat',{window:W,ready:true});assert.equal(b.active,true);
  // Stale revision is refused; pause stops a host's uploads.
  assert.equal((await admin({action:'down',name:'friend',revision:0})).status,409);
  await admin({action:'pause',name:'friend'});
  assert.equal((await push(friend,7))[0],409);
  [s,b]=await mine.call(env,'POST','/api/live/host-beat',{window:W,ready:true});
  assert.equal(b.active,true,'retired host is the last resort when nobody else is left');
  assert.equal((await admin({action:'remove',name:'mine'})).status,400,'built-in host cannot be removed');
  await admin({action:'cold',name:'mine'});
  [s,b]=await mine.call(env,'POST','/api/live/host-beat',{window:W,ready:true});assert.equal(b.cold,true);
  assert.equal((await (await admin(null)).json()).hosts.find(h=>h.name==='mine').cold,true);
  assert.equal((await admin({action:'remove',name:'friend'})).status,200);
  assert.equal((await friend.call(env,'POST','/api/live/host-beat',{window:W}))[0],401,'removed host is out');
  // WEC switched on for my PC: its own baton, F1 unaffected.
  await admin({action:'jobs',name:'mine',jobs:['f1','wec']});
  assert.equal((await admin({action:'jobs',name:'mine',jobs:['nascar']})).status,400);
  [s,b]=await mine.call(env,'POST','/api/live/host-beat',{series:'wec',window:'2026-wec-8-race',ready:true});
  assert.equal(b.active,true);assert.equal(b.series,'wec');assert.deepEqual(b.jobs,['f1','wec']);
  const fleetNow=await (await admin(null)).json();
  assert.deepEqual(fleetNow.hosts[0].live.map(j=>j.series).sort(),['f1','wec']);
  await admin({action:'warm_count',value:3});assert.equal((await (await admin(null)).json()).warm_count,3);
  assert.equal((await admin({action:'warm_count',value:9})).status,400);
  // Update now: every host sees the request on its next heartbeat.
  assert.equal(b.update_at,null);
  await admin({action:'update_all'});
  [s,b]=await mine.call(env,'POST','/api/live/host-beat',{window:null});
  assert.ok(Date.parse(b.update_at)>Date.now()-60_000);
 }finally{COLLECTOR_HOSTS.splice(0,COLLECTOR_HOSTS.length,...saved);}
});

test('hosts without heartbeats (older collector code) are not gated',async()=>{
 const {env}=memoryEnv();const mine=await makeHost('legacy');
 const {COLLECTOR_HOSTS}=await import('../worker/collector-hosts.js');COLLECTOR_HOSTS.push({name:'legacy',key:mine.key});
 try{assert.equal((await mine.call(env,'POST','/api/live/actions-push?window='+W,snapshot(1)))[0],200);}finally{COLLECTOR_HOSTS.pop();}
});

test('only the listed collector admin manages hosts',async()=>{
 const env={COLLECTOR_ADMIN_SHA256:'d648b243a3e817eaa3309e00e183483f2867baadf522099f0c2121770536b25a'};
 assert.equal(await isOwner(env,{email:' A@B.C '}),true);
 assert.equal(await isOwner(env,{email:'x@b.c'}),false);
 assert.equal(await isOwner(env,{email:'a@b.c',email_verified:false}),false);
 assert.equal(await isOwner(env,null),false);
 assert.equal(await isOwner({DEPLOY_OWNER_EMAIL:'x@b.c'},{email:'x@b.c'}),false,'the deploy owner is not automatically the collector admin');
});

test('admin writes need the site origin',async()=>{
 const {env}=memoryEnv();
 const r=await fleetAdminRoute(new Request(SITE+'/account/hosts',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:'{"action":"pause","name":"x"}'}),env,{email:'owner@example.com'});
 assert.equal(r.status,403);
});

test('link codes expire and linking needs a signed-in account',async()=>{
 const {env}=memoryEnv();const pc=await makeHost('pc2');
 const t0=Date.now();
 const [,reg]=await pc.call(env,'POST','/api/live/host-register',{name:'pc2',key:pc.key});
 assert.equal(await findLinkCode(env,reg.link_code,t0+25*3600_000),null,'expired after a day');
 await assert.rejects(linkHost(env,reg.link_code,{id:'a'},t0+25*3600_000));
 const r=await hostLinkRoute(new Request(SITE+'/account/hosts/link',{method:'POST',headers:{origin:SITE},body:new URLSearchParams({code:reg.link_code})}),env,null);
 assert.equal(r.status,401);
 assert.equal(await hostLinkRoute(new Request(SITE+'/account/other'),env,null),null);
});
