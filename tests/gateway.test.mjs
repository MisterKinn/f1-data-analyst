import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import {GATEWAY_TOOLS} from '../worker/gateway.js';

const rpc=(method,params,auth=true)=>new Request('https://test/mcp',{method:'POST',headers:{'content-type':'application/json',...(auth?{'oai-authenticated-user-id':'owner'}:{})},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
const call=async(name,args,auth=true)=>(await (await worker.fetch(rpc('tools/call',{name,arguments:args},auth),{})).json());

test('gateway tools are listed and never change shape',async()=>{
 const tools=(await (await worker.fetch(rpc('tools/list',{}),{})).json()).result.tools;
 assert.deepEqual(tools.slice(-2).map(t=>t.name),['kongboda_tools','kongboda_call']);
 assert.deepEqual(GATEWAY_TOOLS[1].inputSchema.required,['name']);
 assert.ok(GATEWAY_TOOLS.every(t=>t.annotations.readOnlyHint));
});

test('kongboda_tools returns the live server catalog, filterable',async()=>{
 const out=JSON.parse((await call('kongboda_tools',{query:'openf1'})).result.content[0].text);
 const of1=out.tools.filter(t=>t.name.startsWith('openf1_'));
 assert.deepEqual(of1.map(t=>t.name).sort(),['openf1_lap_telemetry','openf1_laps','openf1_sessions']);
 assert.ok(of1.every(t=>t.run_with==='kongboda_call'&&t.inputSchema));
 const all=JSON.parse((await call('kongboda_tools',{})).result.content[0].text);
 assert.ok(!all.tools.some(t=>t.name.startsWith('kongboda_tools')||t.name==='kongboda_call'));
});

test('kongboda_call runs a current tool with the same validation',async()=>{
 const bad=await call('kongboda_call',{name:'openf1_laps',arguments:{session_key:1,driver_number:'RUS'}});
 assert.equal(bad.result.isError,true);assert.match(bad.result.content[0].text,/racing number/);
 const missing=await call('kongboda_call',{name:'openf1_laps',arguments:{}});
 assert.equal(missing.error.code,-32602);
 const unknown=await call('kongboda_call',{name:'fastf1_lap_telemetry',arguments:{}});
 assert.equal(unknown.result.isError,true);assert.match(unknown.result.content[0].text,/kongboda_tools/);
 const direct=await call('fastf1_lap_telemetry',{});
 assert.equal(direct.error.code,-32602);assert.match(direct.error.message,/kongboda_tools/);
});

test('kongboda_call refuses tools that change data and needs login',async()=>{
 const write=await call('kongboda_call',{name:'kongboda_update_my_instructions',arguments:{}});
 assert.equal(write.result.isError,true);assert.match(write.result.content[0].text,/changes data/);
 const anon=await call('kongboda_tools',{},false);
 assert.equal(anon.result.isError,true);
});
