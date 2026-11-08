// Completed-session race context from OpenF1: race control (flags, SC/VSC, red flags,
// penalties, track limits), per-lap positions and gaps, strategy with clean stint pace,
// classification with starting grid, weather and team radio links.
// All requests go through openf1Get, so they share the short memory cache and rate-limit
// handling in openf1.js. Nothing is written to storage.
import {openf1Get,sessionTtl,sessionData,byDriver,fmt,CACHE_POLICY,SOURCE} from './openf1.js';

const ro={readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true};
const key={type:'integer',minimum:1,maximum:999999999999};
const driver={type:'string',pattern:'^\\d{1,3}$'};
const drivers={type:'array',maxItems:6,items:{type:'string'},description:'Racing numbers as strings, e.g. ["63","12"]. Up to 6.'};
const lap={type:'integer',minimum:1,maximum:200};
const schema=(properties,required=['session_key'])=>({type:'object',properties,required,additionalProperties:false});

export const OPENF1_RACE_TOOLS=[
 {name:'f1_race_control',description:'Race control for a completed F1 session from OpenF1: SC, VSC and red-flag periods with laps and durations, penalties and steward investigations, track-limit deletions per driver, blue flags and key events. Use it to confirm neutralisations before explaining gaps, pit timing or slow laps.',
  inputSchema:schema({session_key:key,category:{type:'string',enum:['all','neutralisations','penalties','track_limits','flags'],description:'Default all.'},driver_number:driver}),annotations:ro},
 {name:'f1_race_gaps',description:'Per-lap positions and gaps for a completed F1 race or sprint from OpenF1, measured when each car crossed the timing line. With two drivers it also returns the gap between them per lap, the biggest lap-to-lap changes and the lap the order flipped. Laps under SC/VSC/red flag and pit laps are marked. Optionally lists overtakes involving the chosen drivers.',
  inputSchema:schema({session_key:key,driver_numbers:drivers,lap_from:lap,lap_to:lap,include_overtakes:{type:'boolean',description:'Default true.'}}),annotations:ro},
 {name:'f1_strategy',description:'Tyre strategy for a completed F1 session from OpenF1: stints (compound, laps, tyre age), pit stops (pit-lane and stationary time, flagged when made under red flag, SC or VSC) and clean stint pace (pit, lap-1, neutralised and outlier laps removed, with counts). With two drivers it adds a head-to-head pace difference on laps where both ran clean.',
  inputSchema:schema({session_key:key,driver_numbers:drivers}),annotations:ro},
 {name:'f1_result',description:'Classification of a completed F1 session from OpenF1 (position, laps, gap, status, points; Q1/Q2/Q3 times for qualifying) with the starting grid and places gained for races. Use FIA classification documents when official confirmation is needed.',
  inputSchema:schema({session_key:key}),annotations:ro},
 {name:'f1_weather',description:'Weather for a completed F1 session from OpenF1: air and track temperature range and trend, humidity, pressure, wind and rain periods, with 10-minute samples.',
  inputSchema:schema({session_key:key}),annotations:ro},
 {name:'f1_team_radio',description:'Team radio recordings for a completed F1 session from OpenF1: time, lap and audio link per message. Links only: there are no transcripts, so never describe what was said unless you actually heard it.',
  inputSchema:schema({session_key:key,driver_number:driver,lap_from:lap,lap_to:lap}),annotations:ro}
];

export const OPENF1_RACE_INSTRUCTIONS=' RACE CONTEXT: for completed sessions use f1_race_control to confirm SC/VSC/red flags and penalties, f1_race_gaps for per-lap gaps and overtakes, f1_strategy for stints, pit stops and clean pace, f1_result for classification and grid, f1_weather for conditions and f1_team_radio for radio links (no transcripts). Prefer these computed values over estimating gaps or pace by hand.';

const ms=v=>{const t=Date.parse(v);return Number.isFinite(t)?t:null;};
const iso=t=>Number.isFinite(t)?new Date(t).toISOString():null;
const round=(v,d=3)=>Number.isFinite(v)?Number(v.toFixed(d)):null;
const median=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const reply=result=>({content:[{type:'text',text:JSON.stringify(result)}],isError:false});

async function names(sessionKey,io){
 const {drivers:list}=await sessionData(sessionKey,io);
 return Object.fromEntries(list.map(x=>[String(x.driver_number),{driver:x.name_acronym||null,team:x.team_name||null}]));
}

// ---------- race control ----------
const carsIn=message=>[...String(message||'').matchAll(/\bCARS?\s+((?:\d{1,3}(?:\s*\([A-Z]{3}\))?(?:\s*(?:,|AND)\s*)?)+)/g)].flatMap(m=>[...m[1].matchAll(/\d{1,3}/g)].map(x=>x[0]));

export function neutralisations(messages){
 const rows=[...messages].sort((a,b)=>ms(a.date)-ms(b.date)),periods=[];let open=null;
 const close=(row,lap)=>{if(!open)return;open.end=row.date;open.lap_end=lap??row.lap_number??open.lap_start;periods.push(open);open=null;};
 for(const r of rows){
  const m=String(r.message||'').toUpperCase();
  if(/RED FLAG/.test(m)||r.flag==='RED'){if(open?.type==='RED FLAG')continue;close(r);open={type:'RED FLAG',start:r.date,lap_start:r.lap_number};continue;}
  if(open?.type==='RED FLAG'){if(r.category==='SessionStatus'&&/SESSION STARTED/.test(m))close(r);continue;}
  if(/^VSC DEPLOYED|VIRTUAL SAFETY CAR DEPLOYED/.test(m)){close(r);open={type:'VSC',start:r.date,lap_start:r.lap_number};continue;}
  if(/VSC ENDING|VIRTUAL SAFETY CAR ENDING/.test(m)&&open?.type==='VSC'){close(r);continue;}
  if(/^SAFETY CAR DEPLOYED/.test(m)){close(r);open={type:'SC',start:r.date,lap_start:r.lap_number};continue;}
  if(/SAFETY CAR IN THIS LAP|SAFETY CAR ENDING/.test(m)&&open?.type==='SC'){close(r);continue;}
  if(open&&r.category==='SessionStatus'&&/FINISHED|ENDED/.test(m))close(r);
 }
 if(open)periods.push({...open,end:null,lap_end:null});
 return periods.map(p=>({...p,duration_s:p.end?round((ms(p.end)-ms(p.start))/1000,1):null}));
}
export function neutralisedLaps(periods){
 const set=new Set();for(const p of periods){const to=p.lap_end??p.lap_start;for(let l=p.lap_start;l<=to;l++)set.add(l);}return set;
}

async function raceControl(args,io){
 const rows=await openf1Get('race_control',{session_key:args.session_key},io,io.ttl);
 if(!rows.length)return {state:'unavailable',source:SOURCE,session_key:args.session_key,reason:'OpenF1 has no race control messages for this session.'};
 const d=args.driver_number,cat=args.category||'all',who=await names(args.session_key,io);
 const mentions=r=>!d||String(r.driver_number??'')===d||carsIn(r.message).includes(d);
 const brief=r=>({lap:r.lap_number,time:r.date,message:r.message});
 const periods=neutralisations(rows);
 const penaltyRx=/STEWARDS|PENALTY|REPRIMAND|INVESTIGAT|NOTED|DISQUALIF|NO FURTHER|BLACK AND WHITE|SUMMONED|GRID/i;
 const penalties=rows.filter(r=>penaltyRx.test(r.message)&&!/TRACK LIMITS/i.test(r.message)&&mentions(r)).map(brief);
 const deleted=rows.filter(r=>/DELETED - TRACK LIMITS/i.test(r.message)&&mentions(r));
 const tl={};for(const r of deleted){const n=carsIn(r.message)[0];if(n)(tl[n]??=[]).push({lap:Number(r.message.match(/LAP (\d+)/)?.[1])||null,message:r.message});}
 const blue={};for(const r of rows.filter(r=>r.flag==='BLUE'&&r.driver_number!=null&&mentions(r))){const n=String(r.driver_number);blue[n]=(blue[n]||0)+1;}
 const keyRx=/RACE START|STANDING START|ROLLING START|RESUM|SESSION STARTED|SESSION FINISHED|CHEQUERED|RED FLAG|SAFETY CAR|VSC|RISK OF RAIN|ABORTED|SUSPENDED|EXTRA FORMATION/i;
 const flags=rows.filter(r=>keyRx.test(r.message)||['RED','CHEQUERED'].includes(r.flag)||(r.flag==='DOUBLE YELLOW'&&r.scope!=='Driver')).filter(mentions).map(brief);
 const out={state:'ready',source:SOURCE,session_key:args.session_key,...(d?{driver_number:d,...(who[d]||{})}:{})};
 if(cat==='all'||cat==='neutralisations')out.neutralisations=periods;
 if(cat==='all'||cat==='penalties')out.penalties_and_investigations=penalties;
 if(cat==='all'||cat==='track_limits')out.track_limit_deletions=Object.entries(tl).map(([n,list])=>({driver_number:n,...(who[n]||{}),count:list.length,laps:list.map(x=>x.lap)})).sort((a,b)=>b.count-a.count);
 if(cat==='all'||cat==='flags'){out.key_events=flags.slice(0,80);out.blue_flags=Object.entries(blue).map(([n,c])=>({driver_number:n,...(who[n]||{}),count:c})).sort((a,b)=>b.count-a.count);}
 out.limitations=['Messages are OpenF1 copies of race control; FIA steward decision documents are authoritative for penalties.','A penalty "noted" or "under investigation" is not a decision.'];
 return out;
}

// ---------- per-lap gaps ----------
// Time each driver crossed the line at the end of lap k: start of lap k+1, or start + duration for the last lap.
export function crossings(laps){
 const by=new Map();for(const l of laps){const n=String(l.driver_number);if(!by.has(n))by.set(n,[]);by.get(n).push(l);}
 const out=new Map();
 for(const [n,ls] of by){
  ls.sort((a,b)=>a.lap_number-b.lap_number);const c=new Map();
  for(let i=0;i<ls.length;i++){const next=ls[i+1];const t=next&&next.lap_number===ls[i].lap_number+1?ms(next.date_start):(Number.isFinite(ls[i].lap_duration)?ms(ls[i].date_start)+ls[i].lap_duration*1000:null);if(Number.isFinite(t))c.set(ls[i].lap_number,t);}
  out.set(n,c);
 }
 return out;
}
function lapCar(laps,n,t){let best=null;for(const l of laps)if(String(l.driver_number)===n){const s=ms(l.date_start);if(Number.isFinite(s)&&s<=t&&(!best||l.lap_number>best.lap_number))best=l;}return best?.lap_number??null;}

async function raceGaps(args,io){
 const [all,rc,pits,result]=await Promise.all([sessionData(args.session_key,io),openf1Get('race_control',{session_key:args.session_key},io,io.ttl),openf1Get('pit',{session_key:args.session_key},io,io.ttl),openf1Get('session_result',{session_key:args.session_key},io,io.ttl)]);
 if(!all.laps.length)return {state:'unavailable',source:SOURCE,session_key:args.session_key,reason:'OpenF1 has no laps for this session.'};
 const who=Object.fromEntries(all.drivers.map(x=>[String(x.driver_number),{driver:x.name_acronym||null,team:x.team_name||null}]));
 const chosen=(args.driver_numbers?.length?args.driver_numbers:result.filter(r=>r.position).sort((a,b)=>a.position-b.position).slice(0,3).map(r=>String(r.driver_number))).filter((v,i,a)=>a.indexOf(v)===i);
 if(chosen.some(n=>!/^\d{1,3}$/.test(n)))throw Error('Use driver racing numbers');
 const cross=crossings(all.laps),periods=neutralisations(rc),neutral=neutralisedLaps(periods);
 const pitLap={};for(const p of pits){const n=String(p.driver_number);(pitLap[n]??=new Set()).add(p.lap_number);}
 const maxLap=Math.max(...all.laps.map(l=>l.lap_number)),from=args.lap_from||1,to=Math.min(args.lap_to||maxLap,maxLap);
 const rows=[];
 for(let k=from;k<=to;k++){
  const order=[...cross.entries()].filter(([,c])=>c.has(k)).map(([n,c])=>[n,c.get(k)]).sort((a,b)=>a[1]-b[1]);if(!order.length)continue;
  const lead=order[0][1],row={lap:k,leader:order[0][0],...(neutral.has(k)?{neutralised:true}:{}),cars:{}};
  order.forEach(([n,t],i)=>{if(chosen.includes(n))row.cars[n]={position:i+1,gap_to_leader_s:round((t-lead)/1000),interval_s:i?round((t-order[i-1][1])/1000):0,...(pitLap[n]?.has(k)?{pit_in:true}:{})};});
  rows.push(row);
 }
 const out={state:'ready',source:SOURCE,session_key:args.session_key,drivers:chosen.map(n=>({driver_number:n,...(who[n]||{})})),neutralisations:periods,laps:rows};
 if(chosen.length===2){
  const [a,b]=chosen,pair=rows.filter(r=>r.cars[a]&&r.cars[b]).map(r=>({lap:r.lap,gap_s:round(cross.get(b).get(r.lap)/1000-cross.get(a).get(r.lap)/1000),...(r.neutralised?{neutralised:true}:{}),...(r.cars[a].pit_in||r.cars[b].pit_in?{pit:true}:{})}));
  const changes=pair.slice(1).map((p,i)=>({lap:p.lap,change_s:round(p.gap_s-pair[i].gap_s),...(p.neutralised?{neutralised:true}:{}),...(p.pit||pair[i].pit?{pit:true}:{})}));
  const flip=pair.find((p,i)=>i&&Math.sign(p.gap_s)!==Math.sign(pair[i-1].gap_s)&&p.gap_s!==0);
  out.pair={reference:a,other:b,meaning:`gap_s = time ${who[b]?.driver||b} crossed the line after ${who[a]?.driver||a}; negative means ${who[b]?.driver||b} was ahead`,per_lap:pair,
   biggest_changes:[...changes].sort((x,y)=>Math.abs(y.change_s)-Math.abs(x.change_s)).slice(0,6),order_changed_on_lap:flip?.lap??null};
 }
 if(args.include_overtakes!==false){
  const ot=await openf1Get('overtakes',{session_key:args.session_key},io,io.ttl);
  out.overtakes=ot.filter(o=>chosen.includes(String(o.overtaking_driver_number))||chosen.includes(String(o.overtaken_driver_number))).sort((x,y)=>ms(x.date)-ms(y.date)).slice(0,80)
   .map(o=>{const n=String(o.overtaking_driver_number),m=String(o.overtaken_driver_number),t=ms(o.date);return {time:o.date,lap:lapCar(all.laps,n,t),overtaking:{driver_number:n,...(who[n]||{})},overtaken:{driver_number:m,...(who[m]||{})},for_position:o.position,...(neutral.has(lapCar(all.laps,n,t))?{neutralised_lap:true}:{})};});
 }
 out.limitations=['Gaps are measured at the timing line from OpenF1 lap start times, not from the live interval feed.','OpenF1 overtakes include position swaps from pit cycles and repeated passes; check the lap context.','Lapped cars appear behind on the same lap number.'];
 return out;
}

// ---------- strategy and clean pace ----------
export function cleanPace(laps,{neutral=new Set(),pitIn=new Set(),threshold=1.04}={}){
 const excluded={lap_1:0,pit_out:0,pit_in:0,neutralised:0,no_time:0,outlier:0},keep=[];
 for(const l of laps){
  if(l.lap_number===1){excluded.lap_1++;continue;}
  if(l.is_pit_out_lap){excluded.pit_out++;continue;}
  if(pitIn.has(l.lap_number)){excluded.pit_in++;continue;}
  if(neutral.has(l.lap_number)){excluded.neutralised++;continue;}
  if(!Number.isFinite(l.lap_duration)){excluded.no_time++;continue;}
  keep.push(l);
 }
 const med=median(keep.map(l=>l.lap_duration)),clean=keep.filter(l=>l.lap_duration<=med*threshold);excluded.outlier=keep.length-clean.length;
 const xs=clean.map(l=>l.lap_number),ys=clean.map(l=>l.lap_duration),mx=mean(xs),my=mean(ys);
 const slope=clean.length>=4?xs.reduce((s,x,i)=>s+(x-mx)*(ys[i]-my),0)/xs.reduce((s,x)=>s+(x-mx)**2,0):null;
 return {laps:clean,stats:clean.length?{n:clean.length,mean_s:round(my),mean:fmt(my),median_s:round(median(ys)),best_s:round(Math.min(...ys)),trend_s_per_lap:round(slope,4)}:null,excluded};
}

async function strategy(args,io){
 const [all,rc,pits]=await Promise.all([sessionData(args.session_key,io),openf1Get('race_control',{session_key:args.session_key},io,io.ttl),openf1Get('pit',{session_key:args.session_key},io,io.ttl)]);
 if(!all.stints.length&&!all.laps.length)return {state:'unavailable',source:SOURCE,session_key:args.session_key,reason:'OpenF1 has no stints or laps for this session.'};
 const who=Object.fromEntries(all.drivers.map(x=>[String(x.driver_number),{driver:x.name_acronym||null,team:x.team_name||null}]));
 const periods=neutralisations(rc),neutral=neutralisedLaps(periods);
 const inPeriod=t=>periods.find(p=>ms(p.start)<=t&&(!p.end||t<=ms(p.end)));
 const chosen=args.driver_numbers?.length?args.driver_numbers:[...new Set(all.stints.map(s=>String(s.driver_number)))];
 if(chosen.some(n=>!/^\d{1,3}$/.test(n)))throw Error('Use driver racing numbers');
 const detail=chosen.length<=6&&args.driver_numbers?.length,per={};
 const result=chosen.map(n=>{
  const stints=byDriver(all.stints,n).sort((a,b)=>a.stint_number-b.stint_number),laps=byDriver(all.laps,n),stops=byDriver(pits,n).sort((a,b)=>ms(a.date)-ms(b.date));
  const pitIn=new Set(stops.filter(p=>!((p.lane_duration??p.pit_duration)>120)).map(p=>p.lap_number));
  const stintRows=stints.map(s=>{
   const end=s.lap_end??Math.max(...laps.map(l=>l.lap_number));
   const pace=cleanPace(laps.filter(l=>l.lap_number>=s.lap_start&&l.lap_number<=end),{neutral,pitIn});
   per[n]=(per[n]||[]).concat(pace.laps.map(l=>({...l,stint:s.stint_number,compound:s.compound})));
   return {stint:s.stint_number,compound:s.compound,laps:[s.lap_start,end],laps_run:end-s.lap_start+1,tyre_age_at_start:s.tyre_age_at_start,clean_pace:pace.stats,...(detail?{excluded_laps:pace.excluded}:{})};
  });
  const stopRows=stops.map(p=>{const lane=p.lane_duration??p.pit_duration,t=ms(p.date),period=inPeriod(t);return {lap:p.lap_number,time:p.date,pit_lane_s:round(lane,1),stationary_s:p.stop_duration??null,under:lane>120?'red_flag':period?period.type:null};});
  return {driver_number:n,...(who[n]||{}),stints:stintRows,pit_stops:stopRows,racing_pit_stops:stopRows.filter(p=>p.under!=='red_flag').length};
 });
 const out={state:'ready',source:SOURCE,session_key:args.session_key,neutralisations:periods,drivers:result};
 if(chosen.length===2){
  const [a,b]=chosen,A=new Map((per[a]||[]).map(l=>[l.lap_number,l])),B=new Map((per[b]||[]).map(l=>[l.lap_number,l]));
  const common=[...A.keys()].filter(k=>B.has(k)).sort((x,y)=>x-y),segments=[];
  for(const k of common){const la=A.get(k),lb=B.get(k),last=segments.at(-1);
   if(last&&last.a_stint===la.stint&&last.b_stint===lb.stint&&k-last.to<=3){last.to=k;last.d.push(lb.lap_duration-la.lap_duration);}
   else segments.push({from:k,to:k,a_stint:la.stint,b_stint:lb.stint,a_compound:la.compound,b_compound:lb.compound,d:[lb.lap_duration-la.lap_duration]});}
  out.head_to_head={reference:a,other:b,meaning:`delta_s = ${who[b]?.driver||b} lap time minus ${who[a]?.driver||a}; positive means ${who[a]?.driver||a} was faster`,
   segments:segments.filter(s=>s.d.length>=3).map(s=>({laps:[s.from,s.to],n:s.d.length,[`${a}_tyre`]:`${s.a_compound} (stint ${s.a_stint})`,[`${b}_tyre`]:`${s.b_compound} (stint ${s.b_stint})`,mean_delta_s:round(mean(s.d)),median_delta_s:round(median(s.d))}))};
 }
 out.limitations=['Clean pace removes lap 1, pit-in and pit-out laps, laps touched by SC/VSC/red flag and laps more than 4% slower than the stint median.','The pace trend mixes tyre wear and fuel burn; it is not a degradation figure.','Pit stops with more than 120 s in the pit lane are tyre changes during a red flag, not racing stops.'];
 return out;
}

// ---------- classification ----------
const qTimes=v=>Array.isArray(v)?v.map(x=>Number.isFinite(x)?fmt(x):null):null;
async function result(args,io){
 const [meta,rows]=await Promise.all([openf1Get('sessions',{session_key:args.session_key},io,CACHE_POLICY.META_MS),openf1Get('session_result',{session_key:args.session_key},io,io.ttl)]);
 if(!rows.length)return {state:'unavailable',source:SOURCE,session_key:args.session_key,reason:'OpenF1 has no classification for this session yet.'};
 const s=meta[0]||{},who=await names(args.session_key,io),race=/race/i.test(s.session_type||'')&&!/sprint/i.test(s.session_name||'');
 const grid=race&&s.meeting_key?await openf1Get('starting_grid',{meeting_key:s.meeting_key},io,io.ttl):[];
 const gridPos=Object.fromEntries(grid.map(g=>[String(g.driver_number),g.position]));
 const status=r=>r.dsq?'DSQ':r.dns?'DNS':r.dnf?'DNF':typeof r.gap_to_leader==='string'?r.gap_to_leader:'Finished';
 const classification=[...rows].sort((a,b)=>(a.position??999)-(b.position??999)).map(r=>{const n=String(r.driver_number),g=gridPos[n];
  return {position:r.position,driver_number:n,...(who[n]||{}),laps:r.number_of_laps,status:status(r),
   ...(Array.isArray(r.duration)?{q_times:qTimes(r.duration)}:{time:Number.isFinite(r.duration)?fmt(r.duration):null,gap_to_leader_s:typeof r.gap_to_leader==='number'?r.gap_to_leader:null}),
   points:r.points??null,...(g?{grid:g,places_gained:r.position?g-r.position:null}:{})};});
 return {state:'ready',source:SOURCE,session_key:args.session_key,session:s.session_name||null,classification,
  ...(race?{starting_grid_source:grid.length?'OpenF1 starting_grid (after grid penalties)':'not available on OpenF1'}:{}),
  limitations:['OpenF1 copy of the timing classification; FIA documents are authoritative and may add later penalties.']};
}

// ---------- weather ----------
async function weather(args,io){
 const rows=(await openf1Get('weather',{session_key:args.session_key},io,io.ttl)).filter(r=>ms(r.date)).sort((a,b)=>ms(a.date)-ms(b.date));
 if(!rows.length)return {state:'unavailable',source:SOURCE,session_key:args.session_key,reason:'OpenF1 has no weather for this session.'};
 const span=k=>{const v=rows.map(r=>r[k]).filter(Number.isFinite);return v.length?{min:Math.min(...v),max:Math.max(...v),mean:round(mean(v),1),first:v[0],last:v.at(-1)}:null;};
 const rain=[];let open=null;for(const r of rows){if(r.rainfall>0&&!open)open={from:r.date};if(!(r.rainfall>0)&&open){open.to=r.date;rain.push(open);open=null;}}if(open)rain.push({...open,to:rows.at(-1).date});
 const samples=[];let last=-Infinity;for(const r of rows){const t=ms(r.date);if(t-last>=600_000){samples.push({time:r.date,air_c:r.air_temperature,track_c:r.track_temperature,humidity:r.humidity,wind_ms:r.wind_speed,rain:r.rainfall>0});last=t;}}
 return {state:'ready',source:SOURCE,session_key:args.session_key,from:rows[0].date,to:rows.at(-1).date,air_temperature_c:span('air_temperature'),track_temperature_c:span('track_temperature'),humidity_pct:span('humidity'),pressure_mbar:span('pressure'),wind_speed_ms:span('wind_speed'),rain_periods:rain,samples,
  limitations:['One reading per minute from the circuit weather station; track temperature is a single sensor.']};
}

// ---------- team radio ----------
async function radio(args,io){
 const [rows,all]=await Promise.all([openf1Get('team_radio',{session_key:args.session_key,driver_number:args.driver_number},io,io.ttl),sessionData(args.session_key,io)]);
 const who=Object.fromEntries(all.drivers.map(x=>[String(x.driver_number),{driver:x.name_acronym||null,team:x.team_name||null}]));
 const list=rows.map(r=>{const n=String(r.driver_number);return {time:r.date,lap:lapCar(all.laps,n,ms(r.date)),driver_number:n,...(who[n]||{}),recording_url:r.recording_url};})
  .filter(r=>(!args.lap_from||(r.lap??0)>=args.lap_from)&&(!args.lap_to||(r.lap??0)<=args.lap_to)).sort((a,b)=>ms(a.time)-ms(b.time)).slice(0,100);
 return {state:list.length?'ready':'unavailable',source:SOURCE,session_key:args.session_key,messages:list,count:list.length,
  limitations:['Audio links only. There are no transcripts; do not describe what was said without listening.','OpenF1 publishes a selection of broadcast radio, not every message.']};
}

const HANDLERS={f1_race_control:raceControl,f1_race_gaps:raceGaps,f1_strategy:strategy,f1_result:result,f1_weather:weather,f1_team_radio:radio};
export const isRaceTool=name=>name in HANDLERS;
export async function openf1RaceCall(name,args,io={}){
 const handler=HANDLERS[name];if(!handler)throw Error('Unknown OpenF1 tool');
 for(const k of ['driver_number'])if(args[k]!==undefined&&!/^\d{1,3}$/.test(args[k]))throw Error('Use a driver racing number');
 const trace=[],run={...io,trace};run.ttl=await sessionTtl(args.session_key,run);
 const out=await handler(args,run);const hits=trace.filter(x=>x==='hit').length;
 out.cache={served_from_memory:hits,fetched_from_openf1:trace.length-hits,policy:run.ttl===CACHE_POLICY.SETTLED_MS?'settled session: kept up to 30 min':'running or just-finished session: kept up to 1 min'};
 return reply(out);
}
