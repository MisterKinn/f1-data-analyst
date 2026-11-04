import {test} from 'node:test';
import assert from 'node:assert/strict';
import {f1Access} from '../worker/personal-f1.js';
import {accountIdentity} from '../worker/accounts.js';
import {liveRoutes,cloudRequest} from '../worker/live.js';
const origin='https://example.test';
const request=(email,path='/live',options={})=>new Request(origin+path,{...options,headers:{'oai-authenticated-user-id':email,'oai-authenticated-user-email':email,origin,...options.headers}});
function fixture(){const data=new Map();return {data,env:{DEPLOY_OWNER_EMAIL:'owner@test',BUCKET:{get:async k=>data.has(k)?{json:async()=>JSON.parse(data.get(k))}:null,put:async(k,v)=>data.set(k,v),delete:async k=>data.delete(k)}}};}
test('crew stays shared, personal storage isolates users even without key hash',async()=>{
 const {env,data}=fixture();
 const a=await f1Access(request('a@test'),env),b=await f1Access(request('b@test'),env),owner=await f1Access(request('owner@test'),env);
 assert.equal(owner.mode,'crew');assert.equal(a.mode,'personal');
 await a.env.BUCKET.put('live/current.json','{"private":true}');
 assert.equal(await b.env.BUCKET.get('live/current.json'),null);assert.equal(await env.BUCKET.get('live/current.json'),null);
 const account=(await accountIdentity(request('b@test'),env,null)).account;
 await env.BUCKET.put('website-accounts/account/'+account.id+'.json',JSON.stringify({...account,liveAnalysisAccess:{revision:'1'}}));
 assert.equal((await f1Access(request('b@test'),env)).mode,'crew');
 env.LIVE_ANALYSIS_KEY_REVISION='2';assert.equal((await f1Access(request('b@test'),env)).mode,'personal');
 assert.equal((await f1Access(new Request(origin),env,{provider:'google',sub:'owner-google',email:'owner@test'})).mode,'crew');
});
test('personal cloud path cannot fall back to shared; login CSRF and crew login rejected',async()=>{
 const {env}=fixture();env.FASTF1_CLOUD_URL='https://collector.test';env.FASTF1_CLOUD_KEY='test-only';
 const a=await f1Access(request('a@test'),env);const old=globalThis.fetch;let url;
 globalThis.fetch=async u=>{url=String(u);return new Response('{}');};
 try{await cloudRequest(a.env,'/snapshot','GET');assert.equal(url,'https://collector.test/personal/'+a.accountId+'/snapshot');}finally{globalThis.fetch=old;}
 const bad=request('a@test','/api/live/f1/login',{method:'POST',headers:{origin:'https://evil.test'},body:'{}'});
 assert.equal((await liveRoutes(bad,env)).status,403);
 assert.equal((await liveRoutes(request('owner@test','/api/live/f1/login',{method:'POST',body:'{}'}),env)).status,409);
 assert.equal((await liveRoutes(new Request(origin+'/api/live/f1/login',{method:'POST'}),env)).status,401);
});
