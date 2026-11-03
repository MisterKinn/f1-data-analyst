import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import {alkamelUrl,parseCsv,wecCall} from '../worker/wec.js';
const base='https://files.alkamelcloud.com/';
const season='15_2026',event='BARCELONA-CATALUNYA';
const csvPath='wec/results/15_2026/07_BARCELONA-CATALUNYA/688_FIA WEC/202610181200_Race/06_Hour 6/23_Analysis_Race_Hour 6.CSV';
const fixture='\uFEFFNUMBER; DRIVER_NAME; LAP_NUMBER; LAP_TIME; S1; S2; S3; PIT_TIME; FLAG_AT_FL; CLASS; TEAM;\r\n007;"GAMBLE; Tom";1;1:31.123;21.123;30.000;40.000;;GF;HYPERCAR;"Aston ""Martin""";\r\n7;Other;2;2:05.000;30;45;50;00:30.000;SC;HYPERCAR;Toyota;\r\n007;"GAMBLE; Tom";3;1:32.000;22;30;40;;GF;HYPERCAR;"Aston\nMartin";\r\n';
test('CSV preserves quoted fields, leading zero car IDs, laps, flags and paging',()=>{
 const p=parseCsv(fixture);assert.equal(p.records.length,3);assert.equal(p.records[0].NUMBER,'007');assert.equal(p.records[0].DRIVER_NAME,'GAMBLE; Tom');assert.equal(p.records[0].TEAM,'Aston "Martin"');assert.equal(p.records[2].TEAM,'Aston\nMartin');assert.equal(p.records[1].FLAG_AT_FL,'SC');assert.equal(p.records[0].PIT_TIME,'');
 assert.throws(()=>parseCsv('a;a\n1;2'),/duplicate/);assert.throws(()=>parseCsv('a;b\n1'),/mismatch/);assert.throws(()=>parseCsv('a;b\n"bad'),/unterminated/);
});
test('Al Kamel URL checks reject unrelated hosts, credentials, private paths and redirected access',()=>{
 for(const u of ['http://files.alkamelcloud.com/'+csvPath,'https://evil.example/a.csv','https://user@files.alkamelcloud.com/'+csvPath,'https://files.alkamelcloud.com/other/file.csv','https://files.alkamelcloud.com/wec/results/a.csv#fragment','https://fiawec.alkamelsystems.com/','https://files.alkamelcloud.com/wec/results/%5cprivate.csv'])assert.throws(()=>alkamelUrl(u));
 assert.equal(alkamelUrl(csvPath),new URL(csvPath,base).href);
});
test('MCP discovers WEC archive, routes files only to Al Kamel and reports upstream errors',async()=>{
 const orig=globalThis.fetch;
 const invoke=async(name,args={})=>{const r=await wecCall(name,args);return JSON.parse(r.content[0].text);};
 globalThis.fetch=async(url,opts)=>{
  assert.equal(opts.redirect,'manual');assert.ok(String(url).startsWith(base));
  if(new URL(url).pathname.endsWith('/results.json'))return Response.json({type:'seasons_index',seasons:[{id:season,name:'2026',manifestUrl:'wec/manifests/results_15_2026.json'}]});
  if(new URL(url).pathname.endsWith('results_15_2026.json'))return Response.json({folders:[{name:null,children:[{name:event,children:[{name:'FIA WEC',children:[{name:'Race',children:[{name:'Hour 6',children:[{name:'Analysis_Race_Hour 6.CSV',extension:'csv',url:csvPath,date:'2026-10-21T00:00:00Z'},{name:'Support.JSON',extension:'json',url:'wec/results/15_2026/support.JSON'}]}]}]}]}]}]});
  return new Response(fixture,{headers:{'content-type':'text/csv','last-modified':'Wed, 21 Oct 2026 00:00:00 GMT'}});
 };
 try{
  assert.equal((await invoke('wec_list_archive')).records[0].season_id,season);
  assert.equal((await invoke('wec_list_archive',{season_id:season})).records[0].event,event);
  await assert.rejects(invoke('wec_list_archive',{season_id:'made-up'}),/Unknown season_id/);
  const docs=await invoke('wec_list_documents',{season_id:season,event,session:'Race',query:'Analysis',format:'csv',limit:1});assert.equal(docs.total,1);assert.deepEqual(docs.records[0].folders,[event,'FIA WEC','Race','Hour 6']);assert.equal(docs.records[0].published_at,'2026-10-21T00:00:00Z');
  await assert.rejects(invoke('wec_list_documents',{season_id:season,event:'made-up'}),/Unknown event/);
  const page=await invoke('wec_read_document',{url:docs.records[0].url,car_number:'007',limit:1});
  assert.equal(page.total_source_rows,3);assert.equal(page.total,2);assert.equal(page.records[0].LAP_NUMBER,'1');assert.equal(page.next_offset,1);assert.match(page.source,/Al Kamel/);
  const next=await invoke('wec_read_document',{url:docs.records[0].url,car_number:'007',offset:1,limit:1});assert.equal(next.records[0].LAP_NUMBER,'3');assert.equal(next.next_offset,null);
  await assert.rejects(invoke('wec_read_document',{url:docs.records[0].url,start_page:1}),/PDF only/);
  const rpc=async(method,params={})=>(await worker.fetch(new Request('https://test/mcp',{method:'POST',headers:{'oai-authenticated-user-id':'owner'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}),{})).json();
  const init=(await rpc('initialize')).result;assert.equal(init.serverInfo.name,'Kongboda Motorsports');assert.match(init.instructions,/WEC POST-SESSION/);
  assert.equal((await rpc('tools/list')).result.tools.filter(t=>t.name.startsWith('wec_')).length,5);
  const call=await rpc('tools/call',{name:'wec_read_document',arguments:{url:docs.records[0].url,car_number:'7'}});assert.equal(JSON.parse(call.result.content[0].text).records[0].NUMBER,'7');
  globalThis.fetch=async()=>new Response('blocked',{status:403});assert.equal((await rpc('tools/call',{name:'wec_read_document',arguments:{url:docs.records[0].url}})).result.isError,true);
  globalThis.fetch=async()=>new Response(null,{status:302,headers:{location:'https://evil.example/steal.csv'}});await assert.rejects(invoke('wec_read_document',{url:docs.records[0].url}),/official WEC/);
  globalThis.fetch=async()=>new Response('<html>Login</html>');await assert.rejects(invoke('wec_read_document',{url:docs.records[0].url}),/HTML instead/);
  globalThis.fetch=async()=>new Response('{}');await assert.rejects(invoke('wec_list_archive'),/schema/);
 }finally{globalThis.fetch=orig;}
});

