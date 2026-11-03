import {test} from 'node:test';
import assert from 'node:assert/strict';
import {googleAuthRoute,googleIdentity} from '../worker/google-auth.js';
import worker from '../worker/index.js';
const origin='https://kongboda-motorsports.jeongmin480.chatgpt.site';
const req=(path,options)=>new Request(origin+path,options);
function environment(){const data=new Map();return {data,GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret',BUCKET:{async get(k){return data.has(k)?{json:async()=>JSON.parse(data.get(k))}:null},async put(k,v){data.set(k,v)},async delete(k){data.delete(k)}}};}
async function begin(env,back='/championships/imsa'){const r=await googleAuthRoute(req('/auth/google/start?return_to='+encodeURIComponent(back)),env);return {r,url:new URL(r.headers.get('location')),cookie:r.headers.get('set-cookie').split(';')[0]};}
test('Google setup fails closed, reserved provider routes remain untouched and return paths cannot escape',async()=>{
 assert.equal((await googleAuthRoute(req('/auth/google/start'),{})).status,503);
 assert.equal(await googleAuthRoute(req('/callback'),{}),null);
 const env=environment(),a=await begin(env,'//evil.test');
 assert.equal(a.r.status,303);assert.equal(a.url.origin,'https://accounts.google.com');assert.equal(a.url.searchParams.get('scope'),'openid email profile');assert.equal(a.url.searchParams.get('code_challenge_method'),'S256');assert.ok(a.url.searchParams.get('nonce'));assert.ok(a.url.searchParams.get('state'));
 assert.match(a.r.headers.get('set-cookie'),/Secure; HttpOnly; SameSite=Lax/);assert.equal(JSON.parse([...env.data.values()][0]).back,'/');
 assert.equal((await googleAuthRoute(req('/auth/google/start',{headers:{'sec-fetch-site':'cross-site'}}),env)).status,403);
 assert.equal((await googleAuthRoute(req('/auth/google/logout'),env)).status,405);
 assert.equal((await googleAuthRoute(req('/auth/google/logout',{method:'POST',headers:{origin:'https://evil.test'}}),env)).status,403);
});
test('OIDC state, nonce, signature, audience, expiry and browser session are enforced',async()=>{
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);Object.assign(jwk,{kid:'test-key',use:'sig',alg:'RS256'});
 const b64=value=>Buffer.from(typeof value==='string'?value:JSON.stringify(value)).toString('base64url');
 const original=globalThis.fetch;let tokenClaims={},badSignature=false,nonce='',calls=0;
 globalThis.fetch=async(url,options)=>{
  calls++;if(String(url).includes('/certs'))return Response.json({keys:[jwk]});
  assert.equal(String(url),'https://oauth2.googleapis.com/token');assert.equal(options.redirect,'manual');assert.ok(new URLSearchParams(options.body).get('code_verifier'));
  const now=Math.floor(Date.now()/1000),claims={iss:'https://accounts.google.com',aud:'test-client',sub:'google-sub',iat:now,exp:now+3600,nonce,email:'driver@example.com',email_verified:true,...tokenClaims};
  const input=b64({alg:'RS256',kid:'test-key'})+'.'+b64(claims);const signature=new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(input)));if(badSignature)signature[0]^=1;
  return Response.json({access_token:'not-persisted-access',token_type:'Bearer',id_token:input+'.'+Buffer.from(signature).toString('base64url')});
 };
 try{
  for(const invalid of [{aud:'wrong'},{exp:1},{nonce:'wrong'},{email_verified:false},{badSignature:true}]){
   const env=environment(),a=await begin(env);nonce=a.url.searchParams.get('nonce');tokenClaims={...invalid};badSignature=!!invalid.badSignature;
   const r=await googleAuthRoute(req('/auth/google/callback?code=test&state='+a.url.searchParams.get('state'),{headers:{cookie:a.cookie}}),env);assert.equal(r.status,400);assert.equal([...env.data.keys()].some(k=>k.includes('/session/')),false);
  }
  tokenClaims={};badSignature=false;const env=environment(),a=await begin(env);nonce=a.url.searchParams.get('nonce');
  const before=calls;const wrong=await googleAuthRoute(req('/auth/google/callback?code=test&state=wrong',{headers:{cookie:a.cookie}}),env);assert.equal(wrong.status,400);assert.equal(calls,before);
  const b=await begin(env);nonce=b.url.searchParams.get('nonce');const callback=req('/auth/google/callback?code=test&state='+b.url.searchParams.get('state'),{headers:{cookie:b.cookie}});
  const success=await googleAuthRoute(callback,env);assert.equal(success.status,303);assert.equal(success.headers.get('location'),'/championships/imsa');
  assert.match(success.headers.getSetCookie().find(c=>c.startsWith('__Host-kongboda-google=')),/Max-Age=2592000/);
  const cookie=success.headers.getSetCookie().find(c=>c.startsWith('__Host-kongboda-google=')).split(';')[0];
  assert.deepEqual(await googleIdentity(req('/',{headers:{cookie}}),env),{email:'driver@example.com',provider:'google',sub:'google-sub'});
  const sessionKey=[...env.data.keys()].find(k=>k.includes('/session/'));const session=JSON.parse(env.data.get(sessionKey));assert.equal(session.expires-session.issuedAt,30*86400*1000);
  const future=Date.now;Date.now=()=>session.issuedAt+29*86400*1000;try{assert.ok(await googleIdentity(req('/',{headers:{cookie}}),env));}finally{Date.now=future;}
  assert.doesNotMatch([...env.data.values()].join(''),/not-persisted-access|id_token|test-secret/);
  assert.equal((await googleAuthRoute(callback,env)).status,400);
  // A website Google session cannot authenticate MCP or owner-only endpoints.
  const mcp=await worker.fetch(req('/mcp',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'get_seasons',arguments:{}}})}),env);assert.equal(mcp.status,200);const challenge=await mcp.json();assert.equal(challenge.result.isError,true);assert.ok(challenge.result._meta['mcp/www_authenticate']);
  assert.equal((await googleAuthRoute(req('/auth/google/logout',{method:'POST',headers:{cookie,origin}}),env)).status,303);assert.equal(await googleIdentity(req('/',{headers:{cookie}}),env),null);
 }finally{globalThis.fetch=original;}
});
