#!/usr/bin/env node
// Reads official regulation and race-document sources, detects new or changed documents,
// parses PDFs into an article index and posts the result to the site with a GitHub OIDC
// token. Runs in GitHub Actions (.github/workflows/rules-monitor.yml); nothing here runs
// inside the website or the connector, so a slow or failing source never slows answers.
//
//   node scripts/rules-monitor.mjs [--dry-run] [--source=<id>] [--force] [--max-downloads=N]
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {getDocument} from 'unpdf/pdfjs';
import {calendarEvents} from '../worker/race-calendar-data.js';
import * as L from '../worker/rules-lib.js';

const args=Object.fromEntries(process.argv.slice(2).map(a=>{const [k,v]=a.replace(/^--/,'').split('=');return [k,v??true];}));
const DRY=!!args['dry-run'],FORCE=!!args.force,ONLY=args.source||null;
const SITE=process.env.RULES_SITE||'https://kongboda-motorsports.vercel.app';
const MAX_DOWNLOADS=Number(args['max-downloads']||process.env.RULES_MAX_DOWNLOADS||60);
const DEADLINE=Date.now()+Number(process.env.RULES_MAX_MINUTES||25)*60_000;
const UA='KongbodaRulesMonitor/1.0 (+https://kongboda-motorsports.vercel.app; official-document index)';
const HOUR=3600_000,DAY=24*HOUR;
const registry=JSON.parse(await readFile(process.env.RULES_SOURCES||new URL('../knowledge/rules-sources.json',import.meta.url),'utf8'));

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const lastHit=new Map();
async function polite(url){const host=new URL(url).host,wait=(lastHit.get(host)||0)+1500-Date.now();if(wait>0)await sleep(wait);lastHit.set(host,Date.now());}
async function get(url,{headers={},max=30_000_000,timeout=45_000}={}){
 await polite(url);
 const r=await fetch(url,{headers:{'user-agent':UA,accept:'text/html,application/pdf,*/*',...headers},redirect:'follow',signal:AbortSignal.timeout(timeout)});
 if(r.status===304)return {status:304};
 if(!r.ok)throw Error(`HTTP ${r.status} for ${url}`);
 const len=Number(r.headers.get('content-length')||0);if(len>max)throw Error(`File too large (${len} bytes)`);
 const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length>max)throw Error('File too large');
 return {status:r.status,bytes,etag:r.headers.get('etag'),lm:r.headers.get('last-modified'),type:r.headers.get('content-type')||'',url:r.url};
}
const text=b=>new TextDecoder().decode(b);
const sha=b=>createHash('sha256').update(b).digest('hex');
const idFor=(url,hash)=>sha(Buffer.from(url)).slice(0,16)+'-'+hash.slice(0,10);

async function api(path,body){
 const headers={'content-type':'application/json','user-agent':UA};
 if(body){const tok=await oidc();if(tok)headers.authorization='Bearer '+tok;}
 const r=await fetch(SITE+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60_000)});
 const out=await r.json().catch(()=>({}));if(!r.ok)throw Error(`${path}: HTTP ${r.status} ${out.error||''}`);return out;
}
async function oidc(){
 const u=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,t=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;if(!u||!t)return null;
 const r=await fetch(u+'&audience=kongboda-motorsports',{headers:{authorization:'Bearer '+t}});if(!r.ok)throw Error('OIDC token request failed');return (await r.json()).value;
}

// Race weekend window per series, from the site's own calendar.
function inRaceWindow(source,now=Date.now()){
 const cal=source.calendar||source.series;
 return calendarEvents.some(e=>e.series===cal&&now>=Date.parse(e.start+'T00:00:00Z')-4*DAY&&now<=Date.parse((e.end||e.start)+'T23:59:59Z')+2*DAY);
}
export function intervalFor(source,now=Date.now()){
 if(source.kind==='event_documents')return inRaceWindow(source,now)?15*60_000:12*HOUR;
 return inRaceWindow(source,now)?6*HOUR:DAY;
}
const due=(source,status,now=Date.now())=>FORCE||!status?.checked_at||now-Date.parse(status.checked_at)>=intervalFor(source,now)-60_000;

// PDF -> [{page,text}] with lines rebuilt from text positions.
export async function pdfPages(bytes,maxPages=400){
 const pdf=await getDocument({data:bytes,isEvalSupported:false,disableFontFace:true,useSystemFonts:false,useWasm:false,maxImageSize:0,verbosity:0}).promise;
 try{
  const pages=[],n=Math.min(pdf.numPages,maxPages);
  for(let i=1;i<=n;i++){const p=await pdf.getPage(i),c=await p.getTextContent(),rows=[];
   for(const it of c.items){if(typeof it.str!=='string'||!it.str.trim())continue;const y=Math.round(it.transform[5]);let row=rows.find(r=>Math.abs(r.y-y)<=2);if(!row){row={y,items:[]};rows.push(row);}row.items.push({x:it.transform[4],t:it.str});}
   rows.sort((a,b)=>b.y-a.y);pages.push({page:i,text:rows.map(r=>r.items.sort((a,b)=>a.x-b.x).map(x=>x.t).join(' ')).join('\n')});p.cleanup();}
  return {pages,total:pdf.numPages};
 }finally{await pdf.destroy?.();}
}

// Listing -> candidate documents.
export async function candidates(source,now=new Date()){
 if(source.adapter==='single_pdf')return [{url:source.url,title:source.title,published:null}];
 const page=await get(source.url,{max:8_000_000});const html=text(page.bytes),base=page.url||source.url;
 if(source.adapter==='fia_regulations'){
  const year=now.getUTCFullYear(),min=source.min_year??year;
  return L.parseFiaRegulations(html,base).filter(d=>{const y=L.regulationYear(d.title)||Number(String(d.published||'').slice(0,4));return !y||y>=min;}).filter(d=>!source.include||new RegExp(source.include,'i').test(d.title)).filter(d=>!source.exclude||!new RegExp(source.exclude,'i').test(d.title));
 }
 if(source.adapter==='fia_event_documents'){const r=L.parseFiaEventDocuments(html,base);return r.docs.map(d=>({...d,event:r.event}));}
 if(source.adapter==='alkamel_wec'){
  // Al Kamel's JSON manifests (same reader the connector's wec_list_documents uses).
  const {archive}=await import('../worker/wec.js');const index=await archive();const year=String(now.getUTCFullYear());
  const season=[...index.records].reverse().find(r=>String(r.name).includes(year))||index.records.at(-1);if(!season)return [];
  const a=await archive(season.season_id),since=now.getTime()-(source.recent_days??60)*DAY,skip=source.exclude?new RegExp(source.exclude,'i'):null;
  return a.files.filter(f=>f.format==='pdf').map(f=>({url:f.url,title:[...f.folders.slice(1),f.title].filter(Boolean).join(' / '),published:f.published_at||null,event:f.folders[0]||null}))
   .filter(f=>!skip||!skip.test(f.title)).filter(f=>FORCE||!f.published||Date.parse(f.published)>=since);
 }
 if(source.adapter==='pdf_links')return L.parsePdfLinks(html,base,{include:source.include,exclude:source.exclude,date_order:source.date_order});
 throw Error('Unknown adapter '+source.adapter);
}

export function buildDoc(source,c,file,parsed){
 const hash=sha(file.bytes),issue=L.issueOf(c.title),isEvent=source.kind==='event_documents';
 const category=isEvent?L.eventDocCategory(c.title):null;
 let articles=[];
 if(parsed){articles=L.splitArticles(parsed.pages,{excerpt:isEvent?260:220,maxArticles:isEvent?300:4000});}
 const firstText=parsed?parsed.pages.slice(0,2).map(p=>p.text).join(' ').replace(/\s+/g,' ').trim():'';
 return {id:idFor(c.url,hash),source_id:source.id,series:source.series,kind:source.kind,title:c.title.slice(0,300),url:c.url,
  published:c.published||(file.lm?new Date(file.lm).toISOString():null),issue,family:L.familyKey(c.title),reg_year:isEvent?null:(L.regulationYear(c.title)||source.reg_year||null),group:c.group||null,
  event:c.event||null,number:c.number||null,category,recalled:!!c.recalled,hash,pages:parsed?.total??null,indexed_at:new Date().toISOString(),
  excerpt:isEvent&&firstText?firstText.slice(0,500):undefined,keywords:isEvent&&firstText?[...new Set(L.tokenize(firstText).filter(w=>w.length>3))].slice(0,40):undefined,
  text_status:parsed?(parsed.pages.some(p=>p.text.trim())?'ok':'no_text_layer'):'metadata_only',articles};
}

async function processSource(source,status,report){
 const result={id:source.id,series:source.series,kind:source.kind,status:'ok',listed:0,new:0,error:null},docs=[],known={};
 let state={};try{state=DRY?{}:(await api('/api/rules/state?source='+source.id)).known||{};}catch(e){result.status='failed';result.error='state: '+e.message;return {result,docs,known};}
 let list;try{list=await candidates(source);}catch(e){result.status='failed';result.error=e.message;return {result,docs,known};}
 result.listed=list.length;
 if(!list.length){result.status='failed';result.error='Listing returned no documents (markup change or block?)';return {result,docs,known};}
 for(const c of list){
  if(Date.now()>DEADLINE||report.downloads>=MAX_DOWNLOADS){result.status='partial';result.error='Run budget reached; continues next run';break;}
  const k=state[c.url];
  // FIA event documents never change in place; dated listings change only with a new date.
  if(k&&!FORCE&&(source.kind==='event_documents'||(c.published&&k.published===c.published)))continue;
  const isEvent=source.kind==='event_documents',category=isEvent?L.eventDocCategory(c.title):null;
  if(isEvent&&!L.eventDocWantsText(category)){
   const pseudo={bytes:new TextEncoder().encode(c.url+'|'+c.title+'|'+(c.published||'')),lm:null};
   docs.push(buildDoc(source,c,pseudo,null));known[c.url]={id:docs.at(-1).id,hash:docs.at(-1).hash,published:c.published||null};result.new++;continue;
  }
  let file;try{report.downloads++;file=await get(c.url,{headers:k&&!FORCE?{...(k.etag?{'if-none-match':k.etag}:{}),...(k.lm?{'if-modified-since':k.lm}:{})}:{}});}
  catch(e){result.status='partial';result.error=String(e.message).slice(0,200);continue;}
  if(file.status===304){known[c.url]={...k};continue;}
  const hash=sha(file.bytes);
  if(k?.hash===hash&&!FORCE){known[c.url]={...k,etag:file.etag,lm:file.lm,published:c.published||k.published};continue;}
  if(text(file.bytes.slice(0,5))!=='%PDF-'){result.status='partial';result.error='Not a PDF: '+c.url.slice(0,120);continue;}
  let parsed=null;try{parsed=await pdfPages(file.bytes,isEvent?12:400);}catch(e){result.status='partial';result.error='PDF parse: '+String(e.message).slice(0,150);}
  const doc=buildDoc(source,c,file,parsed);
  // A parse that lost almost everything must not replace a good earlier version.
  if(!isEvent&&parsed&&doc.articles.length<3&&(parsed.total||0)>5){result.status='partial';result.error=`Held for review: only ${doc.articles.length} articles from ${parsed.total} pages (${c.title.slice(0,60)})`;continue;}
  docs.push(doc);known[c.url]={id:doc.id,hash,etag:file.etag,lm:file.lm,published:c.published||null};result.new++;
 }
 return {result,docs,known};
}

async function main(){
 const started=new Date().toISOString(),report={downloads:0};
 const sources=registry.sources.filter(s=>s.enabled!==false&&(!ONLY||s.id===ONLY));
 let status={sources:{}};if(!DRY){try{status=(await api('/api/rules/state')).status||status;}catch(e){console.error('State unavailable:',e.message);process.exitCode=1;return;}}
 const todo=sources.filter(s=>due(s,status.sources?.[s.id]));
 console.log(`${todo.length}/${sources.length} sources due`);
 let failures=0;
 for(const source of todo){
  if(Date.now()>DEADLINE){console.log('Deadline reached; remaining sources wait for the next run');break;}
  const {result,docs,known}=await processSource(source,status.sources?.[source.id],report);
  if(result.status==='failed')failures++;
  console.log(`[${result.status}] ${source.id}: listed ${result.listed}, new ${result.new}${result.error?' — '+result.error:''}`);
  if(DRY){for(const d of docs)console.log(`   + ${d.title} (${d.articles.length} articles, ${d.text_status})`);continue;}
  // Post in small batches; the source status goes with the last batch.
  const batches=[];let cur=[],size=0;for(const d of docs){const s=JSON.stringify(d).length;if(cur.length&&(size+s>3_000_000||cur.length>=10)){batches.push(cur);cur=[];size=0;}cur.push(d);size+=s;}batches.push(cur);
  for(let i=0;i<batches.length;i++){const last=i===batches.length-1;
   try{await api('/api/rules/ingest',{documents:batches[i],...(last?{sources:[result],known:{[source.id]:known},run:{started_at:started,url:process.env.GITHUB_RUN_ID?`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`:''}}:{})});}
   catch(e){failures++;console.error(`   ingest failed for ${source.id}: ${e.message}`);break;}}
 }
 console.log(`Done: ${report.downloads} downloads, ${failures} failed sources`);
 if(failures&&failures===todo.length)process.exitCode=1;
}
if(import.meta.url===`file://${process.argv[1]}`)await main();
