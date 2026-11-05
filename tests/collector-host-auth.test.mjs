import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyHostSignature,hostMessage,hostCollectorRoute} from '../worker/collector-auth.js';
import {COLLECTOR_HOSTS} from '../worker/collector-hosts.js';

const b64u=b=>Buffer.from(b).toString('base64url');
async function host(name='home-pc'){
 const {publicKey,privateKey}=await crypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
 const key=b64u(await crypto.subtle.exportKey('raw',publicKey));
 const sign=async(method,url,body='',ts=Math.floor(Date.now()/1000))=>{const u=new URL(url);const msg=hostMessage(method,u.pathname+u.search,String(ts),createHash('sha256').update(body).digest('hex'));return `KongbodaHost name=${name},ts=${ts},sig=${b64u(await crypto.subtle.sign({name:'Ed25519'},privateKey,new TextEncoder().encode(msg)))}`;};
 return {hosts:[{name,key}],sign};
}
const snapshot={schema_version:1,producer:'fastf1-live-bridge',run_id:'r1',sequence:5,generated_at:'2026-11-06T15:40:00Z',last_message_at:'2026-11-06T15:39:59Z',connected:true,topics:{SessionInfo:{Key:9999,Name:'Practice 1'},SessionStatus:{Status:'Finalised'}},recent_events:[]};
const URL_='https://kongboda-motorsports.vercel.app/api/live/actions-push?window=2026-21-1&final=1';

test('registered host keys are well-formed public keys',()=>{
 for(const h of COLLECTOR_HOSTS){assert.match(h.name,/^[a-z0-9-]{2,40}$/);assert.equal(Buffer.from(h.key,'base64url').length,32);}
 assert.equal(new Set(COLLECTOR_HOSTS.map(h=>h.name)).size,COLLECTOR_HOSTS.length);
});

test('a signed home host can push; tampering and unknown hosts are rejected',async()=>{
 const {hosts,sign}=await host();const store=new Map();
 const env={BUCKET:{get:async k=>store.has(k)?{json:async()=>JSON.parse(store.get(k))}:null,put:async(k,v)=>{store.set(k,v);}}};
 const body=JSON.stringify(snapshot);
 const req=(auth,b=body,url=URL_)=>new Request(url,{method:'POST',headers:{authorization:auth,'content-type':'application/json'},body:b});
 assert.equal((await hostCollectorRoute(req(await sign('POST',URL_,body)),env,{hosts})).status,200);
 assert.equal(JSON.parse(store.get('live/current.json')).snapshot.sequence,5);
 const other=JSON.stringify({...snapshot,sequence:9});
 assert.equal((await hostCollectorRoute(req(await sign('POST',URL_,body),other),env,{hosts})).status,401,'body swapped');
 assert.equal((await hostCollectorRoute(req(await sign('POST',URL_,body),body,URL_.replace('2026-21-1','2026-21-2')),env,{hosts})).status,401,'window swapped');
 assert.equal((await hostCollectorRoute(req(await sign('POST',URL_,body,Math.floor(Date.now()/1000)-3600)),env,{hosts})).status,401,'stale');
 const stranger=await host('stranger');
 assert.equal((await hostCollectorRoute(req(await stranger.sign('POST',URL_,body)),env,{hosts})).status,401,'unregistered');
 const get=new Request('https://kongboda-motorsports.vercel.app/api/live/actions-push?window=2026-21-1',{headers:{authorization:await sign('GET','https://kongboda-motorsports.vercel.app/api/live/actions-push?window=2026-21-1')}});
 const status=await (await hostCollectorRoute(get,env,{hosts})).json();
 assert.equal(status.done,true);assert.ok(status.latest_received_at);
});

test('signature check is exact on the signed message',async()=>{
 const {hosts,sign}=await host();const header=await sign('GET','https://x.app/a?b=1');
 await verifyHostSignature(header,{method:'GET',pathAndQuery:'/a?b=1',hosts});
 await assert.rejects(verifyHostSignature(header,{method:'POST',pathAndQuery:'/a?b=1',hosts}));
});

test('bearer requests are left to the existing OIDC handler',async()=>{
 const r=new Request('https://x.app/api/live/actions-push?window=2026-21-1',{headers:{authorization:'Bearer t'}});
 assert.equal(await hostCollectorRoute(r,{}),null);
 assert.equal(await hostCollectorRoute(new Request('https://x.app/api/other',{headers:{authorization:'KongbodaHost name=a'}}),{}),null);
});
