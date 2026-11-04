import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {publishCatalog} from '../worker/mcp-updates.js';
import worker from '../worker/index.js';

const broken={get:async()=>{throw new Error('down');},put:async()=>{throw new Error('down');}};
const malformed={get:async()=>({json:async()=>{throw new SyntaxError('bad');}}),put:async()=>{}};

test('catalog version persistence failures do not throw',async()=>{
 for(const BUCKET of [broken,malformed,{get:async()=>null,put:async()=>{throw new Error('down');}}])
  assert.match(await publishCatalog({BUCKET},[{name:'a'}]),/^[0-9a-f]{64}$/);
});

test('tools/list still returns the static catalog when storage fails',async()=>{
 const r=await worker.fetch(new Request('https://kongboda-motorsports.vercel.app/mcp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list',params:{}})}),{BUCKET:broken});
 assert.equal(r.status,200);
 const names=(await r.json()).result.tools.map(t=>t.name);
 assert.equal(names[0],'kongboda_my_preferences');
});

class FakeRes extends EventEmitter{
 constructor(){super();this.chunks=[];this.headers={};this.writableEnded=false;this.flushed=0;}
 setHeader(k,v){this.headers[k]=v;}flushHeaders(){this.flushed++;}
 write(c){this.chunks.push({t:Date.now(),c:Buffer.from(c).toString()});return true;}
 end(){this.writableEnded=true;this.emit('finish');}
}

test('Vercel adapter streams SSE chunks before the stream closes',async()=>{
 process.env.FIREBASE_SERVICE_ACCOUNT??='';
 const {send}=await import('../api/index.js');
 const enc=new TextEncoder();let ctrl;
 const body=new ReadableStream({start(c){ctrl=c;c.enqueue(enc.encode(': hello\n\n'));}});
 const res=new FakeRes();
 const done=send(new Response(body,{headers:{'content-type':'text/event-stream'}}),res);
 await new Promise(r=>setTimeout(r,30));
 assert.equal(res.flushed,1);
 assert.equal(res.chunks.length,1,'first SSE comment must be written before close');
 assert.equal(res.writableEnded,false);
 ctrl.enqueue(enc.encode(': keepalive\n\n'));ctrl.close();await done;
 assert.deepEqual(res.chunks.map(x=>x.c),[': hello\n\n',': keepalive\n\n']);
 assert.equal(res.writableEnded,true);
});

test('Vercel adapter cancels the stream when the client disconnects',async()=>{
 const {send}=await import('../api/index.js');
 let cancelled=false;
 const body=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(': hi\n\n'));},cancel(){cancelled=true;}});
 const res=new FakeRes();const done=send(new Response(body),res);
 await new Promise(r=>setTimeout(r,20));res.emit('close');await done;
 assert.equal(cancelled,true);
});
