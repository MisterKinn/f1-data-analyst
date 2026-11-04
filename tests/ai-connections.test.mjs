import {createHash} from 'node:crypto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mcpOAuthRoute,authenticateMcpBearer} from '../server/mcp-oauth.js';
import {aiClientFamily,aiConnectionStatus,recordAiConnection,CONNECTION_ACTIVE_MS} from '../worker/ai-connections.js';
import {invalidateAccountOAuth} from '../worker/oauth-account-state.js';
import {calendarRoute} from '../worker/calendar-refresh.js';

const origin='https://kongboda-motorsports.vercel.app';
function environment(){
 const data=new Map();
 return {APP_ORIGIN:origin,data,BUCKET:{
  async get(key){return data.has(key)?{json:async()=>JSON.parse(data.get(key))}:null;},
  async put(key,value,options={}){if(options.onlyIf?.etagDoesNotMatch==='*'&&data.has(key))return null;data.set(key,value);return {key,etag:'test'};},
  async delete(key){data.delete(key);}
 }};
}
const request=(path,options={})=>new Request(origin+path,options);
const form=body=>({method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)});
const identity={sub:'google-user',email:'driver@example.test',name:'Driver'};
const byId=list=>Object.fromEntries(list.map(item=>[item.id,item]));

async function connect(env,redirect,clientName){
 let response=await mcpOAuthRoute(request('/oauth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({client_name:clientName,redirect_uris:[redirect]})}),env);
 const {client_id}=await response.json(),verifier='v'.repeat(64),challenge=createHash('sha256').update(verifier).digest('base64url');
 const query=new URLSearchParams({response_type:'code',client_id,redirect_uri:redirect,state:'s',resource:origin,code_challenge:challenge,code_challenge_method:'S256',scope:'mcp:read offline_access'});
 response=await mcpOAuthRoute(request('/oauth/authorize?'+query),env,identity);
 const csrf=(await response.text()).match(/name="csrf" value="([^"]+)"/)[1];
 response=await mcpOAuthRoute(request('/oauth/authorize',{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({clientId:client_id,redirectUri:redirect,state:'s',resource:origin,challenge,scope:'mcp:read offline_access',csrf,decision:'approve'})}),env,identity);
 const code=new URL(response.headers.get('location')).searchParams.get('code');
 response=await mcpOAuthRoute(request('/oauth/token',form({grant_type:'authorization_code',client_id,redirect_uri:redirect,resource:origin,code,code_verifier:verifier})),env);
 return {client_id,...await response.json()};
}

test('AI family comes only from the enforced redirect host, never the client name',()=>{
 assert.equal(aiClientFamily('https://claude.ai/api/mcp/auth_callback'),'claude');
 assert.equal(aiClientFamily('https://chatgpt.com/connector_platform_oauth_redirect'),'chatgpt');
 assert.equal(aiClientFamily('https://evilclaude.ai/cb'),null);
 assert.equal(aiClientFamily('not a url'),null);
});

test('account page status reflects real Claude and ChatGPT OAuth grants, use and revocation',async()=>{
 const env=environment();
 assert.deepEqual((await aiConnectionStatus(env,identity.sub)).map(c=>c.state),['none','none']);
 // A client calling itself "Claude" but redirecting to ChatGPT counts as ChatGPT.
 const chatgpt=await connect(env,'https://chatgpt.com/connector_platform_oauth_redirect','Claude');
 let status=byId(await aiConnectionStatus(env,identity.sub));
 assert.equal(status.chatgpt.state,'connected');assert.equal(status.claude.state,'none');
 const claude=await connect(env,'https://claude.ai/api/mcp/auth_callback','Claude');
 assert.deepEqual(await authenticateMcpBearer(request('/mcp',{headers:{authorization:'Bearer '+claude.access_token}}),env),identity);
 status=byId(await aiConnectionStatus(env,identity.sub));
 assert.equal(status.claude.state,'connected');assert.ok(status.claude.lastUsedAt);
 // Revoking an access token alone keeps the link; revoking the refresh token disconnects.
 await mcpOAuthRoute(request('/oauth/revoke',form({token:chatgpt.access_token})),env);
 assert.equal(byId(await aiConnectionStatus(env,identity.sub)).chatgpt.state,'connected');
 await mcpOAuthRoute(request('/oauth/revoke',form({token:chatgpt.refresh_token})),env);
 status=byId(await aiConnectionStatus(env,identity.sub));
 assert.equal(status.chatgpt.state,'revoked');assert.equal(status.claude.state,'connected');
 // Old activity expires; account deletion/rejoin invalidates every grant.
 assert.equal(byId(await aiConnectionStatus(env,identity.sub,Date.now()+CONNECTION_ACTIVE_MS+1000)).claude.state,'expired');
 await invalidateAccountOAuth(env,identity.sub);
 assert.equal(byId(await aiConnectionStatus(env,identity.sub)).claude.state,'revoked');
});

test('a storage failure in status tracking never blocks token issuance',async()=>{
 const env=environment(),put=env.BUCKET.put.bind(env.BUCKET);
 env.BUCKET.put=async(key,...rest)=>{if(key.startsWith('website-auth/oauth/connections/'))throw Error('down');return put(key,...rest);};
 const tokens=await connect(env,'https://claude.ai/api/mcp/auth_callback','Claude');
 assert.match(tokens.access_token,/^kbo_access_/);
 assert.equal(await recordAiConnection(env,{profile:{sub:'x'},redirectUri:'https://example.test/cb'},'token'),false);
});

test('account page lists both AIs with their verified state and a refresh link',async()=>{
 const {websiteRoute}=await import('../worker/website.js');
 const html=await (await websiteRoute(new Request('https://example.test/account'),{google:{name:'T',email:'t@example.invalid',sub:'s'},googleReady:true,accountInfo:{account:{id:'a',name:'T',preferences:{},identities:[{provider:'google'}]}},aiConnections:[{id:'claude',label:'Claude',state:'connected',lastActiveAt:Date.UTC(2026,10,4,7,28)},{id:'chatgpt',label:'ChatGPT',state:'none'}]})).text();
 assert.match(html,/data-ai="claude"><strong>Claude<\/strong><span class="ai-badge">연결됨<\/span><small><span>마지막 확인<\/span> <time[^>]*>2026-11-04 16:28 KST/);
 assert.match(html,/class="ai-connection is-none" data-ai="chatgpt"><strong>ChatGPT<\/strong><span class="ai-badge">연결 기록 없음/);
 assert.match(html,/data-ai-refresh aria-label="연결 상태 새로고침"/);
});

test('manual calendar refresh is uncached and respects the per-source cooldown',async()=>{
 const env=environment(),now=Date.now();
 // Every source was attempted a minute ago, so the button must not hit official sites again.
 for(const series of ['f1','wec'])env.data.set('calendar-refresh/v1/'+series+'.json',JSON.stringify({events:[],checkedAt:now-60000,attemptedAt:now-60000,error:null}));
 const fetchBefore=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('blocked');};
 try{
  const response=await calendarRoute(request('/api/race-calendar?refresh=1&series=f1'),env,{},now);
  assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(calls,0);
  const normal=await calendarRoute(request('/api/race-calendar'),env,{},now);assert.match(normal.headers.get('cache-control'),/s-maxage=300/);
 }finally{globalThis.fetch=fetchBefore;}
});
