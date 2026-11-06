// FIAWEC+ 연결 (account settings): a person signs in to FIAWEC+ once through a remote view of a
// collector browser (collector/wec_signin.py). They type the password and solve any CAPTCHA
// themselves; the site never fills it in. The resulting cookies are stored encrypted per
// account and reused by the timing reader, so a session needs no new sign-in until FIAWEC+
// ends it. Crew never connect: they read the owner's connection (key "operator").
import {cloudConfigured,cloudRequest} from './live.js';
import {verifyCollectorToken} from './github-oidc.js';
import {broadcast} from './web-push.js';

export const WEC_CONNECT_URL='https://kongboda-motorsports.vercel.app/account#fiawec';
const enc=new TextEncoder(),dec=new TextDecoder();
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const stateKey=key=>'wec/auth/'+key+'.json',metaKey=key=>'wec/auth-meta/'+key+'.json';
const b64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);},unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));

export function isOwnerEmail(email,env){return !!(email&&env.DEPLOY_OWNER_EMAIL&&email.toLowerCase()===env.DEPLOY_OWNER_EMAIL.toLowerCase());}
// Whose FIAWEC+ connection this access uses: the owner's ('operator') for the owner and crew,
// the account's own for personal accounts. Crew may also connect their own account (key = accountId).
export function connectionKey(access){return !access?null:access.mode==='personal'?access.accountId:access.owner!==true&&access.accountId?access.accountId:'operator';}
export function canConnect(access){return !!access&&(access.mode==='personal'||access.owner===true||!!access.accountId);}

async function aesKey(env){
 const secret=env.WEC_AUTH_KEY||env.FASTF1_CLOUD_KEY;
 if(!secret||secret.length<16)throw Error('FIAWEC+ 연결 저장 키가 설정되지 않았습니다.');
 const base=await crypto.subtle.importKey('raw',enc.encode(secret),'HKDF',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:enc.encode('kongboda-wec-auth'),info:enc.encode('v1')},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export function validState(state){return !!state&&typeof state==='object'&&!Array.isArray(state)&&Array.isArray(state.cookies)&&state.cookies.length<=400&&JSON.stringify(state).length<=150000;}

export async function saveSignIn(env,key,state,{verified=false,notify=null}={}){
 if(!env.BUCKET)throw Error('계정 저장소를 사용할 수 없습니다.');
 if(!validState(state))throw Error('Invalid sign-in');
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const data=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(key)},await aesKey(env),enc.encode(JSON.stringify(state))));
 await env.BUCKET.put(stateKey(key),JSON.stringify({v:1,iv:b64(iv),data:b64(data)}));
 const old=await signInMeta(env,key),now=new Date().toISOString();
 const who=notify||old?.notify||null; // the Google account that connected: alerted when it lapses
 await env.BUCKET.put(metaKey(key),JSON.stringify({status:'connected',connectedAt:verified?old?.connectedAt||now:now,updatedAt:now,...(verified?{verifiedAt:now}:{}),...(who?{notify:who}:{})}));
}
export async function loadSignIn(env,key){
 const object=key&&await env.BUCKET?.get(stateKey(key));if(!object)return null;
 try{const box=await object.json();const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(box.iv),additionalData:enc.encode(key)},await aesKey(env),unb64(box.data));const state=JSON.parse(dec.decode(plain));return validState(state)?state:null;}catch{return null;}
}
export async function signInMeta(env,key){const object=key&&await env.BUCKET?.get(metaKey(key));if(!object)return null;try{return await object.json();}catch{return null;}}
export const LAPSE_MESSAGE=lang=>lang==='en'
 ?{title:'FIAWEC+ connection lost',body:'Sign in to FIAWEC+ again to keep live WEC timing. It takes one sign-in.',url:'/account#fiawec',tag:'fiawec-connection'}
 :{title:'FIAWEC+ 연결이 끊겼습니다',body:'WEC 라이브 타이밍을 계속 받으려면 FIAWEC+에 다시 한 번 로그인하세요.',url:'/account#fiawec',tag:'fiawec-connection'};
// Status change of a saved connection. Going from connected to needs_reconnect alerts the person
// who connected it (web push, once per lapse), so they can sign in again before the next session.
export async function markSignIn(env,key,status,{fetchImpl=fetch}={}){
 const meta=await signInMeta(env,key);if(!meta||meta.status===status)return null;
 await env.BUCKET.put(metaKey(key),JSON.stringify({...meta,status,updatedAt:new Date().toISOString()}));
 if(status!=='needs_reconnect'||!meta.notify)return null;
 try{return await broadcast(env,LAPSE_MESSAGE,{fetchImpl,account:meta.notify});}catch{return null;}
}
export async function deleteSignIn(env,key){await env.BUCKET?.delete?.(stateKey(key));await env.BUCKET?.delete?.(metaKey(key));}

// What a briefing card shows when FIAWEC+ needs a person: one link, or "wait for the owner".
export function connectInfo(access){
 if(!access||canConnect(access))return {by:'self',label:'FIAWEC+ 연결',url:WEC_CONNECT_URL,note:'꽁보다 계정 설정에서 FIAWEC+에 한 번 직접 로그인하세요(CAPTCHA가 나오면 직접 풀기). 그다음 세션부터 자동으로 읽습니다.'};
 return {by:'owner',label:null,url:null,note:'선원은 운영자의 FIAWEC+ 연결로 자동 수신합니다. 운영자가 다시 연결하면 바로 이어집니다.'};
}

// /api/live/wec/connection, /api/live/wec/connect/<start|frame|input|cancel>, /api/live/wec/disconnect
export async function wecConnectRoute(request,env,access,{notify=null,relay={}}={}){
 const url=new URL(request.url),path=url.pathname,key=connectionKey(access);
 if(path==='/api/live/wec/connection'){
  if(request.method!=='GET')return reply({error:'GET required'},405);
  const meta=await signInMeta(env,key);
  return reply({mode:access.mode,owner:access.owner===true,crew:access.mode==='crew'||access.crew===true,can_connect:canConnect(access),connected:meta?.status==='connected',status:meta?.status||'not_connected',connected_at:meta?.connectedAt||null,verified_at:meta?.verifiedAt||null});
 }
 if(request.method==='POST'&&(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site'))return reply({error:'Same-origin request required'},403);
 if(!canConnect(access))return reply({error:'선원은 운영자의 FIAWEC+ 연결을 자동으로 사용합니다.'},409);
 if(path==='/api/live/wec/disconnect'){
  if(request.method!=='POST')return reply({error:'POST required'},405);
  await deleteSignIn(env,key);
  if(access.mode==='personal'&&cloudConfigured(env))await cloudRequest(env,'/personal/'+encodeURIComponent(key)+'/wec/logout','POST').catch(()=>null);
  return reply({ok:true,status:'not_connected'});
 }
 const op=path.match(/^\/api\/live\/wec\/connect\/(start|frame|input|cancel)$/)?.[1];
 if(!op)return reply({error:'Not found'},404);
 if((op==='frame')!==(request.method==='GET'))return reply({error:'Method not allowed'},405);
 let body;
 if(op==='input'){const text=await request.text();if(text.length>1024)return reply({error:'Request too large'},413);try{body=JSON.parse(text);}catch{return reply({error:'JSON required'},400);}}
 return relayRoute(env,key,op,body,{notify,mode:access.mode,origin:url.origin,...relay});
}

// The sign-in browser runs on the site itself (api/wec-signin.js, a separate function with a
// headless Chromium), not on a collector host: hosts only poll the site and sleep between
// sessions, so a browser there could not be reached. This route and that browser talk through
// two stored records per account: the control record (written here: run id, queued taps and
// typing, cancel) and the view record (written by the browser: latest screenshot). Queued
// commands are encrypted, since typing includes the password.
const ctlKey=key=>'wec/signin-ctl/'+key+'.json',viewKey=key=>'wec/signin-view/'+key+'.json';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const readJson=async(env,k)=>{const o=await env.BUCKET.get(k);if(!o)return null;try{return await o.json();}catch{return null;}};
export async function seal(env,key,value){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const data=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode('relay:'+key)},await aesKey(env),enc.encode(JSON.stringify(value))));
 return b64(iv)+'.'+b64(data);
}
export async function unseal(env,key,box){
 try{const [iv,data]=String(box).split('.');return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv),additionalData:enc.encode('relay:'+key)},await aesKey(env),unb64(data))));}catch{return null;}
}
// Proof that a runner start came from this site: HMAC of the account key and run id.
export async function runnerToken(env,key,run){
 const secret=env.WEC_AUTH_KEY||env.FASTF1_CLOUD_KEY;if(!secret||secret.length<16)throw Error('FIAWEC+ 연결 저장 키가 설정되지 않았습니다.');
 const k=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return b64(new Uint8Array(await crypto.subtle.sign('HMAC',k,enc.encode('wec-signin\0'+key+'\0'+run)))).replace(/[+/=]/g,c=>({'+':'-','/':'_','=':''})[c]);
}
export async function startRunner(env,origin,key,run,extra={},fetchImpl=fetch){
 const r=await fetchImpl(new URL('/api/wec-signin',env.APP_ORIGIN||origin),{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+await runnerToken(env,key,run)},body:JSON.stringify({key,run,...extra}),signal:AbortSignal.timeout(15000)});
 if(r.status!==202)throw Error('runner '+r.status);
}
export function clean(raw){
 if(!raw||typeof raw!=='object')return null;
 const num=v=>typeof v==='number'&&Number.isFinite(v);
 if(raw.op==='click'&&num(raw.x)&&num(raw.y)&&raw.x>=0&&raw.x<=390&&raw.y>=0&&raw.y<=740)return {op:'click',x:raw.x,y:raw.y};
 if(raw.op==='type'&&typeof raw.text==='string'&&raw.text.length>=1&&raw.text.length<=256&&!/[\r\n]/.test(raw.text))return {op:'type',text:raw.text};
 if(raw.op==='key'&&['Enter','Backspace','Tab','Escape','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(raw.key))return {op:'key',key:raw.key};
 if(raw.op==='scroll'&&num(raw.dy)&&Math.abs(raw.dy)<=2000)return {op:'scroll',dy:raw.dy};
 return null;
}
const shown=(view,run)=>{
 if(!view||view.run!==run)return {state:'signing_in',image:null};
 if(view.state==='signed_in')return {state:'signed_in'};
 if(['closed','cancelled'].includes(view.state))return {state:view.state,...(view.error?{error:String(view.error).slice(0,60)}:{})};
 return {state:'signing_in',host:typeof view.host==='string'?view.host.slice(0,60):null,image:typeof view.image==='string'?view.image:null,width:view.width||390,height:view.height||740,seq:view.seq||0};
};
async function waitView(env,key,run,done,{waitMs,pollMs}){
 const until=Date.now()+waitMs;let view;
 do{view=await readJson(env,viewKey(key));if(view?.run===run&&done(view))return view;await sleep(pollMs);}while(Date.now()<until);
 return view;
}
export async function relayRoute(env,key,op,body,{notify=null,mode=null,origin,fetchImpl=fetch,startWaitMs=45000,inputWaitMs=15000,pollMs=500}={}){
 if(!env.BUCKET)return reply({error:'계정 저장소를 사용할 수 없습니다.'},503);
 const ctl=await readJson(env,ctlKey(key));
 if(op==='cancel'){if(ctl)await env.BUCKET.put(ctlKey(key),JSON.stringify({...ctl,cancel:true}));return reply({state:'cancelled'});}
 if(op==='start'){
  const run=crypto.randomUUID();
  await env.BUCKET.put(ctlKey(key),JSON.stringify({run,created:Date.now(),notify,mode,cmds:[]}));
  try{await startRunner(env,origin,key,run,{},fetchImpl);}
  catch{return reply({error:'FIAWEC+ 로그인 화면을 열지 못했습니다. 로그인 브라우저를 시작하지 못했습니다. 잠시 후 다시 시도하세요.'},502);}
  const view=await waitView(env,key,run,v=>!!v.image||v.state!=='signing_in',{waitMs:startWaitMs,pollMs});
  if(!view||view.run!==run)return reply({error:'FIAWEC+ 로그인 화면을 열지 못했습니다. 로그인 브라우저가 제때 응답하지 않았습니다. 잠시 후 다시 시도하세요.'},502);
  return reply(shown(view,run));
 }
 if(!ctl||ctl.cancel)return reply({state:'closed'});
 if(op==='frame')return reply(shown(await readJson(env,viewKey(key)),ctl.run));
 const command=clean(body);if(!command)return reply({error:'Invalid input'},400);
 const id=(ctl.cmds.at(-1)?.id||0)+1;
 await env.BUCKET.put(ctlKey(key),JSON.stringify({...ctl,cmds:[...ctl.cmds,{id,box:await seal(env,key,command)}].slice(-30)}));
 return reply(shown(await waitView(env,key,ctl.run,v=>(v.seq||0)>=id||v.state!=='signing_in',{waitMs:inputWaitMs,pollMs}),ctl.run));
}
// Runner side (api/wec-signin.js): control record and commands newer than `after`.
export async function readControl(env,key){return readJson(env,ctlKey(key));}
export async function newCommands(env,key,ctl,after){const out=[];for(const c of ctl?.cmds||[])if(c.id>after){const cmd=clean(await unseal(env,key,c.box));out.push({id:c.id,cmd});}return out;}
export async function writeView(env,key,view){await env.BUCKET.put(viewKey(key),JSON.stringify({...view,at:Date.now()}));}
export async function endControl(env,key,run){const ctl=await readJson(env,ctlKey(key));if(ctl?.run===run)await env.BUCKET.delete(ctlKey(key));}
export const chainKey=key=>'wec/signin-chain/'+key+'.json';

// Scheduled WEC reader (GitHub Actions) -> the owner's saved sign-in, and back after a session.
export async function wecActionsAuth(request,env,{verify}){
 if(!['GET','POST'].includes(request.method))return reply({error:'Method not allowed'},405);
 try{await verify((request.headers.get('authorization')||'').replace(/^Bearer /,''));}catch{return reply({error:'Collector token rejected'},401);}
 if(!env.BUCKET)return reply({error:'Storage unavailable'},503);
 if(request.method==='GET')return reply({storage_state:await loadSignIn(env,'operator')});
 const text=await request.text();if(text.length>200000)return reply({error:'Too large'},413);
 let body;try{body=JSON.parse(text);}catch{return reply({error:'JSON required'},400);}
 if(!validState(body?.storage_state))return reply({error:'Invalid sign-in'},400);
 if(!await signInMeta(env,'operator'))return reply({ok:false,reason:'not_connected'}); // a disconnect wins
 await saveSignIn(env,'operator',body.storage_state,{verified:true});
 return reply({ok:true});
}
export {verifyCollectorToken};
