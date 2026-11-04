// Offline diagnostic: no real tokens, accounts, or services are touched.
import{createHash}from'node:crypto';import{writeFile}from'node:fs/promises';
import{accountIdentity,accountRoute}from'../worker/accounts.js';
import{authenticateMcpBearer,mcpOAuthRoute}from'../server/mcp-oauth.js';
const origin='https://kongboda-motorsports.vercel.app',data=new Map();
const env={APP_ORIGIN:origin,FIREBASE_AUTH_CONFIGURED:'true',BUCKET:{get:async key=>data.has(key)?{json:async()=>JSON.parse(data.get(key))}:null,put:async(key,value,options={})=>{if(options.onlyIf?.etagDoesNotMatch==='*'&&data.has(key))return null;data.set(key,value);return{etag:'fixture'};},delete:async key=>data.delete(key),list:async({prefix})=>({objects:[...data.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key})),truncated:false})}};
const profile={sub:'fixture-only-google-sub',email:'fixture@example.invalid',name:'Fixture'},identity={...profile,provider:'google'};
const hash=s=>createHash('sha256').update(s).digest('hex'),key=(type,value)=>'website-auth/oauth/'+type+'/'+hash(value)+'.json';
await accountIdentity(new Request(origin+'/account'),env,identity,{create:true});
const access='kbo_access_'+'a'.repeat(40),refresh='kbo_refresh_'+'r'.repeat(40),clientId='kbc_'+'c'.repeat(43);
const record={clientId,resource:origin,issuer:origin,scope:'mcp:read offline_access',profile,issuedAt:Date.now(),expiresAt:Date.now()+600000};
data.set(key('access',access),JSON.stringify(record));data.set(key('refresh',refresh),JSON.stringify(record));data.set(key('client',clientId),JSON.stringify({clientId,redirectUris:['https://chatgpt.com/connector_platform_oauth_redirect']}));
const deletion=await accountRoute(new Request(origin+'/account/delete',{method:'POST',headers:{origin},body:new URLSearchParams({confirmation:'탈퇴'})}),env,identity);
const bearerStillValid=!!await authenticateMcpBearer(new Request(origin+'/mcp',{headers:{authorization:'Bearer '+access}}),env);
const refreshed=await mcpOAuthRoute(new Request(origin+'/oauth/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:clientId,resource:origin,refresh_token:refresh})}),env);
const after=await accountIdentity(new Request(origin+'/account'),env,identity);
const result={scope:'Offline fixtures only',deletionStatus:deletion.status,accountTombstoneBlocksAccount:after.account.deleted===true,bearerHelperStillAcceptsDeletedIdentity:bearerStillValid,refreshStatusAfterDeletion:refreshed.status,important:'After fix: old access and refresh grants must be rejected; crew policy remains separate.'};
await writeFile('../verification/oauth-deletion.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));

if(result.bearerHelperStillAcceptsDeletedIdentity||result.refreshStatusAfterDeletion===200)process.exitCode=1;
