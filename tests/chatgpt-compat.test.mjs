import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../worker/index.js';

test('account and core tools come first in tools/list',async()=>{
 const r=await worker.fetch(new Request('https://kongboda-motorsports.vercel.app/mcp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list',params:{}})}),{});
 const names=(await r.json()).result.tools.map(t=>t.name);
 assert.equal(names[0],'kongboda_my_preferences');
 assert.ok(names.indexOf('kongboda_live_briefing')<10);
 assert.ok(!names.some(n=>n.startsWith('get_')||n.startsWith('list_')));
});

test('authorization-code exchange always returns a refresh token',()=>{
 const source=readFileSync(new URL('../server/mcp-oauth.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/refresh:record\.scope\.split\(' '\)\.includes\('offline_access'\)/);
});

test('removed Hyprace tools are rejected as unknown',async()=>{
 const r=await worker.fetch(new Request('https://kongboda-motorsports.vercel.app/mcp',{method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-id':'u','oai-authenticated-user-email':'u@example.invalid'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'list_seasons',arguments:{}}})}),{});
 assert.equal((await r.json()).error.code,-32602);
});

test('tools without a required list (kongboda_list_crew) do not crash argument validation',async()=>{
 const r=await worker.fetch(new Request('https://kongboda-motorsports.vercel.app/mcp',{method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-id':'u','oai-authenticated-user-email':'u@example.invalid'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'kongboda_list_crew',arguments:{}}})}),{});
 assert.doesNotMatch(JSON.stringify(await r.json()),/not iterable/);
});

test('live snapshot keeps large raw topics out of the default response',async()=>{
 const {boundedTopics,TOPICS_TOTAL_LIMIT}=await import('../worker/live.js');
 const topics={TimingData:{x:'a'.repeat(60000)},CarData:{x:'b'.repeat(50000)},SessionInfo:{Name:'Race'},LapCount:{CurrentLap:65}};
 const out=boundedTopics(topics);
 assert.deepEqual(Object.keys(out.topics).sort(),['LapCount','SessionInfo']);
 assert.ok(out.omitted_topics.TimingData>50000&&out.omitted_topics.CarData>40000);
 assert.ok(JSON.stringify(out).length<TOPICS_TOTAL_LIMIT);
 const picked=boundedTopics({TimingData:{x:'a'.repeat(30000)},CarData:{x:'b'.repeat(30000)}},['TimingData']);
 assert.deepEqual(Object.keys(picked.topics),['TimingData']);
});

test('saved sessions whose collector stopped early are labelled ended, not in progress',async()=>{
 const {sessionFinalisation}=await import('../worker/best_laps.js');
 const snap={topics:{SessionStatus:{Status:'Started'},SessionInfo:{ArchiveStatus:{Status:'Generating'}}},lap_archive:{recovery:{}}};
 const old=new Date(Date.now()-3*24*3600*1000).toISOString();
 assert.equal(sessionFinalisation(snap,old).state,'ended_without_final_status');
 assert.equal(sessionFinalisation(snap,old).recovery,'not_run');
 assert.equal(sessionFinalisation(snap,new Date().toISOString()).state,'in_progress');
 assert.equal(sessionFinalisation({topics:{SessionStatus:{Status:'Finalised'},SessionInfo:{ArchiveStatus:{Status:'Complete'}}}},old).state,'final');
});

test('NLS event list has one entry per event with the descriptive title',async()=>{
 const {nlsEvents}=await import('../worker/official.js');
 const link=(d,title)=>({url:'https://teilnehmer.vln.de/onb.php?d='+d,title});
 const out=nlsEvents([link('2026-10-10','10.10.2026'),link('2026-10-10','10.10.2026'),link('2026-03-14','14.03.2026 – NLS1'),link('2026-10-10','10.10.2026 – NLS10'),{url:'https://teilnehmer.vln.de/download.php?file=onb/2026-10-10/a.pdf',title:'a'}]);
 assert.deepEqual(out,[{id:'2026-10-10',name:'10.10.2026 – NLS10'},{id:'2026-03-14',name:'14.03.2026 – NLS1'}]);
});
