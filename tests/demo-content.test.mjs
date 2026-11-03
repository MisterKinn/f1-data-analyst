import {test} from 'node:test';
import assert from 'node:assert/strict';
import {demoCases} from '../worker/analysis-demo.js';
test('demo summaries remain traceable to the plotted samples and preserve all telemetry channels',()=>{
 for(const c of demoCases){
  assert.ok(c.questionKo&&c.questionEn&&c.answerKo&&c.answerEn);
  assert.equal(new URL(c.sourceUrl).protocol,'https:');
  if(c.chart==='line'&&!c.panels&&c.table?.headersEn.includes('Mean')){
   c.tracks.forEach((tr,i)=>{
    const ys=tr.points.map(p=>p[1]);
    assert.equal(c.table.rows[i][1],(ys.reduce((a,b)=>a+b,0)/ys.length).toFixed(3)+'s');
    assert.equal(c.table.rows[i][2],(ys.slice(-3).reduce((a,b)=>a+b,0)/3).toFixed(3)+'s');
   });
  }
  if(c.panels){assert.deepEqual(c.panels.map(p=>p.kind),['brake','delta']);assert.ok(c.tracks.every(t=>t.points.length>500));}
 }
 const mexico=demoCases.find(c=>c.chart==='map');
 assert.equal(mexico.table.rows.reduce((n,r)=>n+parseFloat(r[1]),0).toFixed(3),'4.304');
 assert.ok(mexico.factsEn.some(r=>r[1].includes('no live temperatures')));
});
