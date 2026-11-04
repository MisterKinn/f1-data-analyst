import {cloudConfigured,cloudRequest} from './live.js';
const sessions=['auto','FP1','FP2','FP3','Qualifying','Hyperpole','Race'];
const hosts=new Set(['plus.fiawec.com','fiawec.alkamelsystems.com']);
const states=new Set(['not_started','discovering','waiting_for_session','timing_opened','timing_layout_unverified','snapshot_unverified','credentials_required','authentication_failed','authentication_action_required','authentication_unverified','human_verification_required','subscription_or_login_required','timing_link_unavailable','event_not_found','ambiguous_event','ambiguous_live_session','unapproved_destination','browser_runtime_unavailable','discovery_timeout','discovery_failed']);
export const WEC_LIVE_TOOLS=[
 {name:'wec_discover_live',description:'Start a bounded FIAWEC+ browser lookup on the existing collector: authenticate, discover the requested event and current live session, open its Live Timing control, and extract the observed timing link/table. event must be an event-name fragment such as Monza, never a URL. Does not prove live reception. Call wec_live_status to read the result. Credentials stay on the collector server; CAPTCHA/MFA/subscription errors require the owner. No scheduled polling.',inputSchema:{type:'object',properties:{event:{type:'string',minLength:2,maxLength:100},session:{type:'string',enum:sessions},year:{type:'integer',minimum:2020,maximum:2100}},required:['event'],additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:true}},
 {name:'wec_live_status',description:'Read the last WEC discovery result without starting a browser or login. Report each stage and checked_at. A found URL, login, or table is not verified live timing. Never infer fresh data or substitute FastF1/Al Kamel for a missing WEC live feed.',inputSchema:{type:'object',properties:{},required:[],additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}
];
export const WEC_LIVE_INSTRUCTIONS=' WEC LIVE DISCOVERY: Use wec_discover_live with the requested event/year/session, then wec_live_status. It follows FIAWEC+ visible pages rather than guessing a feed URL. No provider credentials or signed timing URLs may be disclosed. All current WEC snapshots remain live=false until session-specific live status and freshness are independently verified. waiting_for_session is normal; authentication, runtime, access and parsing failures are not a no-session result. Discovery has bounded execution, no autonomous schedule. Al Kamel is for completed WEC sessions, FastF1 is F1 only.';
export function safeWecUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&hosts.has(u.hostname)&&!u.username&&!u.password&&!u.search&&!u.hash&&(!u.port||u.port==='443')&&!/\/(?:token|auth|callback)\//i.test(u.pathname)?u.href:null;}catch{return null;}}
export function publicWecStatus(raw={}){
 const target=raw.target&&typeof raw.target==='object'?{event:String(raw.target.event??'').slice(0,100),year:raw.target.year,session:sessions.includes(raw.target.session)?raw.target.session:'auto'}:null;
 const records=Array.isArray(raw.records)?raw.records.slice(0,100).filter(r=>r&&typeof r==='object'&&!Array.isArray(r)).map(r=>Object.fromEntries(Object.entries(r).filter(([k,v])=>k.length<81&&!/password|email|token|cookie|secret|authorization|__proto__|constructor|prototype/i.test(k)&&typeof v==='string').slice(0,40).map(([k,v])=>[k,v.slice(0,200)]))):[];
 return {source:'FIAWEC+ via the existing collector server',state:states.has(raw.state)?raw.state:'discovery_failed',live:false,checked_at:Number.isFinite(Date.parse(raw.checked_at))?raw.checked_at:null,target,
  auth_state:raw.auth_state==='authenticated'?'authenticated':null,race_url:safeWecUrl(raw.race_url),session_url:safeWecUrl(raw.session_url),timing_url:safeWecUrl(raw.timing_url),
  private_timing_link:raw.private_timing_link===true,busy:raw.busy===true,retry_requires_operator:raw.retry_requires_operator===true,rows_changed:raw.rows_changed===true,records,
  verification_note:'Link discovery and table extraction are not verified live reception. Session-time validation remains required.'};
}
export async function wecLiveCall(name,args,env){
 if(!cloudConfigured(env))throw Error('기존 수집 서버 연결 설정이 필요합니다.');
 let raw;
 try{raw=await cloudRequest(env,name==='wec_discover_live'?'/wec/discover':'/wec/snapshot',name==='wec_discover_live'?'POST':'GET',name==='wec_discover_live'?args:undefined);}
 catch{throw Error('WEC 수집기 연결을 확인하지 못했습니다. 수집 서버의 WEC 코드 배포·브라우저 설치·연결 인증을 확인해 주세요.');}
 return {content:[{type:'text',text:JSON.stringify(publicWecStatus(raw))}],isError:false};
}
