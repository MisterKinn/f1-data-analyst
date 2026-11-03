import {test} from 'node:test';import assert from 'node:assert/strict';
import {eventRPC,queueCrewEvent,deliverCrewEvents,CREW_EVENT_NAME} from '../worker/deploy_events.js';
test('owner-only crew subscriptions deliver only identifiers, deduplicate and retain failures',async()=>{
 const data=new Map(),env={DEPLOY_OWNER_EMAIL:'owner@example.com',BUCKET:{get:async k=>data.has(k)?{json:async()=>JSON.parse(data.get(k))}:null,put:async(k,v)=>data.set(k,v),delete:async k=>data.delete(k),list:async({prefix})=>({objects:[...data.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key})),truncated:false})}};
 const owner=new Request('https://site/mcp',{headers:{'oai-authenticated-user-id':'owner','oai-authenticated-user-email':'owner@example.com'}}),viewer=new Request('https://site/mcp');
 const params={name:CREW_EVENT_NAME,arguments:{},delivery:{mode:'webhook',url:'https://chatgpt.com/test-crew',secret:'whsec_'+Buffer.alloc(32,5).toString('base64')}};
 await assert.rejects(eventRPC(viewer,env,{method:'events/subscribe',params}));
 const real=globalThis.fetch;let events=[],fail=false;globalThis.fetch=async(url,opts)=>{const b=JSON.parse(opts.body);assert.equal(url,params.delivery.url);if(b.type==='verification')return Response.json({challenge:b.challenge});events.push(b);return new Response('',{status:fail?503:200});};
 try{
  await eventRPC(owner,env,{method:'events/subscribe',params});
  await queueCrewEvent(env,'account-one',1);await deliverCrewEvents(env);assert.equal(events.length,1);assert.equal(events[0].name,CREW_EVENT_NAME);assert.deepEqual(Object.keys(events[0].data).sort(),['account_id','registered_at']);
  await queueCrewEvent(env,'account-one',1);await deliverCrewEvents(env);assert.equal(events.length,1);
  fail=true;await queueCrewEvent(env,'account-two',2);await deliverCrewEvents(env);assert.ok(data.has('crew-events/pending/crew_account-two.json'));
  fail=false;await deliverCrewEvents(env);assert.equal(data.has('crew-events/pending/crew_account-two.json'),false);
 }finally{globalThis.fetch=real;}
});
