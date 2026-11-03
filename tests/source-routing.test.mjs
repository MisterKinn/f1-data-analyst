import assert from 'node:assert/strict';
import worker from '../worker/index.js';
const request=(method,params={})=>new Request('https://test/mcp',{method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-id':'owner'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
const call=async(method,params={},env={})=>(await worker.fetch(request(method,params),env)).json();
const {result:info}=await call('initialize');
assert.equal(info.serverInfo.version,'2.0.0');
assert.match(info.instructions,/FastF1 is the source/);
assert.doesNotMatch(info.instructions,/TracingInsights/);
const {result:{tools}}=await call('tools/list');
assert.equal(tools.length,65);
assert.ok(tools.some(t=>t.name==='fastf1_live_snapshot'));
assert.ok(tools.some(t=>t.name==='get_grands_prix_practices_results'));
assert.ok(tools.some(t=>t.name==='fia_read_document'));
assert.ok(!tools.some(t=>t.name.startsWith('tracing_')||t.name==='resolve_combined_event'));
assert.equal((await call('tools/call',{name:'tracing_driver_laps',arguments:{}})).error.code,-32602);
const original=globalThis.fetch;
globalThis.fetch=async()=>{throw Error('No upstream network fallback is permitted in this test');};
try{
 const result=await call('tools/call',{name:'fastf1_live_snapshot',arguments:{}},{BUCKET:{get:async()=>null}});
 assert.equal(JSON.parse(result.result.content[0].text).available,false);
 const old=new Date(Date.now()-120000).toISOString();
 const snapshot={topics:{SessionInfo:{Name:'Practice 1'},SessionStatus:{Status:'Started'}},connected:true,generated_at:old,last_message_at:old,recent_events:[]};
 const stale=await call('tools/call',{name:'fastf1_live_snapshot',arguments:{}},{BUCKET:{get:async()=>({json:async()=>({snapshot,received_at:old})})}});
 assert.equal(JSON.parse(stale.result.content[0].text).freshness.live,false);
}finally{globalThis.fetch=original;}
const page=await (await worker.fetch(new Request('https://test/championships/f1'),{})).text();
assert.match(page,/FastF1/);assert.doesNotMatch(page,/TracingInsights|TRACINGINSIGHTS/);
console.log('PASS: FastF1 live routing, old tools removed, Hyprace/FIA preserved, no stale/missing-feed fallback');
