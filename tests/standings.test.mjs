import assert from 'node:assert/strict';
import {test} from 'node:test';
import {selectPointDocuments,parsePointDocument,standingsRoute,normalizeF1Standings} from '../worker/standings.js';
test('durable standings remain immediately readable while a sleeping collector fails',async()=>{
 const year=new Date().getUTCFullYear(),data={series:'f1',season:year,round:19,provider:'FastF1 · Jolpica',retrieved_at:new Date().toISOString(),categories:[{id:'constructors',rows:[{position:1,name:'Team',points:10}]}]};
 const tasks=[],env={FASTF1_CLOUD_URL:'https://collector.test',FASTF1_CLOUD_KEY:'test',BUCKET:{get:async()=>({json:async()=>({checked_at:Date.now()-600000,data})}),put:async()=>{throw Error('must not overwrite on failure');}}};
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('starting',{status:503});
 try{
  const response=await standingsRoute(new Request('https://test/api/championship-standings?series=f1&kind=constructors'),env,{waitUntil:p=>tasks.push(p)});
  assert.equal(response.status,200);const body=await response.json();assert.equal(body.stale,true);assert.equal(body.refreshing,false);await Promise.all(tasks);
 }finally{globalThis.fetch=original;}
});
test('F1 first visit returns fresh database totals and persists them for another worker',async()=>{
 const year=new Date().getUTCFullYear(),data={series:'f1',season:year,round:19,provider:'FastF1 · Jolpica',retrieved_at:new Date().toISOString(),categories:[{id:'drivers',rows:[{position:1,name:'Driver',points:10}]}]};
 let saved;const tasks=[],env={FASTF1_CLOUD_URL:'https://collector.test',FASTF1_CLOUD_KEY:'test',BUCKET:{get:async()=>saved?{json:async()=>JSON.parse(saved)}:null,put:async(key,value)=>{saved=value;}}};
 const jolpica={MRData:{total:'1',StandingsTable:{StandingsLists:[{season:String(year),round:'19',DriverStandings:[{position:'1',points:'10',Driver:{givenName:'Test',familyName:'Driver',permanentNumber:'1'},Constructors:[{name:'Team'}]}]}]}}};
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json(jolpica);
 try{
  const request=new Request('https://test/api/championship-standings?series=f1');
  assert.equal((await standingsRoute(request,env,{waitUntil:p=>tasks.push(p)})).status,200);
  await Promise.all(tasks);globalThis.fetch=async()=>{throw Error('collector asleep');};
  const response=await standingsRoute(request,env,{waitUntil:p=>tasks.push(p)});assert.equal(response.status,200);assert.equal((await response.json()).categories[0].rows[0].points,10);
 }finally{globalThis.fetch=original;}
});
const ids=['Hypercar_World_Endurance_Drivers_Championship','Hypercar_World_Endurance_Manufacturers_Championship','FIA_Endurance_Trophy_for_LMGT3_Drivers','FIA_Endurance_Trophy_for_LMGT3_Teams'];
const files=(round,folder='Final Championship Points')=>ids.map(n=>({title:'2026_'+n+'_After_Test.pdf',url:'https://files.alkamelcloud.com/wec/results/15_2026/'+String(round).padStart(2,'0')+'_TEST/1_FIA%20WEC/'+folder+'/'+n+'.pdf',format:'pdf',folders:['TEST','FIA WEC',folder]}));
test('select latest round, never blend older categories and prefer final documents',()=>{
 const r=selectPointDocuments([...files(6),...files(7,'Championship Points'),...files(7)]);
 assert.equal(r.round,7);assert.equal(r.categories.length,4);assert.ok(r.categories.every(c=>c.final));
 assert.throws(()=>selectPointDocuments([...files(6),files(7)[0]]));
});
test('Al Kamel PDF totals are distinct from pole/race points and tied drivers remain separate',()=>{
 const row=(rank,name,points)=>({y:590,cells:[{x:66,text:rank},{x:84,text:name},{x:206,text:points},{x:232,text:'1'},{x:245,text:'25'}]});
 const doc={next_page:null,pages:[{text:'2026 Championship\nRound 7 Test\nAfter Race\nFINAL',text_available:true,truncated:false,rows:[{y:610,cells:[{x:60,text:'Pos'},{x:84,text:'Driver'},{x:197,text:'Points'},{x:235,text:'Pole'}]},row('1','Driver A','114'),row('1','Driver B','114'),row('2','Driver C','0')]}]};
 const r=parsePointDocument(doc,'hypercar-drivers',2026,7);assert.equal(r.rows.length,3);assert.equal(r.rows[0].points,114);assert.equal(r.rows[1].position,1);assert.equal(r.rows[2].points,0);
 assert.throws(()=>parsePointDocument({...doc,next_page:2},'hypercar-drivers',2026,7));assert.throws(()=>parsePointDocument(doc,'hypercar-drivers',2026,8));
});
test('standings rejects arbitrary provider URLs and methods without fetching',async()=>{
 assert.equal((await standingsRoute(new Request('https://test/api/championship-standings?series=https://evil.test'),{})).status,400);
 assert.equal((await standingsRoute(new Request('https://test/api/championship-standings?series=f1',{method:'POST'}),{})).status,405);
});
test('Al Kamel gzipped manifests are decoded before parsing',async()=>{
 const {gzipSync}=await import('node:zlib');const {wecCall}=await import('../worker/wec.js');const original=globalThis.fetch;
 try{globalThis.fetch=async()=>new Response(gzipSync(JSON.stringify({type:'seasons_index',seasons:[{id:'15_2026',name:'2026',manifestUrl:'wec/manifests/results_15_2026.json'}]})));
 const r=await wecCall('wec_list_archive',{});assert.equal(JSON.parse(r.content[0].text).records[0].season_id,'15_2026');
 }finally{globalThis.fetch=original;}
});


test('FastF1 database normalization preserves current round, exact totals, teams and full table',()=>{
 const raw={MRData:{total:'2',StandingsTable:{StandingsLists:[{season:'2026',round:'19',DriverStandings:[
  {position:'1',points:'380',Driver:{givenName:'Andrea Kimi',familyName:'Antonelli',permanentNumber:'12'},Constructors:[{name:'Mercedes'}]},
  {position:'2',points:'261',Driver:{givenName:'Max',familyName:'Verstappen'},Constructors:[{name:'Red Bull'}]}
 ]}]}}};
 const data=normalizeF1Standings(raw,'drivers',2026);assert.equal(data.round,19);assert.equal(data.categories[0].rows[0].points,380);assert.equal(data.categories[0].rows[0].team,'Mercedes');
 assert.match(data.provider,/Jolpica/);assert.match(data.source,/2026\/last\/driverStandings/);
 assert.throws(()=>normalizeF1Standings(raw,'drivers',2025));
 raw.MRData.total='3';assert.throws(()=>normalizeF1Standings(raw,'drivers',2026));
 raw.MRData.total='2';raw.MRData.StandingsTable.StandingsLists[0].DriverStandings[0].points='NaN';assert.throws(()=>normalizeF1Standings(raw,'drivers',2026));
});
