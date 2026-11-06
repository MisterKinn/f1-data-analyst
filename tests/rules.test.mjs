import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as L from '../worker/rules-lib.js';
import {rulesIngest,rulesLookup,rulesState,applicableDocs,clearRulesCache,RULES_TOOLS} from '../worker/rules.js';
import {pdfPages,buildDoc,intervalFor,candidates,officialCandidates} from '../scripts/rules-monitor.mjs';
import sources from '../knowledge/rules-sources.json' with {type:'json'};

// ---- listings (synthetic markup in the same shape as the official pages) ----
const fiaList=`<div class="view-grouping-header">2027 Regulations</div><ul>
<li class="list-item"><a href="https://www.fia.com/system/files/documents/fia_2027_f1_regulations_-_section_b_sporting_-_iss_01_-_2026-10-19.pdf" download><div class="title">FIA 2027 F1 Regulations - Section B [Sporting] - Iss 01 - 2026-10-19</div><div class="published">Published on <span>19.10.26</span></div></a></li></ul>
<div class="view-grouping-header">Section B</div><ul>
<li class="list-item"><a href="/system/files/documents/b_iss_09.pdf"><div class="title">FIA 2026 F1 Regulations - Section B [Sporting] - Iss 09 - 2026-08-01</div><div class="published">Published on <span>01.08.26</span></div></a></li>
<li class="list-item"><a href="/system/files/documents/b_iss_09.pdf"><div class="title">duplicate</div></a></li></ul>`;
const reg=L.parseFiaRegulations(fiaList,'https://www.fia.com/regulation/category/110');
assert.equal(reg.length,2);
assert.equal(reg[0].published,'2026-10-19');assert.equal(reg[0].group,'2027 Regulations');
assert.equal(reg[1].url,'https://www.fia.com/system/files/documents/b_iss_09.pdf');
assert.equal(L.familyKey(reg[0].title).replace('2027','Y'),L.familyKey(reg[1].title).replace('2026','Y'));
assert.deepEqual(L.issueOf(reg[1].title),{label:'Iss 09',number:9});
assert.equal(L.regulationYear(reg[1].title),2026);

const fiaDocs=`<div class="event-title active">São Paulo Grand Prix</div><ul>
<li class="document-row key-12"><a href="/system/files/decision-document/2026_sao_paulo_-_race_director_event_notes.pdf"><div class="title">Doc 12 - Race Director's Event Notes</div><div class="published">Published on 06.11.26 14:05 CET</div></a></li>
<li class="document-row key-3"><a href="/system/files/decision-document/x.pdf"><div class="title">Doc 3 - Timetable</div><div class="published">Published on 05.11.26 09:00 CET</div></a></li></ul>`;
const ev=L.parseFiaEventDocuments(fiaDocs,'https://www.fia.com');
assert.equal(ev.event,'São Paulo Grand Prix');assert.equal(ev.docs.length,2);
assert.equal(ev.docs[0].published,'2026-11-06T14:05:00+01:00');assert.equal(ev.docs[0].number,'12');
assert.equal(L.eventDocCategory(ev.docs[0].title),'race_director');assert.equal(L.eventDocCategory(ev.docs[1].title),'admin');
assert.equal(L.eventDocWantsText('admin'),false);assert.equal(L.eventDocWantsText('decision'),true);

const imsa=`<a href="https://www.imsa.com/wp-content/uploads/sites/32/2026/06/17/2026-SR-IWSC-Blackline.pdf">2026 Sporting Regulations IWSC 6/17/26 <!-- x --> --></a>
<a href="https://www.imsa.com/wp-content/uploads/sites/32/2026/06/17/2026-SR-IWSC-Redline.pdf">2026 Sporting Regulations IWSC REDLINE 6/17/26</a><a href="/about">About</a>`;
const links=L.parsePdfLinks(imsa,'https://www.imsa.com/',{exclude:'redline',date_order:'mdy'});
assert.equal(links.length,1);assert.equal(links[0].title,'2026 Sporting Regulations IWSC 6/17/26');assert.equal(links[0].published,'2026-06-17');
assert.equal(L.findDate('valid 19.10.26'),'2026-10-19');assert.equal(L.findDate('Issued 3 March 2026'),'2026-03-03');assert.equal(L.findDate('6/17/26','mdy'),'2026-06-17');

// ---- PDF -> article index (synthetic PDF written for this test) ----
const pdf=new Uint8Array(await readFile(new URL('./fixtures/rules-sample.pdf',import.meta.url)));
const parsed=await pdfPages(pdf);
assert.equal(parsed.total,3);
const arts=L.splitArticles(parsed.pages);
const byN=Object.fromEntries(arts.map(a=>[a.n,a]));
assert.equal(byN['B1.8.1'].p,2,'body occurrence wins over the table of contents');
assert.match(byN['B1.8.1'].x,/white lines/);
assert.equal(byN['B5.12.2'].p,3);assert.equal(byN['B1.8'].p,2,'section heading taken from the body, not the contents page');assert.equal(byN['B1.8.1'].h,'Driving');assert.ok(byN['B5.12'].h.includes('Virtual Safety Car'));
assert.ok(arts.every(a=>a.x.length<=220));

// ---- query expansion ----
const q=L.expandQuery('F1 트랙 리밋');assert.ok(q.terms.includes('track')&&q.phrases.includes('track limits'));
assert.equal(L.expandQuery('Article 33.3 penalty').number,'33.3');
assert.equal(L.seriesFrom('포뮬러1'),'f1');assert.equal(L.seriesFrom('WEC'),'wec');
assert.ok(L.scoreArticle(byN['B1.8.1'],q)>L.scoreArticle(byN['B5.12.2'],q));

// ---- schedule ----
const now=Date.parse('2026-07-15T00:00:00Z');
assert.equal(intervalFor({kind:'regulations',series:'nonexistent'},now),24*3600_000);
assert.equal(intervalFor({kind:'event_documents',series:'nonexistent'},now),12*3600_000);
assert.ok(sources.sources.every(s=>s.id&&s.series&&s.kind&&s.adapter&&/^https:\/\//.test(s.url)));
assert.equal(new Set(sources.sources.map(s=>s.id)).size,sources.sources.length);

// ---- ingest + lookup round trip with an in-memory bucket ----
function memoryBucket(){const m=new Map();return {m,async get(k){return m.has(k)?{json:async()=>JSON.parse(m.get(k))}:null;},async put(k,v){m.set(k,typeof v==='string'?v:String(v));return {key:k};},async delete(k){m.delete(k);}};}
const env={BUCKET:memoryBucket()};
const source={id:'f1-regs',series:'f1',kind:'regulations'};
const file=n=>({bytes:new TextEncoder().encode('pdf-'+n),lm:null});
const d8=buildDoc(source,{url:'https://www.fia.com/b8.pdf',title:'FIA 2026 F1 Regulations - Section B [Sporting] - Iss 08 - 2026-05-01',published:'2026-05-01'},file(8),parsed);
const d9=buildDoc(source,{url:'https://www.fia.com/b9.pdf',title:'FIA 2026 F1 Regulations - Section B [Sporting] - Iss 09 - 2026-08-01',published:'2026-08-01'},file(9),parsed);
assert.equal(d8.family,d9.family);assert.equal(d9.reg_year,2026);assert.ok(d9.articles.length>=4);
const evSource={id:'f1-event-docs',series:'f1',kind:'event_documents'};
const note=buildDoc(evSource,{...ev.docs[0],event:ev.event},file('note'),parsed);
assert.equal(note.category,'race_director');assert.ok(note.excerpt&&note.keywords.length);
const post=(body,ok=true)=>rulesIngest(new Request('https://x/api/rules/ingest',{method:'POST',body:JSON.stringify(body),headers:{authorization:'Bearer t'}}),env,{verify:async()=>{if(!ok)throw Error('no');}});
assert.equal((await post({documents:[d9]},false)).status,401);
assert.equal((await post({documents:[{...d9,id:'../x'}]})).status,400);
assert.equal((await post({documents:[d8,d9],sources:[{id:'f1-regs',series:'f1',kind:'regulations',status:'ok',listed:2,new:2}],known:{'f1-regs':{[d9.url]:{id:d9.id,hash:d9.hash,published:d9.published}}}})).status,200);
assert.equal((await post({documents:[note],sources:[{id:'f1-event-docs',series:'f1',kind:'event_documents',status:'partial',error:'Run budget reached'}]})).status,200);
clearRulesCache();

const state=await (await rulesState(new Request('https://x/api/rules/state?source=f1-regs'),env)).json();
assert.equal(state.known[d9.url].hash,d9.hash);

const cur=await rulesLookup(env,{query:'트랙 리밋',series:'f1',kind:'regulations',as_of:'2026-11-06'});
assert.equal(cur.index_status,'ok');assert.equal(cur.hits[0].article,'B1.8.1');assert.equal(cur.hits[0].issue,'Iss 09');
assert.match(cur.hits[0].url,/b9\.pdf#page=2$/);assert.equal(cur.hits[0].freshness.check_status,'ok');assert.equal(cur.hits[0].newer_issue,null);
const past=await rulesLookup(env,{query:'VSC',series:'F1',kind:'regulations',as_of:'2026-06-01'});
assert.equal(past.hits[0].issue,'Iss 08','the issue valid on the race date is used');assert.equal(past.hits[0].newer_issue.published,'2026-08-01');
assert.equal((await rulesLookup(env,{query:'B5.12.2',series:'f1',as_of:'2026-11-06'})).hits[0].article,'B5.12.2');
const evHit=await rulesLookup(env,{query:'event notes',series:'f1',kind:'event_documents',as_of:'2026-11-07'});
assert.equal(evHit.hits[0].event,'São Paulo Grand Prix');assert.equal(evHit.hits[0].category,'race_director');
assert.ok(evHit.freshness_warning,'partial source check is surfaced');
assert.equal((await rulesLookup(env,{query:'event notes',series:'f1',kind:'event_documents',as_of:'2026-11-05'})).hits.length,0,'documents published after as_of are hidden');
assert.equal((await rulesLookup({BUCKET:memoryBucket()},{query:'vsc'})).index_status,'index_empty');
assert.deepEqual((await rulesLookup(env,{query:'vsc',series:'zzz-cup'})).unknown_series,['zzz-cup']);

// applicability picks the latest valid issue per family
const fam=applicableDocs([{series:'f1',family:'a',published:'2026-01-01',title:'1'},{series:'f1',family:'a',published:'2026-03-01',title:'2'},{series:'f1',family:'a',published:'2026-09-01',title:'3'}],'2026-04-01');
assert.equal(fam.length,1);assert.equal(fam[0].title,'2');assert.equal(fam[0].newer_issue.title,'3');

// storage objects stay below the Firestore limit
for(const [k,v] of env.BUCKET.m)assert.ok(v.length<850_000,k);
assert.equal(RULES_TOOLS[0].name,'rules_lookup');

// ---- automatic rule context ----
import {rulesContext,attachRulesContext,contextTopics,contextSeries} from '../worker/rules.js';
assert.deepEqual(contextTopics('CAR 44 TIME 1:23.4 DELETED - TRACK LIMITS AT TURN 4; VSC DEPLOYED'),['track limits','virtual safety car']);
assert.equal(contextSeries('openf1_race_control'),'f1');assert.equal(contextSeries('wec_list_documents'),'wec');assert.equal(contextSeries('motorsport_read_document',{series:'imsa'}),'imsa');assert.equal(contextSeries('research_lookup'),null);
const rc={content:[{type:'text',text:JSON.stringify({messages:['LAP 12 TIME DELETED - TRACK LIMITS']})}],isError:false};
const ctxR=await rulesContext(env,'openf1_race_control',{},rc);
assert.equal(ctxR.series,'f1');assert.equal(ctxR.topics[0].topic,'track limits');assert.equal(ctxR.topics[0].hits[0].article,'B1.8.1');
const att=JSON.parse(attachRulesContext(rc,ctxR).content[0].text);assert.ok(att.messages&&att.rules_context.topics.length);
assert.equal(await rulesContext(env,'openf1_race_control',{},{content:[{type:'text',text:'{"laps":[]}'}]}),null,'no regulated situation, nothing attached');
assert.equal(await rulesContext({},'openf1_race_control',{},rc),null);
assert.equal((await rulesLookup(env,{query:'track limits',series:'NASCAR'})).index_status,'not_publicly_available');
// ---- scheduling of unfinished and failed sources ----
import {due,priority} from '../scripts/rules-monitor.mjs';
{const now=Date.parse('2026-07-15T00:00:00Z'),src={kind:'regulations',series:'nonexistent'},ago=m=>new Date(now-m*60_000).toISOString();
assert.equal(due(src,{checked_at:ago(5),status:'partial'},now,false),true,'unfinished source continues next run');
assert.equal(due(src,{checked_at:ago(5),status:'ok'},now,false),false);
assert.equal(due(src,{checked_at:ago(30),status:'failed'},now,false),false);assert.equal(due(src,{checked_at:ago(61),status:'failed'},now,false),true,'failed source retries after an hour');
assert.ok(priority({kind:'event_documents',series:'f1',calendar:'nonexistent'},now)<priority({kind:'regulations',series:'scca'},now));}
// ---- OpenAlex watch candidates are listed as pending only ----
import {researchCall} from '../worker/research.js';
assert.equal((await post({documents:[],research_candidates:[{doi:'10.1234/abc.5',title:'A new trail braking study',year:2026,license:'cc-by',url:'https://example.org/a'},{doi:'bad',title:'x'}]})).status,200);
{const r=JSON.parse((await researchCall('research_lookup',{include_pending:true,query:'trail braking'},env)).content[0].text);
 const auto=r.pending.find(p=>p.doi==='10.1234/abc.5');assert.ok(auto);assert.equal(auto.eligible_for_analysis,false);assert.equal(auto.review_status,'auto_found_not_reviewed');
 assert.ok(!r.papers.some(p=>p.doi==='10.1234/abc.5'),'never used as approved evidence');}
// ---- patents ----
import {parseOpsBiblio,patentsIngest,patentsLookup,saveOpsKey,opsStatus,opsToken} from '../worker/patents.js';
{const ops={'ops:world-patent-data':{'ops:biblio-search':{'@total-result-count':'1','ops:search-result':{'exchange-documents':{'exchange-document':{'@country':'EP','@doc-number':'4123456','@kind':'A1','bibliographic-data':{'publication-reference':{'document-id':[{'@document-id-type':'docdb',country:{$:'EP'},'doc-number':{$:'4123456'},kind:{$:'A1'},date:{$:'20261015'}}]},'invention-title':[{'@lang':'de',$:'Verbrennungsmotor'},{'@lang':'en',$:'Internal combustion engine with turbocharger cooling'}],parties:{applicants:{applicant:[{'@data-format':'epodoc','applicant-name':{name:{$:'FERRARI SPA [IT]'}}}]}},'patent-classifications':{'patent-classification':{section:{$:'F'},class:{$:'02'},subclass:{$:'B'},'main-group':{$:'37'},subgroup:{$:'00'}}},'priority-claims':{'priority-claim':{'document-id':{date:{$:'20250410'}}}}},abstract:{'@lang':'en',p:{$:'A turbocharged engine whose compressor outlet is cooled by a dedicated circuit.'}}}}}}}};
 const r=parseOpsBiblio(ops,'Ferrari');assert.equal(r.total,1);const p=r.patents[0];
 assert.equal(p.number,'EP4123456A1');assert.equal(p.published,'2026-10-15');assert.equal(p.priority,'2025-04-10');assert.match(p.title,/turbocharger/);assert.deepEqual(p.cpc,['F02B37/00']);assert.equal(p.applicants[0],'FERRARI SPA [IT]');
 const penv={BUCKET:memoryBucket()};
 assert.equal((await opsStatus(penv)).configured,false);await assert.rejects(saveOpsKey(penv,'x','y'));assert.equal((await saveOpsKey(penv,'abcdEFGH1234','secretVALUE5678')).configured,true);
 assert.equal((await opsToken(new Request('https://x/api/patents/ops-token',{method:'POST'}),penv,{verify:async()=>{throw Error('no')}})).status,401);
 const tok=await opsToken(new Request('https://x/api/patents/ops-token',{method:'POST'}),penv,{verify:async()=>{},fetcher:async(u,o)=>{assert.match(o.headers.authorization,/^Basic /);return new Response(JSON.stringify({access_token:'T',expires_in:'1199'}),{status:200});}});
 assert.deepEqual(await tok.json(),{access_token:'T',expires_in:1199});
 assert.equal((await patentsLookup(penv,{query:'페라리 엔진'})).index_status,'index_empty');
 const ing=await patentsIngest(new Request('https://x/api/patents/ingest',{method:'POST',body:JSON.stringify({patents:r.patents,watch:{status:'ok',found:1}})}),penv,{verify:async()=>{}});assert.equal(ing.status,200);
 assert.equal((await patentsIngest(new Request('https://x',{method:'POST',body:JSON.stringify({patents:[{...p,number:'bad'}]})}),penv,{verify:async()=>{}})).status,400);
 const look=await patentsLookup(penv,{query:'페라리 터보 엔진'});assert.equal(look.hits[0].number,'EP4123456A1');assert.match(look.hits[0].url,/espacenet/);
 assert.equal((await patentsLookup(penv,{query:'포르쉐 엔진'})).hits.length,0,'company filter applies');}
// marked-up copies are ignored and duplicate articles collapse
{const dup=buildDoc(source,{url:'https://www.fia.com/b9-marked-up.pdf',title:'FIA 2026 F1 Regulations - Section B [Sporting] - Iss 09 - Marked-up',published:'2026-08-01'},file('m'),parsed);
 const dup2=buildDoc({...source,id:'f1-regs'},{url:'https://www.fia.com/other.pdf',title:'Other F1 document 2026',published:'2026-08-02'},file('o'),parsed);
 assert.equal((await post({documents:[dup,dup2]})).status,200);
 const r=await rulesLookup(env,{query:'트랙 리밋',series:'f1',kind:'regulations',as_of:'2026-11-06',limit:10});
 assert.ok(!r.hits.some(h=>/marked-up/i.test(h.document)),'marked-up copy ignored');
 assert.equal(r.hits.filter(h=>h.article==='B1.8.1').length,1,'same article from two documents collapses');}

// ---- JS noticeboards read through their data instead of a browser ----
{// Supercars: PDF links only inside the Next.js payload (escaped slashes, two CDN hosts for one file)
 const page=`<script>self.__next_f.push([1,"{\\"file\\":{\\"url\\":\\"https:\\/\\/assets.ctfassets.net\\/x\\/1\\/a\\/2026._Div_A_-_FINAL_V2_-_Clean.pdf\\"}}"])</script>
 <script>{"u":"//images.ctfassets.net/x/2/b/2026._Div_A_-_FINAL_V2_-_Clean.pdf"}</script>
 <script>{"u":"https://assets.ctfassets.net/x/3/c/2026_VCS_-_Sydney_500-_Supplementary_Regulations.pdf","v":"https://assets.ctfassets.net/x/4/d/2026_VCS_-_Penrite_Oil_Sandown_500_-_Further_Supplementary_Regulations_2.pdf"}</script>
 <a href="https://assets.ctfassets.net/x/5/e/SC27-Calendar.pdf">Calendar</a>`;
 const regsSrc=sources.sources.find(s=>s.id==='supercars-regs'),evSrc=sources.sources.find(s=>s.id==='supercars-event-docs');
 const fetchText=async()=>page;
 const regs=await candidates(regsSrc,new Date('2026-11-06'),{fetchText});
 assert.equal(regs.length,1,'same file from two hosts collapses; calendar excluded');
 assert.equal(regs[0].title,'Supercars Operations Manual - 2026. Div A - FINAL V2 - Clean');
 const ev=await candidates(evSrc,new Date('2026-11-06'),{fetchText});
 assert.deepEqual(ev.map(e=>e.event),['Sydney 500','Penrite Oil Sandown 500']);
 assert.equal(L.eventDocCategory(ev[1].title),L.eventDocCategory('Further Supplementary Regulations'));}
{// BTCC: GT Apps noticeboard JSON — only the newest events, only bulletins/decisions/official documents
 const doc=(ev,n,cat,title,at,extra={})=>({season_event_uuid:ev,season_event_name:ev==='e2'?'HQ60 TOCA Brands Hatch (GP)':'HQ59 TOCA Silverstone',document_number:n,category_name:cat,top_line_label:`Doc ${n} - ${cat} 1`,title,title_label:title,published_at:at,pdf_url:`https://racecontrol.gtapps.co.uk/barc/noticeboard/TOCA/documents/${ev}-${n}/pdf#zoom=page-width`,...extra});
 const data={seasons:[{events:[{uuid:'e0',event_from_date:'2026-08-01'},{uuid:'e1',event_from_date:'2026-09-26'},{uuid:'e2',event_from_date:'2026-10-10'}]}],documents:[
  doc('e0',1,'Bulletin','Old bulletin','01 Aug 2026 10:00'),doc('e1',5,'Bulletin','Bulletin No: 01 - Start Procedure','24 Sep 2026 14:40'),
  doc('e2',7,'Race Classification','BTCC - Race 1 - Classification','11 Oct 2026 12:00'),doc('e2',9,'Stewards Decision','Car 12 - Track limits','11 Oct 2026 16:05',{redacted:true})]};
 const src=sources.sources.find(s=>s.id==='btcc-event-docs');
 const list=await candidates(src,new Date('2026-11-06'),{fetchText:async()=>JSON.stringify(data)});
 assert.deepEqual(list.map(d=>d.number),[5,9]);
 assert.equal(list[1].url,'https://racecontrol.gtapps.co.uk/barc/noticeboard/TOCA/documents/e2-9/pdf');
 assert.equal(list[1].published,'2026-10-11T16:05:00');assert.equal(list[1].event,'HQ60 TOCA Brands Hatch (GP)');assert.equal(list[1].recalled,true);}
{// Formula E results archive: newest season, newest events, document folders only
 const tree={
  'formula-e/files/results':{catalogs:[{id:'formula-e/files/results/10_Season 11 - 2024-25',name:'Season 11 - 2024-25'},{id:'formula-e/files/results/11_Season 12 - 2025-26',name:'Season 12 - 2025-26'}],files:[]},
  'formula-e/files/results/11_Season 12 - 2025-26':{catalogs:[{id:'S/16_R16 London',name:'R16 London'},{id:'S/17_R17 London',name:'R17 London'},{id:'S/09_R09 Monaco',name:'R09 Monaco'}],files:[]},
  'S/17_R17 London':{catalogs:[{id:'S/17/champ',name:'ABB FIA Formula E World Championship'},{id:'S/17/info',name:'Event Information'}],files:[]},
  'S/17/info':{catalogs:[],files:[{url:'https://results.formulae.fia.com/r17/Race_Director_Notes.pdf',title:'Race Director Notes',published_at:1786860276}]},
  'S/16_R16 London':{catalogs:[{id:'S/16/info',name:'Event Information'}],files:[]},
  'S/16/info':{catalogs:[],files:[{url:'https://results.formulae.fia.com/r16/Bulletin_1.pdf',title:'Bulletin 1',published_at:1786700000},{url:'https://results.formulae.fia.com/r16/Classification.pdf',title:'Race Classification'}]}};
 const seen=[];const archive=async(series,id)=>{seen.push(id||'formula-e/files/results');const t=tree[id||'formula-e/files/results'];if(!t)throw Error('unexpected '+id);return t;};
 const src=sources.sources.find(s=>s.id==='fe-event-info');
 const list=await candidates(src,new Date('2026-11-06'),{archive});
 assert.deepEqual(list.map(d=>d.title),['Event Information / Race Director Notes','Event Information / Bulletin 1']);
 assert.equal(list[0].event,'R17 London');assert.equal(list[0].published,'2026-08-16T06:04:36');
 assert.ok(!seen.includes('S/17/champ'),'timing folders are not crawled');assert.ok(!seen.includes('S/09_R09 Monaco'));}
{// ELMS / ALMS through the connector's own archive reader
 const elms=async(series,season,event)=>!season?{seasons:[{id:'20_2025',name:'2025'},{id:'21_2026',name:'2026'}]}:!event?{events:[{id:'05_SILVERSTONE',name:'SILVERSTONE'},{id:'06_PORTIMAO',name:'PORTIMAO'}]}:
  {files:[{url:`https://elms.alkamelsystems.com/Results/21_2026/${event}/00_EVENT%20INFO/Timetable_V3.pdf`,title:'Timetable V3',format:'pdf'},{url:`https://elms.alkamelsystems.com/Results/21_2026/${event}/Race/03_Classification_Race.PDF`,title:'Classification Race',format:'pdf'}]};
 const e=await candidates(sources.sources.find(s=>s.id==='elms-event-docs'),new Date('2026-11-06'),{archive:elms});
 assert.deepEqual(e.map(d=>[d.event,d.title]),[['SILVERSTONE','Timetable V3'],['PORTIMAO','Timetable V3']]);
 const alms=async(series,season)=>!season?{seasons:[{id:'04_2024-2025',name:'2024-2025'},{id:'05_2025-2026',name:'2025-2026'}]}:
  {events:['01_SEPANG','02_DUBAI','03_ABU DHABI'],files:[{url:'https://files.alkamelcloud.com/a/sepang/bulletin.pdf',title:'Bulletin 1',folders:['01_SEPANG','EVENT INFO'],format:'pdf'},{url:'https://files.alkamelcloud.com/a/ad/decision.pdf',title:'Stewards Decision 3',folders:['03_ABU DHABI','DOCUMENTS'],format:'pdf'}]};
 const a=await candidates(sources.sources.find(s=>s.id==='alms-event-docs'),new Date('2026-11-06'),{archive:alms});
 assert.deepEqual(a.map(d=>[d.event,d.title]),[['03_ABU DHABI','DOCUMENTS / Stewards Decision 3']]);}
{// fia.com championship id discovery
 assert.equal(L.discoverLink('<a href="/documents/championships/fia-formula-one-world-championship-14">F1</a><a href="/documents/championships/abb-fia-formula-e-world-championship-1013#x">FE</a>','https://www.fia.com/x','/documents/championships/[^"\'#?]*formula-e'),'https://www.fia.com/documents/championships/abb-fia-formula-e-world-championship-1013');
 assert.ok(sources.sources.every(s=>['fia_regulations','fia_event_documents','pdf_links','single_pdf','alkamel_wec','official_archive','gtapps_noticeboard','embedded_pdf_urls','research_watch','patent_watch'].includes(s.adapter)||s.kind==='research_watch'||s.kind==='patent_watch'),'every source uses a known adapter');
 assert.ok(!('supercars' in sources.tier3_unavailable));
 assert.equal(L.seriesFrom('슈퍼카 챔피언십'),'supercars');assert.equal(L.seriesFrom('Repco Supercars'),'supercars');}
console.log('rules noticeboards ok');
