import {test} from 'node:test';
import assert from 'node:assert/strict';
import {REAL_F1_LINE_DEMOS} from '../worker/demo-telemetry-data.js';
test('qualifying examples expose binary braking and a bounded comparison-minus-reference delta',()=>{
 const examples=REAL_F1_LINE_DEMOS.filter(c=>c.panels);
 assert.equal(examples.length,3);
 for(const example of examples){
  const brake=example.panels.find(p=>p.kind==='brake'),delta=example.panels.find(p=>p.kind==='delta');
  assert.equal(brake.tracks.length,2);assert.ok(delta.reference&&delta.comparison);
  for(const trace of brake.tracks){assert.ok(trace.points.some(p=>p[1]===1));assert.ok(trace.points.every(p=>[0,1].includes(p[1])));}
  for(const panel of [example,...example.panels])for(const trace of panel.tracks){
   assert.match(trace.color,/^#[0-9A-F]{6}$/i);
   assert.ok(trace.points.every((p,i)=>p.every(Number.isFinite)&&(!i||p[0]>trace.points[i-1][0])));
  }
  const end=Math.min(...brake.tracks.map(t=>t.points.at(-1)[0]));
  assert.ok(delta.tracks[0].points.at(-1)[0]<=end+0.001);
 }
 const hadjar=examples.find(c=>c.tracks[0].name.includes('Hadjar'));
 assert.ok(hadjar.panels.find(p=>p.kind==='delta').tracks[0].points.at(-1)[1]>0,'Leclerc is slower than Hadjar at the final shared sample');
});
