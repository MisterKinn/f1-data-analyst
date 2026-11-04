import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import {accountIdentity,accountRoute} from '../worker/accounts.js';
import {readMemberCrew} from '../worker/crew.js';
const origin='https://kongboda-motorsports.jeongmin480.chatgpt.site';
const headers={'oai-authenticated-user-id':'member','oai-authenticated-user-email':'member@example.test',origin};
function environment(){const data=new Map();return {data,BUCKET:{get:async k=>data.has(k)?{json:async()=>JSON.parse(data.get(k))}:null,put:async(k,v)=>data.set(k,v),delete:async k=>data.delete(k),list:async({prefix})=>({objects:[...data.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key})),truncated:false})}};}
test('account cards share an evenly spaced container; compact live key registration follows deletion and generic MCP credentials stay unavailable',async()=>{
 const env=environment();const a=(await accountIdentity(new Request(origin+'/account',{headers}),env,null,{create:true})).account;
 const page=async()=> (await worker.fetch(new Request(origin+'/account',{headers}),env,{})).text();
 let html=await page();assert.match(html,/class="account-settings"/);assert.match(html,/\.account-settings\{[^}]*display:grid;gap:24px/);assert.match(html,/@media\(max-width:650px\)\{\.account-settings\{gap:16px\}/);assert.match(html,/<summary class="button">탈퇴 진행/);assert.ok(html.indexOf('<h2>회원 탈퇴')<html.indexOf('class="account-key-footer"'));assert.match(html,/class="button small-button">비밀키 등록/);assert.match(html,/Claude와 ChatGPT에서 같은 주소와 Google 로그인으로 연결할 수 있습니다/);assert.doesNotMatch(html,/signin-with-chatgpt|계정 연결<\/button>|ChatGPT 연결 해제/);assert.doesNotMatch(html,/MCP 접속 키 발급|action="\/account\/mcp-token"/);assert.doesNotMatch(html,/id="crew-list-open"/);
 env.data.set('website-accounts/account/'+a.id+'.json',JSON.stringify({...a,liveAnalysisAccess:{activatedAt:1,revision:'1'}}));html=await page();assert.match(html,/id="crew-list-open"/);
 env.LIVE_ANALYSIS_KEY_REVISION='2';assert.doesNotMatch(await page(),/id="crew-list-open"/);
 const guide=await (await worker.fetch(new Request(origin+'/guide'),env,{})).text();assert.match(guide,/https:\/\/chatgpt.com\/plugins/);assert.match(guide,/https:\/\/claude.ai\/customize\/connectors/);assert.doesNotMatch(guide,/kongboda-motorsports\.vercel\.app\/mcp/);assert.match(guide,/자동으로 등록/);assert.doesNotMatch(guide,/Authorization에 발급값/);
});
test('member roster enforces current membership and returns only display names and self markers',async()=>{
 const env=environment();const a=(await accountIdentity(new Request(origin+'/account',{headers}),env,null,{create:true})).account;
 const route=()=>accountRoute(new Request(origin+'/account/crew',{headers}),env,null);
 assert.equal((await route()).status,403);
 const member={...a,name:'선원 A',preferences:{team:'Mercedes'},personalInstructions:'private',liveAnalysisAccess:{activatedAt:1,revision:'1'}};
 env.data.set('website-accounts/account/'+a.id+'.json',JSON.stringify(member));
 env.data.set('website-accounts/account/b.json',JSON.stringify({id:'b',name:'<img onerror=evil()>',email:'hidden@example.test',liveAnalysisAccess:{activatedAt:2,revision:'1'}}));
 env.data.set('website-accounts/account/old.json',JSON.stringify({name:'revoked',liveAnalysisAccess:{activatedAt:3,revision:'old'}}));
 env.data.set('website-accounts/account/deleted.json',JSON.stringify({deleted:true,name:'deleted',liveAnalysisAccess:{activatedAt:4,revision:'1'}}));
 const response=await route();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');const data=await response.json();assert.equal(data.crew.length,2);assert.deepEqual(Object.keys(data.crew[0]).sort(),['is_self','name']);assert.ok(data.crew.some(x=>x.is_self));assert.doesNotMatch(JSON.stringify(data),/hidden@example|private|preferences|revision|activatedAt|revoked|deleted/);
 assert.equal((await accountRoute(new Request(origin+'/account/crew'),env,null)).status,401);
 env.LIVE_ANALYSIS_KEY_REVISION='2';await assert.rejects(()=>readMemberCrew(env,member),/현재 선원/);
});
