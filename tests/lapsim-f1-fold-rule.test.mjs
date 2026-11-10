import test from 'node:test';
import assert from 'node:assert/strict';
import {f1FoldStop} from '../scripts/sim/f1-fold-rule.mjs';
test('folds may finish before five rounds and one percent is a strict boundary',()=>{
  assert.equal(f1FoldStop([100],6).complete,false);
  assert.equal(f1FoldStop([100,99.5],6).stopReason,'score-decrease-below-one-percent');
  assert.equal(f1FoldStop([100,99],6).complete,false);
  assert.equal(f1FoldStop([100,101],6).complete,false);
  assert.equal(f1FoldStop([0,0],6).converged,true);
});
test('the main-round limit completes a fold without claiming numerical convergence',()=>{
  const r=f1FoldStop([100,90,80,70,60,50],6);
  assert.equal(r.complete,true);assert.equal(r.converged,false);assert.equal(r.stopReason,'main-round-limit');
  assert.equal(f1FoldStop([100,90,80,70,60,50],7).complete,false);
  assert.throws(()=>f1FoldStop([100],4));assert.throws(()=>f1FoldStop([NaN],6));
});
