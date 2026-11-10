import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, rmSync, existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {nelderMead, holdout} from '../scripts/sim/calibrate-lib.mjs';
import {objectiveTrace} from '../scripts/sim/objective-trace.mjs';
import {SERIES} from '../worker/lapsim/series.js';
test('observer preserves optimizer result and exact objective call sequence', () => {
  const calls = [], loggedCalls = [], events = [];
  const objective = (x, list) => (list.push(x.slice()), (x[0]-0.2)**2 + (x[1]+0.4)**2);
  const a = nelderMead(x=>objective(x,calls),[0,0],{iters:80});
  const b = nelderMead(x=>objective(x,loggedCalls),[0,0],{iters:80,trace:e=>events.push(e)});
  assert.equal(JSON.stringify(a),JSON.stringify(b)); assert.deepEqual(calls,loggedCalls);
  assert.equal(events.at(-1).event,'end'); assert.equal(events.at(-1).objective,b.value);
  assert.ok(events.filter(e=>e.event==='iteration').every((e,i,a)=>!i||e.objective<=a[i-1].objective));
});
test('fold logs identify held-out tracks and do not change predictions', () => {
  const track={ds:10,kappa:Float64Array.from({length:50},(_,i)=>i>15&&i<30?0.02:0)};
  const laps=['a','b','c'].map(name=>({name,track,lapSeconds:30,grip:1}));
  const car=SERIES.wec.classes.lmgt3.prior, events=[];
  const options={iters:2,folds:99,gripFor:()=>1};
  const a=holdout(laps,car,[],options),b=holdout(laps,car,[],{...options,trace:e=>events.push(e)});
  assert.equal(JSON.stringify(a),JSON.stringify(b));
  assert.deepEqual(events.filter(e=>e.event==='end').map(e=>e.heldOut),[['a'],['b'],['c']]);
  for(const e of events)assert.ok(e.trainTracks.every(t=>!e.heldOut.includes(t)));
});
test('file logging is opt-in, valid JSONL, and refuses to overwrite evidence', () => {
  const dir=mkdtempSync(join(tmpdir(),'lapsim-objective-'));
  try {const file=join(dir,'trace.jsonl');assert.equal(objectiveTrace(),undefined);assert.equal(existsSync(file),false);
    const log=objectiveTrace(file);log({group:'wec-lmh/2025',fold:0,restart:0,objective:1.2});
    assert.equal(JSON.parse(readFileSync(file,'utf8')).objective,1.2);assert.throws(()=>objectiveTrace(file),/EEXIST/);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
