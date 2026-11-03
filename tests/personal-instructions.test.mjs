import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import {accountIdentity,accountRoute} from '../worker/accounts.js';
import {DEFAULT_INSTRUCTIONS,saveInstructions,readInstructions} from '../worker/personal-instructions.js';
const origin='https://kongboda-motorsports.jeongmin480.chatgpt.site';
const headers=id=>({'oai-authenticated-user-id':id,'oai-authenticated-user-email':id+'@example.test',origin});
function environment(){const data=new Map();return {data,BUCKET:{get:async k=>{const s=data.get(k);return s?{etag:s.etag,json:async()=>JSON.parse(s.text)}:null;},put:async(k,text,o={})=>{const old=data.get(k);if(o.onlyIf?.etagMatches&&old?.etag!==o.onlyIf.etagMatches||o.onlyIf?.etagDoesNotMatch==='*'&&old)return null;const value={text,etag:crypto.randomUUID()};data.set(k,value);return value;},delete:async k=>data.delete(k)}};}
const rpc=(name,args={},h=headers('one'),path='/mcp')=>new Request(origin+path,{method:'POST',headers:h,body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})});
const unpack=async response=>{const d=await response.json();return d.result?.content?JSON.parse(d.result.content[0].text):d;};

test('FIA review is shared policy; an empty personal field does not erase user-saved text',async()=>{
 const env=environment(),account={id:'test-account'};
 assert.equal(DEFAULT_INSTRUCTIONS,'');
 assert.equal((await readInstructions(env,account)).text,'');
 const written='F1과 WEC의 주요 FIA 문서를 확인해 핵심 변경사항과 경기 영향을 알림으로 보내줘.';
 await saveInstructions(env,account,written,0);
 assert.equal((await readInstructions(env,account)).text,written);
});
test('website and AI share private instructions; defaults, account isolation, stale edits and clearing',async()=>{
 const env=environment();const a=(await accountIdentity(new Request(origin+'/account',{headers:headers('one')}),env,null,{create:true})).account;
 const get=async()=>unpack(await worker.fetch(rpc('kongboda_my_preferences'),env,{}));
 assert.equal((await get()).personalInstructions.text,DEFAULT_INSTRUCTIONS);
 const saved=await unpack(await worker.fetch(rpc('kongboda_update_my_instructions',{instructions:'한국어로 짧게. <script>태그도 텍스트</script>',expected_revision:0}),env,{}));
 assert.equal(saved.saved,true);assert.equal(saved.notificationsScheduled,false);
 const website=await (await accountRoute(new Request(origin+'/account/instructions',{headers:headers('one')}),env,null)).json();assert.equal(website.text,saved.personalInstructions.text);
 const html=await (await worker.fetch(new Request(origin+'/account',{headers:headers('one')}),env,{})).text();assert.match(html,/나만의 MCP 지침/);assert.doesNotMatch(html,/<script>태그도/);
 const form=new URLSearchParams({instructions:'F1과 WEC 문서를 알려줘',revision:String(website.revision)});
 const response=await accountRoute(new Request(origin+'/account/instructions',{method:'POST',headers:{...headers('one'),accept:'application/json'},body:form}),env,null);assert.equal(response.status,200);
 assert.equal((await get()).personalInstructions.text,'F1과 WEC 문서를 알려줘');
 const stale=await worker.fetch(rpc('kongboda_update_my_instructions',{instructions:'stale',expected_revision:0}),env,{});assert.equal((await stale.json()).result.isError,true);
 const clear=await unpack(await worker.fetch(rpc('kongboda_update_my_instructions',{instructions:'',expected_revision:2}),env,{}));assert.equal(clear.personalInstructions.text,'');assert.equal((await get()).personalInstructions.text,'');
 const other=await unpack(await worker.fetch(rpc('kongboda_my_preferences',{},headers('two')),env,{}));assert.notEqual(other.personalInstructions.text,'F1과 WEC 문서를 알려줘');
 const target=await worker.fetch(rpc('kongboda_update_my_instructions',{instructions:'hack',expected_revision:3,accountId:a.id},headers('two')),env,{});assert.ok((await target.json()).error);
 const blocked=await worker.fetch(rpc('kongboda_update_my_instructions',{instructions:'x',expected_revision:3},{}),env,{});assert.equal(blocked.status,200);const challenge=await blocked.json();assert.equal(challenge.result.isError,true);assert.ok(challenge.result._meta['mcp/www_authenticate']);
 assert.equal((await accountRoute(new Request(origin+'/account/instructions',{method:'POST',headers:{...headers('one'),origin:'https://evil.test'},body:form}),env,null)).status,403);
 const invalid=await worker.fetch(rpc('kongboda_update_my_instructions',{instructions:'x'.repeat(4001),expected_revision:3}),env,{});const bad=await invalid.json();assert.ok(bad.error||bad.result.isError);
});
test('concurrent writes cannot overwrite each other and account deletion removes personal text',async()=>{
 const env=environment();const a=(await accountIdentity(new Request(origin+'/account',{headers:headers('one')}),env,null,{create:true})).account;
 const settled=await Promise.allSettled([saveInstructions(env,a,'one',0),saveInstructions(env,a,'two',0)]);assert.equal(settled.filter(x=>x.status==='fulfilled').length,1);
 const response=await accountRoute(new Request(origin+'/account/delete',{method:'POST',headers:headers('one'),body:new URLSearchParams({confirmation:'탈퇴'})}),env,null);assert.equal(response.status,303);
 assert.equal([...env.data.keys()].some(k=>k.startsWith('website-accounts/instructions/')),false);
});
