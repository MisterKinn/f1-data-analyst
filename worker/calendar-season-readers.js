// Organisers that publish their season and timetables in their own formats (checked
// 2026-11-14). Each reader returns {records, reached}: records are official events with
// dates (and sessions when published); reached says an organiser page answered, so an
// empty result means "nothing published yet", not a failure.
import {calendarEvents,circuitInfo} from './race-calendar-data.js';
const MONTHS=['january','february','march','april','may','june','july','august','september','october','november','december'];
const month=name=>{const i=MONTHS.findIndex(m=>m.startsWith(String(name||'').toLowerCase().slice(0,3)));return i<0?null:i+1;};
const pad=n=>String(n).padStart(2,'0');
const slug=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const text=html=>String(html||'').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&#0?39;|&rsquo;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
const utc=value=>/^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d)?$/.test(value)?value+'Z':/(?:Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(Date.parse(value))?value:null;
const korean=name=>name.replace(/^Practice/i,'연습').replace(/^Final Practice/i,'최종 연습').replace(/^Qualifying/i,'퀄리파잉').replace(/^Race\b/i,'레이스');
const DEFAULT_ZONE={imsa:'America/New_York',nascar:'America/New_York','super-gt':'Asia/Tokyo',nls:'Europe/Berlin',dakar:'Europe/Lisbon'};
// Venue text -> checked-in circuit id and its time zone.
export function circuitFor(venue,series){
 const target=slug(String(venue||'').split(',')[0]);if(!target)return {circuit:null,timezone:DEFAULT_ZONE[series]||null};
 const id=Object.keys(circuitInfo).find(k=>slug(circuitInfo[k].name)===target)||Object.keys(circuitInfo).find(k=>{const n=slug(circuitInfo[k].name);return n&&(n.startsWith(target)||target.startsWith(n));});
 const zone=id&&calendarEvents.find(e=>e.circuit===id)?.timezone;
 return {circuit:id||null,timezone:zone||DEFAULT_ZONE[series]||null};
}
const shift=(date,days)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
const near=(record,now)=>{const today=new Date(now).toISOString().slice(0,10);return record.endDate>=today&&record.startDate<=shift(today,21);};
async function first(urls,get,allowed){for(const url of urls){try{return {url,body:await get(url,allowed)};}catch{}}return null;}
const years=now=>{const y=new Date(now).getUTCFullYear();return [y,y+1];};

// IMSA: imsa.com/<year>/schedule cards; event schedule tab lists each series in its own panel.
export function parseImsaSeason(html,base){
 const out=[];
 for(const [,card] of html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)){
  const name=text(/<h3\b[^>]*>([\s\S]*?)<\/h3>/.exec(card)?.[1]);
  const span=/aria-label="([A-Za-z]+) (\d{1,2}), (\d{4})(?: through ([A-Za-z]+) (\d{1,2}), (\d{4}))?"/.exec(card);
  const href=/href="([^"]*\/events\/[^"?]+)\?tab=schedule[^"]*"/.exec(card)?.[1];
  if(!name||!span||!month(span[1]))continue;
  const startDate=span[3]+'-'+pad(month(span[1]))+'-'+pad(span[2]),endDate=span[4]?span[6]+'-'+pad(month(span[4]))+'-'+pad(span[5]):startDate;
  const venue=text(/<h3\b[\s\S]*?<\/h3>\s*<p\b[^>]*>([\s\S]*?)<\/p>/.exec(card)?.[1]);
  out.push({name,startDate,endDate,venue,url:href?new URL(href.replace(/&amp;/g,'&'),base).href+'?tab=schedule&series=weathertech':null});
 }
 return out;
}
export function parseImsaSessions(html,series='weathertech'){
 const start=html.indexOf('id="panel-'+series+'"');if(start<0)return [];
 const next=html.indexOf('id="panel-',start+1),panel=html.slice(start,next<0?undefined:next),out=[];
 for(const [,label,when] of panel.matchAll(/<p\b[^>]*>([^<]+)<\/p>\s*<time\b[^>]*datetime="([^"]+)"/g)){
  const name=text(label),start=utc(when);
  // "Coming Soon" is a slot whose session is not announced yet.
  if(start&&name&&!/coming soon|^tbd$|^tba$/i.test(name))out.push({name:korean(name),nameEn:name,start});
 }
 return out;
}
// IMSA's own site (Cloudflare) refuses server requests, so session times come from the
// official YouTube channel @imsaofficial: each WeatherTech qualifying and race is a
// scheduled live stream. Titles: "2026 IMSA Motul Petit Le Mans | Qualifying | WeatherTech
// Championship | Braselton, GA"; the race stream has no session part.
export const IMSA_YOUTUBE_CHANNEL='UC58em84jwiyM20qR-iqBDZw';
export function imsaStreamSession(title){
 const parts=String(title||'').split('|').map(p=>p.trim());
 if(!/WeatherTech (?:SportsCar )?Championship/i.test(title)||/esports|michelin pilot|vp racing|carrera|historic|hsr|recap|highlight|sights|podcast/i.test(title))return null;
 if(parts.some(p=>/\bpart\s*[2-9]\b/i.test(p)))return null;
 const label=parts.slice(1).find(p=>/qualif|practice|warm|test|race/i.test(p)&&!/championship/i.test(p))||'';
 if(/qualif/i.test(label))return 'Qualifying';
 const practice=/practice\s*(\d)?/i.exec(label);if(practice)return practice[1]?'Practice '+practice[1]:'Practice';
 if(/warm/i.test(label))return 'Warm-up';
 if(/test/i.test(label))return null;
 return 'Race';
}
export function imsaYouTubeSessions(videos,events){
 const byEvent=new Map();
 for(const video of videos){
  const start=utc(video.liveStreamingDetails?.scheduledStartTime||'')||utc(video.liveStreamingDetails?.actualStartTime||''),nameEn=start&&imsaStreamSession(video.snippet?.title);if(!nameEn)continue;
  const at=Date.parse(start),event=events.find(e=>Date.parse(e.start+'T00:00:00Z')-86400000<=at&&at<=Date.parse(e.end+'T23:59:59Z')+86400000);if(!event)continue;
  const list=byEvent.get(event)||[];if(!list.some(s=>s.nameEn===nameEn))list.push({name:korean(nameEn).replace(/^Warm-up$/,'웜업'),nameEn,start,source:'https://www.youtube.com/watch?v='+video.id});byEvent.set(event,list);
 }
 return [...byEvent].map(([event,sessions])=>({name:event.nameEn,startDate:event.start,endDate:event.end,circuit:event.circuit,timezone:event.timezone,sessions:sessions.sort((a,b)=>Date.parse(a.start)-Date.parse(b.start))}));
}
async function imsaYouTube(get,key){
 // Two quota units per refresh: the channel's uploads list, then those videos' stream times.
 const allowed=new Set(['www.googleapis.com']),api='https://www.googleapis.com/youtube/v3/';
 const list=JSON.parse(await get(api+'playlistItems?part=contentDetails&maxResults=50&playlistId=UU'+IMSA_YOUTUBE_CHANNEL.slice(2)+'&key='+encodeURIComponent(key),allowed));
 const ids=(list.items||[]).map(i=>i.contentDetails?.videoId).filter(Boolean);if(!ids.length)return [];
 return JSON.parse(await get(api+'videos?part=snippet,liveStreamingDetails&id='+ids.join(',')+'&key='+encodeURIComponent(key),allowed)).items||[];
}
async function imsa({now,get,env}){
 const allowed=new Set(['www.imsa.com']),records=[];let reached=false,source;
 for(const year of years(now)){
  const page='https://www.imsa.com/'+year+'/schedule';let html;try{html=await get(page,allowed);reached=true;source??=page;}catch{continue;}
  for(const event of parseImsaSeason(html,page)){
   const place=circuitFor(event.venue,'imsa'),record={name:event.name,startDate:event.startDate,endDate:event.endDate,...place,sessions:[]};
   if(event.url&&near(record,now)&&records.filter(r=>r.sessions.length).length<2){try{record.sessions=parseImsaSessions(await get(event.url,allowed));}catch{}}
   if(record.sessions.length<2)record.sessions=[];
   records.push(record);
  }
 }
 if(env?.YOUTUBE_API_KEY){try{
  const sessions=imsaYouTubeSessions(await imsaYouTube(get,env.YOUTUBE_API_KEY),calendarEvents.filter(e=>e.series==='imsa'));
  reached=true;source??='https://www.youtube.com/@imsaofficial';records.push(...sessions.filter(r=>r.sessions.length));
 }catch{}}
 return {records,reached,source};
}

// NASCAR: the official race feed (cf.nascar.com). series_1 is the Cup Series; run_type 0 rows
// are garage and paddock items, 1 practice, 2 qualifying, 3 race.
export function parseNascarFeed(data){
 return (data?.series_1||[]).map(race=>{
  const sessions=(race.schedule||[]).filter(s=>s.run_type>0&&utc(s.start_time_utc)).map(s=>{const nameEn=s.run_type===3?'Race':String(s.event_name).trim();return {name:korean(nameEn),nameEn,start:utc(s.start_time_utc)};}).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
  const end=String(race.race_date||race.date_scheduled||'').slice(0,10),qualifying=String(race.qualifying_date||'').slice(0,10);
  const startDate=[end,qualifying,...sessions.filter(s=>s.nameEn!=='Race').map(s=>s.start.slice(0,10))].filter(d=>/^\d{4}-\d\d-\d\d$/.test(d)&&d<=end).sort()[0]||end;
  return {name:String(race.race_name||'').trim(),startDate,endDate:end,venue:race.track_name,sessions};
 }).filter(r=>r.name&&r.endDate);
}
async function nascar({now,get}){
 const allowed=new Set(['cf.nascar.com']),records=[];let reached=false,source;
 for(const year of years(now)){
  // A season the feed has not published yet answers 403 (S3): nothing to read, not a failure.
  const feed='https://cf.nascar.com/cacher/'+year+'/race_list_basic.json';let body;try{body=await get(feed,allowed);reached=true;source=feed;}catch{continue;}
  for(const race of parseNascarFeed(JSON.parse(body)))records.push({...race,...circuitFor(race.venue,'nascar')});
 }
 return {records,reached,source};
}

// SUPER GT: the English menu lists "RoundN <circuit> MM/DD-DD" per race page; the Japanese
// race page carries the timetable as boxes per day (data-target date tabs, data-from/to).
export function parseSuperGtSeason(html){
 const year=/(\d{4})\s*Calendar/i.exec(html)?.[1],out=[],seen=new Set();if(!year)return out;
 for(const [,href,label] of html.matchAll(/<a href="(https:\/\/supergt\.net\/en\/races\/[a-z0-9-]+)">\s*(Round\s*\d+[^<]*?)\s*<\/a>/gi)){
  const m=/^(Round\s*\d+)\s+(.+?)\s+(\d\d)\/(\d\d)-(?:(\d\d)\/)?(\d\d)$/.exec(text(label));if(!m||seen.has(href))continue;seen.add(href);
  out.push({name:'SUPER GT '+m[1].replace(/\s+/,' '),venue:m[2],startDate:year+'-'+m[3]+'-'+m[4],endDate:year+'-'+(m[5]||m[3])+'-'+m[6],url:href.replace('/en/races/','/races/')});
 }
 return out;
}
const GT_TITLE=[[/決勝/,'Race'],[/予選/,'Qualifying'],[/公式練習/,'Practice'],[/専有走行/,'Exclusive practice'],[/ウォームアップ/,'Warm-up'],[/フリー走行/,'Free practice']];
const GT_KOREAN={Race:'레이스',Qualifying:'퀄리파잉',Practice:'공식 연습','Exclusive practice':'전용 주행','Warm-up':'웜업','Free practice':'프리 주행'};
export function parseSuperGtSessions(html,zone='Asia/Tokyo',stampAt){
 const dates=[...html.matchAll(/table_date_tab"><a[^>]*data-target="(\d{4}-\d\d-\d\d)"/g)].map(m=>m[1]),boxes=html.split(/<div class="table_box[^"]*">/).slice(1),out=[];
 boxes.forEach((box,i)=>{const date=dates[i];if(!date)return;
  for(const [,from,to,title] of box.matchAll(/class="race_box schedule_box pc520" data-from="(\d\d:\d\d)" data-to="(\d\d:\d\d)">\s*<h6>[^<]*?SUPER GT\s*:\s*([^<]+)<\/h6>/g)){
   const rule=GT_TITLE.find(([pattern])=>pattern.test(title));if(!rule)continue;
   const nameEn=rule[1],start=stampAt(date+'T'+from+':00',zone),end=stampAt(date+'T'+to+':00',zone);if(start)out.push({name:GT_KOREAN[nameEn],nameEn,start,...(end?{end}:{})});
  }
 });
 return out.sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
}
async function superGt({now,get,stampAt}){
 const allowed=new Set(['supergt.net']),page=await first(['https://supergt.net/en/calendar'],get,allowed);if(!page)return {records:[],reached:false};
 const records=[];
 for(const event of parseSuperGtSeason(page.body)){
  const place=circuitFor(event.venue,'super-gt'),record={name:event.name,startDate:event.startDate,endDate:event.endDate,...place,sessions:[]};
  if(near(record,now)&&records.filter(r=>r.sessions.length).length<2){try{record.sessions=parseSuperGtSessions(await get(event.url,allowed),place.timezone||'Asia/Tokyo',stampAt);}catch{}}
  if(record.sessions.length<2)record.sessions=[];
  records.push(record);
 }
 return {records,reached:true,source:page.url};
}

// NLS: the season page lists "dd.mm.yyyy<tab>NLSn: name" (or "dd.-dd.mm.yyyy" for a weekend).
export function parseNlsSeason(html){
 const out=[];
 for(const line of String(html).replace(/<[^>]+>/g,'\n').split('\n').map(l=>l.replace(/&nbsp;/g,' ').trim())){
  const m=/^(\d\d)\.(?:-(\d\d)\.)?(\d\d)\.(\d{4})\s+(.+)$/.exec(line);if(!m)continue;
  const startDate=m[4]+'-'+m[3]+'-'+m[1],endDate=m[4]+'-'+m[3]+'-'+(m[2]||m[1]);
  out.push({name:text(m[5]),startDate,endDate:endDate<startDate?startDate:endDate,circuit:'nurburgring-nls',timezone:'Europe/Berlin',sessions:[]});
 }
 return out;
}
async function nls({now,get}){
 const allowed=new Set(['www.nuerburgring-langstrecken-serie.de']),records=[];let reached=false,source;
 for(const year of years(now)){
  const page='https://www.nuerburgring-langstrecken-serie.de/language/de/termine-adac-ravenol-nuerburgring-langstrecken-serie-'+year+'/';let html;try{html=await get(page,allowed);reached=true;source=page;}catch{continue;}
  records.push(...parseNlsSeason(html));
 }
 return {records,reached,source};
}

// Dakar: the route table gives a date per stage (no start times are published).
export function parseDakarRoute(html){
 const dates=[];
 for(const [,row] of String(html).matchAll(/<tr>([\s\S]*?)<\/tr>/g)){
  const cells=[...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c=>text(c[1]));
  const m=/([a-z]+)\s+(\d{1,2}),\s*(\d{4})/i.exec(cells[1]||'');if(m&&month(m[1]))dates.push(m[3]+'-'+pad(month(m[1]))+'-'+pad(m[2]));
 }
 if(!dates.length)return [];dates.sort();
 return [{name:'Dakar Rally',startDate:dates[0],endDate:dates.at(-1),circuit:'dakar-route',timezone:'Europe/Lisbon',sessions:[]}];
}
async function dakar({get}){
 const page=await first(['https://www.dakar.com/en/overall-route'],get,new Set(['www.dakar.com']));
 return {records:page?parseDakarRoute(page.body):[],reached:!!page,source:page?.url};
}

export const seasonReaders={imsa,nascar,'super-gt':superGt,nls,dakar};
