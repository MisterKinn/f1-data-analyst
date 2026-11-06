import {cloudConfigured,cloudRequest} from './live.js';
import {accountIdentity,sharedLiveAllowed} from './accounts.js';
import {googleIdentity} from './google-auth.js';
import {verifyCollectorToken,COLLECTOR_REPOSITORY} from './github-oidc.js';
export const WEC_COLLECTOR_WORKFLOW=COLLECTOR_REPOSITORY+'/.github/workflows/wec-live-collector.yml@refs/heads/main';
const STORE='wec/live/current.json',WINDOW_ID=/^wec-[a-z0-9-]{3,80}-\d{8}$/,FRESH_SECONDS=90;
const sessions=['auto','FP1','FP2','FP3','Qualifying','Hyperpole','Race'];
const hosts=new Set(['plus.fiawec.com','fiawec.alkamelsystems.com']);
const states=new Set(['not_started','reading','session_window_closed','timing_waiting_start','login_unavailable','discovering','waiting_for_session','timing_opened','timing_layout_unverified','snapshot_unverified','credentials_required','authentication_failed','authentication_action_required','authentication_unverified','human_verification_required','subscription_or_login_required','timing_link_unavailable','event_not_found','ambiguous_event','ambiguous_live_session','unapproved_destination','browser_runtime_unavailable','discovery_timeout','discovery_failed']);
export const WEC_LIVE_TOOLS=[
 {name:'wec_discover_live',description:'Start a bounded FIAWEC+ browser lookup on the existing collector: authenticate, discover the requested event and current live session, open its Live Timing control, and extract the observed timing link/table. event must be an event-name fragment such as Monza, never a URL. Does not prove live reception. Call wec_live_status to read the result. Credentials stay on the collector server; CAPTCHA/MFA/subscription errors require the owner. No scheduled polling.',inputSchema:{type:'object',properties:{event:{type:'string',minLength:2,maxLength:100},session:{type:'string',enum:sessions},year:{type:'integer',minimum:2020,maximum:2100}},required:['event'],additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:true}},
 {name:'wec_live_status',description:'Read current WEC live timing without starting a login. Registered crew read the scheduled FIAWEC+ timing reader (operator account, runs every WEC session window); other accounts read the result of their own FIAWEC+ login (connect at /live, 8 hours). live=true only when the timing table changed within 90 s inside the scheduled session window. Report state, checked_at and table_age_seconds. Never infer fresh data or substitute FastF1/Al Kamel for a missing WEC live feed.',inputSchema:{type:'object',properties:{},required:[],additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}
];
export const WEC_LIVE_INSTRUCTIONS=' WEC BRIEFING FORMAT: show it as a card, not a ranking table (give the full table only when asked). Put the session time left first and largest; session name and clock time small in a corner. Report every red flag, yellow, double yellow, FCY or safety car at once with its reason from race control (car number, corner); if no reason is published, say so and label any likely cause as unconfirmed. Include track condition (rain, track and air temperature, humidity) and what it does to lap times; race-sim or long-run pace when stints allow, otherwise say why not; optimal-lap and sector gaps when available. Call kongboda_my_preferences and explain the favourite WEC manufacturer (and F1 team or drivers) first: position, gap, where their time is lost. Keep it to about four short sections. WEC LIVE ACCESS: when wec_live_status shows next_step, ask the user exactly one question with two choices before anything else: (1) sign in to FIAWEC+ themselves (they type their own email and password and solve any CAPTCHA; never type a password for them and never solve a CAPTCHA; detect the finished sign-in yourself instead of asking them to confirm), or (2) give the FIAWEC+ session link (plus.fiawec.com/en/livestream/s-...). With a browser tool you can then open the LIVE session Live timing and read it there; the embedded timing token expires within about a minute, so never ask for or store that token link. WEC LIVE: Call wec_live_status first. Crew get the scheduled FIAWEC+ timing reader; other accounts use their own FIAWEC+ login (at /live) and may call wec_discover_live with the event/year/session, then wec_live_status. It follows FIAWEC+ visible pages rather than guessing a feed URL. No provider credentials or signed timing URLs may be disclosed. Treat a snapshot as live only when live=true (table changing within 90 s inside the session window). waiting_for_session is normal; authentication, runtime, access and parsing failures are not a no-session result. Discovery has bounded execution, no autonomous schedule. Al Kamel is for completed WEC sessions, FastF1 is F1 only.';
export function safeWecUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&hosts.has(u.hostname)&&!u.username&&!u.password&&!u.search&&!u.hash&&(!u.port||u.port==='443')&&!/\/(?:token|auth|callback)\//i.test(u.pathname)?u.href:null;}catch{return null;}}
const ACCESS_BLOCKED=new Set(['human_verification_required','authentication_action_required','authentication_failed','credentials_required','subscription_or_login_required','authentication_unverified']);
export const WEC_NEXT_STEP='Ask the user to choose: sign in to FIAWEC+ themselves (they type the password and solve any CAPTCHA), or give the FIAWEC+ session link. Then read Live timing in the browser.';
export function publicWecStatus(raw={}){
 const target=raw.target&&typeof raw.target==='object'?{event:String(raw.target.event??'').slice(0,100),year:raw.target.year,session:sessions.includes(raw.target.session)?raw.target.session:'auto'}:null;
 const records=Array.isArray(raw.records)?raw.records.slice(0,100).filter(r=>r&&typeof r==='object'&&!Array.isArray(r)).map(r=>Object.fromEntries(Object.entries(r).filter(([k,v])=>k.length<81&&!/password|email|token|cookie|secret|authorization|__proto__|constructor|prototype/i.test(k)&&typeof v==='string').slice(0,40).map(([k,v])=>[k,v.slice(0,200)]))):[];
 return {source:'FIAWEC+ via the existing collector server',state:states.has(raw.state)?raw.state:'discovery_failed',live:false,checked_at:Number.isFinite(Date.parse(raw.checked_at))?raw.checked_at:null,target,
  auth_state:raw.auth_state==='authenticated'?'authenticated':null,race_url:safeWecUrl(raw.race_url),session_url:safeWecUrl(raw.session_url),timing_url:safeWecUrl(raw.timing_url),
  private_timing_link:raw.private_timing_link===true,busy:raw.busy===true,retry_requires_operator:raw.retry_requires_operator===true,rows_changed:raw.rows_changed===true,records,
  verification_note:'Link discovery and table extraction are not verified live reception. Session-time validation remains required.',...(ACCESS_BLOCKED.has(raw.state)?{next_step:WEC_NEXT_STEP}:{})};
}
export async function wecLiveCall(name,args,env){
 if(!cloudConfigured(env))throw Error('기존 수집 서버 연결 설정이 필요합니다.');
 let raw;
 try{raw=await cloudRequest(env,name==='wec_discover_live'?'/wec/discover':'/wec/snapshot',name==='wec_discover_live'?'POST':'GET',name==='wec_discover_live'?args:undefined);}
 catch{throw Error('WEC 수집기 연결을 확인하지 못했습니다. 수집 서버의 WEC 코드 배포·브라우저 설치·연결 인증을 확인해 주세요.');}
 return {content:[{type:'text',text:JSON.stringify(publicWecStatus(raw))}],isError:false};
}

// Same split as F1 (personal-f1.js): crew (and the owner) use the operator's FIAWEC+ account
// through the shared scheduled collector; everyone else signs in with their own account.
// The scope comes from the verified identity only, never from a request field.
export async function wecAccess(request,env,google=null){
 // Without a crew key configured there is no crew/personal split (previous WEC behaviour).
 if(!env.LIVE_ANALYSIS_KEY_HASH||await sharedLiveAllowed(request,env,google))return {mode:'crew'};
 const account=(await accountIdentity(request,env,google,{create:true}))?.account;
 return account&&!account.deleted?{mode:'personal',accountId:account.id}:null;
}
const personalPath=(access,path)=>'/personal/'+encodeURIComponent(access.accountId)+path;
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});

// Scheduled GitHub Actions job (collector/wec_live_runner.py) -> site. GET reports whether
// a session window is done; POST stores the latest timing table; final=1 closes the window.
export async function wecActionsPush(request,env,{verify=token=>verifyCollectorToken(token,{workflow:WEC_COLLECTOR_WORKFLOW})}={}){
 const url=new URL(request.url),windowId=url.searchParams.get('window');
 if(!['GET','POST'].includes(request.method))return reply({error:'Method not allowed'},405);
 if(!WINDOW_ID.test(windowId||''))return reply({error:'Invalid window id'},400);
 try{await verify((request.headers.get('authorization')||'').replace(/^Bearer /,''));}catch{return reply({error:'Collector token rejected'},401);}
 if(!env.BUCKET)return reply({error:'Live storage unavailable'},503);
 const doneKey='wec/live/windows/'+windowId+'.json';
 if(request.method==='GET')return reply({window:windowId,done:!!await env.BUCKET.get(doneKey)});
 const text=await request.text();if(text.length>300000)return reply({error:'Snapshot too large'},413);
 let raw;try{raw=JSON.parse(text);}catch{return reply({error:'JSON required'},400);}
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.window!==windowId)return reply({error:'Window mismatch'},400);
 const received_at=new Date().toISOString();
 const stored={...storedFields(raw),received_at};
 await env.BUCKET.put(STORE,JSON.stringify(stored));
 if(url.searchParams.get('final')==='1')await env.BUCKET.put(doneKey,JSON.stringify({done:true,at:received_at}));
 return reply({ok:true,received_at});
}
const iso=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?v:null;
function storedFields(raw){
 const base=publicWecStatus(raw);
 return {...base,window:String(raw.window).slice(0,100),event:String(raw.event??'').slice(0,100),
  sessions:Array.isArray(raw.sessions)?raw.sessions.filter(v=>typeof v==='string').slice(0,8).map(v=>v.slice(0,60)):[],
  session:typeof raw.session==='string'?raw.session.slice(0,40):null,
  diagnostic:typeof raw.diagnostic==='string'?raw.diagnostic.replace(/[^\w .:@·|-]/g,'').slice(0,160):null,
  rows_changed_at:iso(raw.rows_changed_at),window_open:iso(raw.window_open),window_close:iso(raw.window_close)};
}
// LIVE only while the scheduled session window is open, the reader is on the timing page
// and the table itself changed within the last 90 seconds. A login, a link or a still
// table is never shown as live.
export function wecLiveView(stored,now=Date.now()){
 if(!stored)return {...publicWecStatus({state:'not_started'}),source:'FIAWEC+ live timing (scheduled reader)'};
 const open=Date.parse(stored.window_open)<=now&&now<=Date.parse(stored.window_close);
 const changed=(now-Date.parse(stored.rows_changed_at))/1000;
 const received=(now-Date.parse(stored.received_at))/1000;
 const live=open&&stored.state==='reading'&&stored.records?.length>0&&changed>=0&&changed<=FRESH_SECONDS&&received<=FRESH_SECONDS;
 return {...stored,source:'FIAWEC+ live timing (scheduled reader)',live,
  table_age_seconds:Number.isFinite(changed)?Math.round(changed):null,received_age_seconds:Number.isFinite(received)?Math.round(received):null,
  verification_note:live?'The timing table changed within the last 90 seconds during the scheduled session window.':'Not live: the window is closed, the table has not changed recently, or the reader has not reached the timing page.'};
}
export async function storedWecLive(env,now=Date.now()){
 const object=await env.BUCKET?.get(STORE);
 return wecLiveView(object?await object.json():null,now);
}

// /live: personal FIAWEC+ login (non-crew). Crew already use the operator's account.
export async function wecLoginRoute(request,env,access){
 const url=new URL(request.url);
 if(request.method!=='POST')return reply({error:'POST required'},405);
 if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return reply({error:'Same-origin request required'},403);
 if(access.mode!=='personal')return reply({error:'등록된 선원은 운영자 FIAWEC+ 계정으로 수신합니다.'},409);
 try{
  if(url.pathname.endsWith('/logout'))return reply(await cloudRequest(env,personalPath(access,'/wec/logout'),'POST'));
  const text=await request.text();if(text.length>4096)return reply({error:'Request too large'},413);
  const body=JSON.parse(text);
  if(typeof body.username!=='string'||!body.username.trim()||body.username.length>254||typeof body.password!=='string'||!body.password||body.password.length>1024)return reply({error:'FIAWEC+ 이메일과 비밀번호를 확인하세요.'},400);
  return reply(await cloudRequest(env,personalPath(access,'/wec/login'),'POST',{username:body.username.trim(),password:body.password}));
 }catch{return reply({error:'FIAWEC+ 연결 실패. 로그인 정보·구독과 수집 서버 상태를 확인하세요.'},502);}
}

export async function wecRoutes(request,env,websiteIdentity=null){
 const path=new URL(request.url).pathname;
 if(path==='/api/wec/actions-push')return wecActionsPush(request,env);
 if(!['/api/live/wec/login','/api/live/wec/logout'].includes(path))return null;
 const google=websiteIdentity||await googleIdentity(request,env);
 if(!request.headers.get('oai-authenticated-user-id')&&!google)return reply({error:'사이트 계정으로 로그인해 주세요.'},401);
 const access=await wecAccess(request,env,google);
 if(!access)return reply({error:'유효한 꽁보다 계정으로 로그인해 주세요.'},401);
 return wecLoginRoute(request,env,access);
}

// MCP: crew read the scheduled reader's table; a personal account reads only its own login's result.
export async function wecLiveAccessCall(name,args,env,access){
 if(access.mode==='crew'){
  if(name==='wec_live_status'){
   const view=await storedWecLive(env);
   if(view.state!=='not_started')return {content:[{type:'text',text:JSON.stringify(view)}],isError:false};
  }
  return wecLiveCall(name,args,env);
 }
 if(!cloudConfigured(env))throw Error('기존 수집 서버 연결 설정이 필요합니다.');
 let raw;
 try{raw=await cloudRequest(env,personalPath(access,name==='wec_discover_live'?'/wec/discover':'/wec/snapshot'),name==='wec_discover_live'?'POST':'GET',name==='wec_discover_live'?args:undefined);}
 catch{throw Error('WEC 수집기 연결을 확인하지 못했습니다. 잠시 후 다시 시도하세요.');}
 const status=publicWecStatus(raw);
 if(status.state==='credentials_required')status.verification_note='본인 FIAWEC+ 계정 연결이 필요합니다. https://kongboda-motorsports.vercel.app/live 에서 연결하세요(최대 8시간 유지). 선원은 운영자 계정으로 자동 수신합니다.';
 return {content:[{type:'text',text:JSON.stringify({...status,access:'personal FIAWEC+ account'})}],isError:false};
}
