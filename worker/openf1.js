// Completed-session F1 analysis straight from the OpenF1 API (https://openf1.org): any lap,
// race starts, stints and car telemetry, fetched when a question needs it and never stored.
// Live sessions stay on FastF1 + the collector hosts (live.js). OpenF1 historical data is
// free and needs no key; the free tier allows 3 requests/s and 30/min, so answers reuse a
// short in-memory cache and retry once politely on 429.
import {distanceDelta} from './telemetry.js';

const BASE='https://api.openf1.org/v1/';
const CACHE_MS=10*60_000,CACHE_MAX=200,TIMEOUT_MS=20_000;
const cache=new Map();
const SOURCE='OpenF1 API (historical F1 live-timing data, fetched on demand; not stored by Kongboda)';
const ro={readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true};
const key={type:'integer',minimum:1,maximum:999999999999};
const driver={type:'string',pattern:'^\\d{1,3}$'};

export const OPENF1_TOOLS=[
 {name:'openf1_sessions',description:'Find completed F1 sessions (session_key) on OpenF1 by year and place, e.g. year 2026 + "Mexico". Use the session_key with openf1_laps and openf1_lap_telemetry for post-session analysis.',
  inputSchema:{type:'object',properties:{year:{type:'integer',minimum:2023,maximum:2100},place:{type:'string',minLength:2,maxLength:60,description:'Country, location or circuit name fragment'},session_name:{type:'string',maxLength:40,description:'Optional, e.g. Race, Qualifying, Sprint, Practice 1'}},required:['year'],additionalProperties:false},annotations:ro},
 {name:'openf1_laps',description:'Completed-session laps from OpenF1: lap times, S1/S2/S3, pit-out laps, lap start times and tyre stint per lap. Without driver_number returns each driver\'s best lap and lap count; with driver_number returns that driver\'s laps (optionally lap_from..lap_to). For post-session analysis only; live sessions use fastf1_live_snapshot.',
  inputSchema:{type:'object',properties:{session_key:key,driver_number:driver,lap_from:{type:'integer',minimum:1,maximum:200},lap_to:{type:'integer',minimum:1,maximum:200}},required:['session_key'],additionalProperties:false},annotations:ro},
 {name:'openf1_lap_telemetry',description:'Car telemetry (speed, throttle, binary brake, gear, RPM at about 3.7 Hz) for any lap of a completed session from OpenF1, optionally compared with a second driver/lap. lap_number defaults to the driver\'s best lap. For race starts use lap_number 1 with seconds (e.g. 15): the window then begins 3 s before the lap start so the launch from standstill is visible. Distance is speed-integrated (approximate). Not for live sessions.',
  inputSchema:{type:'object',properties:{session_key:key,driver_number:driver,lap_number:{type:'integer',minimum:1,maximum:200},compare_driver_number:driver,compare_lap_number:{type:'integer',minimum:1,maximum:200},seconds:{type:'number',minimum:3,maximum:200}},required:['session_key','driver_number'],additionalProperties:false},annotations:ro}
];

export const OPENF1_INSTRUCTIONS=' POST-SESSION F1 ANALYSIS: for a completed session (any lap, race starts, stints, sector times, lap or start telemetry) use the OpenF1 tools: openf1_sessions to find the session_key, openf1_laps for laps/sectors/tyres, openf1_lap_telemetry for telemetry (lap_number 1 + seconds for starts). Name OpenF1 as the source. Live sessions stay on the FastF1 tools. If OpenF1 is rate-limited or lacks the data, say so instead of guessing.';

function query(params){
 return Object.entries(params).filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(String(v))).join('&');
}

export async function openf1Get(path,params={},{fetchImpl=fetch,wait=ms=>new Promise(r=>setTimeout(r,ms)),now=Date.now()}={}){
 const url=BASE+path+'?'+query(params);
 const hit=cache.get(url);
 if(hit&&now-hit.at<CACHE_MS)return hit.data;
 for(let attempt=0;;attempt++){
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),TIMEOUT_MS);
  let res;
  try{res=await fetchImpl(url,{headers:{accept:'application/json'},signal:ctl.signal});}
  catch{throw Error('OpenF1 did not answer. Try again in a moment.');}
  finally{clearTimeout(timer);}
  if(res.status===429&&attempt<2){await wait(1200*(attempt+1));continue;}
  if(res.status===429)throw Error('OpenF1 is rate-limiting requests right now (free tier 30/min). Try again in a minute.');
  if(res.status===404)return [];
  if(!res.ok)throw Error('OpenF1 error '+res.status);
  const data=await res.json();
  if(!Array.isArray(data))throw Error('Unexpected OpenF1 response');
  if(cache.size>=CACHE_MAX)cache.delete(cache.keys().next().value);
  cache.set(url,{at:now,data});
  return data;
 }
}
export function clearOpenf1Cache(){cache.clear();}

const fmt=s=>{if(!Number.isFinite(s))return null;const m=Math.floor(s/60),r=s-m*60;return m?`${m}:${r.toFixed(3).padStart(6,'0')}`:r.toFixed(3);};
const sec=v=>Number.isFinite(v)?Number(v.toFixed(3)):null;
const timed=l=>Number.isFinite(l.lap_duration)&&!l.is_pit_out_lap;
export function bestLap(laps){return laps.filter(timed).sort((a,b)=>a.lap_duration-b.lap_duration)[0]||null;}
function tyreFor(stints,driverNumber,lap){
 const s=stints.find(x=>x.driver_number===driverNumber&&x.lap_start<=lap&&(x.lap_end==null||lap<=x.lap_end));
 return s?{compound:s.compound||null,tyre_age:Number.isFinite(s.tyre_age_at_start)?s.tyre_age_at_start+(lap-s.lap_start):null,stint:s.stint_number??null}:null;
}
function lapRow(l,stints){
 return {driver_number:String(l.driver_number),lap_number:l.lap_number,lap_time:fmt(l.lap_duration),lap_seconds:sec(l.lap_duration),
  sectors:{S1:sec(l.duration_sector_1),S2:sec(l.duration_sector_2),S3:sec(l.duration_sector_3)},pit_out_lap:!!l.is_pit_out_lap,
  speed_trap_kmh:l.st_speed??null,date_start:l.date_start||null,tyre:tyreFor(stints,l.driver_number,l.lap_number)};
}

async function sessions(args,io){
 const rows=await openf1Get('sessions',{year:args.year},io);
 const place=(args.place||'').toLowerCase(),name=(args.session_name||'').toLowerCase();
 const found=rows.filter(s=>(!place||[s.country_name,s.location,s.circuit_short_name,s.meeting_name].some(v=>String(v||'').toLowerCase().includes(place)))
  &&(!name||String(s.session_name||'').toLowerCase()===name||String(s.session_type||'').toLowerCase()===name));
 return {source:SOURCE,sessions:found.slice(0,40).map(s=>({session_key:s.session_key,meeting_key:s.meeting_key,session_name:s.session_name,session_type:s.session_type,country:s.country_name,location:s.location,date_start:s.date_start,date_end:s.date_end})),
  ...(found.length?{}:{reason:'No matching session on OpenF1. Check the year and place spelling.'})};
}

async function laps(args,io){
 const d=args.driver_number;
 const [rows,stints,drivers]=await Promise.all([openf1Get('laps',{session_key:args.session_key,driver_number:d},io),openf1Get('stints',{session_key:args.session_key,driver_number:d},io),openf1Get('drivers',{session_key:args.session_key,driver_number:d},io)]);
 if(!rows.length)return {state:'unavailable',source:SOURCE,session_key:args.session_key,reason:'OpenF1 has no laps for this session'+(d?' and driver':'')+'.'};
 const who=Object.fromEntries(drivers.map(x=>[String(x.driver_number),{driver:x.name_acronym||null,team:x.team_name||null}]));
 if(d){
  const from=args.lap_from||1,to=args.lap_to||999,sel=rows.filter(l=>l.lap_number>=from&&l.lap_number<=to).sort((a,b)=>a.lap_number-b.lap_number);
  const best=bestLap(rows);
  return {state:'ready',source:SOURCE,session_key:args.session_key,driver_number:d,...(who[d]||{}),best_lap:best?lapRow(best,stints):null,laps:sel.slice(0,120).map(l=>lapRow(l,stints)),
   limitations:['Pit-out laps are flagged and excluded from best-lap selection.','Lap times are OpenF1 timing values; use FIA classification documents for official results.']};
 }
 const by=new Map();for(const l of rows){const k=String(l.driver_number);if(!by.has(k))by.set(k,[]);by.get(k).push(l);}
 const list=[...by.entries()].map(([n,ls])=>{const b=bestLap(ls);return {driver_number:n,...(who[n]||{}),laps:ls.length,best_lap:b?lapRow(b,stints):null};})
  .sort((a,b)=>(a.best_lap?.lap_seconds??1e9)-(b.best_lap?.lap_seconds??1e9));
 return {state:'ready',source:SOURCE,session_key:args.session_key,drivers:list,next:'Call openf1_laps with driver_number for every lap of one driver, or openf1_lap_telemetry for telemetry.'};
}

// Rows: [elapsed_s, integrated_distance_m, speed_kmh, throttle_percent, brake_on, gear, rpm]
export function telemetryRows(samples,startMs){
 const rows=[];let dist=0,prev=null;
 for(const s of samples){
  const t=Date.parse(s.date);if(!Number.isFinite(t))continue;
  if(prev){const dt=(t-prev.t)/1000;if(dt>0&&dt<2)dist+=((prev.speed+(s.speed||0))/2)/3.6*dt;}
  rows.push([Number(((t-startMs)/1000).toFixed(3)),Number(dist.toFixed(2)),s.speed??null,s.throttle??null,s.brake>0?1:0,s.n_gear??null,s.rpm??null]);
  prev={t,speed:s.speed||0};
 }
 return rows;
}

async function oneLap(sessionKey,driverNumber,lapNumber,seconds,io){
 const [rows,stints]=await Promise.all([openf1Get('laps',{session_key:sessionKey,driver_number:driverNumber},io),openf1Get('stints',{session_key:sessionKey,driver_number:driverNumber},io)]);
 const lap=lapNumber?rows.find(l=>l.lap_number===lapNumber):bestLap(rows);
 if(!lap)return {state:'unavailable',driver_number:driverNumber,reason:lapNumber?`OpenF1 has no lap ${lapNumber} for car ${driverNumber}.`:`OpenF1 has no timed lap for car ${driverNumber}.`};
 const begin=Date.parse(lap.date_start);
 if(!Number.isFinite(begin))return {state:'unavailable',driver_number:driverNumber,reason:'This lap has no start time on OpenF1.'};
 const lead=lap.lap_number===1&&seconds?3:0;
 const span=seconds||(Number.isFinite(lap.lap_duration)?lap.lap_duration:150);
 const from=begin-lead*1000,to=begin+span*1000;
 const samples=await openf1Get('car_data',{session_key:sessionKey,driver_number:driverNumber,'date>':new Date(from).toISOString(),'date<':new Date(to).toISOString()},io);
 samples.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 const data=telemetryRows(samples,begin);
 const gaps=[];for(let i=1;i<data.length;i++)if(data[i][0]-data[i-1][0]>1.5)gaps.push([data[i-1][0],data[i][0]]);
 return {state:data.length?'ready':'unavailable',driver_number:String(driverNumber),...lapRow(lap,stints),window:{from:new Date(from).toISOString(),to:new Date(to).toISOString(),seconds_before_lap_start:lead,partial_lap:!!seconds},
  sample_count:data.length,gaps_seconds:gaps,complete_coverage:data.length>2&&!gaps.length&&!seconds,distance_m:data.length?data.at(-1)[1]:0,samples:data,
  ...(data.length?{}:{reason:'OpenF1 returned no car data for this window.'})};
}

async function lapTelemetry(args,io){
 if(args.compare_driver_number&&args.compare_driver_number===args.driver_number&&(args.compare_lap_number||null)===(args.lap_number||null))throw Error('Choose a different driver or lap to compare');
 const first=await oneLap(args.session_key,args.driver_number,args.lap_number,args.seconds,io);
 const second=args.compare_driver_number||args.compare_lap_number?await oneLap(args.session_key,args.compare_driver_number||args.driver_number,args.compare_lap_number||(args.compare_driver_number?args.lap_number:null),args.seconds,io):null;
 const laps=[first,...(second?[second]:[])];
 const ready=laps.every(l=>l.state==='ready');
 const delta=ready&&laps.length===2&&!args.seconds?distanceDelta(laps.map(l=>({...l,complete_coverage:l.complete_coverage}))):null;
 return {state:ready?'ready':laps.some(l=>l.state==='ready')?'partial':'unavailable',source:SOURCE,session_key:args.session_key,laps,...(delta?{delta}:{}),
  columns:['elapsed_s','integrated_distance_m','speed_kmh','throttle_percent','brake_on','gear','rpm'],
  limitations:['elapsed_s is measured from the lap start time (negative before the start line for race starts).','Distance is speed-integrated, not GPS. Brake is binary.','About 3.7 samples per second; do not draw across gaps.'],
  response_format:'One conclusion sentence, aligned speed/throttle/brake charts on a common horizontal axis, a short sector table, and 1-2 observations. Name OpenF1 as the source.'};
}

export async function openf1Call(name,args,io={}){
 for(const k of ['driver_number','compare_driver_number'])if(args[k]!==undefined&&!/^\d{1,3}$/.test(args[k]))throw Error('Use a driver racing number');
 const result=name==='openf1_sessions'?await sessions(args,io):name==='openf1_laps'?await laps(args,io):name==='openf1_lap_telemetry'?await lapTelemetry(args,io):null;
 if(!result)throw Error('Unknown OpenF1 tool');
 return {content:[{type:'text',text:JSON.stringify(result)}],isError:false};
}
