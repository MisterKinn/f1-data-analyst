import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analysisDemo,demoCases,demoClient,demoCss} from '../worker/homepage-examples.js';

test('shared website script safely skips examples on other pages',()=>{
 const previous=globalThis.document;
 try{globalThis.document={getElementById:()=>null};assert.doesNotThrow(()=>demoClient(demoCases));}
 finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});

test('homepage carries ten sourced reconstructions per tab and preserves measured telemetry',()=>{
 const html=analysisDemo();
 assert.equal((html.match(/data-card="live"/g)||[]).length,10);
 assert.equal((html.match(/data-card="post"/g)||[]).length,10);
 assert.equal((html.match(/data-nav=/g)||[]).length,4);
 assert.equal((html.match(/<div\b/g)||[]).length,(html.match(/<\/div>/g)||[]).length);
 assert.doesNotMatch(html,/class="choices"|data-demo-play|data-lucide/);
 assert.deepEqual([...html.matchAll(/data-telemetry="(.*?)"/g)].map(m=>m[1]),['speed','throttle','brake','delta','gear']);
 for(const card of html.matchAll(/<article\b[\s\S]*?<\/article>/g)){
  assert.match(card[0],/2026/);assert.match(card[0],/href="https:\/\//);
  if(card[0].includes('data-card="live"'))assert.match(card[0],/class="kb-series">(?:F1|WEC) ·/);
 }
 for(const driver of demoCases.drivers){
  assert.ok(driver.data.length>250);
  assert.ok(driver.data.every(p=>[0,1].includes(p.brake)));
 }
 assert.equal(demoCases.session_key,11400);
 assert.ok(demoCases.longrun.every(s=>s.points.some(p=>p.y!==null)));
 assert.ok(demoCases.longrun.some(s=>s.points.some(p=>p.y===null)));
 new Function('return '+demoClient.toString());
 assert.match(demoCss,/background:transparent;color:var\(--muted\)/);
});
