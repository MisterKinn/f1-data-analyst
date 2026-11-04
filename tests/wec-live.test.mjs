import test from 'node:test';
import assert from 'node:assert/strict';
import {publicWecStatus,safeWecUrl,wecLiveCall} from '../worker/wec_live.js';
import worker from '../worker/index.js';

test('WEC status does not disclose credentials, signed URLs or assert live',()=>{
 const result=publicWecStatus({state:'snapshot_unverified',live:true,checked_at:new Date().toISOString(),timing_url:'https://fiawec.alkamelsystems.com/timing?token=secret',password:'secret',records:[{'No.':'007',Lap:'3',token:'secret'}]});
 assert.equal(result.live,false);assert.equal(result.timing_url,null);assert.equal(JSON.stringify(result).includes('secret'),false);assert.equal(result.records[0]['No.'],'007');
 assert.equal(safeWecUrl('https://evil.test'),null);
});
test('WEC discovery uses existing authenticated collector and status is a separate read',async()=>{
 const original=globalThis.fetch,calls=[];
 globalThis.fetch=async(url,options)=>{calls.push({url:String(url),options});return Response.json({state:'waiting_for_session',live:false});};
 try{
  const env={FASTF1_CLOUD_URL:'https://collector.test',FASTF1_CLOUD_KEY:'fixture-key'};
  await wecLiveCall('wec_discover_live',{event:'Monza',year:2026,session:'FP1'},env);
  await wecLiveCall('wec_live_status',{},env);
  assert.equal(calls[0].url,'https://collector.test/wec/discover');assert.equal(calls[0].options.method,'POST');
  assert.equal(JSON.parse(calls[0].options.body).event,'Monza');assert.equal(calls[0].options.headers.Authorization,'Bearer fixture-key');
  assert.equal(calls[1].options.method,'GET');assert.equal(calls[1].options.body,undefined);
  globalThis.fetch=async()=>new Response('missing',{status:404});
  await assert.rejects(wecLiveCall('wec_live_status',{},env),/수집 서버/);
 }finally{globalThis.fetch=original;}
});
test('MCP requires existing visitor authentication for WEC discovery',async()=>{
 const req=new Request('https://test/mcp',{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'wec_discover_live',arguments:{event:'Monza'}}})});
 const blocked=await worker.fetch(req,{});assert.equal(blocked.status,200);const challenge=await blocked.json();assert.equal(challenge.result.isError,true);assert.ok(challenge.result._meta['mcp/www_authenticate']);
 const html=await (await worker.fetch(new Request('https://test/championships/wec'),{})).text();
 assert.doesNotMatch(html,/세션·타이밍 링크 찾기/);assert.match(html,/챔피언십 포인트/);
});
test('WEC discovery is routed through MCP and rejects unexpected parameters',async()=>{
 const original=globalThis.fetch;
 const env={FASTF1_CLOUD_URL:'https://collector.test',FASTF1_CLOUD_KEY:'fixture-key'};
 const rpc=async args=>(await worker.fetch(new Request('https://test/mcp',{method:'POST',headers:{'oai-authenticated-user-id':'fixture-viewer'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'wec_discover_live',arguments:args}})}),env)).json();
 try{
  globalThis.fetch=async()=>Response.json({state:'discovering',live:false});
  const result=await rpc({event:'Monza',year:2026,session:'FP1'});
  assert.equal(JSON.parse(result.result.content[0].text).state,'discovering');
  assert.equal((await rpc({event:'Monza',url:'https://evil.test'})).error.code,-32602);
  assert.equal((await rpc({event:'Monza',session:'Sprint'})).error.code,-32602);
  const script=await (await worker.fetch(new Request('https://test/assets/website.js'),{})).text();
  new Function(script); // Parse shipped client code without using a browser.
 }finally{globalThis.fetch=original;}
});
