// TracingInsights (github.com/TracingInsights/<year>, Apache-2.0): per-session JSON that the
// project extracts with FastF1 from F1 live timing, usually within about an hour of the
// session end. It is the primary post-session source for openf1_sessions, openf1_laps and
// openf1_lap_telemetry because it is free, needs no key and is not locked while another F1
// session is live (OpenF1's free tier is: every request returns 401 until OpenF1 decides the
// live session is over). Session keys are the F1 live-timing keys, the same numbers OpenF1
// uses, so a key found here also works with the OpenF1 race tools later.
// Files are fetched on demand from raw.githubusercontent.com and kept briefly in memory only.
import {calendarEvents} from './race-calendar-data.js';

export const TI_SOURCE='TracingInsights (github.com/TracingInsights, FastF1 extraction of F1 live timing; fetched on demand, kept briefly in server memory only)';
const RAW='https://raw.githubusercontent.com/TracingInsights/';
export const TI_SESSIONS=['Practice 1','Practice 2','Practice 3','Sprint Qualifying','Sprint','Qualifying','Race'];
export const TI_TTL={FRESH:5*60_000,MISS:2*60_000,TELEMETRY:6*3600_000,MAX_ENTRIES:160};
const TIMEOUT_MS=15_000;
// Calendar name -> TracingInsights folder name where they differ.
const FOLDER={'Barcelona-Catalunya Grand Prix':'Barcelona Grand Prix'};
// Extra words a user may search with (country, city, circuit).
const ALIASES={'São Paulo Grand Prix':'brazil brasil interlagos sao paulo','United States Grand Prix':'usa united states austin cota americas','Las Vegas Grand Prix':'usa united states las vegas','Miami Grand Prix':'usa united states miami','Mexico City Grand Prix':'mexico','Abu Dhabi Grand Prix':'uae united arab emirates yas marina','Azerbaijan Grand Prix':'baku','Barcelona Grand Prix':'spain catalunya montmelo','Spanish Grand Prix':'spain madrid madring','British Grand Prix':'uk united kingdom great britain silverstone','Italian Grand Prix':'italy monza','Dutch Grand Prix':'netherlands zandvoort','Belgian Grand Prix':'belgium spa francorchamps','Hungarian Grand Prix':'hungary hungaroring budapest','Austrian Grand Prix':'austria spielberg red bull ring','Japanese Grand Prix':'japan suzuka','Chinese Grand Prix':'china shanghai','Australian Grand Prix':'australia melbourne albert park','Canadian Grand Prix':'canada montreal','Monaco Grand Prix':'monte carlo','Singapore Grand Prix':'marina bay','Qatar Grand Prix':'lusail','Bahrain Grand Prix':'sakhir','Saudi Arabian Grand Prix':'saudi arabia jeddah'};

const cache=new Map();const keys=new Map();
export function clearTiCache(){cache.clear();keys.clear();}
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const url=(year,parts)=>RAW+year+'/main/'+parts.map(encodeURIComponent).join('/');
export const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;

// null when the file is not (yet) published; errors for anything else.
export async function tiGet(year,parts,io,ttl=TI_TTL.FRESH){
 const u=url(year,parts),now=io.now??Date.now(),hit=cache.get(u);
 if(hit&&now-hit.at<hit.ttl){cache.delete(u);cache.set(u,hit);io.trace?.push('hit');return hit.data;}
 io.trace?.push('fetch');
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),TIMEOUT_MS);let res;
 try{res=await io.tiFetch(u,{headers:{accept:'application/json'},signal:ctl.signal});}
 catch{throw Error('TracingInsights did not answer.');}
 finally{clearTimeout(timer);}
 const keep=(data,t)=>{cache.delete(u);while(cache.size>=TI_TTL.MAX_ENTRIES)cache.delete(cache.keys().next().value);cache.set(u,{at:now,ttl:t,data});return data;};
 if(res.status===404)return keep(null,TI_TTL.MISS);
 if(!res.ok)throw Error('TracingInsights error '+res.status);
 let data;try{data=JSON.parse(await res.text());}catch{throw Error('Unexpected TracingInsights response');}
 return keep(data,ttl);
}

// F1 events of a year from the race calendar, oldest first, up to tomorrow.
export function tiEvents(year,now=Date.now()){
 return calendarEvents.filter(e=>e.series==='f1'&&e.start.startsWith(String(year))&&Date.parse(e.start)<=now+86_400_000)
  .map(e=>{const folder=FOLDER[e.nameEn]||e.nameEn;return {folder,start:e.start,words:fold([e.nameEn,folder,e.name,e.circuit,ALIASES[folder]].join(' '))};});
}

const utc=(local,offset)=>{
 const t=Date.parse(String(local||'')+'Z'),m=/^(-)?(\d+):(\d+)/.exec(String(offset||''));
 if(!Number.isFinite(t))return null;
 const off=m?(m[1]?-1:1)*(Number(m[2])*60+Number(m[3]))*60_000:0;
 return new Date(t-off).toISOString();
};

async function eventSessions(year,folder,io){
 const infos=await Promise.all(TI_SESSIONS.map(s=>tiGet(year,[folder,s,'session_info.json'],io).catch(()=>null)));
 const out=[];
 infos.forEach((f,i)=>{
  const s=f?.session_info;if(!s||!Number.isInteger(s.Key))return;
  const row={session_key:s.Key,meeting_key:s.Meeting?.Key??null,session_name:TI_SESSIONS[i],session_type:s.Type||null,
   country_name:s.Meeting?.Country?.Name||null,location:s.Meeting?.Location||null,circuit_short_name:s.Meeting?.Circuit?.ShortName||null,meeting_name:folder,
   date_start:utc(s.StartDate,s.GmtOffset),date_end:utc(s.EndDate,s.GmtOffset)};
  keys.set(s.Key,{year,folder,session:TI_SESSIONS[i],row});out.push(row);
 });
 return out;
}

// Sessions of matching events. Without a place the latest three events are listed.
export async function tiSessions(args,io){
 const now=io.now??Date.now(),place=fold(args.place).trim();
 let events=tiEvents(args.year,now);
 events=place?events.filter(e=>place.split(/\s+/).every(w=>e.words.includes(w))):events.slice(-3);
 const rows=(await Promise.all(events.map(e=>eventSessions(args.year,e.folder,io)))).flat();
 const name=fold(args.session_name).trim();
 return rows.filter(s=>!name||fold(s.session_name)===name||fold(s.session_type)===name);
}

// session_key -> folder. Keys rise through the season, so events are searched newest first
// and the search stops once an event's keys are all below the wanted key.
export async function tiResolve(sessionKey,io){
 if(keys.has(sessionKey))return keys.get(sessionKey);
 const now=io.now??Date.now(),year=new Date(now).getUTCFullYear();let looked=0;
 for(const y of [year,year-1]){
  for(const e of tiEvents(y,now).reverse()){
   if(++looked>12)return null;
   const rows=await eventSessions(y,e.folder,io);
   if(keys.has(sessionKey))return keys.get(sessionKey);
   if(rows.length&&rows.every(r=>r.session_key<sessionKey))return null;
  }
 }
 return null;
}

const iso=v=>{if(typeof v!=='string'||!v||v==='None')return null;const m=/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(\.\d{1,3})?/.exec(v);return m?m[1]+(m[2]||'')+'Z':null;};
const real=v=>v!==null&&v!==undefined&&v!=='None'&&v!=='';

// Laps, stints and drivers in OpenF1's shapes, plus qualifying segment and deletion flags.
export async function tiSessionData(sessionKey,io){
 const where=await tiResolve(sessionKey,io);if(!where)return null;
 const [d,people]=await Promise.all([tiGet(where.year,[where.folder,where.session,'session_laptimes.json'],io),tiGet(where.year,[where.folder,where.session,'drivers.json'],io,TI_TTL.TELEMETRY)]);
 if(!d||!Array.isArray(d.lap))return null;
 const col=k=>Array.isArray(d[k])?d[k]:[];
 const laps=d.lap.map((lap,i)=>({driver_number:Number(col('dNum')[i]),driver_acronym:col('drv')[i]||null,lap_number:lap,
  lap_duration:num(col('time')[i]),duration_sector_1:num(col('s1')[i]),duration_sector_2:num(col('s2')[i]),duration_sector_3:num(col('s3')[i]),
  is_pit_out_lap:real(col('pout')[i]),is_pit_in_lap:real(col('pin')[i]),st_speed:num(col('vst')[i]),date_start:iso(col('lSD')[i]),
  compound:col('compound')[i]||null,stint:num(col('stint')[i]),tyre_life:num(col('life')[i]),position:num(col('pos')[i]),
  deleted:col('del')[i]===true,deleted_reason:real(col('delR')[i])?col('delR')[i]:null,qualifying_segment:real(col('qs')[i])?col('qs')[i]:null}))
  .filter(l=>Number.isInteger(l.lap_number)&&Number.isFinite(l.driver_number));
 const stints=[];
 for(const l of [...laps].sort((a,b)=>a.driver_number-b.driver_number||a.lap_number-b.lap_number)){
  const last=stints.at(-1);
  if(last&&last.driver_number===l.driver_number&&last.stint_number===l.stint&&last.compound===l.compound){last.lap_end=l.lap_number;continue;}
  stints.push({driver_number:l.driver_number,stint_number:l.stint,lap_start:l.lap_number,lap_end:l.lap_number,compound:l.compound,tyre_age_at_start:Number.isFinite(l.tyre_life)?Math.max(0,l.tyre_life-1):null});
 }
 const drivers=(people?.drivers||[]).map(p=>({driver_number:Number(p.dn),name_acronym:p.driver||null,team_name:p.team||null}));
 return {laps,stints,drivers,where};
}

// Rows: [elapsed_s, distance_m, speed_kmh, throttle_percent, brake_on, gear, rpm].
// When the file's time axis ends away from the official lap time it is scaled to it
// (time_axis_scaled), so lap-to-lap deltas end at the real lap-time difference.
export async function tiLapTelemetry(where,lap,seconds,io){
 const f=await tiGet(where.year,[where.folder,where.session,lap.driver_acronym,lap.lap_number+'_tel.json'],io,TI_TTL.TELEMETRY);
 const t=f?.tel;if(!t||!Array.isArray(t.time)||!t.time.length)return {rows:[],scaled:null};
 const end=num(t.time.at(-1)),official=lap.lap_duration;
 const k=!seconds&&Number.isFinite(official)&&end>0&&Math.abs(end-official)>0.02&&Math.abs(end-official)/official<0.05?official/end:1;
 const rows=[];
 for(let i=0;i<t.time.length;i++){
  const e=num(t.time[i]);if(e===null)continue;const el=e*k;if(seconds&&el>seconds)break;
  rows.push([Number(el.toFixed(3)),Number((num(t.distance?.[i])??0).toFixed(2)),num(t.speed?.[i]),num(t.throttle?.[i]),t.brake?.[i]?1:0,num(t.gear?.[i]),num(t.rpm?.[i])]);
 }
 return {rows,scaled:k===1?null:{factor:Number(k.toFixed(5)),file_end_s:end,official_lap_s:official}};
}

// Official turn numbers and their distance along the lap (corners.json, FastF1 circuit info
// matched to the session's fastest lap).
export async function tiTurns(where,io){
 const c=await tiGet(where.year,[where.folder,where.session,'corners.json'],io,TI_TTL.TELEMETRY).catch(()=>null);
 const n=c?.CornerNumber,d=c?.Distance;if(!Array.isArray(n)||!Array.isArray(d))return [];
 return n.map((t,i)=>({turn:'T'+t+(c.Letter?.[i]||''),distance_m:Math.round(num(d[i])??NaN)})).filter(t=>Number.isFinite(t.distance_m));
}
// Nearest official turn within 150 m of a distance, e.g. a speed minimum.
export function nearestTurn(turns,distance){
 let best=null;for(const t of turns)if(!best||Math.abs(t.distance_m-distance)<Math.abs(best.distance_m-distance))best=t;
 return best&&Math.abs(best.distance_m-distance)<=150?best.turn:null;
}
