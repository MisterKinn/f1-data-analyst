import {NEW_SERIES,newSeriesStandings} from './series_standings.js';
import {archive,readDocument} from './wec.js';
import {cloudRequest} from './live.js';
const TTL=300000,cache=new Map(),pending=new Map();
export const STANDINGS_TOOLS=[{name:'motorsport_championship_standings',description:'Read current published championship points for F1 (FastF1), WEC (Al Kamel), IMSA, Formula E, NLS, ELMS or Asian Le Mans. Start without category; use returned category IDs to switch driver/team/manufacturer/cup standings. Preserve actual cross-year season, provisional status, class labels, source and retrieved time.',inputSchema:{type:'object',properties:{series:{type:'string',enum:['f1','wec','imsa','formula-e','nls','elms','alms']},category:{type:'string'}},required:['series'],additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true}}];
export async function standingsCall(args,env){const u=new URL('https://internal/api/championship-standings');u.searchParams.set('series',args.series);if(args.category)u.searchParams.set(args.series==='f1'?'kind':'category',args.category);const r=await standingsRoute(new Request(u),env);return {content:[{type:'text',text:await r.text()}],isError:!r.ok};}
const labels={'hypercar-manufacturers':'하이퍼카 · 매뉴팩처러','hypercar-drivers':'하이퍼카 · 드라이버','hypercar-teams':'하이퍼카 · 팀','lmgt3-drivers':'LMGT3 · 드라이버','lmgt3-teams':'LMGT3 · 팀'};
async function memo(key,fn){const hit=cache.get(key);if(hit&&Date.now()-hit.at<TTL)return hit.data;if(pending.has(key))return pending.get(key);const p=(async()=>{const data=await fn();cache.set(key,{at:Date.now(),data});return data;})();pending.set(key,p);try{return await p;}finally{pending.delete(key);}}
export function selectPointDocuments(files){
 const candidates=files.filter(f=>f.folders[1]==='FIA WEC'&&f.format==='pdf'&&/Championship Points/i.test(f.folders.join(' '))).map(f=>({...f,round:Number(decodeURIComponent(f.url).match(/\/\d+_\d{4}\/(\d+)_/)?.[1])})).filter(f=>f.round>0);
 if(!candidates.length)throw Error('Al Kamel 챔피언십 문서가 아직 없습니다.');
 const round=Math.max(...candidates.map(f=>f.round));const chosen=new Map();
 for(const f of candidates.filter(f=>f.round===round)){
  const title=f.title.replaceAll('_',' ');const cls=/Hypercar/i.test(title)?'hypercar':/LMGT3/i.test(title)?'lmgt3':null;
  const part=/Manufacturers/i.test(title)?'manufacturers':/Drivers/i.test(title)?'drivers':/Teams/i.test(title)?'teams':null;
  const id=cls+'-'+part;if(!labels[id])continue;const old=chosen.get(id),final=/Final/i.test(f.folders.join(' '));
  if(!old||final&&!old.final||final===old.final&&String(f.published_at)>String(old.published_at))chosen.set(id,{...f,id,label:labels[id],final});
 }
 const categories=[...chosen.values()];if(!['hypercar-manufacturers','hypercar-drivers','lmgt3-drivers','lmgt3-teams'].every(id=>chosen.has(id)))throw Error('최신 라운드의 전체 챔피언십 문서가 아직 준비되지 않았습니다.');
 return {round,event:categories[0].folders[0],categories};
}
export function parsePointDocument(document,category,year,round){
 if(document.next_page||!document.pages?.length||document.pages.some(p=>p.truncated||!p.text_available))throw Error('챔피언십 PDF 전체를 읽지 못했습니다.');
 const text=document.pages.map(p=>p.text).join('\n');if(!text.includes(String(year))||!new RegExp('Round\\s+'+round+'\\b').test(text)||!/After Race/i.test(text))throw Error('챔피언십 시즌·라운드가 일치하지 않습니다.');
 const rows=[];
 for(const page of document.pages){
  const header=page.rows.find(r=>r.cells.some(c=>c.text==='Pos')&&r.cells.some(c=>c.text==='Points'));
  if(!header)throw Error('포인트 표의 머리글을 확인할 수 없습니다.');
  const px=header.cells.find(c=>c.text==='Points').x,rx=header.cells.find(c=>c.text==='Pole')?.x;
  const team=category.endsWith('-teams');
  for(const row of page.rows){
   const cells=row.cells;if(row.y>=header.y||!/^\d+$/.test(cells[0]?.text??'')||cells[0].x>header.cells[0].x+15)continue;
   const total=cells.filter(c=>c.x>=px-3&&c.x<rx-8);if(total.length!==1||!/^\d+(?:\.\d+)?$/.test(total[0].text))throw Error('누적 포인트 열이 올바르지 않습니다.');
   const left=cells.slice(1).filter(c=>c.x<px-3);if(team&&(!/^\d+$/.test(left[0]?.text??'')||left.length<3))throw Error('팀·차량 번호 열이 올바르지 않습니다.');
   const name=(team?left.slice(1,-1):left).map(c=>c.text).join(' ');if(!name)throw Error('참가자 이름 누락');
   rows.push({position:Number(cells[0].text),name,number:team?'#'+left[0].text:'',team:'',points:Number(total[0].text)});
  }
 }
 if(!rows.length||rows.length>200)throw Error('챔피언십 순위가 비어 있습니다.');
 return {rows,classification:/\bFINAL\b/.test(text)?'FINAL':'PROVISIONAL'};
}
async function wecStandings(year,requested,env){
 const listing=await memo('wec-index-'+year,async()=>{const index=await archive(undefined,env);const season=index.records.find(s=>s.name===String(year));if(!season)throw Error('현재 WEC 시즌이 아직 없습니다.');return selectPointDocuments((await archive(season.season_id,env)).files);});
 const id=requested||'hypercar-manufacturers';const selected=listing.categories.find(c=>c.id===id);if(!selected)throw Error('이 시즌에 해당 부문이 없습니다.');
 const data=await memo('wec-points-'+selected.url,async()=>{const d=await readDocument({url:selected.url,start_page:1,page_count:5},env);return {...parsePointDocument(d,id,year,listing.round),retrieved_at:d.retrieved_at};});
 return {series:'wec',season:year,round:listing.round,event:listing.event,provider:'Al Kamel',source:selected.url,retrieved_at:data.retrieved_at,classification:data.classification,categories:listing.categories.map(c=>({id:c.id,label:c.label,...(c.id===id?{rows:data.rows}:{})}))};
}
// FastF1's Ergast interface reads this same Jolpica database. Read it directly
// for standings so a sleeping live collector cannot freeze championship totals.
export function normalizeF1Standings(raw,kind,year){
 const table=raw?.MRData?.StandingsTable,lists=table?.StandingsLists;
 if(!Array.isArray(lists)||lists.length!==1||Number(lists[0].season)!==year)throw Error('Unexpected FastF1 database season');
 const list=lists[0],items=list[kind==='drivers'?'DriverStandings':'ConstructorStandings'];
 if(!Number.isInteger(Number(list.round))||Number(list.round)<1||!Array.isArray(items)||!items.length||Number(raw.MRData.total)!==items.length)throw Error('Incomplete FastF1 standings');
 const rows=items.map(item=>({position:Number(item.position),name:kind==='drivers'?[item.Driver?.givenName,item.Driver?.familyName].filter(Boolean).join(' '):item.Constructor?.name,points:Number(item.points),team:(item.Constructors||[]).map(c=>c.name).join(', '),number:item.Driver?.permanentNumber||''}));
 if(rows.some(r=>!r.name||!Number.isInteger(r.position)||r.position<1||!Number.isFinite(r.points)||r.points<0))throw Error('Invalid FastF1 standings');
 return {series:'f1',season:year,round:Number(list.round),provider:'Jolpica · FastF1 standings database',source:`https://api.jolpi.ca/ergast/f1/${year}/last/${kind==='drivers'?'driverStandings':'constructorStandings'}/`,retrieved_at:new Date().toISOString(),categories:[{id:kind,label:kind==='drivers'?'드라이버':'컨스트럭터',rows}]};
}
async function f1Standings(kind,year,env){
 try{
  const endpoint=kind==='drivers'?'driverStandings':'constructorStandings';
  const response=await fetch(`https://api.jolpi.ca/ergast/f1/${year}/last/${endpoint}.json?limit=100`,{headers:{accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('FastF1 database unavailable');
  return normalizeF1Standings(await response.json(),kind,year);
 }catch{
  const data=await cloudRequest(env,'/championship/'+kind,'GET');
  if(!/FastF1|Jolpica/i.test(data.provider||'')||!Number.isInteger(data.round)||data.round<1||Date.now()-Date.parse(data.retrieved_at)>TTL*2)throw Error('Outdated FastF1 collector standings');
  return data;
 }
}
export async function standingsRoute(request,env,ctx){
 const u=new URL(request.url);if(u.pathname!=='/api/championship-standings')return null;
 const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
 if(request.method!=='GET')return new Response(JSON.stringify({error:'GET only'}),{status:405,headers});
 const series=u.searchParams.get('series'),kind=u.searchParams.get('kind')||'drivers',category=u.searchParams.get('category'),year=new Date().getUTCFullYear();
 if(!['f1','wec',...NEW_SERIES].includes(series)||!['drivers','constructors'].includes(kind)||category&&(series==='wec'?!labels[category]:!/^[-a-z0-9]{1,100}$/.test(category)))return new Response(JSON.stringify({error:'Invalid championship'}),{status:400,headers});
 const selected=series==='f1'?kind:(category||(series==='wec'?'hypercar-manufacturers':'default'));
 const key='standings/'+(series==='f1'?'v2':'v1')+'/'+year+'/'+series+'/'+selected+'.json';
 const respond=data=>new Response(JSON.stringify(data),{headers});
 const valid=data=>(NEW_SERIES.includes(series)?String(data?.season).includes(String(year)):data?.season===year)&&data?.series===series&&data.categories?.some(c=>(c.id===selected||selected==='default')&&c.rows?.length)&&Number.isFinite(Date.parse(data.retrieved_at));
 const refresh=()=>memo('refresh-'+key,async()=>{
  const data=NEW_SERIES.includes(series)?await newSeriesStandings(series,selected,year,env):series==='wec'?await wecStandings(year,selected,env):await f1Standings(kind,year,env);
  if(!valid(data))throw Error('Unexpected standings');
  if(env.BUCKET)try{await env.BUCKET.put(key,JSON.stringify({checked_at:Date.now(),data}),{httpMetadata:{contentType:'application/json'}});}catch{console.error('Standings cache write failed');}
  return data;
 });
 if(series==='f1'){
  let saved;try{const object=await env.BUCKET?.get(key);if(object)saved=await object.json();}catch{console.error('Standings cache read failed');}
  const age=saved?Date.now()-saved.checked_at:Infinity;
  if(valid(saved?.data)&&age>=0&&age<TTL)return respond({...saved.data,cached:true,cache_age_seconds:Math.floor(age/1000)});
  try{return respond(await refresh());}
  catch{
   if(valid(saved?.data)&&age>=0&&age<86400000)return respond({...saved.data,cached:true,stale:true,refreshing:false,cache_age_seconds:Math.floor(age/1000)});
   return new Response(JSON.stringify({error:'FastF1 챔피언십 순위를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}),{status:502,headers});
  }
 }
 if(env.BUCKET&&ctx?.waitUntil){
  let saved;try{const object=await env.BUCKET.get(key);if(object)saved=await object.json();}catch{console.error('Standings cache read failed');}
  const age=saved?Date.now()-saved.checked_at:Infinity;
  if(valid(saved?.data)&&age>=0&&age<86400000){
   const stale=age>=TTL;
   if(stale)ctx.waitUntil(refresh().catch(()=>console.error('Standings refresh unavailable',series,selected)));
   return respond({...saved.data,stale,refreshing:stale,cached:true,cache_age_seconds:Math.floor(age/1000)});
  }
  ctx.waitUntil(refresh().catch(()=>console.error('Standings initial fetch unavailable',series,selected)));
  return new Response(JSON.stringify({pending:true,message:'수집 서버를 준비하고 공식 순위를 확인하고 있습니다. 잠시만 기다려 주세요.'}),{status:202,headers:{...headers,'retry-after':'3'}});
 }
 try{return respond(await refresh());}
 catch{return new Response(JSON.stringify({error:(series==='f1'?'FastF1':'Al Kamel')+' 챔피언십 순위를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'}),{status:502,headers});}
}

