import {cachedPublished} from './published-cache.js';
import {archive,readDocument} from './wec.js';
import {tiEvents,eventSessions,tiGet,TI_SESSIONS} from './tracinginsights.js';

const TTL=300000, memory=new Map(), pending=new Map();
const jsonHeaders={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
async function memo(key,fn){
 const hit=memory.get(key);if(hit&&Date.now()-hit.at<TTL)return hit.data;
 if(pending.has(key))return pending.get(key);
 const task=(async()=>{const data=await fn();memory.set(key,{at:Date.now(),data});return data;})();
 pending.set(key,task);try{return await task;}finally{pending.delete(key);}
}
async function json(url,max=2000000){
 const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000),headers:{accept:'application/json'}});
 if(!r.ok)throw Error('Published race data unavailable');
 const reader=r.body.getReader(),parts=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Error('Race source exceeds size limit');}parts.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let at=0;for(const p of parts){bytes.set(p,at);at+=p.length;}
 return JSON.parse(new TextDecoder().decode(bytes));
}
export function durationSeconds(value){
 const text=String(value??'').trim().replaceAll("'",':');
 if(!/^\d+(?::\d{1,2}){0,2}(?:\.\d+)?$/.test(text))return null;
 const parts=text.split(':').map(Number);if(parts.slice(1).some(n=>n>=60))return null;
 return parts.reduce((n,v)=>n*60+v,0);
}
export function resultGap(row,leader){
 if(/disqual|excluded|not classified|retired|did not|withdraw/i.test(row.status||''))return row.status;
 if(row===leader)return 'Leader';
 if(Number.isInteger(row.laps)&&Number.isInteger(leader.laps)&&row.laps<leader.laps){const n=leader.laps-row.laps;return '+'+n+' lap'+(n===1?'':'s');}
 if(row.laps===leader.laps&&Number.isFinite(row.elapsed)&&Number.isFinite(leader.elapsed)&&row.elapsed>=leader.elapsed)return '+'+(row.elapsed-leader.elapsed).toFixed(3);
 return '—';
}
export function normalizeF1Race(raw,year,round){
 const races=raw?.MRData?.RaceTable?.Races;
 if(!Array.isArray(races)||races.length!==1)throw Error('Missing F1 classification');
 const race=races[0],results=race.Results;
 if(Number(race.season)!==year||Number(race.round)!==round||!Array.isArray(results)||!results.length||Number(raw.MRData.total)!==results.length)throw Error('Incomplete F1 classification');
 const rows=results.map(r=>({position:Number(r.position),name:[r.Driver?.givenName,r.Driver?.familyName].filter(Boolean).join(' '),code:r.Driver?.code||'',number:String(r.number??''),team:r.Constructor?.name||'',laps:Number(r.laps),status:r.status||'',elapsed:r.Time?.millis!=null?Number(r.Time.millis)/1000:null,gap:r.Time?.time||'',stints:null}));
 if(rows.some(r=>!r.name||!Number.isInteger(r.position)||r.position<1||!Number.isInteger(r.laps)||r.laps<0)||new Set(rows.map(r=>r.number)).size!==rows.length)throw Error('Invalid F1 classification');
 rows.sort((a,b)=>a.position-b.position);
 // Jolpica publishes winner elapsed time and follower gaps, not elapsed times for every row.
 for(const row of rows){if(row.position===1)row.gap='Leader';else if(!/^(Finished|\+\d+ Laps?)$/i.test(row.status))row.gap=row.status;else if(row.laps<rows[0].laps)row.gap='+'+(rows[0].laps-row.laps)+' lap'+(rows[0].laps-row.laps===1?'':'s');else row.gap=row.gap||'—';delete row.elapsed;}
 return {event:race.raceName,date:race.date,round,rows};
}
export function tyreStrategies(raw,rows){
 const fields=['lap','stint','compound','fresh','dNum'];const n=raw?.lap?.length;
 if(!Number.isInteger(n)||!fields.every(k=>Array.isArray(raw[k])&&raw[k].length===n))throw Error('Incomplete FastF1 stint columns');
 const byCar=new Map();
 for(let i=0;i<n;i++){
  const number=String(raw.dNum[i]),lap=Number(raw.lap[i]),stint=Number(raw.stint[i]);
  if(!Number.isInteger(lap)||lap<1||!Number.isInteger(stint)||stint<1)continue;
  if(!byCar.has(number))byCar.set(number,new Map());const laps=byCar.get(number);
  const record={lap,stint,compound:String(raw.compound[i]||'UNKNOWN').toUpperCase(),fresh:raw.fresh[i]===true?true:raw.fresh[i]===false?false:null};
  if(laps.has(lap)&&JSON.stringify(laps.get(lap))!==JSON.stringify(record))throw Error('Conflicting FastF1 lap records');
  laps.set(lap,record);
 }
 const strategies=new Map();
 for(const row of rows){
  const laps=[...(byCar.get(row.number)?.values()||[])].filter(l=>l.lap<=row.laps).sort((a,b)=>a.lap-b.lap);
  if(!row.laps||laps.length!==row.laps||laps.some((l,i)=>l.lap!==i+1))continue;
  const stints=[];let valid=true;
  for(const lap of laps){let current=stints.at(-1);if(!current||current.stint!==lap.stint){if(current&&lap.stint<current.stint){valid=false;break;}current={stint:lap.stint,compound:lap.compound,fresh:lap.fresh,laps:0};stints.push(current);}else if(current.compound!==lap.compound){valid=false;break;}else if(current.fresh!==lap.fresh)current.fresh=null;current.laps++;}
  if(valid)strategies.set(row.number,stints);
 }
 return strategies;
}
// Recent F1 sessions (practice, qualifying, sprint, race) from TracingInsights first.
// Jolpica is used only when TracingInsights has no race file for that weekend.
export const F1_SESSION_IDS={fp1:'Practice 1',fp2:'Practice 2',fp3:'Practice 3',sq:'Sprint Qualifying',sprint:'Sprint',q:'Qualifying',race:'Race'};
const sessionId=name=>Object.keys(F1_SESSION_IDS).find(k=>F1_SESSION_IDS[k]===name);
const tiIo={tiFetch:(u,o)=>fetch(u,o)};
const realValue=v=>v!==null&&v!==undefined&&v!=='None'&&v!=='';
const seconds=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
function tiRows(d){
 const n=d?.lap?.length;if(!Number.isInteger(n)||!n)throw Error('Empty TracingInsights laps');
 const col=k=>Array.isArray(d[k])?d[k]:[];const out=[];
 for(let i=0;i<n;i++)out.push({number:String(col('dNum')[i]),code:col('drv')[i]||'',team:col('team')[i]||'',lap:Number(d.lap[i]),time:seconds(col('time')[i]),start:realValue(col('lSD')[i])?Date.parse(String(col('lSD')[i]).slice(0,23)+'Z'):null,pos:realValue(col('pos')[i])?Number(col('pos')[i]):null,compound:realValue(col('compound')[i])?String(col('compound')[i]).toUpperCase():null,stint:Number(col('stint')[i]),fresh:col('fresh')[i]===true?true:col('fresh')[i]===false?false:null,deleted:col('del')[i]===true,segment:realValue(col('qs')[i])?String(col('qs')[i]):null});
 return out.filter(r=>Number.isInteger(r.lap)&&r.number);
}
function people(drivers){const map=new Map();for(const p of drivers?.drivers||[])map.set(String(p.dn),{name:[p.fn,p.ln].filter(Boolean).join(' ')||p.driver||'',team:p.team||'',code:p.driver||''});return map;}
const byCar=laps=>{const m=new Map();for(const l of laps){if(!m.has(l.number))m.set(l.number,[]);m.get(l.number).push(l);}for(const v of m.values())v.sort((a,b)=>a.lap-b.lap);return m;};
const base=(number,laps,who)=>{const p=who.get(number)||{};return {number,name:p.name||laps[0].code,code:p.code||laps[0].code,team:p.team||laps[0].team};};
// Best clean lap per driver; qualifying ranks drivers by the last segment they reached.
export function tiTimedClassification(d,drivers,qualifying=false){
 const who=people(drivers),rows=[];
 for(const [number,laps] of byCar(tiRows(d))){
  const valid=laps.filter(l=>l.time!==null&&!l.deleted);const segs=[...new Set(laps.map(l=>l.segment).filter(Boolean))].sort();
  const segment=qualifying?segs.at(-1)||null:null;const pool=segment?valid.filter(l=>l.segment===segment):valid;
  const best=pool.reduce((a,l)=>!a||l.time<a.time?l:a,null);
  rows.push({...base(number,laps,who),laps:laps.length,best:best?.time??null,compound:best?.compound||null,segment,stints:null});
 }
 const rank=r=>r.segment?Number(String(r.segment).replace(/\D/g,''))||0:0;
 rows.sort((a,b)=>rank(b)-rank(a)||(a.best??1e9)-(b.best??1e9));
 const leaders=new Map();rows.forEach((r,i)=>{r.position=i+1;if(r.best!==null&&!leaders.has(r.segment))leaders.set(r.segment,r.best);const lead=leaders.get(r.segment);r.gap=r.best===null?'No time':r.best===lead?(i===0?'Leader':'—'):'+'+(r.best-lead).toFixed(3);});
 return rows;
}
// Race or sprint order on track: laps completed, then the time each car finished its last lap.
export function tiRaceClassification(d,drivers){
 const who=people(drivers),rows=[];
 for(const [number,laps] of byCar(tiRows(d))){
  const last=laps.at(-1);
  rows.push({...base(number,laps,who),laps:last.lap,finish:last.start!==null&&last.time!==null?last.start/1000+last.time:null,lastPos:last.pos,stints:stintsOf(laps)});
 }
 rows.sort((a,b)=>b.laps-a.laps||(a.finish??1e12)-(b.finish??1e12)||(a.lastPos??99)-(b.lastPos??99));
 const lead=rows[0];
 rows.forEach((r,i)=>{r.position=i+1;r.status='';
  if(i===0)r.gap='Leader';
  else if(r.laps<lead.laps*0.9||r.lastPos===null&&r.laps<lead.laps){r.gap='DNF';r.status='DNF';}
  else if(r.laps<lead.laps){const n=lead.laps-r.laps;r.gap='+'+n+' lap'+(n===1?'':'s');}
  else r.gap=r.finish!==null&&lead.finish!==null?'+'+(r.finish-lead.finish).toFixed(3):'—';
  });
 for(const r of rows){delete r.finish;delete r.lastPos;}
 return rows;
}
function stintsOf(laps){
 const stints=[];
 for(const l of laps){const cur=stints.at(-1);if(cur&&cur.stint===l.stint&&cur.compound===(l.compound||'UNKNOWN')){cur.laps++;if(cur.fresh!==l.fresh)cur.fresh=null;continue;}stints.push({stint:l.stint,compound:l.compound||'UNKNOWN',fresh:l.fresh,laps:1});}
 return stints.length?stints:null;
}
function f1Catalog(year){
 return tiEvents(year).map((e,i)=>({id:String(i+1),name:e.folder,date:e.start,round:i+1})).reverse();
}
async function jolpicaCatalog(year){
 const source=`https://api.jolpi.ca/ergast/f1/${year}/results/1.json?limit=100`;
 const raw=await json(source),races=raw?.MRData?.RaceTable?.Races;
 if(!Array.isArray(races)||Number(raw.MRData.total)!==races.length||races.some(r=>Number(r.season)!==year||!/^\d+$/.test(r.round)||!r.Results?.length))throw Error('Invalid F1 race index');
 return races.map(r=>({id:String(r.round),name:r.raceName,date:r.date,round:Number(r.round)})).sort((a,b)=>b.round-a.round);
}
async function weekendSessions(year,event){
 const rows=await memo('ti-sessions-'+year+'-'+event.name,()=>eventSessions(year,event.name,tiIo));
 return rows.filter(r=>sessionId(r.session_name)).sort((a,b)=>String(a.date_start).localeCompare(String(b.date_start))).map(r=>({id:sessionId(r.session_name),name:r.session_name,date:r.date_start}));
}
async function f1Session(year,event,session){
 const name=F1_SESSION_IDS[session.id],folder=[event.name,name];
 const [laps,drivers]=await Promise.all([tiGet(year,[...folder,'session_laptimes.json'],tiIo),tiGet(year,[...folder,'drivers.json'],tiIo).catch(()=>null)]);
 if(!laps)throw Error('TracingInsights session not published');
 const kind=['race','sprint'].includes(session.id)?'race':'timed';
 const rows=kind==='race'?tiRaceClassification(laps,drivers):tiTimedClassification(laps,drivers,['q','sq'].includes(session.id));
 const tree=`https://github.com/TracingInsights/${year}/tree/main/${folder.map(encodeURIComponent).join('/')}`;
 return {event:event.name,round:event.round,rows,series:'f1',season:year,session:session.id,session_name:name,session_kind:kind,provider:'TracingInsights (FastF1)',classification:kind==='race'?'TRACK_ORDER':null,source:tree,strategy_source:kind==='race'?tree:null,strategy_state:kind==='race'?(rows.every(r=>r.stints)?'available':'partial'):null,retrieved_at:new Date().toISOString(),categories:[{id:'drivers',label:'Drivers'}]};
}
async function f1Results(year,event){
 const source=`https://api.jolpi.ca/ergast/f1/${year}/${event.id}/results.json?limit=100`;
 const data=normalizeF1Race(await json(source),year,event.round);
 let strategySource=null,strategyState='unavailable';
 try{
  // Published FastF1 lap archive, maintained by TracingInsights (Apache-2.0).
  const path=encodeURIComponent(data.event);const base=`https://raw.githubusercontent.com/TracingInsights/${year}/main/${path}/Race/`;
  const [info,laps]=await Promise.all([json(base+'session_info.json'),json(base+'session_laptimes.json')]);
  const session=info.session_info;
  if(session?.Type!=='Race'||session?.Meeting?.Name!==data.event||String(session.StartDate).slice(0,10)!==data.date)throw Error('Wrong FastF1 race identity');
  const stints=tyreStrategies(laps,data.rows);for(const row of data.rows)row.stints=stints.get(row.number)||null;
  strategySource=`https://github.com/TracingInsights/${year}/tree/main/${path}/Race`;strategyState=data.rows.every(r=>r.laps===0||r.stints)?'available':'partial';
 }catch{ /* Classification remains usable when optional lap data is not published yet. */ }
 return {...data,series:'f1',season:year,provider:'Jolpica · FastF1 standings database',source,retrieved_at:new Date().toISOString(),strategy_source:strategySource,strategy_state:strategyState,categories:[{id:'drivers',label:'Drivers'}]};
}
export function selectWecRaces(files,year){
 const chosen=new Map();
 for(const f of files){
  if(f.folders[1]!=='FIA WEC'||!f.folders.includes('Race')||f.format!=='csv'||!/^Classification_Race/i.test(f.title)||/ByCategory/i.test(f.title))continue;
  const match=decodeURIComponent(f.url).match(/\/(\d+)_([\d]{4})\/(\d+)_/);if(!match||Number(match[2])!==year)continue;
  // An arbitrary Hour N file is an intermediate snapshot, never a final race result.
  if(!/final|provisional|amended/i.test(f.title))continue;
  const id=String(Number(match[3])),rank=/amended/i.test(f.title)?3:/final/i.test(f.title)?2:1,old=chosen.get(id);
  if(!old||rank>old.rank||rank===old.rank&&String(f.published_at)>String(old.file.published_at))chosen.set(id,{id,round:Number(id),name:f.folders[0],file:f,rank});
 }
 return [...chosen.values()].sort((a,b)=>b.round-a.round);
}
export function normalizeWecRace(records,category){
 if(!Array.isArray(records)||!records.length)throw Error('Missing WEC classification');
 const cars=records.map(r=>({position:/^\d+$/.test(r.POSITION)?Number(r.POSITION):null,number:r.NUMBER,name:r.TEAM,team:r.VEHICLE||'',drivers:[1,2,3,4,5].map(n=>r['DRIVER_'+n]).filter(Boolean).join(' / '),category:r.CLASS,laps:/^\d+$/.test(r.LAPS)?Number(r.LAPS):/did not start|withdraw|dns/i.test(r.STATUS||'')?0:null,status:r.STATUS||'',elapsed:durationSeconds(r.TOTAL_TIME),pit_stops:null,pit_time_seconds:null}));
 if(cars.some(r=>!r.number||!r.name||!r.category||r.laps===null)||new Set(cars.map(r=>r.number)).size!==cars.length)throw Error('Invalid WEC classification');
 const categories=[...new Set(cars.map(r=>r.category))].map(id=>({id,label:id})),selected=category||categories.find(c=>/hypercar/i.test(c.id))?.id||categories[0].id;
 if(!categories.some(c=>c.id===selected))throw Error('Unknown WEC class');
 const rows=cars.filter(r=>r.category===selected);const leader=rows.find(r=>r.position!==null&&!/disqual|excluded/i.test(r.status));if(!leader)throw Error('Missing WEC class leader');
 for(let i=0;i<rows.length;i++){const row=rows[i];row.overall_position=row.position;row.position=row.position===null?null:i+1;row.gap=resultGap(row,leader);}
 for(const row of rows)delete row.elapsed;
 return {rows,categories,selected_category:selected};
}
export function wecPitTotals(records,rows){
 const totals=new Map();
 for(const row of rows){
  const laps=new Map();let invalid=false;
  for(const r of records.filter(r=>r.NUMBER===row.number)){
   const lap=Number(r.LAP_NUMBER);if(!Number.isInteger(lap)||lap<1||lap>row.laps)continue;
   const value={entry:r.CROSSING_FINISH_LINE_IN_PIT==='B',duration:r.PIT_TIME?.trim()?durationSeconds(r.PIT_TIME):null};
   if(r.PIT_TIME?.trim()&&value.duration===null)invalid=true;
   if(laps.has(lap)&&JSON.stringify(laps.get(lap))!==JSON.stringify(value))invalid=true;
   laps.set(lap,value);
  }
  // Missing analysis laps may hide pit visits, so don't publish partial totals as complete.
  if(invalid||!row.laps||laps.size!==row.laps)continue;
  const values=[...laps.values()],entries=values.filter(r=>r.entry).length,durations=values.filter(r=>r.duration!==null);
  totals.set(row.number,{pit_stops:Math.max(entries,durations.length),pit_time_seconds:entries===durations.length?Math.round(durations.reduce((n,r)=>n+r.duration,0)*1000)/1000:null});
 }
 return totals;
}
// Non-race WEC sessions (free practice, qualifying, hyperpole): one classification per session folder.
export const wecSessionId=label=>String(label||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40);
export function selectWecSessions(files,event){
 const folder=event.file.folders.slice(0,2).join('/'),chosen=new Map();
 for(const f of files){
  if(f.format!=='csv'||f.folders.slice(0,2).join('/')!==folder||!/^\d*_?Classification/i.test(f.title)||/ByCategory|ByClass/i.test(f.title))continue;
  const label=f.folders[2]||'';if(!label||/^race$/i.test(label)||/hour \d/i.test(f.title))continue;
  const id=wecSessionId(label),old=chosen.get(id);
  if(!old||String(f.published_at)>String(old.file.published_at))chosen.set(id,{id,name:label,file:f,date:f.published_at||null});
 }
 return [...chosen.values()].sort((a,b)=>String(a.file.url).localeCompare(String(b.file.url)));
}
const pick=(r,keys)=>{for(const k of keys)if(r[k]!==undefined&&String(r[k]).trim())return String(r[k]).trim();return '';};
export function normalizeWecTimed(records,category){
 if(!Array.isArray(records)||!records.length)throw Error('Missing WEC classification');
 const cars=records.map(r=>({number:r.NUMBER,name:r.TEAM,team:r.VEHICLE||'',drivers:[1,2,3,4,5].map(n=>r['DRIVER_'+n]).filter(Boolean).join(' / '),category:r.CLASS,status:r.STATUS||'',laps:/^\d+$/.test(r.LAPS||'')?Number(r.LAPS):null,overall:/^\d+$/.test(r.POSITION||'')?Number(r.POSITION):null,best:durationSeconds(pick(r,['BEST_LAP','FL_TIME','BEST_LAP_TIME','FASTEST_LAP','TIME'])),gap_text:pick(r,['GAP_FIRST'])}));
 if(cars.some(r=>!r.number||!r.category))throw Error('Invalid WEC classification');
 const categories=[...new Set(cars.map(r=>r.category))].map(id=>({id,label:id})),selected=category&&categories.some(c=>c.id===category)?category:categories.find(c=>/hypercar/i.test(c.id))?.id||categories[0].id;
 const rows=cars.filter(r=>r.category===selected).sort((a,b)=>(a.overall??1e9)-(b.overall??1e9)||(a.best??1e9)-(b.best??1e9));
 const lead=rows.find(r=>r.best!==null)?.best??null;
 rows.forEach((r,i)=>{r.overall_position=r.overall;r.position=i+1;r.gap=r.best===null?(r.gap_text||'No time'):r.best===lead?(i===0?'Leader':'—'):lead!==null?'+'+(r.best-lead).toFixed(3):r.gap_text||'—';delete r.overall;delete r.gap_text;});
 return {rows,categories,selected_category:selected};
}
async function allCsv(file,env){
 // Internal bounded read: fetch and parse the source once, not once per tool-sized page.
 const d=await readDocument({url:file.url,offset:0,limit:20000},env);
 if(d.format!=='csv'||!Array.isArray(d.records)||d.next_offset!==null||d.records.length!==d.total)throw Error('Incomplete WEC CSV');
 return d.records;
}
async function wecIndex(year,env){
 const index=await archive(undefined,env),season=index.records.find(r=>r.name===String(year));
 if(!season)return {races:[],files:[]};const listing=await archive(season.season_id,env);
 return {races:selectWecRaces(listing.files,year),files:listing.files};
}
async function wecResults(year,event,category,files,env){
 const records=await memo('wec-classification-'+event.file.url,()=>allCsv(event.file,env));
 const data=normalizeWecRace(records,category);
 const folder=event.file.folders.join('/');
 const analysis=files.filter(f=>f.format==='csv'&&/^Analysis_Race/i.test(f.title)&&f.folders.join('/')===folder).sort((a,b)=>String(b.published_at).localeCompare(String(a.published_at)))[0];
 let pitState='unavailable';
 if(analysis)try{const laps=await memo('wec-analysis-'+analysis.url,()=>allCsv(analysis,env));const totals=wecPitTotals(laps,data.rows);for(const row of data.rows)Object.assign(row,totals.get(row.number)||{});pitState=data.rows.every(r=>r.pit_stops!==null&&r.pit_time_seconds!==null)?'available':'partial';}catch{ /* Keep verified classification available independently of pit analysis. */ }
 return {...data,event:event.name,round:event.round,series:'wec',season:year,provider:'Al Kamel',source:event.file.url,retrieved_at:new Date().toISOString(),classification:event.rank>=2?'FINAL':'PROVISIONAL',pit_source:analysis?.url||null,pit_state:pitState};
}
export async function raceResultsRoute(request,env={}){
 const u=new URL(request.url);if(u.pathname!=='/api/race-results')return null;
 // Only successful public results are cacheable by the CDN.
 const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:status===200?{...jsonHeaders,'cache-control':'public, max-age=60, s-maxage=120, stale-while-revalidate=300'}:jsonHeaders});
 if(request.method!=='GET')return respond({error:'GET only'},405);
 const series=u.searchParams.get('series'),event=u.searchParams.get('event'),category=u.searchParams.get('category'),session=u.searchParams.get('session'),year=Number(u.searchParams.get('season')||new Date().getUTCFullYear());
 if(!['f1','wec'].includes(series)||!Number.isInteger(year)||year<2018||year>new Date().getUTCFullYear()||event&&!/^\d{1,2}$/.test(event)||category&&(!/^[A-Za-z0-9 -]{1,40}$/.test(category)||series==='f1')||session&&(series==='f1'?!F1_SESSION_IDS[session]:!/^[a-z0-9-]{1,40}$/.test(session)))return respond({error:'Invalid race selection'},400);
 try{
  const result=await cachedPublished(env,`race-results/${series}/${year}/${event||'latest'}/${session||'latest'}/${category||'default'}`,async()=>series==='f1'?f1Route(year,event,session):wecRoute(year,event,category,session,env));
  return respond(result);
 }catch(error){return respond({error:error.status===404?'Race results not published':'Published race results are temporarily unavailable. Please retry.'},error.status===404?404:502);}
}
const notFound=()=>Object.assign(Error('Race results not published'),{status:404});
async function wecRoute(year,event,category,session,env){
 const index=await memo('wec-races-'+year,()=>wecIndex(year,env)),races=wecEvents(index);
 if(!races.length)return {series:'wec',season:year,events:[],sessions:[],rows:[],categories:[],empty:true};
 const selected=event?races.find(r=>r.id===event):races[0];if(!selected)throw notFound();
 const sessions=[...selectWecSessions(index.files,selected),...(selected.race?[{id:'race',name:'Race',race:true}]:[])];
 const chosen=session?sessions.find(x=>x.id===session):sessions.at(-1);if(!chosen)throw notFound();
 const data=chosen.race?await memo(`race-results/v1/wec/${year}/${selected.id}/${category||'default'}`,()=>wecResults(year,selected.race,category,index.files,env))
  :await memo(`race-results/v2/wec/${year}/${selected.id}/${chosen.id}/${category||'default'}`,async()=>{const records=await memo('wec-classification-'+chosen.file.url,()=>allCsv(chosen.file,env));return {...normalizeWecTimed(records,category),event:selected.name,round:selected.round,series:'wec',season:year,provider:'Al Kamel',source:chosen.file.url,retrieved_at:new Date().toISOString()};});
 return {...data,session:chosen.id,session_name:chosen.name,session_kind:chosen.race?'race':'timed',selected_event:selected.id,selected_session:chosen.id,sessions:sessions.map(({id,name})=>({id,name})),events:races.map(({id,name,date,round})=>({id,name,date,round}))};
}
// Events with any published classification (practice before the race is published counts).
function wecEvents(index){
 const races=new Map(index.races.map(r=>[r.id,r])),events=new Map();
 for(const f of index.files){
  if(f.folders[1]!=='FIA WEC'||f.format!=='csv'||!/Classification/i.test(f.title))continue;
  const m=decodeURIComponent(f.url).match(/\/\d+_\d{4}\/(\d+)_/);if(!m)continue;const id=String(Number(m[1]));
  if(!events.has(id))events.set(id,{id,round:Number(id),name:f.folders[0],date:null,file:f,race:races.get(id)||null});
 }
 return [...events.values()].sort((a,b)=>b.round-a.round);
}
// F1: newest weekend with a published TracingInsights session, newest session first.
// Falls back to the Jolpica race classification only when TracingInsights has nothing.
async function f1Route(year,event,session){
 const events=f1Catalog(year),list=events.map(({id,name,date,round})=>({id,name,date,round}));
 let selected=null,sessions=[];
 for(const e of event?events.filter(x=>x.id===event):events.slice(0,3)){
  const found=await weekendSessions(year,e).catch(()=>[]);if(found.length){selected=e;sessions=found;break;}
 }
 if(selected){
  const chosen=session?sessions.find(x=>x.id===session):sessions.at(-1);if(!chosen)throw notFound();
  const data=await memo(`race-results/v2/f1/${year}/${selected.id}/${chosen.id}`,()=>f1Session(year,selected,chosen));
  return {...data,selected_event:selected.id,selected_session:chosen.id,sessions,events:list};
 }
 if(session&&session!=='race')throw notFound();
 const races=await memo('f1-jolpica-'+year,()=>jolpicaCatalog(year));
 if(!races.length)return {series:'f1',season:year,events:list,sessions:[],rows:[],categories:[],empty:true};
 const target=event?races.find(r=>r.id===event):races[0];if(!target)throw notFound();
 const data=await memo(`race-results/v1/f1/${year}/${target.id}`,()=>f1Results(year,target));
 return {...data,session:'race',session_name:'Race',session_kind:'race',selected_event:target.id,selected_session:'race',sessions:[{id:'race',name:'Race',date:target.date}],events:list.length?list:races.map(({id,name,date,round})=>({id,name,date,round}))};
}
