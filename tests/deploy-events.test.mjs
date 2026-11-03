import assert from 'node:assert/strict';
import {eventRPC,deployRoute,verifyOIDC,callbackURL,EVENT_NAME,REPOSITORY,AUDIENCE} from '../worker/deploy_events.js';
import worker from '../worker/index.js';
const data=new Map();
const bucket={async get(k){return data.has(k)?{json:async()=>JSON.parse(data.get(k))}:null;},async put(k,v){data.set(k,v);},async delete(k){data.delete(k);},async list({prefix}){return {objects:[...data.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key})),truncated:false};}};
const env={BUCKET:bucket,DEPLOY_OWNER_EMAIL:'owner@example.com'};
const owner=new Request('https://site/mcp',{headers:{'oai-authenticated-user-id':'owner-id','oai-authenticated-user-email':'owner@example.com'}});
const viewer=new Request('https://site/mcp',{headers:{'oai-authenticated-user-id':'viewer-id','oai-authenticated-user-email':'viewer@example.com'}});
assert.equal((await eventRPC(viewer,env,{method:'events/list'})).events.length,0);
assert.equal((await eventRPC(owner,env,{method:'events/list'})).events[0].name,EVENT_NAME);
for(const url of ['http://chatgpt.com/hook','https://chatgpt.com.evil.test/hook','https://127.0.0.1/','https://user@api.openai.com/hook','https://api.openai.com:444/hook'])assert.throws(()=>callbackURL(url));
const params={name:EVENT_NAME,arguments:{repository:REPOSITORY},delivery:{mode:'webhook',url:'https://chatgpt.com/test-callback',secret:'whsec_'+Buffer.alloc(32,7).toString('base64')}};
await assert.rejects(eventRPC(viewer,env,{method:'events/subscribe',params}),/Only the Site owner/);
const originalFetch=globalThis.fetch;let verifications=0,deliveries=0,deliveryMode='ok';
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'test-key',alg:'RS256'};
globalThis.fetch=async(url,options)=>{
 assert.equal(options.redirect,'manual','Workers must reject redirects without using the unsupported error mode');
 if(String(url)==='https://token.actions.githubusercontent.com/.well-known/jwks')return Response.json({keys:[jwk]});
 assert.equal(url,params.delivery.url);assert.equal(options.redirect,'manual');
 const body=JSON.parse(options.body);assert.ok(options.headers['webhook-signature'].startsWith('v1,'));
 const key=await crypto.subtle.importKey('raw',Buffer.alloc(32,7),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const message=options.headers['webhook-id']+'.'+options.headers['webhook-timestamp']+'.'+options.body;
 assert.equal(await crypto.subtle.verify('HMAC',key,Buffer.from(options.headers['webhook-signature'].split(',')[1],'base64'),new TextEncoder().encode(message)),true);
 if(body.type==='verification'){verifications++;return deliveryMode==='redirect'?new Response(null,{status:302,headers:{location:'https://other.example/'}}):Response.json({challenge:body.challenge});}
 deliveries++;assert.equal(body.name,EVENT_NAME);assert.equal(body.data.repository,REPOSITORY);
 return new Response('',{status:deliveryMode==='gone'?410:200});
};
try{
 const s=await eventRPC(owner,env,{method:'events/subscribe',params});
 assert.ok(s.id.startsWith('sub_'));assert.equal(verifications,1);
 assert.equal((await eventRPC(owner,env,{method:'events/subscribe',params})).id,s.id);assert.equal(verifications,1);
 assert.equal(data.size,1);
 await assert.rejects(eventRPC(owner,env,{method:'events/subscribe',params:{...params,ttlMs:-1}}),/lifetime/);
 const now=Math.floor(Date.now()/1000);
 const claims={iss:'https://token.actions.githubusercontent.com',aud:AUDIENCE,repository:REPOSITORY,repository_id:'1432897498',ref:'refs/heads/main',workflow_ref:REPOSITORY+'/.github/workflows/deploy.yml@refs/heads/main',event_name:'push',exp:now+300,nbf:now-5,iat:now,sha:'a'.repeat(40),run_id:'123',run_attempt:'1',actor:'MisterKinn'};
 async function token(overrides={}){const parts=[Buffer.from(JSON.stringify({alg:'RS256',kid:'test-key'})).toString('base64url'),Buffer.from(JSON.stringify({...claims,...overrides})).toString('base64url')];return parts.join('.')+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(parts.join('.')))).toString('base64url');}
 assert.equal((await verifyOIDC(await token())).sha,claims.sha);
 for(const bad of [{repository_id:'1'},{aud:'wrong'},{ref:'refs/heads/other'},{event_name:'pull_request'},{workflow_ref:'other'},{exp:now-1},{iat:now-1000}])await assert.rejects(verifyOIDC(await token(bad)),/claims/);
 await assert.rejects(verifyOIDC((await token()).slice(0,-10)+'xxxxxxxxxx'));
 const request=async(path='/api/deploy-events',overrides={})=>new Request('https://site'+path,{method:'POST',headers:{authorization:'gateway-owned'},body:JSON.stringify({oidc:await token(overrides)})});
 assert.equal((await deployRoute(await request(),env)).status,200);assert.equal(deliveries,1);
 assert.equal((await deployRoute(await request(),env)).status,200);assert.equal(deliveries,1);
 assert.equal((await deployRoute(await request('/api/deploy-events/status'),env)).status,200);
 assert.equal((await deployRoute(new Request('https://site/api/deploy-events',{method:'POST'}),env)).status,401);
 await eventRPC(owner,env,{method:'events/unsubscribe',params});
 deliveryMode='redirect';
 await assert.rejects(eventRPC(owner,env,{method:'events/subscribe',params}),/Callback verification failed/);
 assert.equal([...data.keys()].filter(k=>k.startsWith('deploy-events/subscriptions/')).length,0);
 assert.equal((await deployRoute(await request('/api/deploy-events',{run_id:'124'}),env)).status,409);
 await eventRPC(owner,env,{method:'events/unsubscribe',params});
 const response=await worker.fetch(new Request('https://site/mcp',{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:1,method:'server/discover'})}),env);
 assert.deepEqual((await response.json()).result.capabilities,{tools:{},resources:{},events:{}});
 console.log('PASS: owner-only subscriptions, callback restrictions/signatures, idempotency, OIDC signature/claims, deduplication, unsubscribe, discovery');
}finally{globalThis.fetch=originalFetch;}
