import test from 'node:test';
import assert from 'node:assert/strict';
import {createFirestoreBucket} from '../server/firestore-bucket.js';
import {diagnosticsSampleRate,sampleRequestMeasurement} from '../server/request-diagnostics.js';
import handler from '../api/index.js';
import {EventEmitter} from 'node:events';

test('asset hits and misses need no Firebase initialization or credentials',async()=>{
 for(const [path,status] of [['/assets/brand-icon.svg',200],['/assets/not-an-asset',404]]){
  const response=new EventEmitter(),chunks=[];response.headers={};response.setHeader=(k,v)=>response.headers[k]=v;
  response.write=chunk=>{chunks.push(chunk);return true;};response.end=()=>{response.writableEnded=true;};
  await handler({url:path,method:'GET',headers:{host:'fixture.invalid'}},response);
  assert.equal(response.statusCode,status);assert.ok(chunks.length);
 }
});

test('unconditional writes do not read; conditional writes still use transactions',async()=>{
 let reads=0,writes=0,transactions=0,value;
 const ref={async get(){reads++;return {exists:!!value,data:()=>value};},async set(next){writes++;value=next;}};
 const db={collection:()=>({doc:()=>ref}),async runTransaction(run){transactions++;return run({get:r=>r.get(),set:(r,v)=>r.set(v)});}};
 const bucket=createFirestoreBucket(db);
 await bucket.put('key','one');await bucket.put('key','two',{onlyIf:{}});
 assert.deepEqual([reads,writes,transactions],[0,2,0]);
 assert.equal(await bucket.put('key','three',{onlyIf:{etagMatches:'wrong'}}),null);
 assert.deepEqual([reads,writes,transactions],[1,2,1]);
 await bucket.put('key','three',{onlyIf:{etagMatches:value.etag}});
 assert.deepEqual([reads,writes,transactions],[2,3,2]);
 assert.equal(value.body,'three');
});

test('diagnostics default to 2%, support 1–5% or off, and record the sampling rate',()=>{
 for(const value of [undefined,'','bad','1','-1','0.001'])assert.equal(diagnosticsSampleRate(value),0.02);
 assert.equal(diagnosticsSampleRate('0.05'),0.05);
 assert.equal(diagnosticsSampleRate('0.01'),0.01);
 assert.equal(sampleRequestMeasurement('0',()=>0),null);
 assert.equal(sampleRequestMeasurement(undefined,()=>0.02),null);
 assert.equal(sampleRequestMeasurement(undefined,()=>0.019).sampleRate,0.02);
 const samples=Array.from({length:1000},(_,i)=>sampleRequestMeasurement(undefined,()=>i/1000)).filter(Boolean);
 assert.equal(samples.length,20);
});
