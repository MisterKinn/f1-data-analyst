import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyCollectorToken,resetOidcCache,COLLECTOR_WORKFLOW} from '../worker/github-oidc.js';
import {actionsPush} from '../worker/live.js';

const enc=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
async function signer(){
 const {publicKey,privateKey}=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk={...await crypto.subtle.exportKey('jwk',publicKey),kid:'k1'};
 const sign=async claims=>{const h=enc({alg:'RS256',kid:'k1'}),p=enc(claims);const s=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',privateKey,new TextEncoder().encode(h+'.'+p));return h+'.'+p+'.'+Buffer.from(s).toString('base64url');};
 return {sign,fetcher:async()=>new Response(JSON.stringify({keys:[jwk]}))};
}
const good=t=>({iss:'https://token.actions.githubusercontent.com',aud:'kongboda-motorsports',repository:'MisterKinn/f1-data-analyst',ref:'refs/heads/main',workflow_ref:COLLECTOR_WORKFLOW,exp:t+300});

test('only the main-branch collector workflow token is accepted',async()=>{
 resetOidcCache();const {sign,fetcher}=await signer();const now=Date.now(),t=Math.floor(now/1000);
 assert.equal((await verifyCollectorToken(await sign(good(t)),{fetcher,now})).repository,'MisterKinn/f1-data-analyst');
 for(const bad of [{repository:'evil/f1-data-analyst'},{ref:'refs/heads/feature'},{aud:'other'},{exp:t-1},{workflow_ref:'MisterKinn/f1-data-analyst/.github/workflows/x.yml@refs/heads/main'}])
  await assert.rejects(verifyCollectorToken(await sign({...good(t),...bad}),{fetcher,now}));
 const forged=(await sign(good(t))).split('.');forged[1]=enc({...good(t),repository:'x/y'});
 await assert.rejects(verifyCollectorToken(forged.join('.'),{fetcher,now}));
});

const snapshot={schema_version:1,producer:'fastf1-live-bridge',run_id:'r1',sequence:5,generated_at:'2026-11-06T15:40:00Z',last_message_at:'2026-11-06T15:39:59Z',connected:true,topics:{SessionInfo:{Key:9999,Name:'Practice 1'},SessionStatus:{Status:'Finalised'}},recent_events:[]};

test('actions push stores snapshots and marks finished windows',async()=>{
 const store=new Map();const BUCKET={get:async k=>store.has(k)?{json:async()=>JSON.parse(store.get(k))}:null,put:async(k,v)=>{store.set(k,v);}};
 const env={BUCKET},verify=async t=>{if(t!=='ok')throw Error('no');};
 const req=(m,q,body,token='ok')=>new Request('https://kongboda-motorsports.vercel.app/api/live/actions-push'+q,{method:m,headers:{authorization:'Bearer '+token,'content-type':'application/json'},body});
 assert.equal((await actionsPush(req('POST','?window=2026-21-1',JSON.stringify(snapshot),'bad'),env,{verify})).status,401);
 assert.equal((await actionsPush(req('GET','?window=../x'),env,{verify})).status,400);
 assert.equal((await (await actionsPush(req('GET','?window=2026-21-1'),env,{verify})).json()).done,false);
 assert.equal((await actionsPush(req('POST','?window=2026-21-1&final=1',JSON.stringify(snapshot)),env,{verify})).status,200);
 assert.equal(JSON.parse(store.get('live/current.json')).snapshot.sequence,5);
 assert.equal((await (await actionsPush(req('GET','?window=2026-21-1'),env,{verify})).json()).done,true);
 assert.equal((await actionsPush(req('POST','?window=2026-21-1',JSON.stringify({...snapshot,producer:'x'})),env,{verify})).status,400);
});

test('the final push is saved even right after another push',async()=>{
 const store=new Map();const BUCKET={get:async k=>store.has(k)?{json:async()=>JSON.parse(store.get(k))}:null,put:async(k,v)=>{store.set(k,v);}};
 const env={BUCKET},verify=async()=>{};
 const post=(q,s)=>actionsPush(new Request('https://kongboda-motorsports.vercel.app/api/live/actions-push'+q,{method:'POST',headers:{authorization:'Bearer ok','content-type':'application/json'},body:JSON.stringify(s)}),env,{verify});
 assert.equal((await post('?window=2026-21-1',snapshot)).status,200);
 const later={...snapshot,sequence:6,generated_at:'2026-11-06T15:40:01Z'};
 await post('?window=2026-21-1',later); // within 5 s: may be held back
 assert.equal(JSON.parse(store.get('live/current.json')).snapshot.sequence,5);
 const last={...snapshot,sequence:7,generated_at:'2026-11-06T15:40:02Z',topics:{...snapshot.topics,SessionStatus:{Status:'Finished'}}};
 assert.equal((await post('?window=2026-21-1&final=1',last)).status,200);
 assert.equal(JSON.parse(store.get('live/current.json')).snapshot.sequence,7);
 const closed={...last,sequence:8,generated_at:'2026-11-06T15:40:03Z'};
 assert.equal((await post('?window=2026-21-1&flush=1',closed)).status,200);
 assert.equal(JSON.parse(store.get('live/current.json')).snapshot.sequence,8);
});
