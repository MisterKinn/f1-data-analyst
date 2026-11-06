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
export async function wecConnectRoute(request,env,access,{notify=null}={}){
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
 if(!cloudConfigured(env))return reply({error:'수집 서버 연결 설정이 필요합니다.'},503);
 let body;
 if(op==='input'){const text=await request.text();if(text.length>1024)return reply({error:'Request too large'},413);try{body=JSON.parse(text);}catch{return reply({error:'JSON required'},400);}}
 let result;
 try{result=await cloudRequest(env,'/wec/signin/'+encodeURIComponent(key)+'/'+op,op==='frame'?'GET':'POST',op==='input'?body:op==='frame'?undefined:{});}
 catch{return reply({error:'FIAWEC+ 로그인 화면을 열지 못했습니다. 잠시 후 다시 시도하세요.'},502);}
 if(result?.state==='signed_in'){
  if(!validState(result.storage_state))return reply({state:'failed',error:'로그인 정보를 저장하지 못했습니다. 다시 시도하세요.'},502);
  await saveSignIn(env,key,result.storage_state,{notify});
  if(access.mode==='personal')await cloudRequest(env,'/personal/'+encodeURIComponent(key)+'/wec/restore','POST',{storage_state:result.storage_state}).catch(()=>null);
  return reply({state:'signed_in'}); // the cookies never go to the browser
 }
 const image=typeof result?.image==='string'&&result.image.length<1500000&&/^[A-Za-z0-9+/=]+$/.test(result.image)?result.image:null;
 return reply({state:['signing_in','closed','cancelled'].includes(result?.state)?result.state:'signing_in',host:typeof result?.host==='string'?result.host.slice(0,60):null,image,width:result?.width||null,height:result?.height||null,error:typeof result?.error==='string'?result.error.slice(0,60):undefined});
}

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
