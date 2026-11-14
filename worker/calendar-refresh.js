import {championships} from './website.js';
import{calendarEvents,calendarSources,circuitInfo,calendarReviewedAt}from'./race-calendar-data.js';
import{sessionSchedule}from'./session-schedule.js';import{seasonReaders}from'./calendar-season-readers.js';import{trackMaps}from'./track-map-data.js';
const TTL=6*3600000,MAX_AGE=86400000,RETRY=60000;
// A visitor-pressed refresh re-checks a source at most once per 5 minutes, waits up
// to 12 seconds, then returns whatever is saved so the button never hangs the page.
export const MANUAL_REFRESH_COOLDOWN=5*60000;const MANUAL_REFRESH_BUDGET=12000;
const inflight=new WeakMap();
const slug=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const day=value=>String(value||'').slice(0,10);
const validDay=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const stamp=value=>typeof value==='string'&&/T.*(?:Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(Date.parse(value));
const WEEK=7*86400000,dayAfter=d=>new Date(Date.parse(d+'T12:00:00Z')+86400000).toISOString().slice(0,10);
// A name only identifies an event within its own weekend; the same E-Prix recurs every season.
function matchEvent(series,name,start,existing,end=start,circuit=null){
 const target=slug(name),near=e=>Math.abs(Date.parse(e.start)-Date.parse(start))<=WEEK;
 return existing.find(e=>e.series===series&&near(e)&&[e.name,e.nameEn].some(v=>slug(v)===target))||existing.find(e=>e.series===series&&e.start===start)
  // Organisers name races differently from our cards ("Xfinity 500" vs "NASCAR · Martinsville"): same circuit, same weekend.
  ||(circuit?existing.find(e=>e.series===series&&e.circuit===circuit&&e.start<=end&&start<=e.end):undefined);
}
// Some organisers list each race of a doubleheader as its own entry with a round number
// ("R06 Jeddah E-Prix", "R07 Jeddah E-Prix"). Our calendar has one card per weekend.
const roundless=name=>String(name||'').trim().replace(/^R(?:ound)?\s*\d{1,2}\s*[:·–—-]?\s+/i,'');
function foldWeekends(records){
 const out=[];
 for(const record of records){
  const name=roundless(record.name),start=day(record.startDate),end=day(record.endDate||record.startDate);
  if(!validDay(start)||!validDay(end)){out.push(record);continue;}
  const prev=out.find(p=>p.folded&&slug(p.name)===slug(name)&&p.startDate<=dayAfter(end)&&start<=dayAfter(p.endDate));
  if(!prev){out.push({...record,name,startDate:start,endDate:end,folded:true});continue;}
  if(start<prev.startDate)prev.startDate=start;if(end>prev.endDate)prev.endDate=end;
  prev.sessions=[...(prev.sessions||[]),...(record.sessions||[])];
 }
 return out;
}
export function normalizeOfficialEvents(records,series,url,existing=calendarEvents,now=Date.now()){
 const result=[];
 for(const record of foldWeekends(records)){
  const start=day(record.startDate),end=day(record.endDate||record.startDate),name=String(record.name||'').trim();
  if(!validDay(start)||!validDay(end)||end<start||!name||name.length>240||!/^20\d\d/.test(start))continue;
  const old=matchEvent(series,name,start,existing,end,record.circuit),sameDates=old?.start===start&&old?.end===end;
  const fresh=Array.isArray(record.sessions)?record.sessions.filter(s=>s.name&&stamp(s.start)).map(s=>({...s,source:url,verifiedAt:new Date(now).toISOString()})):[];
  const sessions=fresh.length?fresh:sameDates?(old?.sessions||sessionSchedule[old?.id]||[]):[];
  const race=sessions.find(s=>/^(?:race|경기)$/i.test(s.nameEn||s.name));
  result.push({...old,raceStart:race?.start||(sameDates?old?.raceStart:null),id:old?.id||series+'-official-'+slug(name)+'-'+start,series,name:old?.name||name,nameEn:name,start,end,timezone:old?.timezone||record.timezone||null,...(!old?.circuit&&record.circuit?{circuit:record.circuit}:{}),url,precision:race?'time':'date',sessions,reviewedAt:new Date(now).toISOString().slice(0,10),verifiedAt:new Date(now).toISOString()});
 }
 return [...new Map(result.map(e=>[e.id,e])).values()];
}
// Saved refresh records can be older than the checked-in schedule, or list only part
// of a season. Never let one replace the other wholesale: keep every checked-in event,
// let a refreshed record update matching events, and keep whichever session timetable
// is more complete. Both sources are official; a shorter list is never an upgrade.
const overlaps=(a,b)=>a.start<=(b.end||b.start)&&b.start<=(a.end||a.start);
export function mergeCalendarEvents(base,refreshed=[]){
 const merged=new Map(base.map(e=>[e.id,e]));
 for(const event of refreshed||[]){
  const target=slug(event.nameEn||event.name);
  const match=merged.get(event.id)||[...merged.values()].find(b=>b.series===event.series&&overlaps(b,event)&&[b.name,b.nameEn].some(v=>slug(v)===target))||[...merged.values()].find(b=>b.series===event.series&&b.start===event.start);
  if(!match){merged.set(event.id,event);continue;}
  const fresh=event.sessions||[],saved=match.sessions||[];
  const sessions=fresh.length>=saved.length&&fresh.length?fresh:saved;
  const race=sessions.find(s=>/^(?:race|경기|레이스)$/i.test(s.nameEn||s.name));
  merged.set(match.id,{...match,...event,id:match.id,name:match.name||event.name,nameEn:match.nameEn||event.nameEn,sessions,raceStart:race?.start||event.raceStart||match.raceStart||null,precision:sessions.length?'time':(event.precision||match.precision)});
 }
 return [...merged.values()].sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
}
export {missingSessionCoverage} from './calendar-coverage.js';
export function parseJsonLdEvents(html){
 const found=[];const walk=value=>{if(Array.isArray(value))return value.forEach(walk);if(!value||typeof value!=='object')return;const type=[value['@type']].flat();if(type.some(t=>['Event','SportsEvent','MotorSportsEvent'].includes(t))&&value.name&&value.startDate)found.push(value);if(value['@graph'])walk(value['@graph']);if(value.subEvent)walk(value.subEvent);if(value.itemListElement)walk(value.itemListElement);if(value.item)walk(value.item);};
 for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))try{walk(JSON.parse(m[1]));}catch{}
 return found;
}
// Organiser calendar files give wall-clock times with a TZID. Turn them into the same
// explicit-offset stamps as the checked-in timetable; an unknown zone yields null.
export function zonedStamp(iso,zone){
 try{
  const format=new Intl.DateTimeFormat('en-US',{timeZone:zone,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const offsetAt=utc=>{const p=Object.fromEntries(format.formatToParts(utc).map(x=>[x.type,x.value]));return Math.round((Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)-utc)/60000);};
  const wall=Date.parse(iso+'Z');if(!Number.isFinite(wall))return null;
  const minutes=offsetAt(wall-offsetAt(wall)*60000),abs=Math.abs(minutes);
  return iso+(minutes<0?'-':'+')+String(Math.floor(abs/60)).padStart(2,'0')+':'+String(abs%60).padStart(2,'0');
 }catch{return null;}
}
export function parseICalendar(text){
 const rows=text.replace(/\r?\n[ \t]/g,'').split(/\r?\n/),events=[];let item=null;
 const date=(key,value)=>{if(/^\d{8}$/.test(value))return value.slice(0,4)+'-'+value.slice(4,6)+'-'+value.slice(6,8);const local=/^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)(Z?)$/.exec(value);if(!local)return null;const iso=local[1]+'-'+local[2]+'-'+local[3]+'T'+local[4]+':'+local[5]+':'+local[6];if(local[7])return iso+'Z';const zone=/;TZID=([^;:]+)/.exec(key)?.[1];return zone?zonedStamp(iso,zone):null;};
 for(const row of rows){if(row==='BEGIN:VEVENT'){item={};continue;}if(row==='END:VEVENT'){if(item?.name&&item.startDate){if(item.allDay&&item.endDate){const d=new Date(item.endDate+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);item.endDate=d.toISOString().slice(0,10);}events.push(item);}item=null;continue;}if(!item)continue;const i=row.indexOf(':');if(i<0)continue;const key=row.slice(0,i),value=row.slice(i+1);if(key==='SUMMARY')item.name=value.replace(/\\n/g,' ').replace(/\\([,;\\])/g,'$1');if(key.startsWith('DTSTART')){item.startDate=date(key,value);item.allDay=/^\d{8}$/.test(value);}if(key.startsWith('DTEND'))item.endDate=date(key,value);}
 return events;
}
export function parseFastF1Schedule(raw){
 const rows=Array.isArray(raw)?raw:Object.keys(raw.round_number||{}).map(i=>Object.fromEntries(Object.entries(raw).map(([key,values])=>[key,values?.[i]])));
 return rows.filter(r=>Number(r.round_number)>0).map(r=>{
  const offset=/^[+-]\d\d:\d\d/.exec(String(r.gmt_offset||''))?.[0];const sessions=[];for(let i=1;i<=5;i++){const name=r['session'+i],utc=r['session'+i+'_date_utc'],local=r['session'+i+'_date'];if(!name||!(utc||local))continue;const value=utc||local;const start=stamp(value)?value:/^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d)?$/.test(value)?value+(utc?'Z':offset||''):null;if(start&&stamp(start))sessions.push({name,nameEn:name,start});}
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
// Season pages rarely carry session times, but an event page can link the organiser's
// own per-session calendar file (ACO sites: /race/calendar/<id>). Read it for events
// that are running or start within three weeks, and only keep rows inside the event dates.
const sessionLabel=text=>{const i=text.indexOf(' - '),title=(i<0?text:text.slice(i+3)).trim();const nameEn=title.replace(/^Free Practice\s*/i,'FP').replace(/^Qualifications\b/i,'Qualifying');return {name:nameEn.replace(/^Qualifying\b/,'퀄리파잉').replace(/^Race\b/,'레이스'),nameEn};};
const shift=(date,days)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
// Organisers without a calendar file still publish the timetable as page text (Super
// Taikyu, Rally Saudi Arabia) or as a JSON programme feed (Macau). Both readers return
// {month,day,from,to,title} rows; eventSessions() turns them into stamped sessions.
const MONTHS=['january','february','march','april','may','june','july','august','september','october','november','december'];
const TIME=/^(\d{1,2}):(\d\d)(?:\s*[-\u2010-\u2015\u2212~〜]\s*(\d{1,2}):(\d\d))?(?:\s*[•·]?\s*(\S.*))?$/;
const clock=(h,m)=>h===undefined?null:String(h).padStart(2,'0')+':'+m;
export function parseTimetableText(html){
 const lines=html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi,' ').replace(/<!--[\s\S]*?-->/g,' ').replace(/<[^>]+>/g,'\n').replace(/&nbsp;/g,' ').replace(/&(?:ndash|mdash|minus);/g,'–').replace(/&(?:bull|middot);/g,'•').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,code)=>String.fromCodePoint(code[0]==='x'||code[0]==='X'?parseInt(code.slice(1),16):+code)).replace(/&amp;/g,'&').split('\n').map(l=>l.trim()).filter(Boolean);
 const rows=[];let date=null;
 for(let i=0;i<lines.length;i++){
  const line=lines[i],time=TIME.exec(line);
  // SRO timetable tables read as "Session / Local Time / GMT": the title sits before two bare times.
  if(time&&date&&!time[3]&&!time[5]&&i>0&&TIME.test(lines[i+1]||'')&&!TIME.test(lines[i-1])){rows.push({...date,from:clock(time[1],time[2]),to:null,title:lines[i-1]});i++;continue;}
  if(time){if(!date)continue;const title=(time[5]||lines[i+1]||'').replace(/^[•·]\s*/,'').trim();if(title&&!TIME.test(title))rows.push({...date,from:clock(time[1],time[2]),to:clock(time[3],time[4]),title});continue;}
  if(line.length>40)continue;
  const numeric=/^20\d\d[.\/-](\d{1,2})[.\/-](\d{1,2})$/.exec(line),named=/(\d{1,2})\s+([A-Za-z]+)/.exec(line),reversed=/([A-Za-z]+)\s+(\d{1,2})\b/.exec(line);
  if(numeric)date={month:+numeric[1],day:+numeric[2]};
  else if(named&&MONTHS.includes(named[2].toLowerCase()))date={month:MONTHS.indexOf(named[2].toLowerCase())+1,day:+named[1]};
  else if(reversed&&MONTHS.includes(reversed[1].toLowerCase()))date={month:MONTHS.indexOf(reversed[1].toLowerCase())+1,day:+reversed[2]};
 }
 return rows;
}
// Timetable tables with one row per session: name, "Fri 15 Jan", "16:15 – 17:00" (fiaformulae.com/en/<city>).
export function parseTimetableRows(html){
 const rows=[];
 for(const [,row] of String(html).matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const cells=[...row.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(c=>c[1].replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&(?:ndash|mdash);/g,'–').replace(/\s+/g,' ').trim());
  const time=cells.map(c=>TIME.exec(c)).find(Boolean),dateCell=cells.find(c=>/^(?:[A-Za-z]{3,9},?\s+)?\d{1,2}\s+[A-Za-z]{3,9}$/.test(c)),title=cells.find(c=>c&&c!==dateCell&&!TIME.test(c));
  const date=/(\d{1,2})\s+([A-Za-z]{3,9})$/.exec(dateCell||''),m=date&&MONTHS.findIndex(x=>x.startsWith(date[2].toLowerCase().slice(0,3)));
  if(time&&date&&m>=0&&title)rows.push({month:m+1,day:+date[1],from:clock(time[1],time[2]),to:clock(time[3],time[4]),title});
 }
 return rows;
}
export function parseTimetableJson(text){
 const data=JSON.parse(text),days=Array.isArray(data)?data:Array.isArray(data?.data)?data.data:[],rows=[];
 for(const item of days){
  const date=/^(\d{1,2})\/(\d{1,2})$/.exec(String(item?.date||''));if(!date)continue;
  const list=Object.values(item).find(v=>Array.isArray(v)&&v.some(x=>x?.time&&x?.title))||[];
  for(const row of list){const time=TIME.exec(String(row?.time||'').trim());if(time&&row.title)rows.push({month:+date[2],day:+date[1],from:clock(time[1],time[2]),to:clock(time[3],time[4]),title:String(row.title).trim()});}
 }
 return rows;
}
// Paddock and ceremony items are not sessions.
const NOT_A_SESSION=/pit\s*walk|スタート進行|セレモニー|グリッドウォーク|circuit (?:closed|opened|inspection)|special event|lion dance|parc ferm|^(?:out|in)$|podium|ceremony|briefing/i;
const english=title=>[[/S耐/g,'S-Tai '],[/フリー走行/g,' FP'],[/チャレンジ/g,' Challenge '],[/公式予選|予選/g,' Qualifying '],[/決勝/g,' Race'],[/ドライバー/g,' driver'],[/（/g,' ('],[/）/g,')']].reduce((t,[from,to])=>t.replace(from,to),title).replace(/\s+/g,' ').replace(/\( /g,'(').trim();
const korean=title=>[[/\bFree Practice\b/gi,'FP'],[/\bQualifying\b/gi,'퀄리파잉'],[/\bQualification Race\b/gi,'예선 레이스'],[/\bRace\b/g,'레이스'],[/\bShakedown\b/gi,'셰이크다운'],[/\bwarm[- ]?up\b/gi,'웜업']].reduce((t,[from,to])=>t.replace(from,to),title);
export function eventSessions(rows,event){
 const year=event.start.slice(0,4),zone=event.timezone,sessions=[];
 for(const row of rows){
  const date=year+'-'+String(row.month).padStart(2,'0')+'-'+String(row.day).padStart(2,'0');
  if(!zone||!validDay(date)||date<shift(event.start,-1)||date>shift(event.end,1)||NOT_A_SESSION.test(row.title))continue;
  const start=zonedStamp(date+'T'+row.from+':00',zone),end=row.to?zonedStamp(date+'T'+row.to+':00',zone):null;if(!start)continue;
  const nameEn=english(row.title);sessions.push({name:korean(nameEn),nameEn,start,...(end?{end}:{})});
 }
 return sessions.sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
}
// One organiser page -> a function that gives the sessions falling inside a given event.
async function pageReader(page,hosts,get){
 const body=await get(page,hosts);
 if(/^\s*[\[{]/.test(body)){const rows=parseTimetableJson(body);return event=>eventSessions(rows,event);}
 const href=/href=["']([^"']*\/race\/calendar\/\d+|[^"']+\.ics(?:\?[^"']*)?)["']/i.exec(body)?.[1],file=href?new URL(href,page):null;
 if(file&&hosts.has(file.hostname)){const rows=parseICalendar(await get(file.href,hosts)).filter(r=>stamp(r.startDate)).sort((a,b)=>Date.parse(a.startDate)-Date.parse(b.startDate));
  return event=>rows.filter(r=>day(r.startDate)>=shift(event.start,-1)&&day(r.startDate)<=shift(event.end,1)).map(r=>({...sessionLabel(r.name),start:r.startDate,...(stamp(r.endDate)?{end:r.endDate}:{})}));}
 const table=parseTimetableRows(body),rows=table.length>=2?table:parseTimetableText(body);return event=>eventSessions(rows,event);
}
// Race pages named after the venue city (fiaformulae.com/en/mexicocity), same host only.
export function cityPageLinks(html,base,allowed,events){
 const found=new Set();
 for(const event of events){
  const city=slug(String(event.nameEn||'').replace(/\b(?:E-?Prix|Grand Prix|GP)\b/gi,'')).replace(/-/g,'');if(city.length<4)continue;
  for(const [,href] of String(html).matchAll(new RegExp('href=["\']((?:https://[^/"\']+)?/(?:[a-z]{2}/)?'+city+')["\']','gi'))){try{const url=new URL(href,base);if(allowed.has(url.hostname))found.add(url.href);}catch{}}
 }
 return [...found];
}
// Event pages linked from the season page (ACO /race/<slug>, SRO /event/<id>/<slug>, ...), same host only.
export function eventPageLinks(html,base,allowed,limit=12){
 const found=new Set();
 for(const [,href] of html.matchAll(/href=["']([^"'#?]*\/(?:race|races|event|events)\/[^"'#?]+)["']/gi)){
  try{const url=new URL(href,base);if(url.protocol==='https:'&&allowed.has(url.hostname)&&!/\/calendar(?:\/|$)/.test(url.pathname))found.add(url.href);}catch{}
  if(found.size>=limit)break;
 }
 return [...found];
}
export async function loadEventSessions(series,allowed,now,events=calendarEvents,get=getText,seasonHtml=''){
 const today=day(new Date(now).toISOString()),horizon=shift(today,21),records=[];
 const due=events.filter(e=>e.series===series&&e.end>=today&&e.start<=horizon).slice(0,2);if(!due.length)return records;
 // Read every linked event page once, and only when an event near enough has no page of its own that works.
 let pool;const discovered=()=>pool??=Promise.all([...new Set([...cityPageLinks(seasonHtml,calendarSources[series],allowed,due),...eventPageLinks(seasonHtml,calendarSources[series],allowed)])].slice(0,12).map(page=>pageReader(page,allowed,get).catch(()=>null)));
 for(const event of due){
  let sessions=[];
  try{
   // sessionsUrl is checked in with the event, so its host is trusted like the season source.
   const page=event.sessionsUrl||(event.url!==calendarSources[series]?event.url:null),hosts=event.sessionsUrl?new Set([...allowed,new URL(page).hostname]):allowed;
   if(page&&hosts.has(new URL(page).hostname))sessions=(await pageReader(page,hosts,get))(event);
  }catch{}
  if(sessions.length<2)for(const reader of await discovered()){const found=reader?reader(event):[];if(found.length>=2){sessions=found;break;}}
  if(sessions.length>=2)records.push({name:event.nameEn||event.name,startDate:event.start,endDate:event.end,sessions});
 }
 return records;
}
async function loadSource(series,now){
 const url=calendarSources[series];let records,source=url;
 if(series==='f1'){source='https://raw.githubusercontent.com/theOehrly/f1schedule/master/schedule_'+new Date(now).getUTCFullYear()+'.json';records=parseFastF1Schedule(JSON.parse(await getText(source,new Set(['raw.githubusercontent.com']))));}
 else if(seasonReaders[series]){
  // Organisers with their own season format (IMSA, NASCAR, SUPER GT, NLS, Dakar).
  const read=await seasonReaders[series]({now,get:getText,stampAt:zonedStamp});records=read.records;source=read.source||source;
  if(!read.reached)throw Error('Calendar source unavailable');
  if(!records.length)return {events:[],checkedAt:now,source,provider:'Official organizer',note:'Nothing new published yet'};
 }
 else{const allowed=new Set([new URL(url).hostname]);records=[];
  // A season page without structured data must not stop the per-event session files.
  let season='',reached=false;
  try{const text=season=await getText(url,allowed);reached=true;records=text.includes('BEGIN:VCALENDAR')?parseICalendar(text):parseJsonLdEvents(text);
   if(!records.length){const links=[...text.matchAll(/href=["']([^"']+\.ics(?:\?[^"']*)?)["']/gi)].slice(0,2);for(const [,href]of links){const next=new URL(href,url);if(allowed.has(next.hostname))records.push(...parseICalendar(await getText(next.href,allowed)));}}
  }catch{}
  records.push(...await loadEventSessions(series,allowed,now,calendarEvents,getText,season));
  // The organiser's page answered but has no dates or timetable to read yet (next season
  // not announced, timetable not out). That is not a failure: keep the checked-in schedule.
  if(!records.length&&reached)return {events:[],checkedAt:now,source,provider:'Official organizer',note:'Nothing new published yet'};
 }
 const events=normalizeOfficialEvents(records,series,source,calendarEvents,now);if(!events.length)throw Error('No verifiable structured schedule found');return {events,checkedAt:now,source,provider:series==='f1'?'FastF1 schedule backend':'Official organizer'};
}
const key=series=>'calendar-refresh/v1/'+series+'.json';
async function read(env,series){try{const object=await env.BUCKET?.get(key(series));return object?await object.json():null;}catch{return null;}}
export async function refreshCalendarSource(env,series,now=Date.now(),{minAge}={}){
 if(!Object.hasOwn(calendarSources,series))throw Error('Unknown calendar series');
 const old=await read(env,series);if(old&&now-(old.attemptedAt||old.checkedAt)<(minAge??(old.error?RETRY:TTL)))return old;
 try{const result={...await loadSource(series,now),attemptedAt:now,error:null};await env.BUCKET.put(key(series),JSON.stringify(result));return result;}
 catch(error){const result={...old,attemptedAt:now,error:'Official schedule refresh unavailable'};await env.BUCKET.put(key(series),JSON.stringify(result));return result;}
}
export async function calendarRoute(request,env={},ctx={},now=Date.now()){
 const url=new URL(request.url);if(url.pathname!=='/api/race-calendar')return null;if(!['GET','HEAD'].includes(request.method))return Response.json({error:'GET only'},{status:405});
 const selected=url.searchParams.get('series');if(selected&&!Object.hasOwn(calendarSources,selected))return Response.json({error:'Invalid calendar series'},{status:400});
 const series=Object.keys(calendarSources),manual=url.searchParams.get('refresh')==='1'&&!!env.BUCKET;
 if(manual){
  const targets=selected?[selected]:series,initial=await Promise.all(targets.map(s=>read(env,s)));
  const due=targets.filter((s,i)=>{const old=initial[i];return !old||now-(old.attemptedAt||old.checkedAt||0)>=MANUAL_REFRESH_COOLDOWN;});
  let cursor=0;const work=Promise.all(Array.from({length:Math.min(4,due.length)},async()=>{while(cursor<due.length){const s=due[cursor++];await refreshCalendarSource(env,s,now,{minAge:MANUAL_REFRESH_COOLDOWN}).catch(()=>null);}}));
  if(due.length)await Promise.race([work,new Promise(resolve=>setTimeout(resolve,MANUAL_REFRESH_BUDGET))]);
 }
 const records=await Promise.all(series.map(s=>read(env,s)));let events=[],statuses=[];
 for(let i=0;i<series.length;i++){
  const record=records[i],name=series[i],reviewed=Date.parse(calendarReviewedAt+'T00:00:00Z'),age=now-Math.max(record?.checkedAt||0,reviewed);
  const available=age>=0&&age<MAX_AGE;
  const base=calendarEvents.filter(e=>e.series===name).map(e=>({...e,sessions:sessionSchedule[e.id]||[],seriesIds:[e.series,...(e.seriesAliases||[])]}));
  // A failed official refresh must not hide the schedule. Fall back to the last
  // saved or checked-in events and mark them unverified for the page.
  const combined=mergeCalendarEvents(base,record?.events);
  if(available)events.push(...combined);
  else events.push(...combined.map(event=>({...event,verified:false})));
  statuses.push({series:name,source:record?.source||calendarSources[name],lastVerifiedAt:record?.checkedAt?new Date(record.checkedAt).toISOString():calendarReviewedAt,lastAttemptAt:record?.attemptedAt?new Date(record.attemptedAt).toISOString():null,available,stale:!!record?.error||!record?.checkedAt,error:record?.error||(!record?.checkedAt?'Using checked-in schedule snapshot':null),...(record?.note&&!record?.error?{note:record.note}:{})});
 }
 if(env.BUCKET&&ctx?.waitUntil){
  let tasks=inflight.get(env.BUCKET);if(!tasks){tasks=new Map();inflight.set(env.BUCKET,tasks);}
  const due=(selected?[selected]:series).filter(s=>{const old=records[series.indexOf(s)];return !old||now-(old.attemptedAt||old.checkedAt)>=(old.error?RETRY:TTL);});
  const refresh=async()=>{let cursor=0;await Promise.all(Array.from({length:Math.min(4,due.length)},async()=>{while(cursor<due.length){const s=due[cursor++];if(!tasks.has(s)){const task=refreshCalendarSource(env,s,now);tasks.set(s,task);task.finally(()=>tasks.delete(s)).catch(()=>{});}await tasks.get(s);}}));};
  if(due.length)ctx.waitUntil(refresh().catch(()=>{}));
 }
 const verified=statuses.filter(s=>s.available).map(s=>s.lastVerifiedAt).sort();
 const payload={events,supported:championships.filter(c=>c.group!=='reference').map(c=>c.slug),circuits:circuitInfo,trackMaps,checkedAt:verified[0]||null,sourceStatus:statuses,stale:statuses.some(s=>s.stale),unavailable:!events.length,refreshing:!!env.BUCKET,maximumStaleSeconds:86400};
 // Public data, identical for every visitor: let the CDN serve it for 5 minutes
 // (and stale for 10 more while it refreshes) instead of rebuilding 250 KB per view.
 return new Response(request.method==='HEAD'?null:JSON.stringify(payload),{headers:{'content-type':'application/json; charset=utf-8','cache-control':manual?'no-store':'public, max-age=60, s-maxage=300, stale-while-revalidate=600'}});
}
