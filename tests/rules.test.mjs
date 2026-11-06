import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as L from '../worker/rules-lib.js';
import {rulesIngest,rulesLookup,rulesState,applicableDocs,clearRulesCache,RULES_TOOLS} from '../worker/rules.js';
import {pdfPages,buildDoc,intervalFor} from '../scripts/rules-monitor.mjs';
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
