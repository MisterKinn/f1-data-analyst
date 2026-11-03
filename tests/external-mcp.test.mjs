import {test} from 'node:test';
import assert from 'node:assert/strict';
import {issueMcpToken,revokeMcpToken,externalMcpAccount,EXTERNAL_MCP_UNAVAILABLE} from '../worker/external-mcp.js';
import {accountIdentity,accountRoute} from '../worker/accounts.js';
import worker from '../worker/index.js';

const origin='https://kongboda-motorsports.jeongmin480.chatgpt.site';
const headers={'oai-authenticated-user-id':'site-user','oai-authenticated-user-email':'member@example.com',origin};
function environment(){const data=new Map();return {data,BUCKET:{get:async k=>data.has(k)?{json:async()=>JSON.parse(data.get(k))}:null,put:async(k,v)=>data.set(k,v),delete:async k=>data.delete(k)}};}
const account=async e=>(await accountIdentity(new Request(origin+'/account',{headers}),e,null,{create:true})).account;
const call=(authorization='Bearer kbm_'+'a'.repeat(64))=>new Request(origin+'/api/mcp',{method:'POST',headers:{authorization},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})});

test('generic external MCP credentials cannot be issued or accepted',async()=>{
 const env=environment(),member=await account(env);
 await assert.rejects(()=>issueMcpToken(env,member),new RegExp(EXTERNAL_MCP_UNAVAILABLE));
 assert.equal(await externalMcpAccount(call(),env),null);
 const response=await worker.fetch(call(),env,{});
 assert.equal(response.status,401);
 assert.equal((await response.json()).error,EXTERNAL_MCP_UNAVAILABLE);
});

test('legacy credential records can be removed but cannot authenticate',async()=>{
 const env=environment(),member=await account(env),digest='b'.repeat(64);
 env.data.set('website-accounts/account/'+member.id+'.json',JSON.stringify({...member,mcpTokenHash:digest}));
 env.data.set('website-accounts/mcp-token/'+digest+'.json',JSON.stringify({accountId:member.id,version:2,expiresAt:Date.now()+10000}));
 assert.equal(await externalMcpAccount(call(),env),null);
 await revokeMcpToken(env,member);
 assert.equal(env.data.has('website-accounts/mcp-token/'+digest+'.json'),false);
 assert.equal(JSON.parse(env.data.get('website-accounts/account/'+member.id+'.json')).mcpTokenHash,undefined);
});

test('credential endpoint keeps origin checks and fails closed for registered accounts',async()=>{
 const env=environment();
 const request=h=>new Request(origin+'/account/mcp-token',{method:'POST',headers:h});
 assert.equal((await accountRoute(request({origin}),env,null)).status,401);
 assert.equal((await accountRoute(request({...headers,origin:'https://evil.test'}),env,null)).status,403);
 await account(env);
 const response=await accountRoute(request(headers),env,null);
 assert.equal(response.status,403);
 assert.equal(await response.text(),EXTERNAL_MCP_UNAVAILABLE);
});

test('official ChatGPT MCP remains available',async()=>{
 const response=await worker.fetch(new Request(origin+'/mcp',{method:'POST',headers,body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})}),environment(),{});
 assert.equal(response.status,200);
 assert.ok((await response.json()).result.tools.length>10);
});
