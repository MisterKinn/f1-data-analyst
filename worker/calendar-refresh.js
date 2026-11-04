import {championships} from './website.js';
import{calendarEvents,calendarSources,circuitInfo,calendarReviewedAt}from'./race-calendar-data.js';
import{sessionSchedule}from'./session-schedule.js';import{trackMaps}from'./track-map-data.js';
const TTL=6*3600000,MAX_AGE=86400000,RETRY=60000;
const inflight=new WeakMap();
const slug=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const day=value=>String(value||'').slice(0,10);
const validDay=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const stamp=value=>typeof value==='string'&&/T.*(?:Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(Date.parse(value));
function matchEvent(series,name,start,existing){
 const target=slug(name);return existing.find(e=>e.series===series&&[e.name,e.nameEn].some(v=>slug(v)===target))||existing.find(e=>e.series===series&&e.start===start);
}
export function normalizeOfficialEvents(records,series,url,existing=calendarEvents,now=Date.now()){
 const result=[];
 for(const record of records){
  const start=day(record.startDate),end=day(record.endDate||record.startDate),name=String(record.name||'').trim();
  if(!validDay(start)||!validDay(end)||end<start||!name||name.length>240||!/^20\d\d/.test(start))continue;
  const old=matchEvent(series,name,start,existing),sameDates=old?.start===start&&old?.end===end;
  const sessions=Array.isArray(record.sessions)?record.sessions.filter(s=>s.name&&stamp(s.start)).map(s=>({...s,source:url,verifiedAt:new Date(now).toISOString()})):sameDates?(old?.sessions||sessionSchedule[old?.id]||[]):[];
  const race=sessions.find(s=>/^(?:race|경기)$/i.test(s.nameEn||s.name));
  result.push({...old,raceStart:race?.start||(sameDates?old?.raceStart:null),id:old?.id||series+'-official-'+slug(name)+'-'+start,series,name:old?.name||name,nameEn:name,start,end,timezone:old?.timezone||null,url,precision:race?'time':'date',sessions,reviewedAt:new Date(now).toISOString().slice(0,10),verifiedAt:new Date(now).toISOString()});
 }
 return [...new Map(result.map(e=>[e.id,e])).values()];
}
export function parseJsonLdEvents(html){
 const found=[];const walk=value=>{if(Array.isArray(value))return value.forEach(walk);if(!value||typeof value!=='object')return;const type=[value['@type']].flat();if(type.some(t=>['Event','SportsEvent','MotorSportsEvent'].includes(t))&&value.name&&value.startDate)found.push(value);if(value['@graph'])walk(value['@graph']);if(value.subEvent)walk(value.subEvent);if(value.itemListElement)walk(value.itemListElement);if(value.item)walk(value.item);};
 for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))try{walk(JSON.parse(m[1]));}catch{}
 return found;
}
export function parseICalendar(text){
 const rows=text.replace(/\r?\n[ \t]/g,'').split(/\r?\n/),events=[];let item=null;
 const date=(key,value)=>{if(/^\d{8}$/.test(value))return value.slice(0,4)+'-'+value.slice(4,6)+'-'+value.slice(6,8);if(/^\d{8}T\d{6}Z$/.test(value))return value.slice(0,4)+'-'+value.slice(4,6)+'-'+value.slice(6,8)+'T'+value.slice(9,11)+':'+value.slice(11,13)+':'+value.slice(13,15)+'Z';return null;};
 for(const row of rows){if(row==='BEGIN:VEVENT'){item={};continue;}if(row==='END:VEVENT'){if(item?.name&&item.startDate){if(item.allDay&&item.endDate){const d=new Date(item.endDate+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);item.endDate=d.toISOString().slice(0,10);}events.push(item);}item=null;continue;}if(!item)continue;const i=row.indexOf(':');if(i<0)continue;const key=row.slice(0,i),value=row.slice(i+1);if(key==='SUMMARY')item.name=value.replace(/\\n/g,' ').replace(/\\([,;\\])/g,'$1');if(key.startsWith('DTSTART')){item.startDate=date(key,value);item.allDay=/^\d{8}$/.test(value);}if(key.startsWith('DTEND'))item.endDate=date(key,value);}
 return events;
}
export function parseFastF1Schedule(raw){
 const rows=Array.isArray(raw)?raw:Object.keys(raw.round_number||{}).map(i=>Object.fromEntries(Object.entries(raw).map(([key,values])=>[key,values?.[i]])));
 return rows.filter(r=>Number(r.round_number)>0).map(r=>{
  const sessions=[];for(let i=1;i<=5;i++){const name=r['session'+i],value=r['session'+i+'_date_utc'];if(!name||!value)continue;const start=stamp(value)?value:/^\d{4}-\d\d-\d\dT/.test(value)?value+'Z':null;if(start&&stamp(start))sessions.push({name,nameEn:name,start});}
  const end=day(r.event_date),start=day(r.session1_date)||(sessions.length?sessions.map(s=>day(s.start)).sort()[0]:end);
  return {name:r.event_name||r.official_event_name,startDate:start,endDate:end,sessions};
 });
}
async function getText(url,allowed){
 const target=new URL(url);if(target.protocol!=='https:'||target.username||target.password||!allowed.has(target.hostname))throw Error('Unapproved calendar source');
 const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(8000),headers:{accept:'application/ld+json,application/json,text/html,text/calendar'}});if(!response.ok)throw Error('Calendar source unavailable');
 const reader=response.body.getReader(),chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1500000){await reader.cancel();throw Error('Calendar source exceeds limit');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return new TextDecoder().decode(bytes);
}
async function loadSource(series,now){
 const url=calendarSources[series];let records,source=url;
 if(series==='f1'){source='https://raw.githubusercontent.com/theOehrly/f1schedule/master/schedule_'+new Date(now).getUTCFullYear()+'.json';records=parseFastF1Schedule(JSON.parse(await getText(source,new Set(['raw.githubusercontent.com']))));}
 else{const allowed=new Set([new URL(url).hostname]);const text=await getText(url,allowed);records=text.includes('BEGIN:VCALENDAR')?parseICalendar(text):parseJsonLdEvents(text);
  if(!records.length){const links=[...text.matchAll(/href=["']([^"']+\.ics(?:\?[^"']*)?)["']/gi)].slice(0,2);for(const [,href]of links){const next=new URL(href,url);if(allowed.has(next.hostname))records.push(...parseICalendar(await getText(next.href,allowed)));}}
 }
 const events=normalizeOfficialEvents(records,series,source,calendarEvents,now);if(!events.length)throw Error('No verifiable structured schedule found');return {events,checkedAt:now,source,provider:series==='f1'?'FastF1 schedule backend':'Official organizer'};
}
const key=series=>'calendar-refresh/v1/'+series+'.json';
async function read(env,series){try{const object=await env.BUCKET?.get(key(series));return object?await object.json():null;}catch{return null;}}
export async function refreshCalendarSource(env,series,now=Date.now()){
 if(!Object.hasOwn(calendarSources,series))throw Error('Unknown calendar series');
 const old=await read(env,series);if(old&&now-(old.attemptedAt||old.checkedAt)<(old.error?RETRY:TTL))return old;
 try{const result={...await loadSource(series,now),attemptedAt:now,error:null};await env.BUCKET.put(key(series),JSON.stringify(result));return result;}
 catch(error){const result={...old,attemptedAt:now,error:'Official schedule refresh unavailable'};await env.BUCKET.put(key(series),JSON.stringify(result));return result;}
}
export async function calendarRoute(request,env={},ctx={},now=Date.now()){
 const url=new URL(request.url);if(url.pathname!=='/api/race-calendar')return null;if(!['GET','HEAD'].includes(request.method))return Response.json({error:'GET only'},{status:405});
 const selected=url.searchParams.get('series');if(selected&&!Object.hasOwn(calendarSources,selected))return Response.json({error:'Invalid calendar series'},{status:400});
 const series=Object.keys(calendarSources),records=await Promise.all(series.map(s=>read(env,s)));let events=[],statuses=[];
 for(let i=0;i<series.length;i++){
  const record=records[i],name=series[i],age=record?.checkedAt?now-record.checkedAt:now-Date.parse(calendarReviewedAt+'T00:00:00Z');
  const available=age>=0&&age<MAX_AGE;
  const base=calendarEvents.filter(e=>e.series===name).map(e=>({...e,sessions:sessionSchedule[e.id]||[],seriesIds:[e.series,...(e.seriesAliases||[])]}));
  if(available)events.push(...(record?.events||base));
  statuses.push({series:name,source:record?.source||calendarSources[name],lastVerifiedAt:record?.checkedAt?new Date(record.checkedAt).toISOString():calendarReviewedAt,lastAttemptAt:record?.attemptedAt?new Date(record.attemptedAt).toISOString():null,available,stale:!!record?.error||!record?.checkedAt,error:record?.error||(!record?.checkedAt?'Using checked-in schedule snapshot':null)});
 }
 if(env.BUCKET&&ctx?.waitUntil){
  let tasks=inflight.get(env.BUCKET);if(!tasks){tasks=new Map();inflight.set(env.BUCKET,tasks);}
  const due=(selected?[selected]:series).filter(s=>{const old=records[series.indexOf(s)];return !old||now-(old.attemptedAt||old.checkedAt)>=(old.error?RETRY:TTL);});
  const refresh=async()=>{let cursor=0;await Promise.all(Array.from({length:Math.min(4,due.length)},async()=>{while(cursor<due.length){const s=due[cursor++];if(!tasks.has(s)){const task=refreshCalendarSource(env,s,now);tasks.set(s,task);task.finally(()=>tasks.delete(s)).catch(()=>{});}await tasks.get(s);}}));};
  if(due.length)ctx.waitUntil(refresh().catch(()=>{}));
 }
 const verified=statuses.filter(s=>s.available).map(s=>s.lastVerifiedAt).sort();
 const payload={events,supported:championships.filter(c=>c.group!=='reference').map(c=>c.slug),circuits:circuitInfo,trackMaps,checkedAt:verified[0]||null,sourceStatus:statuses,stale:statuses.some(s=>s.stale),unavailable:!events.length,refreshing:!!env.BUCKET,maximumStaleSeconds:86400};
 return new Response(request.method==='HEAD'?null:JSON.stringify(payload),{headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
