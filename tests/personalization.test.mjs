import {test} from 'node:test';import assert from 'node:assert/strict';import worker from '../worker/index.js';import {accountIdentity,accountRoute} from '../worker/accounts.js';
test('MCP reads current account preferences through the official ChatGPT plugin without leaking another account',async()=>{
 const data=new Map(),env={BUCKET:{get:async k=>data.has(k)?{json:async()=>JSON.parse(data.get(k))}:null,put:async(k,v)=>data.set(k,v),delete:async k=>data.delete(k)}};
 const origin='https://kongboda-motorsports.jeongmin480.chatgpt.site',headers={'oai-authenticated-user-id':'one','oai-authenticated-user-email':'one@example.com',origin};
 const a=(await accountIdentity(new Request(origin+'/account',{headers}),env,null,{create:true})).account;
 const save=await accountRoute(new Request(origin+'/account/preferences',{method:'POST',headers,body:new URLSearchParams([['team','Haas'],['driver','Bearman'],['manufacturer','Genesis']])}),env,null);assert.equal(save.status,303);
 const call=async(path,h,args={})=>(await worker.fetch(new Request(origin+path,{method:'POST',headers:h,body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'kongboda_my_preferences',arguments:args}})}),env,{}));
 const one=await (await call('/mcp',headers)).json();const p=JSON.parse(one.result.content[0].text);assert.equal(p.preferences.f1Team,'Haas');assert.deepEqual(p.preferences.f1Drivers,['Bearman']);assert.equal(p.preferences.wecHypercarManufacturer,'Genesis');assert.ok(!JSON.stringify(one).includes('one@example.com'));
 const blocked=await call('/api/mcp',{authorization:'Bearer kbm_'+'a'.repeat(64)});assert.equal(blocked.status,401);
 const other=await (await call('/mcp',{'oai-authenticated-user-id':'two','oai-authenticated-user-email':'two@example.com'})).json();assert.equal(JSON.parse(other.result.content[0].text).configured,false);
 const blockedMcp=await call('/mcp',{});assert.equal(blockedMcp.status,200);const challenge=await blockedMcp.json();assert.equal(challenge.result.isError,true);assert.ok(challenge.result._meta['mcp/www_authenticate']);
 const invalid=await (await call('/mcp',headers,{accountId:a.id})).json();assert.ok(invalid.error);
});
