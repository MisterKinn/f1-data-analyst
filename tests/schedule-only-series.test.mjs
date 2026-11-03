import {test} from 'node:test';import assert from 'node:assert/strict';import worker from '../worker/index.js';
test('schedule-only series have verified sessions and local logos but no analysis routes',async()=>{
 const data=await (await worker.fetch(new Request('https://site/api/race-calendar'),{},{})).json();
 for(const series of ['24h-series','wrc','super-taikyu']){
  assert.ok(!data.supported.includes(series));assert.ok(data.events.some(e=>e.series===series&&e.sessions.length));
  const asset=await worker.fetch(new Request('https://site/assets/schedule/'+series),{},{});assert.equal(asset.status,200);assert.match(asset.headers.get('content-type'),/^image/);assert.ok((await asset.arrayBuffer()).byteLength>1000);
  const page=await worker.fetch(new Request('https://site/championships/'+series),{},{});assert.equal(page.status,404);
 }
 const japan=data.events.find(e=>e.id==='wrc-2026-05-28-rally-japan');assert.equal(japan.sessions.length,21);assert.equal(japan.sessions.at(-1).start,'2026-05-31T14:15:00+09:00');
});
