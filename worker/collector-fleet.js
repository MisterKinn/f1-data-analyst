// Collector host fleet: which home computers may upload, in what order, and which one
// holds the "baton" (is the publishing host) for a session window.
//
// Per series window the first `warm_count` live hosts in the owner's order (default 2)
// record at the same time; only the baton holder publishes. The baton goes to the first
// host that receives data ("ready"), then stays with it for the whole session. If the
// holder goes quiet for BEAT_FRESH_MS, the other recording host takes over at once, the
// next host in line starts recording as the new spare, and the silent host is retired from
// publishing for the rest of that session (it may record again as a spare; it publishes
// again only as a last resort). A host marked "cold"
// is picked as a spare only after the others. One live host is enough to collect.
// A host on a network F1 refuses (a cloud server, F1 answers 403 before sign-in) says so
// in its heartbeat (f1_blocked): it never holds the baton or does post-session data while
// any unblocked host is alive, and it is the last pick as a spare.
//
// Hosts listed in collector-hosts.js are built in. Any other host registers itself with
// its public key, gets a one-time link code, and its installer signs in to the site and
// links the computer to their Kongboda account. Linking registers it: from then on it
// collects at session time without further approval (added last in the order), and every
// collector shows whose it is. The owner can reorder, pause or remove it.
import {COLLECTOR_HOSTS,COLLECTOR_ADMIN_SHA256} from './collector-hosts.js';
import {accountIdentity} from './accounts.js';

export const FLEET_KEY='collector/fleet.json';
export const BEAT_FRESH_MS=15_000;       // a live-window heartbeat counts this long (hosts beat every 5 s)
export const WARM_DEFAULT=2,WARM_MAX=5;
export const ONLINE_MS=11*60_000;        // an idle heartbeat (every 5 min) counts this long
export const MAX_HOSTS=30,MAX_PENDING=10,LINK_TTL_MS=24*3600_000;
const LINK_CODE=/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
export function makeLinkCode(){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',r=crypto.getRandomValues(new Uint8Array(8));const c=[...r].map(x=>a[x%a.length]).join('');return c.slice(0,4)+'-'+c.slice(4);}
const linkUrl=(origin,code)=>origin+'/account?host_link='+code;
export const HOST_NAME=/^[a-z0-9][a-z0-9-]{0,39}$/;
const KEY=/^[A-Za-z0-9_-]{43}$/;
// Data sources a host can collect. A host runs the jobs the owner switches on for it.
export const KNOWN_SERIES={f1:'F1',wec:'WEC'};
const SERIES=Object.keys(KNOWN_SERIES),IDLE='_';
const WINDOW=/^[A-Za-z0-9._:-]{1,40}$/;
// One heartbeat document per host and series ('_' = idle beat), so parallel jobs never overwrite each other.
const beatKey=(name,series=IDLE)=>'collector/beat/'+name+'/'+series+'.json';
const batonKey=(series,windowId)=>'collector/baton/'+series+'/'+windowId+'.json';

async function readJson(env,key){const o=await env.BUCKET.get(key);return o?await o.json():null;}
// Shared F1 login: the owner's computer (a built-in host) sends its F1 login token with its
// heartbeat; approved hosts without their own F1 account receive it with theirs. Only the
// token is kept (it expires after a few days), never a password.
const TOKEN_KEY='collector/f1-shared-token.json';
export function tokenExpiry(value){
 try{
  const parts=typeof value==='string'&&value.length<8000?value.split('.'):[];
  if(parts.length!==3)return null;
  const b64=parts[1].replace(/-/g,'+').replace(/_/g,'/');
  const claims=JSON.parse(atob(b64+'='.repeat((4-b64.length%4)%4)));
  return Number.isFinite(claims.exp)?claims.exp:null;
 }catch{return null;}
}
// Crew members (accounts that registered the secret key) and the owner's built-in hosts
// collect with the owner's F1 login; other hosts use their own F1 account.
export async function crewHost(env,host){
 if(host?.builtin)return true;
 const id=host?.account?.id;
 if(typeof id!=='string'||!/^[\w-]{1,128}$/.test(id))return false;
 const account=await readJson(env,'website-accounts/account/'+id+'.json').catch(()=>null);
 const {hasCrewAccess}=await import('./crew.js');
 return hasCrewAccess(account,env);
}
async function sharedLogin(env,me,data,now){
 if(me?.builtin&&typeof data.f1_token==='string'){
  const exp=tokenExpiry(data.f1_token);
  if(exp&&exp*1000>now+600000){
   const prev=await readJson(env,TOKEN_KEY).catch(()=>null);
   if(!prev||!(prev.expires_at>=exp))await env.BUCKET.put(TOKEN_KEY,JSON.stringify({value:data.f1_token,expires_at:exp,from:me.name,at:new Date(now).toISOString()}));
  }
 }
 if(!data.want_token||!me||me.status!=='approved'||me.enabled===false)return null;
 if(!await crewHost(env,me))return {mode:'not_crew'};
 const saved=await readJson(env,TOKEN_KEY).catch(()=>null);
 return {mode:'crew',...(saved&&saved.expires_at*1000>now+300000?{token:{value:saved.value,expires_at:saved.expires_at}}:{})};
}
export async function sharedLoginStatus(env,now=Date.now()){
 const saved=await readJson(env,TOKEN_KEY).catch(()=>null);
 return saved?{expires_at:new Date(saved.expires_at*1000).toISOString(),from:saved.from,valid:saved.expires_at*1000>now}:null;
}
const clean=v=>typeof v==='string'?v.slice(0,40):null;

// Saved fleet merged with the built-in hosts (built-ins first unless the owner reordered).
export async function readFleet(env,builtin=COLLECTOR_HOSTS){
 const saved=env.BUCKET?await readJson(env,FLEET_KEY):null;
 const hosts=Array.isArray(saved?.hosts)?saved.hosts.filter(h=>h&&HOST_NAME.test(h.name)&&KEY.test(h.key)):[];
 const known=new Set(hosts.map(h=>h.name));
 const missing=builtin.filter(h=>!known.has(h.name)).map(h=>({name:h.name,key:h.key,status:'approved',enabled:true,builtin:true}));
 for(const h of hosts){const b=builtin.find(x=>x.name===h.name);if(b){h.builtin=true;h.key=b.key;h.status='approved';}}
 const warm_count=Number.isInteger(saved?.warm_count)?Math.min(WARM_MAX,Math.max(1,saved.warm_count)):WARM_DEFAULT;
 return {revision:Number(saved?.revision)||0,hosts:[...missing,...hosts],update_at:saved?.update_at||null,warm_count};
}
async function writeFleet(env,fleet){
 const warm=Number.isInteger(fleet.warm_count)?{warm_count:fleet.warm_count}:{};
 const hosts=fleet.hosts.map(({name,key,status,enabled,builtin,cold,os,added_at,account,link_code,link_expires,jobs,update_at})=>({name,key,status,enabled:enabled!==false,...(builtin?{builtin:true}:{}),...(cold?{cold:true}:{}),...(os?{os}:{}),...(added_at?{added_at}:{}),
  ...(account?{account}:{}),...(link_code&&!account?{link_code,link_expires}:{}),...(Array.isArray(jobs)?{jobs}:{}),...(update_at?{update_at}:{})}));
 await env.BUCKET.put(FLEET_KEY,JSON.stringify({revision:fleet.revision+1,hosts,...warm,...(fleet.update_at?{update_at:fleet.update_at}:{})}));
}
// Hosts whose signatures are accepted for uploads.
export async function uploadHosts(env){return (await readFleet(env)).hosts.filter(h=>h.status==='approved');}

const jobsOf=h=>Array.isArray(h.jobs)?h.jobs.filter(j=>SERIES.includes(j)):['f1'];
export async function readBeats(env,hosts,only=[IDLE,...SERIES]){
 const beats={};
 await Promise.all(hosts.flatMap(h=>only.map(async series=>{const b=await readJson(env,beatKey(h.name,series)).catch(()=>null);if(b)(beats[h.name]??={})[series]=b;})));
 return beats;
}
const fresh=(b,now,ms)=>!!b&&now-Date.parse(b.at)<ms;
// Hosts whose own check found F1 refusing their network go last (used only if nobody else is left).
const unblockedFirst=(list,blocked)=>[...list.filter(h=>!blocked(h.name)),...list.filter(h=>blocked(h.name))];
// Pure baton decision for one series window. prev is the stored baton state
// ({holder,since,retired}); returns the next state, the holder and the recording set.
export function decideBaton(hosts,beats,series,windowId,prev,{warmCount=WARM_DEFAULT,now=Date.now()}={}){
 const beatOf=name=>beats[name]?.[series];
 const alive=hosts.filter(h=>h.status==='approved'&&h.enabled!==false&&jobsOf(h).includes(series)).filter(h=>{const b=beatOf(h.name);return fresh(b,now,BEAT_FRESH_MS)&&b.window===windowId;});
 const isAlive=n=>alive.some(h=>h.name===n),ready=n=>!!beatOf(n)?.ready,blocked=n=>!!beatOf(n)?.f1_blocked&&!ready(n);
 const state={holder:prev?.holder??null,since:prev?.since??null,retired:Array.isArray(prev?.retired)?[...prev.retired]:[]};
 // The holder went quiet (power cut, crash, network): retire it for this session.
 if(state.holder&&!isAlive(state.holder)){if(!state.retired.includes(state.holder))state.retired.push(state.holder);state.holder=null;}
 const fresh_=alive.filter(h=>!state.retired.includes(h.name)),candidates=unblockedFirst(fresh_.length?fresh_:alive,blocked); // retired hosts only as a last resort
 const pick=()=>(candidates.find(h=>ready(h.name))||candidates[0])?.name??null;
 // Until the holder receives data, the best candidate may still take the baton (session start,
 // a holder whose F1 login fails). Once it receives data, it keeps the baton for the session.
 if(!state.holder||!ready(state.holder)){const next=pick();if(next&&next!==state.holder){state.holder=next;state.since=new Date(now).toISOString();}}
 // Spares follow the owner's order (cold ones last). A retired host may record again as a
 // spare once it is back (a network blip should not cost the session its best computer),
 // but it never publishes again in that session unless nobody else is left.
 const order=unblockedFirst([...alive.filter(h=>!h.cold),...alive.filter(h=>h.cold)],blocked).map(h=>h.name);
 const warm=new Set(state.holder?[state.holder]:[]);
 for(const name of order){if(warm.size>=warmCount)break;warm.add(name);}
 return {state,holder:state.holder,warm};
}
// Holder only (tests and simple callers): same rules, no stored state.
export function chooseHolder(hosts,beats,series,windowId,now=Date.now()){return decideBaton(hosts,beats,series,windowId,null,{now}).holder;}
const lastBeat=(beats,name)=>Object.values(beats[name]||{}).reduce((a,b)=>!a||Date.parse(b.at)>Date.parse(a.at)?b:a,null);
// First enabled host that is online at all: it publishes post-session data.
export function chooseLead(hosts,beats,now=Date.now()){
 const online=hosts.filter(h=>h.status==='approved'&&h.enabled!==false&&fresh(lastBeat(beats,h.name),now,ONLINE_MS));
 return unblockedFirst(online,n=>!!beats[n]?.[IDLE]?.f1_blocked)[0]?.name??null;
}
export async function readBaton(env,series,windowId){return readJson(env,batonKey(series,windowId)).catch(()=>null);}
// For any upload endpoint: may this signed host publish this series window now?
export async function hostBatonGate(env,signer,series,windowId){
 const baton=await readBaton(env,series,windowId);
 return !baton?.holder||baton.holder===signer?null:{error:'Another host is publishing',standby:true,holder:baton.holder};
}

// POST /api/live/host-beat (signed): store this host's heartbeat, answer who publishes.
export async function hostBeat(env,name,body,now=Date.now()){
 let data;try{data=JSON.parse(body||'{}');}catch{return [400,{error:'JSON required'}];}
 const windowId=typeof data.window==='string'&&WINDOW.test(data.window)?data.window:null;
 const series=windowId?(SERIES.includes(data.series)?data.series:data.series==null?'f1':null):IDLE;
 if(!series)return [400,{error:'Unknown series'}];
 const beat={at:new Date(now).toISOString(),window:windowId,ready:!!data.ready,recording:!!data.recording,os:clean(data.os),version:clean(data.version),
  ...(typeof data.started_at==='string'?{started_at:clean(data.started_at)}:{}),
  ...(Array.isArray(data.jobs_available)?{jobs_available:data.jobs_available.filter(j=>typeof j==='string').slice(0,10).map(clean)}:{}),
  ...(typeof data.own_login==='boolean'?{own_login:data.own_login}:{}),
  ...(data.f1_blocked===true?{f1_blocked:true}:{}),
  ...(data.error?{error:clean(String(data.error))}:{})};
 await env.BUCKET.put(beatKey(name,series),JSON.stringify(beat));
 // A session beat (every 5 s) reads only that series' beats; idle beats (every minute) read the rest.
 const fleet=await readFleet(env),{hosts}=fleet,beats=await readBeats(env,hosts,windowId?[series]:[IDLE,...SERIES]);(beats[name]??={})[series]=beat;
 const me=hosts.find(h=>h.name===name),lead=windowId?null:chooseLead(hosts,beats,now);
 let holder=null,warm=false,retired=false;
 if(windowId){
  const decide=async bucket=>{
   const prev=await readJson({BUCKET:bucket},batonKey(series,windowId));
   const next=decideBaton(hosts,beats,series,windowId,prev,{warmCount:fleet.warm_count,now});
   if(JSON.stringify(next.state)!==JSON.stringify({holder:prev?.holder??null,since:prev?.since??null,retired:prev?.retired||[]}))await bucket.put(batonKey(series,windowId),JSON.stringify(next.state));
   return next;
  };
  const next=env.BUCKET.atomic?await env.BUCKET.atomic(decide):await decide(env.BUCKET);
  holder=next.holder;warm=next.warm.has(name);retired=next.state.retired.includes(name);
 }
 const update_at=[fleet.update_at,me?.update_at].filter(Boolean).sort().at(-1)||null;
 const shared=await sharedLogin(env,me,data,now);
 return [200,{host:name,token_source:!!me?.builtin,...(shared?{shared_login:shared.mode}:{}),...(shared?.token?{f1_token:shared.token}:{}),enabled:me?.enabled!==false,cold:!!me?.cold,jobs:me?jobsOf(me):['f1'],update_at,
  priority:hosts.filter(h=>h.status==='approved').findIndex(h=>h.name===name)+1,
  series:windowId?series:null,window:windowId,holder,active:!!windowId&&holder===name,warm,retired,lead,is_lead:lead===name}];
}

// POST /api/live/host-register: a new host proves it owns the key (the request is signed
// with it) and waits for the owner's approval. Names already taken by another key are refused.
export async function hostRegister(env,body,verify,{origin='',now=Date.now()}={}){
 let data;try{data=JSON.parse(body||'{}');}catch{return [400,{error:'JSON required'}];}
 const name=String(data.name||'').toLowerCase(),key=String(data.key||'');
 if(!HOST_NAME.test(name)||!KEY.test(key))return [400,{error:'Invalid host name or key'}];
 try{await verify([{name,key}]);}catch(e){return [401,{error:'Collector token rejected',reason:e.reason||'invalid'}];}
 const fleet=await readFleet(env);let host=fleet.hosts.find(h=>h.name===name);
 if(host&&host.key!==key)return [409,{error:'Host name already used by another computer',name}];
 if(!host){
  if(fleet.hosts.length>=MAX_HOSTS||fleet.hosts.filter(h=>h.status==='pending').length>=MAX_PENDING)return [429,{error:'Too many hosts waiting for approval'}];
  host={name,key,status:'pending',enabled:true,os:clean(data.os),added_at:new Date(now).toISOString()};fleet.hosts.push(host);
 }
 const linked=!!(host.account||host.builtin);
 if(!linked&&(!host.link_code||Date.parse(host.link_expires)<now)){host.link_code=makeLinkCode();host.link_expires=new Date(now+LINK_TTL_MS).toISOString();await writeFleet(env,fleet);}
 return [host.status==='pending'&&!host.account?202:200,{name,status:host.status,enabled:host.enabled!==false,linked,
  ...(host.account?{account_name:host.account.name||null}:{}),...(linked?{}:{link_code:host.link_code,link_url:linkUrl(origin,host.link_code)})}];
}

// A signed-in person links a waiting computer to their Kongboda account with its code.
export async function findLinkCode(env,code,now=Date.now()){
 if(!LINK_CODE.test(code||'')||!env.BUCKET)return null;
 const host=(await readFleet(env)).hosts.find(h=>h.link_code===code&&!h.account);
 return host&&Date.parse(host.link_expires)>now?{code,name:host.name,os:host.os||null}:null;
}
export async function linkHost(env,code,account,now=Date.now()){
 const fleet=await readFleet(env),host=LINK_CODE.test(code||'')?fleet.hosts.find(h=>h.link_code===code):null;
 if(!host||host.account||Date.parse(host.link_expires)<=now)throw Object.assign(Error('연결 코드가 없거나 만료됐습니다. 수집기 상태 확인을 다시 실행해 새 코드를 받으세요.'),{status:404});
 host.account={id:account.id,name:account.name||null,email:account.email||null,linked_at:new Date(now).toISOString()};
 delete host.link_code;delete host.link_expires;
 host.status='approved';host.enabled=true; // linked = registered: collects from the next heartbeat
 await writeFleet(env,fleet);
 return host.name;
}

// Owner view: every host with its heartbeats per series.
export async function fleetStatus(env,now=Date.now()){
 const {revision,hosts,update_at,warm_count}=await readFleet(env),beats=await readBeats(env,hosts);
 const holders={},warmSets={};
 for(const series of SERIES)for(const w of new Set(hosts.map(h=>beats[h.name]?.[series]).filter(b=>fresh(b,now,BEAT_FRESH_MS)&&b.window).map(b=>b.window))){
  const next=decideBaton(hosts,beats,series,w,await readBaton(env,series,w),{warmCount:warm_count,now});
  holders[series+':'+w]=next.holder;warmSets[series+':'+w]=next.warm;
 }
 const lead=chooseLead(hosts,beats,now);
 const shared_login=await sharedLoginStatus(env,now);
 const crew=Object.fromEntries(await Promise.all(hosts.map(async h=>[h.name,await crewHost(env,h).catch(()=>false)])));
 return {revision,lead,holders,update_at,warm_count,shared_login,series:KNOWN_SERIES,now:new Date(now).toISOString(),hosts:hosts.map((h,i)=>{
  const last=lastBeat(beats,h.name),age=last?now-Date.parse(last.at):null;
  const live=SERIES.map(series=>{const b=beats[h.name]?.[series],k=series+':'+b?.window;return fresh(b,now,BEAT_FRESH_MS)&&b.window?{series,window:b.window,ready:!!b.ready,holder:holders[k]===h.name,recording:!!warmSets[k]?.has(h.name)}:null;}).filter(Boolean);
  const state=h.status==='pending'?'pending':h.enabled===false?'paused':live.some(j=>j.holder)?'publishing':live.some(j=>j.recording)?'standby':live.length?'reserve':age!==null&&age<ONLINE_MS?'online':'offline';
  const idle=beats[h.name]?.[IDLE];
  return {name:h.name,priority:i+1,status:h.status,enabled:h.enabled!==false,builtin:!!h.builtin,cold:!!h.cold,state,jobs:jobsOf(h),live,
   jobs_available:idle?.jobs_available||null,
   login:idle?.own_login?'own':crew[h.name]?'shared':'needs_account',
   account:h.account?{name:h.account.name,email:h.account.email}:h.builtin?{name:'운영자 (기본 호스트)',email:null}:null,
   os:last?.os||h.os||null,version:last?.version||null,started_at:last?.started_at||null,last_seen:last?.at||null,
   update_requested:[update_at,h.update_at].filter(Boolean).sort().at(-1)||null,
   f1_blocked:!!last?.f1_blocked,error:(last?.f1_blocked?'F1이 이 네트워크를 막음(403) · 다른 호스트가 없을 때만 사용':null)||last?.error||null,key_hint:h.key.slice(0,8)};})};
}

// Owner actions: approve, pause, resume, remove, move up/down or set the full order.
export async function fleetAction(env,action){
 const fleet=await readFleet(env);
 if(action.action==='update_all'||action.action==='warm_count')action.name=undefined;
 if(Number.isInteger(action.revision)&&action.revision!==fleet.revision)throw Object.assign(Error('다른 곳에서 바뀌었습니다. 새로고침 후 다시 해 주세요.'),{status:409});
 const index=fleet.hosts.findIndex(h=>h.name===action.name),host=fleet.hosts[index];
 const fail=(m,status=400)=>{throw Object.assign(Error(m),{status});};
 switch(action.action){
  case 'approve':if(!host)fail('호스트가 없습니다.',404);if(!host.account&&!host.builtin)fail('아직 꽁보다 계정에 연결되지 않은 컴퓨터입니다. 설치한 사람이 연결한 뒤 승인하세요.');host.status='approved';host.enabled=true;break;
  case 'pause':if(!host)fail('호스트가 없습니다.',404);host.enabled=false;break;
  case 'resume':if(!host)fail('호스트가 없습니다.',404);host.enabled=true;break;
  // Cold standby: connect to F1 only when holding the baton (e.g. a second computer on the same F1 account).
  case 'cold':case 'warm':if(!host)fail('호스트가 없습니다.',404);host.cold=action.action==='cold';break;
  case 'jobs':{if(!host)fail('호스트가 없습니다.',404);const jobs=Array.isArray(action.jobs)?[...new Set(action.jobs)]:null;if(!jobs||jobs.some(j=>!SERIES.includes(j)))fail('알 수 없는 수집 항목입니다.');host.jobs=jobs;break;}
  // Update now: hosts pick it up on their next heartbeat (about a minute) once nothing is recording.
  case 'update':if(!host)fail('호스트가 없습니다.',404);host.update_at=new Date().toISOString();break;
  case 'update_all':fleet.update_at=new Date().toISOString();break;
  // How many live hosts record each session at the same time (one publishes).
  case 'warm_count':{const n=Number(action.value);if(!Number.isInteger(n)||n<1||n>WARM_MAX)fail('1~'+WARM_MAX+' 사이로 정해 주세요.');fleet.warm_count=n;break;}
  case 'remove':if(!host)fail('호스트가 없습니다.',404);if(host.builtin)fail('기본 호스트는 지울 수 없습니다. 일시정지를 쓰세요.');fleet.hosts.splice(index,1);await Promise.all([IDLE,...SERIES].map(x=>env.BUCKET.delete(beatKey(host.name,x))));break;
  case 'up':case 'down':{if(!host)fail('호스트가 없습니다.',404);const to=index+(action.action==='up'?-1:1);if(to<0||to>=fleet.hosts.length)break;[fleet.hosts[index],fleet.hosts[to]]=[fleet.hosts[to],fleet.hosts[index]];break;}
  case 'order':{const names=Array.isArray(action.order)?action.order:[];if(names.length!==fleet.hosts.length||new Set(names).size!==names.length||names.some(n=>!fleet.hosts.some(h=>h.name===n)))fail('순서 목록이 맞지 않습니다.');fleet.hosts.sort((a,b)=>names.indexOf(a.name)-names.indexOf(b.name));break;}
  default:fail('지원하지 않는 작업입니다.');
 }
 await writeFleet(env,fleet);
 return fleetStatus(env);
}

// The collector admin: a signed-in Google account whose email hash is listed in
// collector-hosts.js (or env.COLLECTOR_ADMIN_SHA256, comma-separated, for tests/overrides).
export async function isOwner(env,google){
 const email=String(google?.email||'').trim().toLowerCase();
 if(!email||google.email_verified===false)return false;
 const allowed=(env.COLLECTOR_ADMIN_SHA256?String(env.COLLECTOR_ADMIN_SHA256).split(','):COLLECTOR_ADMIN_SHA256).map(x=>x.trim().toLowerCase());
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(email)))].map(b=>b.toString(16).padStart(2,'0')).join('');
 return allowed.includes(hash);
}
// /account/hosts: owner-only JSON API behind the account page panel.
export async function fleetAdminRoute(request,env,google,{origin}={}){
 const u=new URL(request.url);if(u.pathname!=='/account/hosts')return null;
 const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}});
 if(!await isOwner(env,google))return json({error:'운영자만 사용할 수 있습니다.'},403);
 if(!env.BUCKET)return json({error:'저장소를 사용할 수 없습니다.'},503);
 if(request.method==='GET')return json(await fleetStatus(env));
 if(request.method!=='POST')return json({error:'지원하지 않는 요청입니다.'},405);
 const allowed=origin||env.APP_ORIGIN||u.origin;
 if(u.origin!==allowed||request.headers.get('origin')!==allowed||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'허용되지 않은 요청입니다.'},403);
 let action;try{action=await request.json();}catch{return json({error:'JSON required'},400);}
 const run=bucket=>fleetAction({...env,BUCKET:bucket},action);
 try{return json(env.BUCKET.atomic?await env.BUCKET.atomic(run):await run(env.BUCKET));}catch(e){return json({error:e.message},e.status||500);}
}

// Hosts linked to one account (shown to that person on their account page).
export async function myHosts(env,accountId,now=Date.now()){
 const status=await fleetStatus(env,now),{hosts}=await readFleet(env);
 const mine=new Set(hosts.filter(h=>h.account?.id===accountId).map(h=>h.name));
 return status.hosts.filter(h=>mine.has(h.name)).map(({name,priority,status:s,state,os,last_seen,enabled,jobs})=>({name,priority,status:s,state,os,last_seen,enabled,jobs}));
}
// /account/hosts/link (POST form) and /account/my-hosts (GET) for any signed-in account.
export async function hostLinkRoute(request,env,google){
 const u=new URL(request.url);if(u.pathname!=='/account/hosts/link'&&u.pathname!=='/account/my-hosts')return null;
 const text=(m,status)=>new Response(m,{status,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});
 if(!env.BUCKET)return text('저장소를 사용할 수 없습니다.',503);
 const info=await accountIdentity(request,env,google);
 if(!info?.account||info.account.deleted)return text('꽁보다에 로그인해 주세요.',401);
 if(u.pathname==='/account/my-hosts'){
  if(request.method!=='GET')return text('지원하지 않는 요청입니다.',405);
  return new Response(JSON.stringify({hosts:await myHosts(env,info.account.id)}),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}});
 }
 if(request.method!=='POST')return text('지원하지 않는 요청입니다.',405);
 const allowed=env.APP_ORIGIN||u.origin;
 if(u.origin!==allowed||request.headers.get('origin')!==allowed||request.headers.get('sec-fetch-site')==='cross-site')return text('허용되지 않은 요청입니다.',403);
 const code=String((await request.formData()).get('code')||'').toUpperCase();
 const run=bucket=>linkHost({...env,BUCKET:bucket},code,info.account);
 try{const name=env.BUCKET.atomic?await env.BUCKET.atomic(run):await run(env.BUCKET);
  return new Response(null,{status:303,headers:{location:'/account?host_linked='+encodeURIComponent(name)+'#my-hosts','cache-control':'no-store'}});}
 catch(e){return text(e.message,e.status||500);}
}

// Public collector status (/status/data). Everyone sees host numbers, states and who
// publishes; crew members and people who registered a collector also see whose computer
// each one is (account name only). Pending (not yet linked) computers are not listed.
export async function publicStatus(env,{showOwners=false,accountId=null,admin=false}={},now=Date.now()){
 const status=await fleetStatus(env,now),{hosts}=await readFleet(env);
 const mine=new Set(accountId?hosts.filter(h=>h.account?.id===accountId).map(h=>h.name):[]);
 const listed=status.hosts.filter(h=>h.status==='approved');
 const number=new Map(listed.map((h,i)=>[h.name,i+1]));
 const collecting=Object.entries(status.holders).map(([key,name])=>{const [series,...w]=key.split(':');return {series,window:w.join(':'),host:name?number.get(name)??null:null};});
 return {now:status.now,warm_count:status.warm_count,series:KNOWN_SERIES,collecting,show_owners:!!showOwners,admin:!!admin,
  hosts:listed.map(h=>({number:number.get(h.name),state:h.state,enabled:h.enabled,os:h.os,last_seen:h.last_seen,
   live:(h.live||[]).map(({series,window,ready,holder,recording})=>({series,window,ready,holder,recording})),mine:mine.has(h.name),
   ...(showOwners?{owner:h.account?.name||null}:{})}))};
}
export async function collectorStatusRoute(request,env,google){
 const u=new URL(request.url);if(u.pathname!=='/status/data')return null;
 const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'}});
 if(request.method!=='GET')return json({error:'Method not allowed'},405);
 if(!env.BUCKET)return json({error:'저장소를 사용할 수 없습니다.'},503);
 const admin=await isOwner(env,google);
 let account=null;
 if(google||request.headers.get('oai-authenticated-user-id')){try{account=(await accountIdentity(request,env,google))?.account||null;}catch{}}
 if(account?.deleted)account=null;
 const {hosts}=await readFleet(env);
 const registered=!!account&&hosts.some(h=>h.account?.id===account.id);
 const {hasCrewAccess}=await import('./crew.js');
 return json(await publicStatus(env,{showOwners:admin||registered||hasCrewAccess(account,env),accountId:account?.id||null,admin}));
}
