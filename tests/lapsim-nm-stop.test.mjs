import test from 'node:test';
import assert from 'node:assert/strict';
import {nelderMead, fitSeason, holdout} from '../scripts/sim/calibrate-lib.mjs';
import {wecNmStop} from '../scripts/sim/wec-nm-stop.mjs';
import {SERIES} from '../worker/lapsim/series.js';

test('unset WEC stop preserves legacy optimizer results, calls and logs', () => {
  const a = [], b = [], ea = [], eb = [];
  const f = (x, calls) => { calls.push(x.slice()); return (x[0] - 2) ** 2; };
  const x = nelderMead(v => f(v, a), [0], {iters: 20, trace: e => ea.push(e)});
  const y = nelderMead(v => f(v, b), [0], {iters: 20, trace: e => eb.push(e), stop: wecNmStop({LAPSIM_WEC_NM_CAP: '1000'})});
  assert.deepEqual(x, y); assert.deepEqual(a, b); assert.deepEqual(ea, eb);
});
test('flat objective alone cannot stop a large simplex', () => {
  const events = [];
  nelderMead(() => 1, [0, 0], {step: 1, stop: {tolerance: 1e-6, cap: 100, window: 10}, trace: e => events.push(e)});
  const end = events.at(-1);
  assert.equal(end.stopReason, 'tolerance'); assert.ok(end.iteration >= 20);
  assert.ok(end.simplexSize < 1e-6); assert.equal(end.relativeObjectiveChange, 0);
});
test('small simplex alone cannot stop a changing objective', () => {
  const events = [];
  nelderMead(x => 1e12 * x[0], [0], {step: 1e-10,
    stop: {tolerance: 1e-4, cap: 10, window: 1}, trace: e => events.push(e)});
  const end = events.at(-1);
  assert.equal(end.capHit, true);
  assert.ok(end.simplexSize < 1e-4);
  assert.ok(end.relativeObjectiveChange >= 1e-4);
});
test('both tolerances converge on a known quadratic and report cap exhaustion separately', () => {
  for (const tolerance of [1e-4, 1e-6]) {
    const events = [];
    const fit = nelderMead(x => (x[0] - 0.2) ** 2 + (x[1] + 0.4) ** 2, [0, 0],
      {stop: {tolerance, cap: 2000, window: 10}, trace: e => events.push(e)});
    assert.ok(Math.abs(fit.x[0] - 0.2) < tolerance * 2);
    assert.ok(Math.abs(fit.x[1] + 0.4) < tolerance * 2);
    assert.equal(events.at(-1).capHit, false);
  }
  const events = [];
  nelderMead(x => -x[0], [0], {stop: {tolerance: 1e-6, cap: 12, window: 10}, trace: e => events.push(e)});
  assert.equal(events.at(-1).iteration, 12); assert.equal(events.at(-1).capHit, true);
});
test('same optional rule reaches the main fit and each held-out fold', () => {
  const track = {ds: 10, kappa: Float64Array.from({length: 50}, (_, i) => i > 15 && i < 30 ? 0.02 : 0)};
  const laps = ['a', 'b', 'c'].map(name => ({name, track, lapSeconds: 30, grip: 1}));
  const car = SERIES.wec.classes.lmgt3.prior, events = [];
  const options = {iters: 1, stop: {tolerance: 1e-6, cap: 100, window: 10}, trace: e => events.push(e)};
  fitSeason(laps, car, [], options);
  holdout(laps, car, [], {...options, folds: 99, gripFor: () => 1});
  const ends = events.filter(e => e.event === 'end');
  assert.equal(ends.length, 4);
  assert.ok(ends.every(e => e.iteration === 10 && e.stopReason === 'tolerance'));
  assert.deepEqual(ends.slice(1).map(e => e.heldOut), [['a'], ['b'], ['c']]);
});
test('invalid optional settings fail before a fit', () => {
  for (const value of ['0', '-1', 'NaN', 'Infinity']) assert.throws(() => wecNmStop({LAPSIM_WEC_NM_TOL: value}), /positive/);
  for (const value of ['1.5', '0', '9', 'NaN']) assert.throws(() => wecNmStop({LAPSIM_WEC_NM_TOL: '1e-4', LAPSIM_WEC_NM_CAP: value}), /integer/);
  assert.deepEqual(wecNmStop({LAPSIM_WEC_NM_TOL: '1e-4'}), {tolerance: 1e-4, cap: 2000, window: 10});
});
