import{test}from'node:test';import assert from'node:assert/strict';
import{createHash}from'node:crypto';
import{oauthAccountState,oauthGrantActive,invalidateAccountOAuth}from'../worker/oauth-account-state.js';
import{authenticateMcpBearer,mcpOAuthRoute}from'../server/mcp-oauth.js';
const hash=s=>createHash('sha256').update(s).digest('hex');
function fixture(){const data=new Map();return{data,APP_ORIGIN:'https://preview.invalid',BUCKET:{get:async k=>data.has(k)?{json:async()=>JSON.parse(data.get(k))}:null,put:async(k,v)=>{data.set(k,v);return{etag:'fixture'};},delete:async k=>data.delete(k)}};}

test('deletion revokes old grants after rejoin without changing another account or crew records',async()=>{
 const env=fixture(),sub='fixture-sub',other='other-sub',old={profile:{sub}};
 env.data.set('crew/fixture','untouched');
 assert.equal(await oauthGrantActive(env,old),true);await invalidateAccountOAuth(env,sub);
 assert.equal(await oauthGrantActive(env,old),false);assert.equal(await oauthGrantActive(env,{profile:{sub:other}}),true);
 const identityKey='website-accounts/identity/'+hash('google:'+sub)+'.json';env.data.set(identityKey,JSON.stringify({deleted:true}));
 const generation=(await oauthAccountState(env,sub)).generation;
 assert.equal(await oauthGrantActive(env,{profile:{sub},accountGeneration:generation}),false);
 env.data.set(identityKey,JSON.stringify({accountId:'new-account'}));
 assert.equal(await oauthGrantActive(env,old),false);assert.equal(await oauthGrantActive(env,{profile:{sub},accountGeneration:generation}),true);
 assert.equal(env.data.get('crew/fixture'),'untouched');
});

test('real bearer and refresh endpoints reject grants revoked by account deletion',async()=>{
 const env=fixture(),origin=env.APP_ORIGIN,sub='fixture-sub',clientId='kbc_'+'c'.repeat(43),access='kbo_access_'+'a'.repeat(40),refresh='kbo_refresh_'+'r'.repeat(40);
 const key=(type,value)=>'website-auth/oauth/'+type+'/'+hash(value)+'.json';
 const record={clientId,resource:origin,issuer:origin,scope:'mcp:read offline_access',profile:{sub,email:'fixture@example.invalid'},expiresAt:Date.now()+60000};
 env.data.set(key('client',clientId),JSON.stringify({clientId}));env.data.set(key('access',access),JSON.stringify(record));env.data.set(key('refresh',refresh),JSON.stringify(record));
 const request=new Request(origin+'/mcp',{headers:{authorization:'Bearer '+access}});assert.ok(await authenticateMcpBearer(request,env));
 await invalidateAccountOAuth(env,sub);assert.equal(await authenticateMcpBearer(request,env),null);
 const response=await mcpOAuthRoute(new Request(origin+'/oauth/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:clientId,resource:origin,refresh_token:refresh})}),env);
 assert.equal(response.status,400);assert.equal((await response.json()).error,'invalid_grant');
});
