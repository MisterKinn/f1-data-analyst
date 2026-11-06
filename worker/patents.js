// Automotive technology patents (EPO Open Patent Services). The rules monitor Action asks this
// server for a short-lived OPS token (GitHub OIDC), searches new publications by company and
// technology class, and posts compact records here. patents_lookup answers from that index.
// The owner's EPO consumer key/secret stay in site storage and never leave the server.
import {verifyCollectorToken,RULES_MONITOR_WORKFLOW} from './github-oidc.js';
import {tokenize} from './rules-lib.js';

const ro={readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false};
export const PATENT_TOOLS=[{name:'patents_lookup',
 description:'Search the indexed recent patent publications (EPO worldwide data: EP, US, WO, DE, IT, JP, KR, CN...) from carmakers, F1/WEC/IMSA manufacturers and tyre makers, e.g. Ferrari, Porsche, Tesla, Mercedes, Toyota, Hyundai, Pirelli. Query in Korean or English by company and technology (engine, hybrid, battery, aero, suspension, brakes, tyres, hydrogen...). Returns publication number, applicant, dates, classes, title, short abstract and link. A patent shows what a company protects, not what it builds or races.',
 inputSchema:{type:'object',properties:{query:{type:'string',minLength:1,maxLength:200},applicant:{type:'string',maxLength:60},since:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'},limit:{type:'integer',minimum:1,maximum:15}},required:['query'],additionalProperties:false},annotations:ro}];
export const PATENT_INSTRUCTIONS=' PATENTS: for questions about carmakers\' or racing manufacturers\' technology (engines, hybrid/EV systems, batteries, aero, chassis, brakes, tyres), call patents_lookup and use it as supporting background after the regulation and driving-theory evidence. Say "patent published" with number and date; never present a patent as a confirmed product, race-car part or performance gain. New applications are usually published about 18 months after filing.';

const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
const KEY='settings/epo-ops';
export async function opsStatus(env){const o=env.BUCKET&&await env.BUCKET.get(KEY);const v=o?await o.json():null;return v?.key?{configured:true,updated_at:v.updated_at}:{configured:false};}
export async function saveOpsKey(env,key,secret){
 const k=String(key||'').trim(),s=String(secret||'').trim();
 if(!k){await env.BUCKET.delete(KEY);return {configured:false};}
 if(!/^[A-Za-z0-9_-]{8,100}$/.test(k)||!/^[A-Za-z0-9_\-+/=]{8,200}$/.test(s))throw Error('EPO consumer key/secret 형식이 아닙니다.');
 await env.BUCKET.put(KEY,JSON.stringify({key:k,secret:s,updated_at:new Date().toISOString()}));return {configured:true};
}
// POST /api/patents/ops-token (OIDC): exchange the stored key for a 20-minute OPS token.
export async function opsToken(request,env,{verify=t=>verifyCollectorToken(t,{workflow:RULES_MONITOR_WORKFLOW}),fetcher=fetch}={}){
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 try{await verify((request.headers.get('authorization')||'').replace(/^Bearer /,''));}catch{return json({error:'Monitor token rejected'},401);}
 const o=env.BUCKET&&await env.BUCKET.get(KEY);const v=o?await o.json():null;if(!v?.key)return json({error:'EPO OPS key not configured'},503);
 const r=await fetcher('https://ops.epo.org/3.2/auth/accesstoken',{method:'POST',headers:{authorization:'Basic '+btoa(v.key+':'+v.secret),'content-type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials',signal:AbortSignal.timeout(15000)});
 const t=await r.json().catch(()=>null);if(!r.ok||!t?.access_token)return json({error:'EPO token request failed ('+r.status+')'},502);
 return json({access_token:t.access_token,expires_in:Number(t.expires_in)||1200});
}

const shardKey=month=>`patents/${month}.json`;
function checkPatent(p){
 if(!p||typeof p.number!=='string'||!/^[A-Z]{2}[A-Z0-9.]{3,20}$/.test(p.number))throw Error('Invalid patent number');
 if(typeof p.title!=='string'||p.title.length>400||(p.abstract&&String(p.abstract).length>700))throw Error('Invalid patent text');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(p.published||'')))throw Error('Invalid publication date');
 return p;
}
// POST /api/patents/ingest (OIDC) {patents:[...], watch:{...}}
export async function patentsIngest(request,env,{verify=t=>verifyCollectorToken(t,{workflow:RULES_MONITOR_WORKFLOW})}={}){
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 try{await verify((request.headers.get('authorization')||'').replace(/^Bearer /,''));}catch{return json({error:'Monitor token rejected'},401);}
 if(!env.BUCKET)return json({error:'Storage unavailable'},503);
 const text=await request.text();if(text.length>3_000_000)return json({error:'Batch too large'},413);
 let body;try{body=JSON.parse(text);}catch{return json({error:'Invalid JSON'},400);}
 const list=Array.isArray(body.patents)?body.patents.slice(0,2000):[];try{list.forEach(checkPatent);}catch(e){return json({error:e.message},400);}
 const now=new Date().toISOString(),byMonth=new Map();for(const p of list){const m=p.published.slice(0,7);(byMonth.get(m)||byMonth.set(m,[]).get(m)).push(p);}
 const catO=await env.BUCKET.get('patents/catalog.json'),cat=catO?await catO.json():{months:[]};
 for(const [m,items] of byMonth){
  const o=await env.BUCKET.get(shardKey(m)),cur=o?await o.json():{month:m,items:{}};
  for(const p of items)cur.items[p.number]={number:p.number,title:p.title,abstract:p.abstract?String(p.abstract).slice(0,600):null,applicants:(p.applicants||[]).slice(0,6).map(String),cpc:(p.cpc||[]).slice(0,12).map(String),published:p.published,priority:p.priority||null,watch:String(p.watch||'').slice(0,40),url:`https://worldwide.espacenet.com/patent/search?q=pn%3D${encodeURIComponent(p.number)}`,stored_at:now};
  cur.updated_at=now;const s=JSON.stringify(cur);if(s.length>800_000)return json({error:`Patent shard ${m} too large`},507);await env.BUCKET.put(shardKey(m),s);
  if(!cat.months.includes(m))cat.months.push(m);
 }
 cat.months.sort();cat.updated_at=now;if(body.watch&&typeof body.watch==='object')cat.last_watch={at:now,status:String(body.watch.status||''),error:body.watch.error?String(body.watch.error).slice(0,200):null,found:Number(body.watch.found)||0};
 await env.BUCKET.put('patents/catalog.json',JSON.stringify(cat));
 return json({ok:true,patents:list.length});
}

export async function patentRoutes(request,env){
 const path=new URL(request.url).pathname;
 if(path==='/api/patents/ops-token')return opsToken(request,env);
 if(path==='/api/patents/ingest')return patentsIngest(request,env);
 return null;
}

// ---------- lookup ----------
const TECH={engine:['엔진','engine','combustion','내연'],turbo:['터보','turbo','turbocharger','compressor'],hybrid:['하이브리드','hybrid','mgu','energy recovery'],battery:['배터리','battery','cell','accumulator'],'electric motor':['모터','electric motor','e-axle','inverter'],hydrogen:['수소','hydrogen','fuel cell'],aerodynamic:['공력','에어로','aero','aerodynamic','wing','diffuser','downforce'],suspension:['서스펜션','suspension','damper','shock absorber'],brake:['브레이크','brake','braking','regenerative'],tyre:['타이어','tyre','tire','tread'],transmission:['변속기','transmission','gearbox','clutch'],cooling:['냉각','cooling','radiator','thermal management'],steering:['조향','steering'],chassis:['섀시','chassis','monocoque','carbon']};
const COMPANIES={ferrari:['페라리','ferrari'],porsche:['포르쉐','porsche'],tesla:['테슬라','tesla'],mercedes:['메르세데스','벤츠','mercedes'],toyota:['토요타','도요타','toyota'],hyundai:['현대','hyundai'],kia:['기아','kia'],mclaren:['맥라렌','mclaren'],'red bull':['레드불','red bull'],honda:['혼다','honda'],audi:['아우디','audi'],bmw:['bmw'],'aston martin':['애스턴','aston martin'],ford:['포드','ford'],'general motors':['gm','general motors','cadillac','캐딜락'],pirelli:['피렐리','pirelli'],michelin:['미쉐린','michelin'],bridgestone:['브리지스톤','bridgestone'],goodyear:['굿이어','goodyear'],peugeot:['푸조','peugeot','stellantis'],lamborghini:['람보르기니','lamborghini'],alpine:['알핀','alpine','renault']};
function expand(q){
 const s=String(q||'').toLowerCase(),terms=new Set(tokenize(s)),companies=[];
 for(const [k,al] of Object.entries(TECH))if(al.some(a=>s.includes(a)))for(const a of al)if(/^[\x00-\x7f]+$/.test(a))terms.add(a);
 for(const [k,al] of Object.entries(COMPANIES))if(al.some(a=>s.includes(a))){companies.push(k);terms.delete(k);for(const a of al)terms.delete(a);}
 return {terms:[...terms].filter(t=>!COMPANIES[t]),companies};
}
export async function patentsLookup(env,args={}){
 if(!env.BUCKET)return {index_status:'storage_unavailable',hits:[]};
 const catO=await env.BUCKET.get('patents/catalog.json'),cat=catO?await catO.json():null;
 if(!cat?.months?.length)return {index_status:'index_empty',message:'No patents indexed yet (the EPO key may not be configured).',hits:[]};
 const q=expand(args.query),applicant=args.applicant?String(args.applicant).toLowerCase():null,since=args.since||null,limit=args.limit||8,hits=[];
 for(const m of cat.months.slice(-18).reverse()){
  if(since&&m<since.slice(0,7))continue;const o=await env.BUCKET.get(shardKey(m));if(!o)continue;const shard=await o.json();
  for(const p of Object.values(shard.items)){
   if(since&&p.published<since)continue;const apps=p.applicants.join(' ').toLowerCase();
   if(applicant&&!apps.includes(applicant))continue;
   if(q.companies.length&&!q.companies.some(c=>(COMPANIES[c]||[c]).some(a=>/^[\x00-\x7f]+$/.test(a)&&apps.includes(a))))continue;
   const hay=(p.title+' '+(p.abstract||'')+' '+p.cpc.join(' ')).toLowerCase();let score=q.terms.length?0:1;for(const t of q.terms)if(hay.includes(t))score+=p.title.toLowerCase().includes(t)?3:1;
   if(score>0)hits.push({score,...p});
  }
 }
 hits.sort((a,b)=>b.score-a.score||b.published.localeCompare(a.published));
 return {index_status:'ok',months_indexed:cat.months.length,last_watch:cat.last_watch||null,total_matches:hits.length,hits:hits.slice(0,limit).map(({score,stored_at,...h})=>h),note:'Patent publications only: protection sought, not a confirmed product or race part. Check the Espacenet link for the full text and legal status.'};
}
export async function patentsCall(name,args,env){if(name!=='patents_lookup')throw Error('Unknown patents tool');return {content:[{type:'text',text:JSON.stringify(await patentsLookup(env,args))}],isError:false};}

// ---------- EPO OPS biblio JSON -> compact records (used by the monitor) ----------
const arr=v=>v==null?[]:Array.isArray(v)?v:[v];
const val=v=>v==null?'':typeof v==='object'?String(v.$??''):String(v);
export function parseOpsBiblio(json,watch=''){
 const res=json?.['ops:world-patent-data']?.['ops:biblio-search']?.['ops:search-result'];
 const total=Number(json?.['ops:world-patent-data']?.['ops:biblio-search']?.['@total-result-count'])||0;
 const out=[];
 for(const ex of arr(res?.['exchange-documents'])){
  for(const d of arr(ex?.['exchange-document'])){
   const b=d?.['bibliographic-data']||{};
   const docdb=arr(b['publication-reference']?.['document-id']).find(x=>x?.['@document-id-type']==='docdb')||arr(b['publication-reference']?.['document-id'])[0]||{};
   const number=(d['@country']||val(docdb.country))+(d['@doc-number']||val(docdb['doc-number']))+(d['@kind']||val(docdb.kind));
   const dRaw=val(docdb.date);const published=/^\d{8}$/.test(dRaw)?`${dRaw.slice(0,4)}-${dRaw.slice(4,6)}-${dRaw.slice(6,8)}`:null;
   const titles=arr(b['invention-title']);const title=val(titles.find(t=>t?.['@lang']==='en')||titles[0]);
   const abs=arr(d.abstract);const ab=abs.find(a=>a?.['@lang']==='en')||abs[0];const abstract=ab?arr(ab.p).map(val).join(' ').replace(/\s+/g,' ').trim():null;
   const apps=arr(b.parties?.applicants?.applicant).filter(a=>a?.['@data-format']!=='original'||true).map(a=>val(a?.['applicant-name']?.name)).filter(Boolean);
   const cpc=arr(b['patent-classifications']?.['patent-classification']).map(c=>[val(c.section),val(c.class),val(c.subclass),val(c['main-group'])].join('')+(val(c.subgroup)?'/'+val(c.subgroup):'')).filter(Boolean);
   const pr=arr(b['priority-claims']?.['priority-claim']).map(p=>val(arr(p['document-id'])[0]?.date)).filter(x=>/^\d{8}$/.test(x)).sort()[0];
   if(!number||!title||!published)continue;
   out.push({number:number.replace(/\s+/g,''),title:title.slice(0,400),abstract:abstract?abstract.slice(0,600):null,applicants:[...new Set(apps)].slice(0,6),cpc:[...new Set(cpc)].slice(0,12),published,priority:pr?`${pr.slice(0,4)}-${pr.slice(4,6)}-${pr.slice(6,8)}`:null,watch});
  }
 }
 return {total,patents:out};
}
