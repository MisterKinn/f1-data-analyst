import {test} from 'node:test';
import assert from 'node:assert/strict';
import {f1Access} from '../worker/personal-f1.js';
import {accountIdentity} from '../worker/accounts.js';
import {liveRoutes,cloudRequest} from '../worker/live.js';
const origin='https://example.test';
const request=(email,path='/live',options={})=>new Request(origin+path,{...options,headers:{'oai-authenticated-user-id':email,'oai-authenticated-user-email':email,origin,...options.headers}});
function fixture(){const data=new Map();return {data,env:{DEPLOY_OWNER_EMAIL:'owner@test',BUCKET:{get:async k=>data.has(k)?{json:async()=>JSON.parse(data.get(k))}:null,put:async(k,v)=>data.set(k,v),delete:async k=>data.delete(k)}}};}
test('every signed-in account reads the shared F1 data; crew keep collector controls',async()=>{
 const {env}=fixture();
 const a=await f1Access(request('a@test'),env),b=await f1Access(request('b@test'),env),owner=await f1Access(request('owner@test'),env);
 assert.equal(owner.mode,'crew');assert.equal(a.mode,'member');assert.equal(b.mode,'member');
 await env.BUCKET.put('live/current.json','{"shared":true}');
 assert.deepEqual(await (await a.env.BUCKET.get('live/current.json')).json(),{shared:true});
 assert.deepEqual(await (await b.env.BUCKET.get('live/current.json')).json(),{shared:true});
 const account=(await accountIdentity(request('b@test'),env,null)).account;
 await env.BUCKET.put('website-accounts/account/'+account.id+'.json',JSON.stringify({...account,liveAnalysisAccess:{revision:'1'}}));
 assert.equal((await f1Access(request('b@test'),env)).mode,'crew');
 env.LIVE_ANALYSIS_KEY_REVISION='2';assert.equal((await f1Access(request('b@test'),env)).mode,'member');
 assert.equal((await f1Access(new Request(origin),env,{provider:'google',sub:'owner-google',email:'owner@test'})).mode,'crew');
});
test('members cannot operate the collector and need no personal F1 login',async()=>{
 const {env}=fixture();env.FASTF1_CLOUD_URL='https://collector.test';env.FASTF1_CLOUD_KEY='test-only';
 assert.equal((await liveRoutes(request('a@test','/api/live/cloud/stop',{method:'POST'}),env)).status,403);
 assert.equal((await liveRoutes(request('a@test','/api/live/f1/login',{method:'POST',body:'{}'}),env)).status,409);
 const bad=request('a@test','/api/live/f1/login',{method:'POST',headers:{origin:'https://evil.test'},body:'{}'});
 assert.equal((await liveRoutes(bad,env)).status,403);
 assert.equal((await liveRoutes(new Request(origin+'/api/live/f1/login',{method:'POST'}),env)).status,401);
});
