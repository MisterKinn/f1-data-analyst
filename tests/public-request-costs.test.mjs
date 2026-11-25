import test from 'node:test';
import assert from 'node:assert/strict';
import {cachedPublished,MAX_STALE,PUBLISHED_TTL} from '../worker/published-cache.js';

const fixture=()=>{
 let reads=0,writes=0,fail=false;const values=new Map();
 const bucket={async get(key){reads++;await Promise.resolve();if(fail)throw Error('store unavailable');const body=values.get(key);return body?{json:async()=>JSON.parse(body)}:null;},async put(key,body){writes++;if(fail)throw Error('store unavailable');values.set(key,body);}};
 return {env:{BUCKET:bucket},values,get reads(){return reads;},get writes(){return writes;},fail(){fail=true;}};
};
test('public result burst shares one read and load; warm requests read zero documents',async()=>{
 const f=fixture();let loads=0;
 const run=()=>cachedPublished(f.env,'race-results/test',async()=>{loads++;return {rows:[{lap:90}]};},{now:()=>1000});
 const results=await Promise.all(Array.from({length:20},run));
 assert.deepEqual([f.reads,f.writes,loads],[1,1,1]);
 results[0].rows[0].lap=1;assert.equal(results[1].rows[0].lap,90);
 for(let i=0;i<20;i++){const hit=await run();assert.equal(hit.cached,true);assert.equal(hit.rows[0].lap,90);hit.rows[0].lap=2;}
 assert.deepEqual([f.reads,f.writes,loads],[1,1,1]);
});
test('public cache expires on original timestamp, survives database outage, rejects expired fallback',async()=>{
 const f=fixture();let time=1000;const options={now:()=>time};
 await cachedPublished(f.env,'fixture',async()=>({rows:[1]}),options);f.fail();
 time+=PUBLISHED_TTL;
 const old=await cachedPublished(f.env,'fixture',async()=>{throw Error('upstream unavailable');},options);
 assert.equal(old.stale,true);assert.equal(old.cache_age_seconds,300);
 time=1000+MAX_STALE;
 await assert.rejects(cachedPublished(f.env,'fixture',async()=>{throw Error('expired');},options),/expired/);
 const recovered=await cachedPublished(f.env,'fixture',async()=>({rows:[2]}),options);
 assert.deepEqual(recovered.rows,[2]);assert.equal(recovered.stale,false);
});
test('stale expiry is checked after a slow upstream failure, not before it',async()=>{
 const f=fixture();let time=1000;const options={now:()=>time};
 await cachedPublished(f.env,'fixture',async()=>({rows:[1]}),options);
 time=1000+MAX_STALE-1;
 await assert.rejects(cachedPublished(f.env,'fixture',async()=>{time+=2;throw Error('too late');},options),/too late/);
});
test('bindings are isolated and failed requests can retry',async()=>{
 const a=fixture(),b=fixture();
 await cachedPublished(a.env,'fixture',async()=>({rows:['a']}));
 await assert.rejects(cachedPublished(b.env,'fixture',async()=>{throw Error('first');}),/first/);
 assert.deepEqual((await cachedPublished(b.env,'fixture',async()=>({rows:['b']}))).rows,['b']);
});
test('memory entry count and byte budgets evict old public records',async()=>{
 for(const large of [false,true]){
  const f=fixture(),count=large?7:65,payload=large?'x'.repeat(700000):'small';
  for(let i=0;i<count;i++)await cachedPublished(f.env,String(i),async()=>({payload}),{now:()=>1000});
  const before=f.reads;
  await cachedPublished(f.env,'0',async()=>{throw Error('persisted result expected');},{now:()=>1000});
  assert.equal(f.reads,before+1);
 }
});
