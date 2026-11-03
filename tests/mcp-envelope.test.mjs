import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import {LIVE_APP_URI} from '../worker/mcp-app.js';
const call=async(method,params={},headers={})=>{
 const request=new Request('https://example.test/mcp',{method:'POST',
 headers:{'content-type':'application/json',...headers},
 body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
 return (await worker.fetch(request,{})).json();
};
test('modern UI resource reads have the required complete discriminator',async()=>{
 for(const params of [{uri:LIVE_APP_URI},{uri:LIVE_APP_URI,_meta:{'io.modelcontextprotocol/protocolVersion':'2026-07-28'}}]){
  const result=await call('resources/read',params,params._meta?{}:{'mcp-protocol-version':'2026-07-28'});
  assert.equal(result.result.resultType,'complete');
  assert.equal(result.result.ttlMs,0);
  assert.equal(result.result.cacheScope,'private');
  assert.equal(result.result.contents[0].mimeType,'text/html;profile=mcp-app');
  assert.match(result.result.contents[0].text,/ui\/initialize/);
 }
});
test('modern catalog results are complete and legacy results retain their wire shape',async()=>{
 for(const method of ['resources/list','tools/list','ping']){
  assert.equal((await call(method,{}, {'mcp-protocol-version':'2026-07-28'})).result.resultType,'complete');
  assert.equal((await call(method)).result.resultType,undefined);
  if(method!=='ping'){
   const modern=(await call(method,{}, {'mcp-protocol-version':'2026-07-28'})).result;
   assert.equal(modern.ttlMs,0);assert.equal(modern.cacheScope,'private');
  }
 }
 const legacy=await call('resources/read',{uri:LIVE_APP_URI});
 assert.equal(legacy.result.resultType,undefined);
 assert.equal(legacy.result.ttlMs,undefined);assert.equal(legacy.result.cacheScope,undefined);
});
test('unknown UI resources remain RPC errors in the modern protocol',async()=>{
 const result=await call('resources/read',{uri:'ui://unknown'}, {'mcp-protocol-version':'2026-07-28'});
 assert.equal(result.error.code,-32602);
 assert.equal(result.result,undefined);
});
