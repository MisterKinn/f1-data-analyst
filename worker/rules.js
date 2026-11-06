// Regulation and race-document index. The GitHub Action (scripts/rules-monitor.mjs) reads
// official sources, parses PDFs and posts finished index records here with a GitHub OIDC
// token. Answers only read this small index, so no PDF is downloaded at answer time.
//
// Storage (env.BUCKET, each object < 850 KB):
//  rules/status.json                       per-source check status
//  rules/known/<source>.json               url -> {id,hash,etag,lm,published} for change detection
//  rules/catalog.json                      series -> buckets (years) that hold documents
//  rules/series/<series>/<bucket>.json     regulation documents (bucket = rulebook year or "general")
//  rules/events/<series>/<year>.json       race-event documents grouped by event
//  rules/doc/<id>/<part>.json              article index parts of one document
import {verifyCollectorToken,RULES_MONITOR_WORKFLOW} from './github-oidc.js';
import {expandQuery,scoreArticle,seriesFrom,tokenize,slug,RULES_INDEX_VERSION} from './rules-lib.js';

const ro={readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false};
const KINDS=['regulations','event_documents','all'];
export const RULES_TOOLS=[{name:'rules_lookup',
 description:'Instant lookup in the pre-built index of official motorsport regulations, driving/conduct guidelines and race-event documents (race director notes, steward decisions, bulletins) for many series (F1, F2, F3, Formula E, WEC, WRC, ISC/Appendix L, IMSA, IndyCar, NLS and more as coverage grows). Give a topic in Korean or English (e.g. "트랙 리밋", "VSC", "B5.12") and optionally series, date or event. Returns article number, heading, page, issue/date, a short excerpt and the official link, plus when the source was last checked. Use the version applicable on as_of. Open the original page with fia_read_document or motorsport_read_document when exact wording matters.',
 inputSchema:{type:'object',properties:{
  query:{type:'string',minLength:1,maxLength:200,description:'Topic, keyword or article number.'},
  series:{type:'string',maxLength:40,description:'Series id or name, e.g. f1, wec, formula-e, indycar, imsa, isc. Omit to search all indexed series.'},
  kind:{type:'string',enum:KINDS,description:'regulations (incl. guidelines), event_documents, or all (default).'},
  as_of:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$',description:'Date the rule must apply on (YYYY-MM-DD). Default today. Use the race date for past events.'},
  season:{type:'integer',minimum:1950,maximum:2100,description:'Rulebook year; defaults to the year of as_of.'},
  event:{type:'string',maxLength:80,description:'Event name for race documents, e.g. "São Paulo Grand Prix". Default: latest indexed event.'},
  limit:{type:'integer',minimum:1,maximum:10}
 },required:['query'],additionalProperties:false},annotations:ro}];
export const RULES_INSTRUCTIONS=' RULES INDEX: for any regulation, procedure, penalty, flag, track-limit, BoP or race-director question in any series, call rules_lookup first; it answers from a pre-built index without downloading PDFs. Cite series, document title, issue/date, article number and page with the official link, and say when the index last checked that source. If rules_lookup reports index_status other than ok, a failed or stale check, or a newer issue than the one applied, say so plainly. The excerpt is a search aid, not the full rule: open the cited page with fia_read_document (FIA) or motorsport_read_document before quoting exact wording or deciding a penalty dispute. Apply the issue valid on the event date (as_of), not a later one, and never present an older issue as current. Analysis results may carry rules_context: articles the server matched to situations in that result (deleted laps, SC/VSC/FCY, penalties, flags); use them to cite the applicable rule, and check the page before quoting.';

const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
let caches=new WeakMap();const TTL=5*60_000;
const cacheOf=env=>{let c=caches.get(env.BUCKET);if(!c)caches.set(env.BUCKET,c=new Map());return c;};
export function clearRulesCache(){caches=new WeakMap();}
async function readJson(env,key,{fresh=false}={}){
 const cache=cacheOf(env),hit=!fresh&&cache.get(key);if(hit&&hit.expires>Date.now())return hit.value;
 const o=await env.BUCKET.get(key);const value=o?await o.json():null;cache.set(key,{value,expires:Date.now()+TTL});return value;
}
async function writeJson(env,key,value){const body=JSON.stringify(value);await env.BUCKET.put(key,body);cacheOf(env).set(key,{value,expires:Date.now()+TTL});}
const ID=/^[a-z0-9-]{8,64}$/,SAFE=/^[a-z0-9-]{1,40}$/;
const bucketOf=d=>d.reg_year?String(d.reg_year):'general';
const eventYear=d=>Number(String(d.published||d.indexed_at||'').slice(0,4))||new Date().getUTCFullYear();
const meta=d=>{const {articles,...m}=d;return m;};

function checkDoc(d){
 if(!d||typeof d!=='object')throw Error('Invalid document');
 if(!ID.test(d.id)||!SAFE.test(d.series)||!SAFE.test(d.source_id))throw Error('Invalid document id, series or source');
 if(!['regulations','driving_guidelines','event_documents','bop','bulletin'].includes(d.kind))throw Error('Invalid kind');
 if(typeof d.url!=='string'||!/^https?:\/\//.test(d.url)||typeof d.title!=='string'||d.title.length>300)throw Error('Invalid url or title');
 if(!Array.isArray(d.articles)||d.articles.length>6000)throw Error('Invalid articles');
 if(d.excerpt!==undefined&&(typeof d.excerpt!=='string'||d.excerpt.length>600))throw Error('Invalid excerpt');
 if(d.keywords!==undefined&&(!Array.isArray(d.keywords)||d.keywords.length>60))throw Error('Invalid keywords');
 for(const a of d.articles)if(!a||typeof a.n!=='string'||a.n.length>24||typeof (a.x??'')!=='string'||String(a.x??'').length>400||!Number.isInteger(a.p))throw Error('Invalid article');
 return d;
}
function partsOf(articles,maxBytes=700_000){const parts=[];let cur=[],size=2;for(const a of articles){const s=JSON.stringify(a).length+1;if(cur.length&&size+s>maxBytes){parts.push(cur);cur=[];size=2;}cur.push(a);size+=s;}if(cur.length||!parts.length)parts.push(cur);return parts;}

// POST /api/rules/ingest  {sources:[status], known:{source_id:{url:{...}}}, documents:[doc]}
export async function rulesIngest(request,env,{verify=t=>verifyCollectorToken(t,{workflow:RULES_MONITOR_WORKFLOW})}={}){
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 try{await verify((request.headers.get('authorization')||'').replace(/^Bearer /,''));}catch{return json({error:'Monitor token rejected'},401);}
 if(!env.BUCKET)return json({error:'Storage unavailable'},503);
 const text=await request.text();if(text.length>4_000_000)return json({error:'Batch too large'},413);
 let body;try{body=JSON.parse(text);}catch{return json({error:'Invalid JSON'},400);}
 const docs=Array.isArray(body.documents)?body.documents:[];if(docs.length>20)return json({error:'At most 20 documents per batch'},413);
 try{docs.forEach(checkDoc);}catch(e){return json({error:e.message},400);}
 const now=new Date().toISOString(),catalog=await readJson(env,'rules/catalog.json',{fresh:true})||{version:RULES_INDEX_VERSION,series:{}};
 const manifests=new Map(),load=async key=>{if(!manifests.has(key))manifests.set(key,await readJson(env,key,{fresh:true}));return manifests.get(key);};
 for(const d of docs){
  const parts=partsOf(d.articles);for(let i=0;i<parts.length;i++)await writeJson(env,`rules/doc/${d.id}/${i}.json`,{id:d.id,part:i,articles:parts[i]});
  const record={...meta(d),parts:parts.length,article_count:d.articles.length,stored_at:now};
  if(d.kind==='event_documents'){
   // Per-event manifest keeps every object small even for a full season of documents.
   const y=eventYear(d),name=d.event||'Unknown event',es=slug(name)||'unknown',idxKey=`rules/events/${d.series}/${y}.json`,evKey=`rules/events/${d.series}/${y}/${es}.json`;
   const idx=await load(idxKey)||{series:d.series,year:y,events:{}},ev=await load(evKey)||{series:d.series,year:y,event:name,docs:{}};
   ev.docs[d.id]=record;ev.updated_at=now;manifests.set(evKey,ev);
   idx.events[name]={slug:es,updated_at:now,count:Object.keys(ev.docs).length};idx.updated_at=now;manifests.set(idxKey,idx);
   const c=catalog.series[d.series]||={buckets:[],event_years:[]};if(!c.event_years.includes(y))c.event_years.push(y);
  }else{
   const b=bucketOf(d),key=`rules/series/${d.series}/${b}.json`,m=await load(key)||{series:d.series,bucket:b,docs:{}};
   m.docs[d.id]=record;m.updated_at=now;manifests.set(key,m);
   const c=catalog.series[d.series]||={buckets:[],event_years:[]};if(!c.buckets.includes(b))c.buckets.push(b);
  }
 }
 for(const [key,value] of manifests){const size=JSON.stringify(value).length;if(size>800_000)return json({error:`Manifest ${key} would exceed the storage limit`},507);await writeJson(env,key,value);}
 if(docs.length){catalog.updated_at=now;await writeJson(env,'rules/catalog.json',catalog);}
 if(body.known&&typeof body.known==='object')for(const [sid,entries] of Object.entries(body.known)){
  if(!SAFE.test(sid)||!entries||typeof entries!=='object')continue;
  const key=`rules/known/${sid}.json`,cur=await readJson(env,key,{fresh:true})||{};
  for(const [url,v] of Object.entries(entries))if(/^https?:\/\//.test(url)&&v&&typeof v==='object')cur[url]={id:v.id??cur[url]?.id??null,hash:v.hash??cur[url]?.hash??null,etag:v.etag??null,lm:v.lm??null,published:v.published??cur[url]?.published??null,seen_at:now};
  if(JSON.stringify(cur).length<800_000)await writeJson(env,key,cur);
 }
 if(Array.isArray(body.sources)&&body.sources.length){
  const status=await readJson(env,'rules/status.json',{fresh:true})||{sources:{}};
  for(const s of body.sources.slice(0,200)){if(!s||!SAFE.test(s.id))continue;const prev=status.sources[s.id]||{};
   status.sources[s.id]={series:String(s.series||prev.series||''),kind:String(s.kind||prev.kind||''),checked_at:now,status:['ok','partial','failed','skipped'].includes(s.status)?s.status:'ok',ok_at:s.status==='ok'?now:prev.ok_at??null,error:s.error?String(s.error).slice(0,300):null,listed:Number.isFinite(s.listed)?s.listed:null,new:Number.isFinite(s.new)?s.new:0};}
  status.updated_at=now;if(body.run&&typeof body.run==='object')status.last_run={started_at:String(body.run.started_at||''),finished_at:now,run_url:String(body.run.url||'').slice(0,200)};
  await writeJson(env,'rules/status.json',status);
 }
 return json({ok:true,documents:docs.length});
}

// GET /api/rules/state?source=<id>  (public; read by the monitor before each check)
export async function rulesState(request,env){
 if(!env.BUCKET)return json({error:'Storage unavailable'},503);
 const url=new URL(request.url),sid=url.searchParams.get('source');
 if(sid){if(!SAFE.test(sid))return json({error:'Invalid source'},400);return json({source:sid,known:await readJson(env,`rules/known/${sid}.json`,{fresh:true})||{}});}
 return json({status:await readJson(env,'rules/status.json',{fresh:true})||{sources:{}},catalog:await readJson(env,'rules/catalog.json',{fresh:true})||{series:{}}});
}

export async function rulesRoutes(request,env){
 const path=new URL(request.url).pathname;
 if(path==='/api/rules/ingest')return rulesIngest(request,env);
 if(path==='/api/rules/state'&&request.method==='GET')return rulesState(request,env);
 return null;
}

// ---------- lookup ----------
const today=()=>new Date().toISOString().slice(0,10);
const date=v=>String(v||'').slice(0,10);
// Latest issue per rulebook family valid on as_of, plus the newest later issue if any.
export function applicableDocs(docs,asOf){
 const fam=new Map();
 for(const d of docs){const k=`${d.series}|${d.family||d.id}`;(fam.get(k)||fam.set(k,[]).get(k)).push(d);}
 const out=[];
 for(const list of fam.values()){
  list.sort((a,b)=>date(a.published).localeCompare(date(b.published))||(a.issue?.number??0)-(b.issue?.number??0));
  const valid=list.filter(d=>!d.published||date(d.published)<=asOf),later=list.filter(d=>d.published&&date(d.published)>asOf);
  const pick=valid.at(-1);if(pick)out.push({...pick,newer_issue:later.length?{title:later.at(-1).title,published:later.at(-1).published,url:later.at(-1).url}:null});
 }
 return out;
}
function freshness(status,sourceId){const s=status?.sources?.[sourceId];return s?{last_checked:s.checked_at,last_ok:s.ok_at,check_status:s.status,error:s.error}:{last_checked:null,check_status:'never_checked'};}
async function articlesOf(env,d){const out=[];for(let i=0;i<(d.parts||1);i++){const p=await readJson(env,`rules/doc/${d.id}/${i}.json`);if(p?.articles)out.push(...p.articles);}return out;}
const pageUrl=(url,p)=>/\.pdf(?:$|[?#])/i.test(url)&&p?`${url.replace(/#.*$/,'')}#page=${p}`:url;
const sameEvent=(a,b)=>tokenize(a).filter(w=>w.length>3).some(w=>tokenize(b).includes(w));

export async function rulesLookup(env,args={}){
 if(!env.BUCKET)return {index_status:'storage_unavailable',hits:[]};
 const asOf=args.as_of||today(),season=args.season||Number(asOf.slice(0,4)),kind=args.kind||'all',limit=args.limit||5;
 const [catalog,status]=await Promise.all([readJson(env,'rules/catalog.json'),readJson(env,'rules/status.json')]);
 if(!catalog||!Object.keys(catalog.series||{}).length)return {index_status:'index_empty',message:'The rules index has no documents yet. Use fia_list_regulations / motorsport_list_documents for now.',hits:[]};
 let series=args.series?[seriesFrom(args.series)]:null;
 if(!series){const words=String(args.query).toLowerCase();const guess=Object.keys(catalog.series).filter(s=>{const id=seriesFrom(s);return id&&(words.includes(id)||tokenize(words).some(w=>seriesFrom(w)===id));});series=guess.length?guess:Object.keys(catalog.series);}
 const unknown=series.filter(s=>!catalog.series[s]);series=series.filter(s=>catalog.series[s]);
 const q=expandQuery(args.query),hits=[],considered=[];
 if(kind!=='event_documents')for(const s of series){
  const buckets=(catalog.series[s].buckets||[]).filter(b=>b==='general'||Number(b)===season);
  const docs=[];for(const b of buckets){const m=await readJson(env,`rules/series/${s}/${b}.json`);if(m?.docs)docs.push(...Object.values(m.docs));}
  for(const d of applicableDocs(docs,asOf)){
   considered.push(d.title);const fresh=freshness(status,d.source_id),titleScore=scoreArticle({n:'',h:d.title,x:'',k:[]},q);
   for(const a of await articlesOf(env,d)){const score=scoreArticle(a,q)+(titleScore>0?1:0);if(score>0)hits.push({score,series:s,kind:d.kind,document:d.title,issue:d.issue?.label??null,published:d.published??null,article:a.n,heading:a.h,page:a.p,excerpt:a.x,url:pageUrl(d.url,a.p),document_url:d.url,newer_issue:d.newer_issue,freshness:fresh});}
  }
 }
 if(kind!=='regulations')for(const s of series){
  const year=Number(asOf.slice(0,4));if(!(catalog.series[s].event_years||[]).includes(year))continue;
  const m=await readJson(env,`rules/events/${s}/${year}.json`);if(!m?.events)continue;
  const names=Object.keys(m.events).sort((a,b)=>String(m.events[b].updated_at).localeCompare(String(m.events[a].updated_at)));
  const chosen=args.event?names.filter(n=>sameEvent(n,args.event)):names.slice(0,1);
  for(const name of chosen){const ev=await readJson(env,`rules/events/${s}/${year}/${m.events[name].slug}.json`);if(!ev?.docs)continue;for(const d of Object.values(ev.docs)){
   if(d.published&&date(d.published)>asOf)continue;const fresh=freshness(status,d.source_id);
   const docScore=scoreArticle({n:'',h:d.title,x:d.excerpt||'',k:d.keywords||[]},q);
   if(docScore>0)hits.push({score:docScore+1,series:s,kind:'event_document',event:name,document:d.title,category:d.category,number:d.number,published:d.published,recalled:!!d.recalled,page:1,excerpt:d.excerpt||null,url:d.url,freshness:fresh});
   if(d.article_count)for(const a of await articlesOf(env,d)){const score=scoreArticle(a,q);if(score>0)hits.push({score,series:s,kind:'event_document',event:name,document:d.title,category:d.category,published:d.published,recalled:!!d.recalled,article:a.n,heading:a.h,page:a.p,excerpt:a.x,url:pageUrl(d.url,a.p),freshness:fresh});}
  }}
 }
 hits.sort((a,b)=>b.score-a.score);
 const top=hits.slice(0,limit).map(({score,...h})=>h);
 const stale=top.some(h=>h.freshness.check_status!=='ok');
 return {index_status:'ok',as_of:asOf,season,series_searched:series,unknown_series:unknown.length?unknown:undefined,total_matches:hits.length,hits:top,
  ...(top.length?{}:{message:'No indexed article matched. Try another wording, an article number, or open the rulebook with fia_list_regulations.'}),
  ...(stale?{freshness_warning:'At least one source was not checked successfully on its last run; verify on the official page.'}:{}),
  note:'Excerpts are short search aids from the official documents, not full rule text. Check the linked page for exact wording.'};
}
export async function rulesCall(name,args,env){
 if(name!=='rules_lookup')throw Error('Unknown rules tool');
 return {content:[{type:'text',text:JSON.stringify(await rulesLookup(env,args))}],isError:false};
}

// ---------- automatic rule context for analysis results ----------
// When an analysis result mentions a regulated situation (deleted laps, SC/VSC, penalties...),
// attach the matching indexed articles so the answer can cite the rule without another call.
const CONTEXT_TOPICS=[
 ['track limits',/track limits|lap (?:time )?deleted|deleted lap|leaving the track/i],
 ['safety car',/\bsafety car\b|\bSC (?:DEPLOYED|ENDING|IN THIS LAP)/i],
 ['virtual safety car',/virtual safety car|\bVSC\b/],
 ['full course yellow',/full course yellow|\bFCY\b|code 60/i],
 ['red flag',/red flag|session suspended|race suspended/i],
 ['penalty',/penalt|drive.?through|stop.?(?:and.?)?go|reprimand|grid (?:drop|place)/i],
 ['blue flags',/blue flag/i],
 ['yellow flags',/double yellow|yellow flag/i],
 ['pit lane',/unsafe release|pit lane speed|speeding in the pit/i],
 ['start procedure',/false start|jump start|aborted start/i]
];
export function contextSeries(toolName,args={}){
 if(/^(?:fastf1_|openf1_|fia_|kongboda_live)/.test(toolName))return 'f1';
 if(/^wec_/.test(toolName))return 'wec';
 if(toolName.startsWith('motorsport_')&&typeof args.series==='string')return seriesFrom(args.series);
 return null;
}
export function contextTopics(text){const t=String(text||'').slice(0,200_000);return CONTEXT_TOPICS.filter(([,rx])=>rx.test(t)).map(([n])=>n).slice(0,3);}
export async function rulesContext(env,toolName,args,result,{timeoutMs=1500}={}){
 if(!env?.BUCKET)return null;const series=contextSeries(toolName,args);if(!series)return null;
 const text=(result?.content||[]).map(c=>c.type==='text'?c.text:'').join('\n');const topics=contextTopics(text);if(!topics.length)return null;
 const work=(async()=>{const out=[];for(const topic of topics){const r=await rulesLookup(env,{query:topic,series,kind:'regulations',limit:2});if(r.index_status!=='ok'||!r.hits.length)continue;out.push({topic,hits:r.hits.map(h=>({document:h.document,issue:h.issue,article:h.article,heading:h.heading,page:h.page,url:h.url,last_checked:h.freshness?.last_checked??null}))});}return out.length?{series,topics:out,note:'Matched from the rules index; open the cited page before quoting exact wording.'}:null;})();
 return Promise.race([work.catch(()=>null),new Promise(r=>setTimeout(()=>r(null),timeoutMs))]);
}
export function attachRulesContext(result,context){
 if(!context||!result||result.isError)return result;const first=result.content?.[0];
 if(first?.type==='text'){try{const v=JSON.parse(first.text);if(v&&typeof v==='object'&&!Array.isArray(v))return {...result,content:[{...first,text:JSON.stringify({...v,rules_context:context})},...result.content.slice(1)]};}catch{}}
 return {...result,content:[...(result.content||[]),{type:'text',text:JSON.stringify({rules_context:context})}]};
}
