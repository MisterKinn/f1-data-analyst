// Completed-session F1 analysis straight from the OpenF1 API (https://openf1.org): any lap,
// race starts, stints and car telemetry, fetched when a question needs it. Nothing is written
// to a database. Live sessions stay on FastF1 + the collector hosts (live.js). OpenF1
// historical data is free and needs no key; the free tier allows 3 requests/s and 30/min.
//
// Short in-memory cache (per server instance, lost on restart):
// - a settled session (scheduled end + 2 h passed, so red-flag overruns and late OpenF1
//   corrections are over) is kept SETTLED_MS: its data no longer changes;
// - a running or just-finished session is kept only FRESH_MS, so a burst of the same
//   question does not hit the rate limit but late corrections still show up;
// - laps, stints and drivers are fetched once per session and filtered per driver;
// - the cache is capped by entries and by bytes, oldest (least recently used) out first.
import {distanceDelta} from './telemetry.js';
import {TI_SOURCE,tiSessions,tiSessionData,tiLapTelemetry,tiTurns,nearestTurn} from './tracinginsights.js';

const BASE='https://api.openf1.org/v1/';
export const CACHE_POLICY={SETTLED_MS:30*60_000,FRESH_MS:60_000,META_MS:6*3600_000,SETTLE_AFTER_END_MS:2*3600_000,MAX_ENTRIES:300,MAX_BYTES:24*1024*1024};
const TIMEOUT_MS=20_000;
const cache=new Map();let cacheBytes=0;
export const SOURCE='OpenF1 API (historical F1 live-timing data, fetched on demand; kept briefly in server memory only, never written to storage)';
const ro={readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true};
const key={type:'integer',minimum:1,maximum:999999999999};
const driver={type:'string',pattern:'^\\d{1,3}$'};

export const OPENF1_TOOLS=[
 {name:'f1_sessions',description:'Find completed F1 sessions (session_key) by year and place, e.g. year 2026 + "Mexico". Use the session_key with f1_laps and f1_lap_telemetry for post-session analysis.',
  inputSchema:{type:'object',properties:{year:{type:'integer',minimum:2023,maximum:2100},place:{type:'string',minLength:2,maxLength:60,description:'Country, location or circuit name fragment'},session_name:{type:'string',maxLength:40,description:'Optional, e.g. Race, Qualifying, Sprint, Practice 1'}},required:['year'],additionalProperties:false},annotations:ro},
 {name:'f1_laps',description:'Completed-session laps (TracingInsights/FastF1 extraction, OpenF1 fallback): lap times, S1/S2/S3, pit-out laps, lap start times and tyre stint per lap. Without driver_number returns each driver\'s best lap and lap count; with driver_number returns that driver\'s laps (optionally lap_from..lap_to). For post-session analysis only; live sessions use f1_live_snapshot.',
  inputSchema:{type:'object',properties:{session_key:key,driver_number:driver,lap_from:{type:'integer',minimum:1,maximum:200},lap_to:{type:'integer',minimum:1,maximum:200}},required:['session_key'],additionalProperties:false},annotations:ro},
 {name:'f1_lap_telemetry',description:'Car telemetry (speed, throttle, binary brake, gear, RPM at about 3.7 Hz) for any lap of a completed session (TracingInsights/FastF1 extraction, OpenF1 fallback), optionally compared with a second driver/lap. lap_number defaults to the driver\'s best lap. For race starts use lap_number 1 with seconds (e.g. 15): the window then begins 3 s before the lap start so the launch from standstill is visible. Distance is speed-integrated (approximate). Not for live sessions.',
  inputSchema:{type:'object',properties:{session_key:key,driver_number:driver,lap_number:{type:'integer',minimum:1,maximum:200},compare_driver_number:driver,compare_lap_number:{type:'integer',minimum:1,maximum:200},seconds:{type:'number',minimum:3,maximum:200},summary:{type:'boolean',description:'true returns a compact per-corner summary (minimum speed, braking point, time gained or lost per corner) instead of raw samples. Use it first for comparisons; ask for samples only when drawing charts.'}},required:['session_key','driver_number'],additionalProperties:false},annotations:ro}
];

export const OPENF1_INSTRUCTIONS=' POST-SESSION F1 ANALYSIS: for a completed session (any lap, race starts, stints, sector times, lap or start telemetry) use the post-session tools: f1_sessions to find the session_key, f1_laps for laps/sectors/tyres, f1_lap_telemetry for telemetry (lap_number 1 + seconds for starts). These three read TracingInsights first (free, published about an hour after the session, not locked during live sessions) and OpenF1 when TracingInsights has no data; name the source given in each result. QUALIFYING: rank by the classification, not the fastest lap of the session: compare Q3 laps for Q3 drivers (laps carry qualifying_segment; deleted laps are flagged and never chosen as best) and confirm with the FIA provisional/final qualifying classification and deleted-lap documents (fia_list_documents). TELEMETRY CHARTS: mark every official turn number (official_turns) on the common distance axis and name turns by official number in the text; never present speed-minimum order (corner) as turn numbers. Gaps the post-session data does not cover (official results, grid, penalties, pit-stop times, overtakes) come from FIA documents. Live sessions use the f1_live_* tools. If OpenF1 is rate-limited or lacks the data, say so instead of guessing. Results carry a cache field: data may be reused from server memory for up to 30 min for a settled session (scheduled end + 2 h) and up to 1 min otherwise; mention it only if the user asks how fresh the data is.';

function query(params){
 return Object.entries(params).filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(String(v))).join('&');
}

function drop(url){const e=cache.get(url);if(e){cacheBytes-=e.bytes;cache.delete(url);}}
function remember(url,data,bytes,ttl,now){
 if(ttl<=0||bytes>CACHE_POLICY.MAX_BYTES/4)return;
 drop(url);
 while(cache.size&&(cache.size>=CACHE_POLICY.MAX_ENTRIES||cacheBytes+bytes>CACHE_POLICY.MAX_BYTES))drop(cache.keys().next().value);
 cache.set(url,{at:now,ttl,data,bytes});cacheBytes+=bytes;
}
export function openf1CacheStats(){return {entries:cache.size,bytes:cacheBytes};}

// ttl: how long this answer may be reused (CACHE_POLICY.FRESH_MS when unsure).
export async function openf1Get(path,params={},{fetchImpl=fetch,wait=ms=>new Promise(r=>setTimeout(r,ms)),now=Date.now(),trace=null}={},ttl=CACHE_POLICY.FRESH_MS){
 const url=BASE+path+'?'+query(params);
 const hit=cache.get(url);
 if(hit&&now-hit.at<hit.ttl){cache.delete(url);cache.set(url,hit);trace?.push('hit');return hit.data;}
 if(hit)drop(url);
 trace?.push('fetch');
 for(let attempt=0;;attempt++){
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),TIMEOUT_MS);
  let res;
  try{res=await fetchImpl(url,{headers:{accept:'application/json'},signal:ctl.signal});}
  catch{throw Error('OpenF1 did not answer. Try again in a moment.');}
  finally{clearTimeout(timer);}
  if(res.status===429&&attempt<2){await wait(1200*(attempt+1));continue;}
  if(res.status===429)throw Error('OpenF1 is rate-limiting requests right now (free tier 30/min). Try again in a minute.');
  if(res.status===404)return [];
  if(res.status===401)throw Error('OpenF1 is locked for free users while an F1 session is live (past sessions included) and for a while after. Use f1_sessions/f1_laps/f1_lap_telemetry (TracingInsights) and FIA documents (fia_list_documents) meanwhile.');
  if(!res.ok)throw Error('OpenF1 error '+res.status);
  const text=await res.text();
  let data;try{data=JSON.parse(text);}catch{throw Error('Unexpected OpenF1 response');}
  if(!Array.isArray(data))throw Error('Unexpected OpenF1 response');
  remember(url,data,text.length,ttl,now);
  return data;
 }
}
export function clearOpenf1Cache(){cache.clear();cacheBytes=0;}

// How long data for this session may be reused. The session's own metadata changes rarely,
// so it is kept META_MS; unknown sessions are treated as still changing.
export async function sessionTtl(sessionKey,io={}){
 const now=io.now??Date.now();
 let rows=[];try{rows=await openf1Get('sessions',{session_key:sessionKey},io,CACHE_POLICY.META_MS);}catch{return CACHE_POLICY.FRESH_MS;}
 const end=Date.parse(rows[0]?.date_end);
 return Number.isFinite(end)&&now>=end+CACHE_POLICY.SETTLE_AFTER_END_MS?CACHE_POLICY.SETTLED_MS:CACHE_POLICY.FRESH_MS;
}
export const byDriver=(rows,d)=>d?rows.filter(r=>String(r.driver_number)===String(d)):rows;

export const fmt=s=>{if(!Number.isFinite(s))return null;const m=Math.floor(s/60),r=s-m*60;return m?`${m}:${r.toFixed(3).padStart(6,'0')}`:r.toFixed(3);};
export const sec=v=>Number.isFinite(v)?Number(v.toFixed(3)):null;
const timed=l=>Number.isFinite(l.lap_duration)&&!l.is_pit_out_lap&&!l.deleted;
export function bestLap(laps){return laps.filter(timed).sort((a,b)=>a.lap_duration-b.lap_duration)[0]||null;}
function tyreFor(stints,driverNumber,lap){
 const s=stints.find(x=>x.driver_number===driverNumber&&x.lap_start<=lap&&(x.lap_end==null||lap<=x.lap_end));
 return s?{compound:s.compound||null,tyre_age:Number.isFinite(s.tyre_age_at_start)?s.tyre_age_at_start+(lap-s.lap_start):null,stint:s.stint_number??null}:null;
}
function lapRow(l,stints){
 return {driver_number:String(l.driver_number),lap_number:l.lap_number,lap_time:fmt(l.lap_duration),lap_seconds:sec(l.lap_duration),
  sectors:{S1:sec(l.duration_sector_1),S2:sec(l.duration_sector_2),S3:sec(l.duration_sector_3)},pit_out_lap:!!l.is_pit_out_lap,
  speed_trap_kmh:l.st_speed??null,date_start:l.date_start||null,tyre:tyreFor(stints,l.driver_number,l.lap_number),
  ...(l.qualifying_segment?{qualifying_segment:l.qualifying_segment}:{}),...(l.deleted?{deleted:true,deleted_reason:l.deleted_reason||null}:{})};
}

// TracingInsights is used unless a test injects only an OpenF1 fetch.
const tiOn=io=>{if(io.tiFetch===undefined)io.tiFetch=io.fetchImpl?null:fetch;return !!io.tiFetch;};

async function sessions(args,io){
 if(tiOn(io)){
  let found=[];try{found=await tiSessions(args,io);}catch{}
  if(found.length){io.source=TI_SOURCE;return {source:TI_SOURCE,sessions:found.slice(0,40).map(s=>({session_key:s.session_key,meeting_key:s.meeting_key,session_name:s.session_name,session_type:s.session_type,country:s.country_name,location:s.location,meeting:s.meeting_name,date_start:s.date_start,date_end:s.date_end}))};}
 }
 const rows=await openf1Get('sessions',{year:args.year},io,CACHE_POLICY.SETTLED_MS);
 const place=(args.place||'').toLowerCase(),name=(args.session_name||'').toLowerCase();
 const found=rows.filter(s=>(!place||[s.country_name,s.location,s.circuit_short_name,s.meeting_name].some(v=>String(v||'').toLowerCase().includes(place)))
  &&(!name||String(s.session_name||'').toLowerCase()===name||String(s.session_type||'').toLowerCase()===name));
 return {source:SOURCE,sessions:found.slice(0,40).map(s=>({session_key:s.session_key,meeting_key:s.meeting_key,session_name:s.session_name,session_type:s.session_type,country:s.country_name,location:s.location,date_start:s.date_start,date_end:s.date_end})),
  ...(found.length?{}:{reason:'No matching session on OpenF1. Check the year and place spelling.'})};
}

// One request per kind for the whole session; every driver's question reuses it.
export async function sessionData(sessionKey,io){
 const [laps,stints,drivers]=await Promise.all(['laps','stints','drivers'].map(p=>openf1Get(p,{session_key:sessionKey},io,io.ttl)));
 return {laps,stints,drivers};
}

// Laps for the lap and telemetry tools: TracingInsights first, OpenF1 when it has none.
async function lapData(sessionKey,io){
 if(io.lapData?.key===sessionKey)return io.lapData.data;
 let data=null;
 if(tiOn(io)){try{data=await tiSessionData(sessionKey,io);}catch{}}
 if(data?.laps.length)io.source=TI_SOURCE;else{data=await sessionData(sessionKey,io);io.source=SOURCE;}
 io.lapData={key:sessionKey,data};return data;
}

async function laps(args,io){
 const d=args.driver_number;
 const all=await lapData(args.session_key,io);
 const rows=byDriver(all.laps,d),stints=byDriver(all.stints,d),drivers=byDriver(all.drivers,d);
 if(!rows.length)return {state:'unavailable',source:io.source,session_key:args.session_key,reason:'Neither TracingInsights nor OpenF1 has laps for this session'+(d?' and driver':'')+' yet.'};
 const who=Object.fromEntries(drivers.map(x=>[String(x.driver_number),{driver:x.name_acronym||null,team:x.team_name||null}]));
 if(d){
  const from=args.lap_from||1,to=args.lap_to||999,sel=rows.filter(l=>l.lap_number>=from&&l.lap_number<=to).sort((a,b)=>a.lap_number-b.lap_number);
  const best=bestLap(rows);
  return {state:'ready',source:io.source,session_key:args.session_key,driver_number:d,...(who[d]||{}),best_lap:best?lapRow(best,stints):null,laps:sel.slice(0,120).map(l=>lapRow(l,stints)),
   limitations:['Pit-out and deleted laps are flagged and excluded from best-lap selection.','Lap times are live-timing values; use FIA classification documents for official results.']};
 }
 const by=new Map();for(const l of rows){const k=String(l.driver_number);if(!by.has(k))by.set(k,[]);by.get(k).push(l);}
 const list=[...by.entries()].map(([n,ls])=>{const b=bestLap(ls);return {driver_number:n,...(who[n]||{}),laps:ls.length,best_lap:b?lapRow(b,stints):null};})
  .sort((a,b)=>(a.best_lap?.lap_seconds??1e9)-(b.best_lap?.lap_seconds??1e9));
 return {state:'ready',source:io.source,session_key:args.session_key,drivers:list,next:'Call f1_laps with driver_number for every lap of one driver, or f1_lap_telemetry for telemetry.'};
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
 const all=await lapData(sessionKey,io);
 const rows=byDriver(all.laps,driverNumber),stints=byDriver(all.stints,driverNumber);
 const lap=lapNumber?rows.find(l=>l.lap_number===lapNumber):bestLap(rows);
 if(!lap)return {state:'unavailable',driver_number:driverNumber,reason:lapNumber?`No lap ${lapNumber} for car ${driverNumber}.`:`No timed lap for car ${driverNumber}.`};
 if(all.where){
  const {rows:data,scaled}=await tiLapTelemetry(all.where,lap,seconds,io);
  const gaps=[];for(let i=1;i<data.length;i++)if(data[i][0]-data[i-1][0]>1.5)gaps.push([data[i-1][0],data[i][0]]);
  return {state:data.length?'ready':'unavailable',driver_number:String(driverNumber),...lapRow(lap,all.stints),window:{seconds_before_lap_start:0,partial_lap:!!seconds},
   sample_count:data.length,gaps_seconds:gaps,complete_coverage:data.length>2&&!gaps.length&&!seconds,distance_m:data.length?data.at(-1)[1]:0,samples:data,
   ...(scaled?{time_axis_scaled:scaled}:{}),...(data.length?{}:{reason:'TracingInsights has no telemetry file for this lap yet.'})};
 }
 const begin=Date.parse(lap.date_start);
 if(!Number.isFinite(begin))return {state:'unavailable',driver_number:driverNumber,reason:'This lap has no start time on OpenF1.'};
 const lead=lap.lap_number===1&&seconds?3:0;
 const span=seconds||(Number.isFinite(lap.lap_duration)?lap.lap_duration:150);
 const from=begin-lead*1000,to=begin+span*1000;
 const samples=[...await openf1Get('car_data',{session_key:sessionKey,driver_number:driverNumber,'date>':new Date(from).toISOString(),'date<':new Date(to).toISOString()},io,io.ttl)];
 samples.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
 const data=telemetryRows(samples,begin);
 const gaps=[];for(let i=1;i<data.length;i++)if(data[i][0]-data[i-1][0]>1.5)gaps.push([data[i-1][0],data[i][0]]);
 return {state:data.length?'ready':'unavailable',driver_number:String(driverNumber),...lapRow(lap,stints),window:{from:new Date(from).toISOString(),to:new Date(to).toISOString(),seconds_before_lap_start:lead,partial_lap:!!seconds},
  sample_count:data.length,gaps_seconds:gaps,complete_coverage:data.length>2&&!gaps.length&&!seconds,distance_m:data.length?data.at(-1)[1]:0,samples:data,
  ...(data.length?{}:{reason:'OpenF1 returned no car data for this window.'})};
}

// Compact per-corner view of one lap: local speed minima at least 40 km/h below the
// preceding peak, merged within 150 m, with the braking point that led into each.
export function lapSummary(rows){
 const v=rows.filter(r=>Number.isFinite(r[2]));if(v.length<5)return null;
 const corners=[];let peak=v[0][2];
 for(let i=1;i<v.length-1;i++){
  const s=v[i][2];peak=Math.max(peak,v[i-1][2]);
  const lo=Math.max(0,i-3),hi=Math.min(v.length-1,i+3);let isMin=true;for(let j=lo;j<=hi;j++)if(v[j][2]<s){isMin=false;break;}
  if(!isMin||peak-s<40)continue;
  let b=i;while(b>0&&v[b-1][4]===1)b--;const braked=b<i&&v[b][4]===1;
  const corner={distance_m:Math.round(v[i][1]),min_speed_kmh:s,entry_speed_kmh:braked?v[Math.max(0,b-1)][2]:peak,brake_start_m:braked?Math.round(v[b][1]):null};
  const last=corners.at(-1);if(last&&corner.distance_m-last.distance_m<150){if(s<last.min_speed_kmh)corners[corners.length-1]=corner;}else corners.push(corner);
  peak=s;
 }
 const full=v.filter(r=>r[3]>=98).length,brake=v.filter(r=>r[4]===1).length;
 return {top_speed_kmh:Math.max(...v.map(r=>r[2])),full_throttle_pct:Math.round(100*full/v.length),braking_pct:Math.round(100*brake/v.length),corners};
}
function deltaAt(all,d){const points=(all||[]).filter(p=>Number.isFinite(p[1]));if(!points.length)return null;if(d<=points[0][0])return points[0][1];for(let i=1;i<points.length;i++)if(points[i][0]>=d){const [d0,v0]=points[i-1],[d1,v1]=points[i];return v0+(v1-v0)*(d-d0)/(d1-d0||1);}return points.at(-1)[1];}
export function cornerComparison(a,b,delta){
 if(!a||!b)return null;const rows=[];let prevExit=0;
 a.corners.forEach((c,i)=>{const m=b.corners.reduce((best,x)=>Math.abs(x.distance_m-c.distance_m)<Math.abs((best?.distance_m??1e9)-c.distance_m)?x:best,null);
  if(!m||Math.abs(m.distance_m-c.distance_m)>250)return;const exit=c.distance_m+150,d0=deltaAt(delta?.points,prevExit),d1=deltaAt(delta?.points,exit);prevExit=exit;
  rows.push({corner:i+1,...(c.turn?{turn:c.turn}:{}),distance_m:c.distance_m,min_speed_kmh:[c.min_speed_kmh,m.min_speed_kmh],brake_start_m:[c.brake_start_m,m.brake_start_m],time_change_s:Number.isFinite(d0)&&Number.isFinite(d1)?Number((d1-d0).toFixed(3)):null});});
 return {columns_note:'Pairs are [reference, comparison]. time_change_s is the change in the gap from the previous corner exit to this corner exit; positive means the comparison driver lost time there.',corners:rows,
  biggest_losses:[...rows].filter(r=>Number.isFinite(r.time_change_s)).sort((x,y)=>y.time_change_s-x.time_change_s).slice(0,3).map(r=>r.turn||r.corner),
  biggest_gains:[...rows].filter(r=>Number.isFinite(r.time_change_s)).sort((x,y)=>x.time_change_s-y.time_change_s).slice(0,3).map(r=>r.turn||r.corner)};
}

// Two laps rarely integrate to the same distance; stretching the second onto the first's
// length keeps the delta from drifting so it ends at the real lap-time difference.
function sameLength([a,b]){
 const la=a.samples.at(-1)?.[1],lb=b.samples.at(-1)?.[1];
 if(!(la>0&&lb>0))return [a,b];const k=la/lb;
 return [a,{...b,samples:b.samples.map(r=>[r[0],Number((r[1]*k).toFixed(2)),...r.slice(2)])}];
}

async function lapTelemetry(args,io){
 if(args.compare_driver_number&&args.compare_driver_number===args.driver_number&&(args.compare_lap_number||null)===(args.lap_number||null))throw Error('Choose a different driver or lap to compare');
 const first=await oneLap(args.session_key,args.driver_number,args.lap_number,args.seconds,io);
 const second=args.compare_driver_number||args.compare_lap_number?await oneLap(args.session_key,args.compare_driver_number||args.driver_number,args.compare_lap_number||(args.compare_driver_number?args.lap_number:null),args.seconds,io):null;
 const laps=[first,...(second?[second]:[])];
 const ready=laps.every(l=>l.state==='ready');
 const delta=ready&&laps.length===2&&!args.seconds?distanceDelta(sameLength(laps)):null;
 const where=io.lapData?.data?.where;
 const turns=where?await tiTurns(where,io):[];
 const turnInfo=turns.length?{official_turns:turns}:{official_turns:null,official_turns_note:'Official turn positions are not available for this session; say so and do not present speed-minimum numbers as turn numbers.'};
 if(args.summary){
  const sums=laps.map(l=>l.state==='ready'?lapSummary(l.samples):null);
  for(const sum of sums)for(const c of sum?.corners||[]){const t=nearestTurn(turns,c.distance_m);if(t)c.turn=t;}
  return {state:ready?'ready':laps.some(l=>l.state==='ready')?'partial':'unavailable',source:io.source,session_key:args.session_key,mode:'summary',
   laps:laps.map((l,i)=>{const {samples,...rest}=l;return {...rest,summary:sums[i]};}),
   ...turnInfo,...(delta?{total_delta_s:delta.points?.filter(p=>Number.isFinite(p[1])).at(-1)?.[1]??null,corner_comparison:cornerComparison(sums[0],sums[1],delta)}:{}),
   limitations:[...(io.source===TI_SOURCE?['TracingInsights telemetry starts at the lap start line (no pre-start window for race starts); a file time axis that ends away from the official lap time is scaled to it (time_axis_scaled).']:[]),'corner is the order of speed minima on this lap; turn is the nearest official turn number (within 150 m). Always label charts and text with official turn numbers.','Distance is speed-integrated and approximate. Brake is on/off only.','Call again without summary for raw samples when a chart is needed.']};
 }
 return {state:ready?'ready':laps.some(l=>l.state==='ready')?'partial':'unavailable',source:io.source,session_key:args.session_key,laps,...turnInfo,...(delta?{delta}:{}),
  columns:['elapsed_s','integrated_distance_m','speed_kmh','throttle_percent','brake_on','gear','rpm'],
  limitations:[...(io.source===TI_SOURCE?['TracingInsights telemetry starts at the lap start line (no pre-start window for race starts); a file time axis that ends away from the official lap time is scaled to it (time_axis_scaled).']:[]),'elapsed_s is measured from the lap start time (negative before the start line for race starts).','Distance is speed-integrated, not GPS. Brake is binary.','About 3.7 samples per second; do not draw across gaps.'],
  response_format:'One conclusion sentence, aligned speed/throttle/brake charts on a common horizontal axis with every official turn (official_turns) marked by a vertical line and its number, a short sector table, and 1-2 observations naming turns by official number. Name the source field.'};
}

export async function openf1Call(name,args,io={}){
 for(const k of ['driver_number','compare_driver_number'])if(args[k]!==undefined&&!/^\d{1,3}$/.test(args[k]))throw Error('Use a driver racing number');
 if(!['f1_sessions','f1_laps','f1_lap_telemetry'].includes(name))throw Error('Unknown OpenF1 tool');
 const trace=[],run={...io,trace};
 if(args.session_key)run.ttl=await sessionTtl(args.session_key,run);
 const result=name==='f1_sessions'?await sessions(args,run):name==='f1_laps'?await laps(args,run):await lapTelemetry(args,run);
 const hits=trace.filter(x=>x==='hit').length;
 result.cache={served_from_memory:hits,fetched_from_openf1:trace.length-hits,
  policy:run.ttl===undefined?'session list kept up to 30 min':run.ttl===CACHE_POLICY.SETTLED_MS?'settled session: kept up to 30 min':'running or just-finished session: kept up to 1 min'};
 return {content:[{type:'text',text:JSON.stringify(result)}],isError:false};
}
