// Automatic alerts for new official F1 documents (FIA event documents incl. Pirelli preview).
// A check runs every ~10 minutes during a race weekend (GitHub schedule + on-read from the
// connector). New important documents are read, summarised by Claude (headline, facts,
// interpretation) and pushed to every signed-in account that allowed notifications.
// State per event: doc-alerts/f1/<year>/<slug>. Nothing here guesses facts missing from the PDF.
import {calendarEvents} from './race-calendar-data.js';
import {eventDocuments,fiaDocumentText} from './fia.js';
import {broadcast,sha256Hex,accountPushState} from './web-push.js';

const CHECK_GAP_MS=3*60_000,MAX_PER_RUN=3,MAX_TRIES=3,RECENT_MS=48*3600_000;
const DAY=86400_000;
const ro={readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true};

export const DOC_ALERT_TOOLS=[{name:'fia_event_updates',description:'New official documents for the current (or a named) F1 weekend: FIA power unit information, Pirelli preview, race director notes, car upgrades and steward decisions, each already read and summarised (headline, key facts, short interpretation) with the original link. Call it first for any question about this weekend\'s PU/energy limits, tyres, track notes, upgrades or penalties.',
 inputSchema:{type:'object',properties:{year:{type:'integer',minimum:2023,maximum:2100},event:{type:'string',maxLength:80,description:'FIA event name, e.g. "São Paulo Grand Prix". Default: current weekend.'},include_routine:{type:'boolean',description:'Also list routine documents (timetable, visa, car display).'}},additionalProperties:false},annotations:ro}];

export const DOC_ALERT_INSTRUCTIONS=' OFFICIAL DOCUMENT ALERTS: during a race weekend, F1 tool results may carry official_updates (new FIA/Pirelli documents the server already read and summarised). Mention new ones briefly at the start of the answer (headline + one fact), once per conversation, and link the original. For this weekend\'s PU/energy limits, tyres, race director notes, upgrades or penalties call fia_event_updates first. If a result carries alerts_setup, tell the user once that phone notifications for new documents can be turned on at that link. Summaries are server-written from the PDF; quote the PDF for exact wording.';

// ---------- event and classification ----------
export function currentF1Event(now=Date.now()){
 const open=calendarEvents.filter(e=>e.series==='f1').filter(e=>{const s=Date.parse(e.start+'T00:00:00Z')-4*DAY,t=Date.parse((e.end||e.start)+'T23:59:59Z')+2*DAY;return now>=s&&now<=t;});
 const e=open.sort((a,b)=>a.start.localeCompare(b.start)).at(-1);
 if(!e)return null;
 return {year:Number(e.start.slice(0,4)),name:e.nameEn,name_ko:e.name,short_ko:String(e.name).replace(/\s*그랑프리$/,' GP'),short_en:String(e.nameEn).replace(/Grand Prix$/,'GP'),id:e.id};
}
const SKIP=/visa|timetable|car display procedure|entry list|appointment|accreditation|biograph|circuit map|scrutineering|press conference|media|provisional|lap (?:chart|analysis|times)|history chart|speed trap|best sector|pit stop summary|fastest laps|maximum speeds|sector times|parc ferm[ée]/i;
const RULES=[
 ['pirelli',/pirelli/i],
 ['pu',/power unit|\bpu\b|energy store|gearbox|exhaust/i],
 ['decision',/decision|offence|infringement|summons|penalty|reprimand|disqualif|right of review|appeal/i],
 ['updates',/car presentation|presentation submission|upgrade/i],
 ['classification',/(?:final|corrected|amended|revised).*(?:classification|starting grid)/i],
 ['race_director',/race director|competition notes|event notes|track limits|pit lane|drivers?['’]? (?:meeting|briefing)|notes? to teams/i]
];
export function classify(title){
 const t=String(title||'');for(const [c,rx] of RULES)if(rx.test(t))return c;
 return SKIP.test(t)?'skip':'unknown';
}
const LABEL={ko:{pu:'PU 정보',pirelli:'피렐리 프리뷰',race_director:'레이스 디렉터 노트',updates:'차량 업데이트 자료',decision:'스튜어드 결정',classification:'수정 분류',other:'공식 문서'},en:{pu:'power unit information',pirelli:'Pirelli preview',race_director:'race director notes',updates:'car upgrade submissions',decision:'steward decision',classification:'corrected classification',other:'official document'}};
const slug=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const stateKey=ev=>`doc-alerts/f1/${ev.year}/${slug(ev.name)}`;

// ---------- Claude summary ----------
async function aiSettings(env){
 if(env.ANTHROPIC_API_KEY)return {key:env.ANTHROPIC_API_KEY,model:env.ANTHROPIC_MODEL||'claude-sonnet-5-5',source:'env'};
 const o=env.BUCKET&&await env.BUCKET.get('settings/anthropic');const v=o?await o.json():null;
 return v?.key?{key:v.key,model:v.model||env.ANTHROPIC_MODEL||'claude-sonnet-5-5',source:'stored'}:null;
}
export async function aiStatus(env){const s=await aiSettings(env);return s?{configured:true,source:s.source,model:s.model}:{configured:false};}
export async function saveAiKey(env,key,model){
 const k=String(key||'').trim(),m=String(model||'').trim();
 if(!k){await env.BUCKET.delete('settings/anthropic');return {configured:false};}
 if(!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(k))throw Error('Anthropic API 키 형식이 아닙니다.');
 if(m&&!/^[a-z0-9.-]{3,60}$/.test(m))throw Error('모델 ID 형식이 아닙니다.');
 await env.BUCKET.put('settings/anthropic',JSON.stringify({key:k,model:m||null,updated_at:new Date().toISOString()}));
 return {configured:true};
}

const SYSTEM=`You write short technical alerts about official Formula 1 documents (FIA event documents, Pirelli previews) for Korean F1 fans.
Rules:
- Use only facts present in the document text. Copy numbers and units exactly. Never invent values, causes, penalties or team intentions.
- "Power Unit Information" gives energy/power limits and sector exceptions; it is NOT a parts-usage list. Never infer grid penalties from part counts.
- "Car Display Procedure" is not an upgrade list. A case "noted" or "under investigation" is not a decision.
- Facts and interpretation are separate. The interpretation is 1-2 sentences on what it may mean for racing, strategy or setup, phrased conditionally, with no new numbers.
- Set notify=false for routine administration (timetables, visas, accreditation, procedures without sporting effect).
Return ONLY a JSON object:
{"notify":true,"category":"pu|pirelli|race_director|updates|decision|classification|other",
 "ko":{"headline":"Korean, max 32 characters, starts with the event short name, e.g. \\"상파울루 GP PU 운용 한도 공개\\"","facts":["1-3 Korean sentences with the key numbers"],"interpretation":"Korean, 1-2 sentences, or empty"},
 "en":{"headline":"English, max 60 characters","facts":["1-3 English sentences"],"interpretation":"English, or empty"}}`;

const clip=(s,n)=>{s=String(s||'').trim();return s.length>n?s.slice(0,n-1)+'…':s;};
function cleanLang(v,fallback){
 if(!v||typeof v!=='object')return fallback;
 const facts=(Array.isArray(v.facts)?v.facts:[]).map(x=>clip(x,160)).filter(Boolean).slice(0,3);
 return {headline:clip(v.headline,70)||fallback.headline,facts:facts.length?facts:fallback.facts,interpretation:clip(v.interpretation,240)};
}
export function parseSummary(text,fallback){
 const s=String(text||''),a=s.indexOf('{'),b=s.lastIndexOf('}');if(a<0||b<a)throw Error('Summary was not JSON');
 const v=JSON.parse(s.slice(a,b+1));
 return {notify:v.notify!==false,category:Object.keys(LABEL.ko).includes(v.category)?v.category:fallback.category,ko:cleanLang(v.ko,fallback.ko),en:cleanLang(v.en,fallback.en),ai:true};
}
export function factsOnly(ev,doc,category){
 const c=category==='unknown'?'other':category,n=doc.document_number?`Doc ${doc.document_number} · `:'';
 return {notify:true,category:c,ai:false,
  ko:{headline:`${ev.short_ko} ${LABEL.ko[c]} 공개`,facts:[`FIA ${n}${doc.title}`],interpretation:''},
  en:{headline:`${ev.short_en}: ${LABEL.en[c]} published`,facts:[`FIA ${n}${doc.title}`],interpretation:''}};
}
async function summarise(env,ai,ev,doc,category,{fetchImpl=fetch,readText=fiaDocumentText}={}){
 const text=(await readText(doc.url,4)).slice(0,14000);
 const fallback=factsOnly(ev,doc,category);
 const res=await fetchImpl('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':ai.key,'anthropic-version':'2023-06-01'},
  body:JSON.stringify({model:ai.model,max_tokens:900,system:SYSTEM,messages:[{role:'user',content:`Event: ${ev.name} (${ev.short_ko})\nDocument: ${doc.title}\nPublished: ${doc.published||'unknown'}\nCategory guess: ${category}\n\nDocument text:\n${text}`}]})});
 if(!res.ok)throw Error('Claude API '+res.status);
 const body=await res.json();
 return parseSummary(body.content?.map(c=>c.text||'').join('')||'',fallback);
}

// ---------- state ----------
async function readJson(env,key){const o=await env.BUCKET.get(key);return o?await o.json():null;}
async function claim(env,now,force){
 const take=async b=>{const lock=await (async()=>{const o=await b.get('doc-alerts/lock');return o?await o.json():null;})();if(!force&&lock&&now-lock.at<CHECK_GAP_MS)return false;await b.put('doc-alerts/lock',JSON.stringify({at:now}));return true;};
 return env.BUCKET.atomic?env.BUCKET.atomic(take):take(env.BUCKET);
}
export async function eventState(env,ev){return await readJson(env,stateKey(ev))||{event:ev.name,event_ko:ev.name_ko,year:ev.year,seen:{},alerts:[]};}

const pushMessage=(alert,ev)=>lang=>{const l=alert[lang==='en'?'en':'ko'],why=l.interpretation?`\n${lang==='en'?'Why it matters':'해석'}: ${l.interpretation}`:'';
 return {title:l.headline,body:clip(l.facts.join(' ')+why,300),url:`/alerts#${alert.id}`,tag:alert.id,event:ev.name};};

export async function runCheck(env,{now=Date.now(),force=false,fetchImpl=fetch,event=null,listDocs=eventDocuments,readText=fiaDocumentText}={}){
 if(!env.BUCKET)return {state:'disabled',reason:'no storage'};
 const ev=event||currentF1Event(now);if(!ev)return {state:'idle',reason:'no F1 weekend in progress'};
 if(!await claim(env,now,force))return {state:'throttled',event:ev.name};
 const listing=await listDocs(ev.year,ev.name);
 if(!listing)return {state:'waiting',event:ev.name,reason:'FIA has not published this event page yet'};
 const state=await eventState(env,ev),ai=await aiSettings(env),created=[];
 const fresh=listing.records.filter(d=>d.url&&!d.recalled&&!['alerted','skipped'].includes(state.seen[d.url]?.status))
  .sort((a,b)=>(Number(a.document_number)||0)-(Number(b.document_number)||0));
 let done=0;
 for(const doc of fresh){
  const category=classify(doc.title);
  if(category==='skip'||(category==='unknown'&&!ai)){state.seen[doc.url]={status:'skipped',category,at:new Date(now).toISOString()};continue;}
  if(done>=MAX_PER_RUN)break;done++;
  let summary;const tries=(state.seen[doc.url]?.tries||0)+1;
  try{summary=ai?await summarise(env,ai,ev,doc,category,{fetchImpl,readText}):factsOnly(ev,doc,category);}
  catch(e){if(tries<MAX_TRIES){state.seen[doc.url]={status:'retry',tries,error:String(e.message).slice(0,120)};continue;}summary=category==='unknown'?null:factsOnly(ev,doc,category);}
  if(!summary||!summary.notify){state.seen[doc.url]={status:'skipped',category,at:new Date(now).toISOString()};continue;}
  const alert={id:(await sha256Hex(doc.url)).slice(0,12),url:doc.url,title:doc.title,document_number:doc.document_number,published:doc.published,version:doc.version,category:summary.category,ai:summary.ai,ko:summary.ko,en:summary.en,created_at:new Date(now).toISOString()};
  state.alerts.unshift(alert);state.seen[doc.url]={status:'alerted',id:alert.id};created.push(alert);
 }
 state.alerts=state.alerts.slice(0,60);state.updated_at=new Date(now).toISOString();
 await env.BUCKET.put(stateKey(ev),JSON.stringify(state));
 for(const alert of created){
  try{alert.push=await broadcast(env,pushMessage(alert,ev),{fetchImpl});}catch(e){alert.push={error:String(e.message).slice(0,120)};}
 }
 if(created.length){const latest=await eventState(env,ev);for(const a of latest.alerts){const c=created.find(x=>x.id===a.id);if(c)a.push=c.push;}await env.BUCKET.put(stateKey(ev),JSON.stringify(latest));}
 return {state:'checked',event:ev.name,new_alerts:created.length,pending:fresh.filter(d=>!['alerted','skipped'].includes(state.seen[d.url]?.status)).length,ai:!!ai};
}

// ---------- connector ----------
const brief=a=>({id:a.id,category:a.category,ko:a.ko,en:a.en,document:{title:a.title,number:a.document_number,published:a.published,url:a.url},summary_by:a.ai?'Claude (from the PDF text)':'title only'});
export async function officialUpdates(env,{now=Date.now(),account=null,origin=''}={}){
 if(!env.BUCKET)return null;const ev=currentF1Event(now);if(!ev)return null;
 const state=await readJson(env,stateKey(ev));const recent=(state?.alerts||[]).filter(a=>now-Date.parse(a.created_at)<RECENT_MS).slice(0,5);
 if(!recent.length)return null;
 const out={event:ev.name,alerts:recent.map(brief)};
 if(account){try{const s=await accountPushState(env,account);if(!s.devices&&!s.off)out.alerts_setup=`${origin||'https://kongboda-motorsports.vercel.app'}/alerts`;}catch{}}
 return out;
}

export async function eventUpdatesCall(env,args,{now=Date.now(),ctx=null,origin=''}={}){
 const cur=currentF1Event(now);
 const ev=args.event?{...(cur&&cur.name.toLowerCase()===args.event.toLowerCase()?cur:{short_ko:args.event,short_en:args.event,name_ko:args.event}),year:args.year||cur?.year||new Date(now).getUTCFullYear(),name:args.event}:cur;
 if(!ev)return {content:[{type:'text',text:JSON.stringify({state:'idle',reason:'No F1 weekend is in progress. Pass year and event (FIA name) for another weekend.'})}],isError:false};
 const listing=await eventDocuments(ev.year,ev.name);
 if(!listing)return {content:[{type:'text',text:JSON.stringify({state:'waiting',event:ev.name,reason:'FIA has not published this event page yet.'})}],isError:false};
 const state=env.BUCKET?await eventState(env,ev):{alerts:[],seen:{}};
 const documents=listing.records.filter(d=>!d.recalled).map(d=>({number:d.document_number,title:d.title,published:d.published,url:d.url,category:classify(d.title),alert_id:state.seen[d.url]?.id||null}))
  .filter(d=>args.include_routine||d.category!=='skip');
 if(cur&&ev.name===cur.name&&env.BUCKET){const job=runCheck(env,{now}).catch(()=>null);if(ctx?.waitUntil)ctx.waitUntil(job);}
 const out={state:'ready',source:'FIA official event documents',event:listing.event,event_url:listing.url,alerts:state.alerts.slice(0,20).map(brief),documents,
  notes:['Documents without alert_id are not summarised yet (new, or routine). Read them with fia_read_document.','Phone notifications: '+(origin||'https://kongboda-motorsports.vercel.app')+'/alerts']};
 return {content:[{type:'text',text:JSON.stringify(out)}],isError:false};
}
