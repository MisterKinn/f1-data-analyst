import {cachedPublished} from './published-cache.js';
import {archive,readDocument} from './wec.js';

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
async function f1Catalog(year){
 const source=`https://api.jolpi.ca/ergast/f1/${year}/results/1.json?limit=100`;
 const raw=await json(source),races=raw?.MRData?.RaceTable?.Races;
 if(!Array.isArray(races)||Number(raw.MRData.total)!==races.length||races.some(r=>Number(r.season)!==year||!/^\d+$/.test(r.round)||!r.Results?.length))throw Error('Invalid F1 race index');
 return races.map(r=>({id:String(r.round),name:r.raceName,date:r.date,round:Number(r.round)})).sort((a,b)=>b.round-a.round);
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
 const series=u.searchParams.get('series'),event=u.searchParams.get('event'),category=u.searchParams.get('category'),year=Number(u.searchParams.get('season')||new Date().getUTCFullYear());
 if(!['f1','wec'].includes(series)||!Number.isInteger(year)||year<2018||year>new Date().getUTCFullYear()||event&&!/^\d{1,2}$/.test(event)||category&&(!/^[A-Za-z0-9 -]{1,40}$/.test(category)||series==='f1'))return respond({error:'Invalid race selection'},400);
 try{
  const result=await cachedPublished(env,`race-results/${series}/${year}/${event||'latest'}/${category||'default'}`,async()=>{
  const index=await memo(series+'-races-'+year,()=>series==='f1'?f1Catalog(year):wecIndex(year,env));
  const races=series==='f1'?index:index.races;
  if(!races.length)return {series,season:year,events:[],rows:[],categories:[],empty:true};
  const selected=event?races.find(r=>r.id===event):races[0];if(!selected)throw Object.assign(Error('Race results not published'),{status:404});
  const key=`race-results/v1/${series}/${year}/${selected.id}/${category||'default'}`;
  const data=await memo(key,()=>series==='f1'?f1Results(year,selected):wecResults(year,selected,category,index.files,env));
  return {...data,selected_event:selected.id,events:races.map(({id,name,date,round})=>({id,name,date,round}))};
  });return respond(result);
 }catch(error){return respond({error:error.status===404?'Race results not published':'Published race results are temporarily unavailable. Please retry.'},error.status===404?404:502);}
}
