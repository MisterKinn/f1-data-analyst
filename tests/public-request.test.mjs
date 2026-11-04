import{test}from'node:test';
import assert from'node:assert/strict';
import{publicJsonRequest}from'../worker/public-request.js';
test('public reads keep HTTP errors available to caller and parse the body',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({error:'unavailable'}),{status:503}));
 const {response,data}=await publicJsonRequest('/api/example');assert.equal(response.status,503);assert.equal(data.error,'unavailable');
});
test('deadline covers a body stalled after headers, and is distinct from selection cancellation',async t=>{
 t.mock.method(globalThis,'fetch',async(_,{signal})=>({json:()=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))}));
 await assert.rejects(publicJsonRequest('/slow-body',{timeoutMs:10}),{name:'TimeoutError'});
 const controller=new AbortController();const pending=publicJsonRequest('/cancel',{signal:controller.signal});await Promise.resolve();controller.abort();await assert.rejects(pending,{name:'AbortError'});
});
test('a successful read removes its cancellation subscription',async t=>{
 const controller=new AbortController();const remove=t.mock.method(controller.signal,'removeEventListener');
 t.mock.method(globalThis,'fetch',async()=>Response.json({ok:true}));
 await publicJsonRequest('/ok',{signal:controller.signal});assert.equal(remove.mock.callCount(),1);
});

test('both public assets can execute in a single document without duplicate lexical declarations',async()=>{
 const {websiteRoute}=await import('../worker/website.js');
 const paths=['/assets/race-features.js','/assets/website.js'];
 const scripts=await Promise.all(paths.map(path=>websiteRoute(new Request('https://preview.invalid'+path)).text()));
 assert.doesNotThrow(()=>new Function(scripts.join('\n')));
});
