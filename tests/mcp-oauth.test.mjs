import {createHash} from 'node:crypto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authenticateMcpBearer,mcpOAuthRoute,oauthMetadata,protectedResourceMetadata} from '../server/mcp-oauth.js';

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

test('metadata advertises OAuth 2.1 PKCE, DCR, refresh tokens and the canonical resource',()=>{
 const env=environment(),metadata=oauthMetadata(request('/'),env),resource=protectedResourceMetadata(request('/'),env);
 assert.equal(metadata.issuer,origin);assert.equal(metadata.authorization_response_iss_parameter_supported,true);
 assert.deepEqual(metadata.code_challenge_methods_supported,['S256']);assert.ok(metadata.scopes_supported.includes('offline_access'));
 assert.equal(metadata.registration_endpoint,origin+'/oauth/register');assert.equal(resource.resource,origin);assert.deepEqual(resource.authorization_servers,[origin]);
});

test('DCR, Google consent, authorization code PKCE, refresh rotation and revocation work end to end',async()=>{
 const env=environment(),redirect='https://chatgpt.com/connector_platform_oauth_redirect';
 let response=await mcpOAuthRoute(request('/oauth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({client_name:'ChatGPT',redirect_uris:[redirect],token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code']})}),env);
 assert.equal(response.status,201);const registration=await response.json();assert.match(registration.client_id,/^kbc_/);assert.equal(registration.client_secret,undefined);
 const verifier='v'.repeat(64),challenge=createHash('sha256').update(verifier).digest('base64url');
 const query=new URLSearchParams({response_type:'code',client_id:registration.client_id,redirect_uri:redirect,state:'state-123',resource:origin,code_challenge:challenge,code_challenge_method:'S256',scope:'mcp:read offline_access'});
 response=await mcpOAuthRoute(request('/oauth/authorize?'+query),env);assert.equal(response.status,303);assert.match(response.headers.get('location'),/^\/auth\/google\/start/);
 const identity={sub:'google-user',email:'driver@example.test',name:'Driver'};
 response=await mcpOAuthRoute(request('/oauth/authorize?'+query),env,identity);assert.equal(response.status,200);assert.match(await response.text(),/Kongboda Motorsports 연결/);
 const csrfCookie=response.headers.get('set-cookie').split(';')[0],csrf=csrfCookie.slice(csrfCookie.indexOf('=')+1);
 const approval=new URLSearchParams({clientId:registration.client_id,redirectUri:redirect,state:'state-123',resource:origin,challenge,scope:'mcp:read offline_access',csrf,decision:'approve'});
 response=await mcpOAuthRoute(request('/oauth/authorize',{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded',cookie:csrfCookie},body:approval}),env,identity);
 assert.equal(response.status,303);const callback=new URL(response.headers.get('location'));assert.equal(callback.searchParams.get('state'),'state-123');assert.equal(callback.searchParams.get('iss'),origin);const code=callback.searchParams.get('code');assert.ok(code);
 const exchange=new URLSearchParams({grant_type:'authorization_code',client_id:registration.client_id,redirect_uri:redirect,resource:origin,code,code_verifier:verifier});
 const wrongExchange=new URLSearchParams(exchange);wrongExchange.set('code_verifier','x'.repeat(64));response=await mcpOAuthRoute(request('/oauth/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:wrongExchange}),env);assert.equal(response.status,400);
 response=await mcpOAuthRoute(request('/oauth/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:exchange}),env);assert.equal(response.status,200);const tokens=await response.json();assert.match(tokens.access_token,/^kbo_access_/);assert.match(tokens.refresh_token,/^kbo_refresh_/);assert.equal(tokens.expires_in,3600);
 const authenticated=await authenticateMcpBearer(request('/mcp',{headers:{authorization:'Bearer '+tokens.access_token}}),env);assert.deepEqual(authenticated,identity);
 assert.equal((await mcpOAuthRoute(request('/oauth/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:exchange}),env)).status,400);
 const refresh=new URLSearchParams({grant_type:'refresh_token',client_id:registration.client_id,resource:origin,refresh_token:tokens.refresh_token});
 response=await mcpOAuthRoute(request('/oauth/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:refresh}),env);assert.equal(response.status,200);const rotated=await response.json();assert.notEqual(rotated.refresh_token,tokens.refresh_token);
 assert.equal((await mcpOAuthRoute(request('/oauth/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:refresh}),env)).status,400);
 response=await mcpOAuthRoute(request('/oauth/revoke',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:rotated.access_token})}),env);assert.equal(response.status,200);
 assert.equal(await authenticateMcpBearer(request('/mcp',{headers:{authorization:'Bearer '+rotated.access_token}}),env),null);
 assert.doesNotMatch([...env.data.values()].join('\n'),new RegExp(tokens.access_token+'|'+tokens.refresh_token));
});

test('DCR rejects arbitrary callbacks and token exchange rejects the wrong resource',async()=>{
 const env=environment();
 let response=await mcpOAuthRoute(request('/oauth/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({redirect_uris:['https://evil.example/callback']})}),env);assert.equal(response.status,400);assert.equal((await response.json()).error,'invalid_redirect_uri');
 response=await mcpOAuthRoute(request('/oauth/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:'unknown',resource:'https://evil.example'})}),env);assert.equal(response.status,401);
});
