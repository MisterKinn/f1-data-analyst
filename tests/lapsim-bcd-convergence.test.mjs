import test from 'node:test';
import assert from 'node:assert/strict';
import {fitJointBCD} from '../scripts/sim/joint-bcd.mjs';
import {TUM_2019} from '../worker/lapsim/cars.js';
import {simulateLap} from '../worker/lapsim/engine.js';

test('one-round warm starts preserve uninterrupted BCD with team adjustments', async () => {
  const track = {ds: 10, kappa: Float64Array.from({length: 120}, (_, i) => i % 60 > 40 ? 1 / 60 : 0)};
  const base = structuredClone(TUM_2019);
  const lap = simulateLap(track, base).lapTime;
  const groups = [{key: 2025, base, params: [{key: 'muY', path: 'muY', base: base.muY, min: 1, max: 3}],
    laps: [0, 1, 2].map(i => ({name: 'interlagos', track, lapSeconds: lap * (1 + i / 100), team: `team-${i}`, tau: i / 2}))}];
  const options = {rounds: 3, iters: 8, workers: 1, teams: true, trackDrag: false, wTime: 20, wSector: 2, wPrior: 8};
  const continuous = await fitJointBCD(groups, options);
  let resumed;
  for (let i = 0; i < 3; i++) resumed = await fitJointBCD(groups, {...options, rounds: 1,
    ...(resumed ? {startX: resumed.xs, startFactors: resumed.factors, startAdj: resumed.adj} : {})});
  assert.deepEqual(resumed, continuous);
});

const {bcdConverged} = await import('../scripts/sim/joint-bcd.mjs');
test('opt-in F1 convergence rejects score increases, the one-percent boundary and too few rounds', () => {
  assert.equal(bcdConverged([100, 99.9]), false);
  assert.equal(bcdConverged([110, 105, 102, 100, 99]), false);
  assert.equal(bcdConverged([110, 105, 102, 100, 99.01]), true);
  assert.equal(bcdConverged([110, 105, 102, 100, 100.01]), false);
  assert.equal(bcdConverged([0, 0, 0, 0, 0]), true);
});

test('explicitly disabled convergence is byte-identical to the legacy fit', async () => {
  const track = {ds: 10, kappa: Float64Array.from({length: 40}, (_, i) => i % 20 > 12 ? 1 / 60 : 0)};
  const base = structuredClone(TUM_2019);
  const groups = [{key: 2025, base, params: [], laps: [{name: 'test', track, lapSeconds: simulateLap(track, base).lapTime}]}];
  const options = {rounds: 2, iters: 2, workers: 1};
  assert.equal(JSON.stringify(await fitJointBCD(groups, options)), JSON.stringify(await fitJointBCD(groups, {...options, convergence: false})));
  const fit = await fitJointBCD(groups, {...options, convergence: true});
  assert.ok(Number.isFinite(fit.score));
});
